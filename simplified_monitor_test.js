#!/usr/bin/env node

const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

// Constants from BTICARD.H and BTI429.H
const CARDNUM = 0;
const CORENUM = 0;
const XMT_CHAN = 12;
const RCV_CHAN = 0;

// Constants for configuration
const CHCFG429_HIGHSPEED = 0x00000001;
const CHCFG429_AUTOSPEED = 0x00000004;
const MSGCRT429_DEFAULT = 0x00000000;
const SDIALL = 0x0F;

// Constants for labels (octal)
const COMP_AIRSPEED_LABEL = 0o206;
const TOT_AIR_TEMP_LABEL = 0o211;
const ALTITUDE_RATE_LABEL = 0o212;

console.log("\n    **********************************************************************");
console.log("    *                                                                    *");
console.log("    *  Simplified UA2430 Transmit/Receive Test                           *");
console.log("    *  Based on Astronics Advanced Electronic Systems Corp. example      *");
console.log("    *                                                                    *");
console.log("    **********************************************************************");
console.log("");

try {
    // Open the card with the specified card number
    console.log(`Opening ARINC 429 card #${CARDNUM}...`);
    const hCard = ua2430.openCardNum(CARDNUM);
    if (!hCard) {
        console.error(`Error: Either card number ${CARDNUM} is not present, or an error occurred opening the card.`);
        process.exit(1);
    }

    // Open a handle to the core
    console.log(`Opening ARINC 429 core #${CORENUM}...`);
    const hCore = ua2430.openCore(hCard, CORENUM);
    if (!hCore) {
        console.error(`Error: Failed to open core #${CORENUM}.`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    console.log(`Using ARINC 429 core #${CORENUM}`);
    console.log(`Using receive channel #${RCV_CHAN}`);
    console.log(`Using transmit channel #${XMT_CHAN}`);
    console.log();

    // Reset the card
    ua2430.resetCard(hCore);

    // Configure rcvchan for automatic speed detection
    console.log(`Configuring channel ${RCV_CHAN} for automatic speed detection...`);
    let errval = ua2430.config429(CHCFG429_AUTOSPEED, RCV_CHAN, hCore);
    if (errval < 0) {
        console.error(`Error: An error was encountered (${errval}) while configuring channel #${RCV_CHAN}.`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Configure xmtchan to transmit at high speed
    console.log(`Configuring channel ${XMT_CHAN} for high speed transmission...`);
    errval = ua2430.config429(CHCFG429_HIGHSPEED, XMT_CHAN, hCore);
    if (errval < 0) {
        console.error(`Error: An error was encountered (${errval}) while configuring channel #${XMT_CHAN}.`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Create transmit messages for each of the labels
    console.log("Creating message structures...");
    const comp_airspeed_addr = ua2430.BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
    const tot_air_temp_addr = ua2430.BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
    const altitude_rate_addr = ua2430.BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);

    // Build the transmission schedule using interval information
    console.log("Building transmission schedule...");
    errval = ua2430.buildSchedule3(
        hCore, XMT_CHAN,
        comp_airspeed_addr, 250, 500,
        tot_air_temp_addr, 250, 500,
        altitude_rate_addr, 100, 200
    );

    if (errval < 0) {
        console.error(`Error: An error was encountered (${errval}) while building a schedule on channel #${XMT_CHAN}.`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Create receive filters for our transmitted labels
    console.log("Setting up receive filters...");
    const msgdefault_addr = ua2430.filterDefault(MSGCRT429_DEFAULT, RCV_CHAN, hCore);
    const rcv_airspeed_addr = ua2430.filterSet(MSGCRT429_DEFAULT, COMP_AIRSPEED_LABEL, SDIALL, RCV_CHAN, hCore);
    const rcv_temp_addr = ua2430.filterSet(MSGCRT429_DEFAULT, TOT_AIR_TEMP_LABEL, SDIALL, RCV_CHAN, hCore);
    const rcv_altrate_addr = ua2430.filterSet(MSGCRT429_DEFAULT, ALTITUDE_RATE_LABEL, SDIALL, RCV_CHAN, hCore);

    // Initialize the three message records
    let comp_airspeed_data = ua2430.BTI429_FldPutLabel(0, COMP_AIRSPEED_LABEL);
    let tot_air_temp_data = ua2430.BTI429_FldPutLabel(0, TOT_AIR_TEMP_LABEL);
    let altitude_rate_data = ua2430.BTI429_FldPutLabel(0, ALTITUDE_RATE_LABEL);

    // Set the BNR mantissa values
    comp_airspeed_data = ua2430.BTI429_BNRPutMant(comp_airspeed_data, 0, 14, 0);
    tot_air_temp_data = ua2430.BTI429_BNRPutMant(tot_air_temp_data, 0, 11, 0);
    altitude_rate_data = ua2430.BTI429_BNRPutMant(altitude_rate_data, 0, 16, 0);

    // Write the initial data to the message records
    ua2430.BTI429_MsgDataWr(comp_airspeed_data, comp_airspeed_addr, hCore);
    ua2430.BTI429_MsgDataWr(tot_air_temp_data, tot_air_temp_addr, hCore);
    ua2430.BTI429_MsgDataWr(altitude_rate_data, altitude_rate_addr, hCore);

    // Start operation of the card
    console.log("Starting card operation...");
    ua2430.startCard(hCore);

    console.log("\nTesting transmit and receive for 30 seconds...");
    console.log("Press Ctrl+C to exit early\n");
    
    // Periodically increment data values to show change
    let dataValue = 0;
    
    const updateInterval = setInterval(() => {
        dataValue++;
        
        // Update the data in each message with incrementing values
        comp_airspeed_data = ua2430.BTI429_BNRPutMant(
            ua2430.BTI429_FldPutLabel(0, COMP_AIRSPEED_LABEL),
            dataValue, 14, 0
        );
        
        tot_air_temp_data = ua2430.BTI429_BNRPutMant(
            ua2430.BTI429_FldPutLabel(0, TOT_AIR_TEMP_LABEL),
            dataValue + 100, 11, 0
        );
        
        altitude_rate_data = ua2430.BTI429_BNRPutMant(
            ua2430.BTI429_FldPutLabel(0, ALTITUDE_RATE_LABEL),
            dataValue + 200, 16, 0
        );
        
        // Write updated data to transmit messages
        ua2430.BTI429_MsgDataWr(comp_airspeed_data, comp_airspeed_addr, hCore);
        ua2430.BTI429_MsgDataWr(tot_air_temp_data, tot_air_temp_addr, hCore);
        ua2430.BTI429_MsgDataWr(altitude_rate_data, altitude_rate_addr, hCore);
        
        console.log(`\nUpdate #${dataValue}:`);
        console.log(`Transmitted airspeed: 0x${comp_airspeed_data.toString(16).padStart(8, '0')}`);
        
        // Read from receive filter addresses to see if data is being received
        try {
            const rcv_airspeed = ua2430.BTI429_MsgDataRd(rcv_airspeed_addr, hCore);
            const rcv_temp = ua2430.BTI429_MsgDataRd(rcv_temp_addr, hCore);
            const rcv_altrate = ua2430.BTI429_MsgDataRd(rcv_altrate_addr, hCore);
            
            console.log(`Received data:`);
            console.log(`  Airspeed: 0x${rcv_airspeed.toString(16).padStart(8, '0')}`);
            console.log(`  Air temp: 0x${rcv_temp.toString(16).padStart(8, '0')}`);
            console.log(`  Alt rate: 0x${rcv_altrate.toString(16).padStart(8, '0')}`);
            
            const receivedOk = (rcv_airspeed !== 0 || rcv_temp !== 0 || rcv_altrate !== 0);
            console.log(`Receive status: ${receivedOk ? 'RECEIVING DATA' : 'NO DATA RECEIVED'}`);
        } catch (err) {
            console.error(`Error reading receive data: ${err.message}`);
        }
    }, 1000);
    
    // Run for 30 seconds then clean up
    setTimeout(() => {
        // Stop our intervals
        clearInterval(updateInterval);
        
        // Stop the card
        console.log("\nStopping card operation...");
        ua2430.stopCard(hCore);
        
        // Close the card
        console.log("Closing card...");
        ua2430.closeCard(hCard);
        
        console.log("Test completed.");
        process.exit(0);
    }, 30000);

} catch (e) {
    console.error("\nException:", e.message);
    console.error("Stack:", e.stack);
    process.exit(1);
} 
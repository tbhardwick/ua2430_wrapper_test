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
const CHCFG429_SEQALL = 0x00000100; // Record all data
const MSGCRT429_DEFAULT = 0x00000000;
const MSGCRT429_SEQ = 0x00000010;
const SDIALL = 0x0F;
const SEQCFG_DEFAULT = 0x00000000;

// For sequential monitor
const SEQ_BUF_SIZE = 2048;

// Constants for labels (octal)
const COMP_AIRSPEED_LABEL = 0o206;
const TOT_AIR_TEMP_LABEL = 0o211;
const ALTITUDE_RATE_LABEL = 0o212;
const LATITUDE_LABEL = 0o310;
const LONGITUDE_LABEL = 0o311;

// Constants for sequential monitor record
const MSGACT429_CHMASK = 0x1F00;
const MSGACT429_CHSHIFT = 8;
const SEQVER_1 = 1;

console.log("\n    **********************************************************************");
console.log("    *                                                                    *");
console.log("    *  JavaScript version of EXAMP3.C                                    *");
console.log("    *  Based on Astronics Advanced Electronic Systems Corp. example      *");
console.log("    *                                                                    *");
console.log("    *  BTI429 Example 3 - JS Version                                     *");
console.log("    *  \"Program for monitor example.\"                                    *");
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

    // Configure xmtchan to transmit at high speed with all data recorded
    console.log(`Configuring channel ${XMT_CHAN} for high speed transmission with sequential recording...`);
    errval = ua2430.config429(CHCFG429_HIGHSPEED | CHCFG429_SEQALL, XMT_CHAN, hCore);
    if (errval < 0) {
        console.error(`Error: An error was encountered (${errval}) while configuring channel #${XMT_CHAN}.`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Create messages for each of the labels we are transmitting
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

    // Initialize the three message records
    let comp_airspeed_data = ua2430.BTI429_FldPutLabel(0, COMP_AIRSPEED_LABEL);
    let tot_air_temp_data = ua2430.BTI429_FldPutLabel(0, TOT_AIR_TEMP_LABEL);
    let altitude_rate_data = ua2430.BTI429_FldPutLabel(0, ALTITUDE_RATE_LABEL);

    // Set the BNR mantissa values
    comp_airspeed_data = ua2430.BTI429_BNRPutMant(comp_airspeed_data, 0, 14, 0);
    tot_air_temp_data = ua2430.BTI429_BNRPutMant(tot_air_temp_data, 0, 11, 0);
    altitude_rate_data = ua2430.BTI429_BNRPutMant(altitude_rate_data, 0, 16, 0);

    // Write the data to the message records
    ua2430.BTI429_MsgDataWr(comp_airspeed_data, comp_airspeed_addr, hCore);
    ua2430.BTI429_MsgDataWr(tot_air_temp_data, tot_air_temp_addr, hCore);
    ua2430.BTI429_MsgDataWr(altitude_rate_data, altitude_rate_addr, hCore);

    // Set up filters for the receive channel
    console.log("Setting up receive filters...");
    const msgdefault_addr = ua2430.filterDefault(MSGCRT429_DEFAULT, RCV_CHAN, hCore);
    const latitude_addr = ua2430.filterSet(MSGCRT429_SEQ, LATITUDE_LABEL, SDIALL, RCV_CHAN, hCore);
    const longitude_addr = ua2430.filterSet(MSGCRT429_SEQ, LONGITUDE_LABEL, SDIALL, RCV_CHAN, hCore);

    // Configure the Sequential Monitor for fill and halt mode (default)
    console.log("Configuring sequential monitor...");
    errval = ua2430.BTICard_SeqConfig(SEQCFG_DEFAULT, hCore);
    if (errval < 0) {
        console.error(`Error: An error was encountered (${errval}) while configuring the sequential record.`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Start operation of the card
    console.log("Starting card operation...");
    ua2430.startCard(hCore);

    console.log("\nMonitoring transmit and receive data for 30 seconds...");
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
        
        // Write updated data to messages
        ua2430.BTI429_MsgDataWr(comp_airspeed_data, comp_airspeed_addr, hCore);
        ua2430.BTI429_MsgDataWr(tot_air_temp_data, tot_air_temp_addr, hCore);
        ua2430.BTI429_MsgDataWr(altitude_rate_data, altitude_rate_addr, hCore);
        
        console.log(`Updated message data values (increment: ${dataValue})`);
        
        // Simple test to verify we can read back the data we just wrote
        const readback = ua2430.BTI429_MsgDataRd(comp_airspeed_addr, hCore);
        console.log(`Verified data readback: 0x${readback.toString(16).padStart(8, '0')}`);
    }, 1000);
    
    // Add back a fixed version of the sequential monitor code that uses Uint16Array
    // Check for received data every 200ms
    const monitorInterval = setInterval(() => {
        try {
            // Create a buffer for sequential monitor using Uint16Array (16-bit unsigned integers)
            // This matches the 'unsigned short *' type expected by the C function
            const seqbuf = new Uint16Array(SEQ_BUF_SIZE);
            
            // Variables for sequential monitoring
            const blkcnt = { value: 0 };
            
            // Read sequential monitor data
            const seqcount = ua2430.BTICard_SeqBlkRd(seqbuf, SEQ_BUF_SIZE, blkcnt, hCore);
            
            if (seqcount > 0) {
                console.log(`Sequential monitor: Read ${seqcount} records (${blkcnt.value} blocks)`);
                
                // Initialize search
                const sfinfo = {};
                ua2430.BTICard_SeqFindInit(seqbuf, seqcount, sfinfo);
                
                // Create record object
                const pRec429 = {};
                
                // Find and process each record
                let recordsFound = 0;
                while (ua2430.BTICard_SeqFindNext429(pRec429, sfinfo) === 0) {
                    recordsFound++;
                    
                    // Get channel number from activity field
                    const chanNum = ((pRec429.activity & MSGACT429_CHMASK) >> MSGACT429_CHSHIFT);
                    const chanType = (chanNum === XMT_CHAN) ? "TRANSMIT" : "RECEIVE";
                    const label = pRec429.data & 0xFF;
                    
                    // Display record information
                    console.log(`[${chanType}] Channel: ${chanNum}, Data: 0x${pRec429.data.toString(16).padStart(8, '0')}, Label: ${label.toString(8).padStart(3, '0')}`);
                    
                    // Check record version
                    if (ua2430.BTICard_SeqFindCheckVersion(pRec429, SEQVER_1)) {
                        console.log(`  DecGap: ${pRec429.decgap}`);
                    }
                }
                
                if (recordsFound === 0) {
                    console.log("No records found in sequential monitor");
                }
            }
        } catch (err) {
            console.error("Error in monitor interval:", err);
        }
    }, 500);

    // Run for 30 seconds then clean up
    setTimeout(() => {
        // Stop our intervals
        clearInterval(updateInterval);
        clearInterval(monitorInterval);
        
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
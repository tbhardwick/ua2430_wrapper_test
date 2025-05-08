#!/usr/bin/env node

const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

// Use a single label for simplicity
const TEST_LABEL = 0o201; // Octal 201 (same as in transmit_ch12.js)
const CARDNUM = 0;
const CORENUM = 0;
const XMT_CHAN = 12;
const RCV_CHAN = 0;

// Constants for configuration
const CHCFG429_HIGHSPEED = 0x00000001;
const CHCFG429_LOWSPEED = 0x00000000;  // Low speed = 0 (default)
const MSGCRT429_DEFAULT = 0x00000000;
const SDIALL = 0x0F;

console.log("\n=============================================");
console.log("ARINC-429 Fixed Receive Test");
console.log(`Transmit CH${XMT_CHAN} -> Receive CH${RCV_CHAN}`);
console.log(`Using Label ${TEST_LABEL.toString(8)} (octal)`);
console.log("=============================================\n");

try {
    // Open card and core
    console.log('Opening card...');
    const hCard = ua2430.openCardNum(CARDNUM);
    if (!hCard) {
        console.error('Failed to open card');
        process.exit(1);
    }

    console.log('Opening core...');
    const hCore = ua2430.openCore(hCard, CORENUM);
    if (!hCore) {
        console.error('Failed to open core');
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Reset card
    console.log('Resetting card...');
    ua2430.resetCard(hCore);

    // Configure channels - ENSURE BOTH ARE THE SAME SPEED
    console.log(`Configuring channel ${XMT_CHAN} for HIGH SPEED (transmit)...`);
    let err = ua2430.config429(CHCFG429_HIGHSPEED, XMT_CHAN, hCore);
    if (err < 0) {
        console.error(`Failed to configure channel ${XMT_CHAN}, error = ${err}`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Try setting receive channel to match the transmit channel's speed
    console.log(`Configuring channel ${RCV_CHAN} for HIGH SPEED (receive)...`);
    err = ua2430.config429(CHCFG429_HIGHSPEED, RCV_CHAN, hCore);
    if (err < 0) {
        console.error(`Failed to configure channel ${RCV_CHAN}, error = ${err}`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Create the receive filter FIRST
    console.log('Creating receive filters...');
    const defaultFilterAddr = ua2430.filterDefault(MSGCRT429_DEFAULT, RCV_CHAN, hCore);
    console.log(`Default filter address: 0x${defaultFilterAddr.toString(16)}`);
    
    const rxFilterAddr = ua2430.filterSet(MSGCRT429_DEFAULT, TEST_LABEL, SDIALL, RCV_CHAN, hCore);
    console.log(`Label filter address: 0x${rxFilterAddr.toString(16)}`);

    // Set up the transmit message
    console.log('Creating transmit message...');
    const txMsgAddr = ua2430.BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
    
    // Set up the label
    let msgData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL);
    console.log(`Initialized message with label ${TEST_LABEL.toString(8)} (0x${msgData.toString(16)})`);
    
    // Build a schedule
    console.log('Building transmission schedule...');
    err = ua2430.buildSchedule(hCore, XMT_CHAN, txMsgAddr, 100, 100);
    if (err < 0) {
        console.error(`Failed to build schedule, error = ${err}`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Write initial message data
    ua2430.BTI429_MsgDataWr(msgData, txMsgAddr, hCore);
    
    // Start the card
    console.log('Starting card...');
    err = ua2430.startCard(hCore);
    if (err !== 0) {
        console.error(`Failed to start card, error = ${err}`);
        ua2430.closeCard(hCard);
        process.exit(1);
    }

    // Explicitly start both channels
    console.log(`Starting receive channel ${RCV_CHAN}...`);
    err = ua2430.start429(RCV_CHAN, hCore);
    console.log(`Receive channel start result: ${err}`);

    console.log(`Starting transmit channel ${XMT_CHAN}...`);
    err = ua2430.start429(XMT_CHAN, hCore);
    console.log(`Transmit channel start result: ${err}`);
    
    console.log('\nBeginning transmit/receive test (30 seconds)...');
    
    let counter = 0;
    const interval = setInterval(() => {
        counter++;
        
        // Update transmit data with counter
        const newData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL) | counter;
        ua2430.BTI429_MsgDataWr(newData, txMsgAddr, hCore);
        
        // Read from both filters
        const defaultData = ua2430.BTI429_MsgDataRd(defaultFilterAddr, hCore);
        const rxData = ua2430.BTI429_MsgDataRd(rxFilterAddr, hCore);
        
        console.log(`\nIteration ${counter}:`);
        console.log(`  TX Data: 0x${newData.toString(16).padStart(8, '0')}`);
        console.log(`  RX Default Filter: 0x${defaultData.toString(16).padStart(8, '0')}`);
        console.log(`  RX Label Filter: 0x${rxData.toString(16).padStart(8, '0')}`);
        
        if (rxData !== 0 || defaultData !== 0) {
            console.log('  Status: DATA RECEIVED! Connection is working.');
        } else {
            console.log('  Status: No data received');
        }
    }, 1000);
    
    // Run for 30 seconds
    setTimeout(() => {
        clearInterval(interval);
        
        // Stop both channels explicitly
        console.log('\nStopping channels...');
        ua2430.stop429(RCV_CHAN, hCore);
        ua2430.stop429(XMT_CHAN, hCore);
        
        // Stop card operations
        console.log('Stopping card...');
        ua2430.stopCard(hCore);
        ua2430.closeCard(hCard);
        
        console.log('Test completed');
        process.exit(0);
    }, 30000);
    
} catch (e) {
    console.error('\nError:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
} 
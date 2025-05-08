#!/usr/bin/env node

/**
 * UA2430 ARINC-429 Transmit and Receive Test
 * -----------------------------------------
 * 
 * Purpose:
 * This script demonstrates proper ARINC-429 bidirectional communication using the UA2430 hardware.
 * It sends data on channel 12 and receives it on channel 0, demonstrating the critical requirements
 * for successful data reception.
 * 
 * Key Features:
 * - Configures BOTH transmit (ch12) and receive (ch0) channels to the SAME SPEED (HIGH SPEED)
 * - Creates receive filters FIRST (both default and label-specific filters)
 * - Creates and configures a transmit message with label 201 (octal)
 * - Builds a transmission schedule
 * - EXPLICITLY starts both channels after starting the card
 * - Monitors both transmitted and received data
 * - Shows proper cleanup procedure for both channels
 * 
 * Critical Requirements Demonstrated:
 * 1. Matching speed settings (both HIGH SPEED)
 * 2. Explicit channel starting with start429()
 * 3. Proper initialization order
 * 4. Read data through both default and label-specific filters
 * 
 * Usage:
 * node fixed_receive_test.js
 * 
 * Expected Output:
 * - Successfully received data will show high bit set (0x80000081)
 * - Status will show "DATA RECEIVED! Connection is working."
 * 
 * Physical Setup Required:
 * - Connect channel 12 output to channel 0 input with appropriate ARINC-429 cabling
 * 
 * Notes:
 * - This is the reference implementation for bidirectional ARINC-429 communication
 * - The receive channel MUST be configured for the same speed as the transmit channel
 * - Without explicit channel starting, reception will not work
 */

const path = require('path');
const fs = require('fs');
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

// Logging configuration
const LOG_FILE = 'arinc429_receive_log.txt';

// Create or open the log file
function initLogFile() {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const header = `ARINC-429 Test Log - Started ${timestamp}\n` +
                   `TX Channel: ${XMT_CHAN}, RX Channel: ${RCV_CHAN}, Label: ${TEST_LABEL.toString(8)} (octal)\n` +
                   '=============================================================\n' +
                   'Timestamp            | Iteration | TX Data     | RX Default  | RX Label    | Status\n' +
                   '--------------------|-----------|-----------  |-----------  |-------------|------------------\n';
    
    fs.writeFileSync(LOG_FILE, header);
    console.log(`Log file initialized: ${LOG_FILE}`);
}

// Write data to log file
function logData(iteration, txData, defaultData, rxData, status) {
    const timestamp = new Date().toISOString().substring(0, 19);
    const logEntry = `${timestamp} | ${iteration.toString().padStart(9, ' ')} | 0x${txData.toString(16).padStart(8, '0')} | 0x${defaultData.toString(16).padStart(8, '0')} | 0x${rxData.toString(16).padStart(8, '0')} | ${status}\n`;
    
    fs.appendFileSync(LOG_FILE, logEntry);
}

console.log("\n=============================================");
console.log("ARINC-429 Fixed Receive Test");
console.log(`Transmit CH${XMT_CHAN} -> Receive CH${RCV_CHAN}`);
console.log(`Using Label ${TEST_LABEL.toString(8)} (octal)`);
console.log("=============================================\n");

// Initialize the log file
initLogFile();

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
    console.log(`Logging data to ${LOG_FILE}`);
    
    let counter = 0;
    const interval = setInterval(() => {
        counter++;
        
        // Update transmit data with counter
        const newData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL) | counter;
        ua2430.BTI429_MsgDataWr(newData, txMsgAddr, hCore);
        
        // Read from both filters
        const defaultData = ua2430.BTI429_MsgDataRd(defaultFilterAddr, hCore);
        const rxData = ua2430.BTI429_MsgDataRd(rxFilterAddr, hCore);
        
        // Determine status
        const status = (rxData !== 0 || defaultData !== 0) ? 
                      'DATA RECEIVED! Connection is working.' : 
                      'No data received';
        
        console.log(`\nIteration ${counter}:`);
        console.log(`  TX Data: 0x${newData.toString(16).padStart(8, '0')}`);
        console.log(`  RX Default Filter: 0x${defaultData.toString(16).padStart(8, '0')}`);
        console.log(`  RX Label Filter: 0x${rxData.toString(16).padStart(8, '0')}`);
        console.log(`  Status: ${status}`);
        
        // Log to file
        logData(counter, newData, defaultData, rxData, status);
        
    }, 1000);
    
    // Run for 30 seconds
    setTimeout(() => {
        clearInterval(interval);
        
        // Log test completion
        fs.appendFileSync(LOG_FILE, `\nTest completed at ${new Date().toISOString()}\n`);
        
        // Stop both channels explicitly
        console.log('\nStopping channels...');
        ua2430.stop429(RCV_CHAN, hCore);
        ua2430.stop429(XMT_CHAN, hCore);
        
        // Stop card operations
        console.log('Stopping card...');
        ua2430.stopCard(hCore);
        ua2430.closeCard(hCard);
        
        console.log('Test completed');
        console.log(`Log file saved to ${LOG_FILE}`);
        process.exit(0);
    }, 30000);
    
} catch (e) {
    console.error('\nError:', e.message);
    console.error('Stack:', e.stack);
    
    // Log error to file
    try {
        fs.appendFileSync(LOG_FILE, `\nERROR at ${new Date().toISOString()}: ${e.message}\n${e.stack}\n`);
    } catch (logError) {
        console.error('Additionally, failed to write to log file:', logError);
    }
    
    process.exit(1);
} 
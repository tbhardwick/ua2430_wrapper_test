#!/usr/bin/env node

const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Constants from BTICARD.H and BTI429.H
const CHCFG429_DEFAULT = 0x00000000;
const CHCFG429_HIGHSPEED = 0x00000001;
const CHCFG429_AUTOSPEED = 0x00000004;
const MSGCRT429_DEFAULT = 0x00000000;

// Channel configuration
const TRANSMIT_CHANNEL = 12;
const RECEIVE_CHANNEL = 0;
const TEST_LABEL = 0o201; // Octal label 201 (0x81 in hex)

console.log('\n=============================================');
console.log('UA2430 ARINC-429 Transmit/Receive Test');
console.log(`Transmit CH${TRANSMIT_CHANNEL} -> Receive CH${RECEIVE_CHANNEL}`);
console.log('=============================================\n');

try {
  // 1) Open the card and core
  console.log('Opening card 0...');
  const hCard = ua2430.openCardNum(0);
  if (!hCard) die('Failed to open card 0');
  console.log('Card opened successfully, handle =', hCard);

  console.log('Opening core 0...');
  const hCore = ua2430.openCore(hCard, 0);
  if (!hCore) die('Failed to open core 0');
  console.log('Core opened successfully, handle =', hCore);

  // 2) Reset the card
  console.log('Resetting card...');
  ua2430.resetCard(hCore);
  console.log('Card reset successful');

  // 3) Configure channels
  console.log(`Configuring channel ${TRANSMIT_CHANNEL} for HIGH SPEED (transmit)...`);
  let err = ua2430.config429(CHCFG429_HIGHSPEED, TRANSMIT_CHANNEL, hCore);
  if (err !== 0) die(`Failed to configure transmit channel ${TRANSMIT_CHANNEL}, error = ${err}`);
  console.log(`Transmit channel ${TRANSMIT_CHANNEL} configured successfully`);

  console.log(`Configuring channel ${RECEIVE_CHANNEL} for AUTO SPEED (receive)...`);
  err = ua2430.config429(CHCFG429_AUTOSPEED, RECEIVE_CHANNEL, hCore);
  if (err !== 0) die(`Failed to configure receive channel ${RECEIVE_CHANNEL}, error = ${err}`);
  console.log(`Receive channel ${RECEIVE_CHANNEL} configured successfully`);

  // 4) Create transmit message
  console.log('Creating transmit message...');
  const txMsgAddr = ua2430.BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
  if (!txMsgAddr) die('Failed to create transmit message');
  console.log('Transmit message created, address = 0x' + txMsgAddr.toString(16));

  // 5) Set up message with test label
  let txMsgData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL);
  console.log(`Initialized message with label ${TEST_LABEL.toString(8)} (0x${txMsgData.toString(16)})`);

  // 6) Build transmission schedule
  console.log('Building transmission schedule...');
  const minInterval = 100; // milliseconds
  const maxInterval = 200; // milliseconds 
  err = ua2430.buildSchedule(hCore, TRANSMIT_CHANNEL, txMsgAddr, minInterval, maxInterval);
  if (err < 0) die(`Failed to build schedule, error = ${err}`);
  console.log(`Schedule built successfully: interval = ${minInterval}-${maxInterval}ms`);

  // 7) Write initial message data
  ua2430.BTI429_MsgDataWr(txMsgData, txMsgAddr, hCore);
  console.log('Initial message data written');

  // 8) Start the card - NOTE: In EXAMP3.C this is all that's needed to start transmission
  console.log('Starting card...');
  err = ua2430.startCard(hCore);
  if (err !== 0) die(`Failed to start card, error = ${err}`);
  console.log('Card started successfully');

  // 10) Start test loop
  console.log('\nStarting transmit/receive test loop (20 seconds)...');
  console.log('Transmitting incrementing data values with label', TEST_LABEL.toString(8));
  console.log(`Transmitting on CH${TRANSMIT_CHANNEL} to CH${RECEIVE_CHANNEL}...\n`);
  
  let dataValue = 0;
  
  const interval = setInterval(() => {
    // Update and transmit data
    dataValue++;
    const newTxData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL) | (dataValue & 0xFFFF);
    ua2430.BTI429_MsgDataWr(newTxData, txMsgAddr, hCore);
    
    console.log(`Transmitted data: 0x${newTxData.toString(16).padStart(8, '0')} (value: ${dataValue}, label: ${TEST_LABEL.toString(8)})`);
  }, 1000);
  
  // Run for 20 seconds total
  console.log('Running for 20 seconds...');
  setTimeout(() => {
    // Stop our update loop
    clearInterval(interval);
    
    // Display final transmitted data
    const finalData = ua2430.BTI429_MsgDataRd(txMsgAddr, hCore);
    console.log(`\nFinal transmitted data: 0x${finalData.toString(16).padStart(8, '0')}`);
    
    // Clean up
    console.log('\nCleaning up...');
    
    // Stop card - this should stop all channels
    console.log('Stopping card...');
    err = ua2430.stopCard(hCore);
    console.log(`Card stop completed, result = ${err}`);
    
    // Close card
    console.log('Closing card...');
    ua2430.closeCard(hCard);
    console.log('Card closed');
    
    console.log('\nTest completed. If the channels are properly connected,');
    console.log(`data should have been transmitted from CH${TRANSMIT_CHANNEL} to CH${RECEIVE_CHANNEL}.`);
    console.log('Use an oscilloscope to verify that the signal was present.\n');
    
    process.exit(0);
  }, 20000);

} catch (e) {
  console.error('\nEXCEPTION:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
} 
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
const MSGCRT429_DEFAULT = 0x00000000;

console.log('\n=============================================');
console.log('UA2430 ARINC-429 Transmit Test - Channel 12');
console.log('=============================================\n');

// Channel to use
const CHANNEL = 12;

try {
  // 1) Open the card and core exactly as EXAMP2.C does
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

  // 3) Configure channel 12 for high speed
  console.log(`Configuring channel ${CHANNEL} for HIGH SPEED...`);
  let err = ua2430.config429(CHCFG429_HIGHSPEED, CHANNEL, hCore);
  if (err !== 0) die(`Failed to configure channel ${CHANNEL}, error = ${err}`);
  console.log(`Channel ${CHANNEL} configured successfully`);

  // 4) Create message for our test label (like EXAMP2.C)
  console.log('Creating message...');
  const msgAddr = ua2430.BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
  if (!msgAddr) die('Failed to create message');
  console.log('Message created, address = 0x' + msgAddr.toString(16));

  // 5) Set up message with octal label 201 (like EXAMP2.C uses 206/211/212)
  const LABEL = 0o201; // Octal label 201 (0x81 in hex)
  let msgData = ua2430.BTI429_FldPutLabel(0, LABEL);
  console.log(`Initialized message with label ${LABEL.toString(8)} (0x${msgData.toString(16)})`);

  // 6) BUILD A SCHEDULE - this is what we were missing!
  console.log('Building transmission schedule...');
  const minInterval = 100; // milliseconds
  const maxInterval = 200; // milliseconds 
  err = ua2430.buildSchedule(hCore, CHANNEL, msgAddr, minInterval, maxInterval);
  if (err < 0) die(`Failed to build schedule, error = ${err}`);
  console.log(`Schedule built successfully: interval = ${minInterval}-${maxInterval}ms`);

  // 7) Write initial message data
  ua2430.BTI429_MsgDataWr(msgData, msgAddr, hCore);
  console.log('Initial message data written');

  // 8) Start the card (required before starting channel)
  console.log('Starting card...');
  err = ua2430.startCard(hCore);
  console.log(`Card started, result = ${err}`);

  // 9) Start debug monitoring loop - we'll periodically change the data,
  //    mimicking what EXAMP2.C does in its while(!_kbhit()) loop
  console.log('\nStarting data update loop (every 200ms for 20s)...');
  console.log('Check scope - you should see ARINC-429 data on channel', CHANNEL, '\n');
  
  let dataValue = 0; // Will be incremented in the loop
  
  const interval = setInterval(() => {
    // Read current message
    const currentData = ua2430.BTI429_MsgDataRd(msgAddr, hCore);
    
    // Increment data part (preserve label)
    dataValue++;
    const newData = ua2430.BTI429_FldPutLabel(0, LABEL) | (dataValue & 0xFFFF);
    
    // Write it back
    ua2430.BTI429_MsgDataWr(newData, msgAddr, hCore);
    
    console.log(`Data update #${dataValue}: 0x${newData.toString(16).padStart(8, '0')} - Previous value: 0x${currentData.toString(16).padStart(8, '0')}`);
  }, 200);
  
  // Run for 20 seconds total
  console.log('Running for 20 seconds...');
  setTimeout(() => {
    // Stop our update loop
    clearInterval(interval);
    
    // Clean up
    console.log('\nTime\'s up, cleaning up...');
    
    // Stop channel
    console.log(`Stopping channel ${CHANNEL}...`);
    err = ua2430.stop429(CHANNEL, hCore);
    console.log(`Channel stop completed, result = ${err}`);
    
    // Stop card (like EXAMP2.C does)
    console.log('Stopping card...');
    err = ua2430.stopCard(hCore);
    console.log(`Card stop completed, result = ${err}`);
    
    // Close card
    console.log('Closing card...');
    ua2430.closeCard(hCard);
    console.log('Card closed');
    
    console.log('\nTest completed.\n');
    process.exit(0);
  }, 20000);

} catch (e) {
  console.error('\nEXCEPTION:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
} 
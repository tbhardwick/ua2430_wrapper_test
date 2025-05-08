# UA2430 ARINC-429 Node.js Wrapper

A Node.js native addon wrapper for Astronics UA2430 ARINC-429 interface hardware. This wrapper uses SWIG to provide JavaScript bindings for the Astronics BTICard and BTI429 C APIs.

## Prerequisites

- Windows OS (tested on Windows 10)
- Node.js (v12 or later)
- Python (for node-gyp)
- Visual Studio or Visual C++ Build Tools
- SWIG (Simple Wrapper and Interface Generator) installed and available on PATH
- Astronics UA2430 device driver and libraries installed

## Building the Wrapper

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/ua2430_wrapper_test.git
   cd ua2430_wrapper_test
   ```

2. Make sure SWIG is installed and on your PATH. To verify:
   ```
   swig -version
   ```

3. Generate the wrapper code:
   ```
   swig -Ivendor/include -c++ -javascript -node ua2430.i
   ```

4. Build the Node.js addon:
   ```
   node-gyp configure
   node-gyp build
   ```

The built addon will be available at `build/Release/ua2430.node`.

## How to Use

### Basic Example

Here's a minimal example to transmit on an ARINC-429 channel:

```javascript
const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

// 1. Open card and core
const hCard = ua2430.openCardNum(0);
const hCore = ua2430.openCore(hCard, 0);

// 2. Reset and configure
ua2430.resetCard(hCore);
ua2430.config429(0x00000001, 12, hCore); // HIGHSPEED on channel 12

// 3. Create a message with label 201 (octal)
const msgAddr = ua2430.BTI429_MsgCreate(0, hCore);
const label = 0o201; // Octal 201
const msgData = ua2430.BTI429_FldPutLabel(0, label);
ua2430.BTI429_MsgDataWr(msgData, msgAddr, hCore);

// 4. Build schedule (critical for transmission)
ua2430.buildSchedule(hCore, 12, msgAddr, 100, 200);

// 5. Start the card and let it run
ua2430.startCard(hCore);

// 6. Update data periodically (optional)
setInterval(() => {
  // Add some data in bits 1-16 (keeping label intact)
  const newData = ua2430.BTI429_FldPutLabel(0, label) | 0x1234;
  ua2430.BTI429_MsgDataWr(newData, msgAddr, hCore);
}, 200);

// 7. On program exit, clean up:
// ua2430.stop429(12, hCore);
// ua2430.stopCard(hCore);
// ua2430.closeCard(hCard);
```

### Transmit-Receive Example

To properly transmit data from one channel and receive it on another (e.g., transmit on channel 12, receive on channel 0), follow this critical sequence:

```javascript
const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

const XMT_CHAN = 12;  // Transmit channel
const RCV_CHAN = 0;   // Receive channel
const TEST_LABEL = 0o201; // Octal label
const CHCFG429_HIGHSPEED = 0x00000001;
const SDIALL = 0x0F;

// 1. Open card and core
const hCard = ua2430.openCardNum(0);
const hCore = ua2430.openCore(hCard, 0);

// 2. Reset the card
ua2430.resetCard(hCore);

// 3. Configure BOTH channels to the same speed
ua2430.config429(CHCFG429_HIGHSPEED, XMT_CHAN, hCore); // Transmit channel
ua2430.config429(CHCFG429_HIGHSPEED, RCV_CHAN, hCore); // Receive channel

// 4. Create receive filters FIRST
const defaultFilterAddr = ua2430.filterDefault(0, RCV_CHAN, hCore);
const rxFilterAddr = ua2430.filterSet(0, TEST_LABEL, SDIALL, RCV_CHAN, hCore);

// 5. Create transmit message
const txMsgAddr = ua2430.BTI429_MsgCreate(0, hCore);
const msgData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL);
ua2430.BTI429_MsgDataWr(msgData, txMsgAddr, hCore);

// 6. Build schedule
ua2430.buildSchedule(hCore, XMT_CHAN, txMsgAddr, 100, 100);

// 7. Start the card
ua2430.startCard(hCore);

// 8. Explicitly start both channels
ua2430.start429(RCV_CHAN, hCore);
ua2430.start429(XMT_CHAN, hCore);

// 9. Read from receive filter periodically
setInterval(() => {
  // Update transmit data
  const newData = ua2430.BTI429_FldPutLabel(0, TEST_LABEL) | 0x1234;
  ua2430.BTI429_MsgDataWr(newData, txMsgAddr, hCore);
  
  // Read from receive filter
  const rxData = ua2430.BTI429_MsgDataRd(rxFilterAddr, hCore);
  console.log(`RX Data: 0x${rxData.toString(16)}`);
}, 1000);

// 10. Cleanup when done
// ua2430.stop429(RCV_CHAN, hCore);
// ua2430.stop429(XMT_CHAN, hCore);
// ua2430.stopCard(hCore);
// ua2430.closeCard(hCard);
```

## Test Scripts

This repository includes several test scripts to demonstrate and validate functionality:

- **transmit_ch12.js**: Basic transmission test on channel 12
- **transmit_receive_test.js**: Combined transmit and receive test (only transmits properly)
- **specific_label_test.js**: Tests a single label transmission and reception
- **fixed_receive_test.js**: Fixed version that properly demonstrates transmit and receive functionality
- **simplified_monitor_test.js**: Tests transmission and reception without sequential monitor
- **sequential_monitor_test.js**: Attempts to use sequential monitor functionality (has buffer issues)

To run any script:
```
node script_name.js
```

## API Reference

### Card and Core Management

- `openCardNum(cardNum)`: Open a card by number (usually 0)
- `openCore(cardHandle, coreNum)`: Open a core on the given card
- `resetCard(coreHandle)`: Reset the card
- `startCard(coreHandle)`: Start the card
- `stopCard(coreHandle)`: Stop the card
- `closeCard(cardHandle)`: Close the card

### Channel Configuration

- `config429(configValue, chanNum, coreHandle)`: Configure an ARINC-429 channel
- `start429(chanNum, coreHandle)`: Start a channel
- `stop429(chanNum, coreHandle)`: Stop a channel

### Message Handling

- `BTI429_MsgCreate(configVal, coreHandle)`: Create a message
- `BTI429_MsgDataWr(value, msgAddr, coreHandle)`: Write data to a message
- `BTI429_MsgDataRd(msgAddr, coreHandle)`: Read data from a message
- `BTI429_FldPutLabel(msgValue, label)`: Set a label in a message word

### Filter Management

- `filterDefault(configVal, chanNum, coreHandle)`: Create default filter for all labels
- `filterSet(configVal, labelVal, sdimask, chanNum, coreHandle)`: Create filter for specific label

### Schedule Building

- `buildSchedule(coreHandle, chanNum, msgAddr, minInterval, maxInterval)`: Build a schedule with one message
- `buildSchedule3(coreHandle, chanNum, msgAddr1, min1, max1, msgAddr2, min2, max2, msgAddr3, min3, max3)`: Build a schedule with three messages

## Critical Requirements for Transmit/Receive Functionality

Through extensive testing, we've identified these critical requirements for proper transmit/receive operations:

1. **Matching speed settings**: Both transmit and receive channels must use the same speed setting (both HIGH SPEED or both LOW SPEED). Auto-speed detection does not work reliably.

2. **Explicit channel starting**: After calling `startCard()`, you must explicitly start both the receive and transmit channels with `start429()`.

3. **Proper initialization order**:
   - Configure receive channel first
   - Set up receive filters
   - Configure transmit channel
   - Create and initialize transmit messages
   - Build schedule
   - Start card
   - Start receive channel
   - Start transmit channel

4. **Physical connection**: Ensure proper physical wiring between the transmit and receive channels.

5. **Label matching**: Ensure the transmit label matches the filter label on the receive side.

## Troubleshooting

- **No transmission seen on scope**: Make sure you've built a schedule with `buildSchedule()`. This is essential for transmission.

- **Not receiving data**: 
  - Ensure both channels are configured for the same speed
  - Explicitly start both channels with `start429()`
  - Check physical connections
  - Verify filter labels match transmit labels
  - Follow the proper initialization order

- **Sequential monitor errors**: The sequential monitor functionality has issues with buffer types in JavaScript. Use the direct message reading approach instead of sequential monitor.

- **High bit set in received data**: Data coming from a receive filter may have the high bit (bit 31) set (e.g., 0x80000081). This is normal and indicates valid received data.

- **Errors opening card**: Make sure the Astronics drivers are installed and the device is connected.

- **Channel not found**: Make sure you're using the correct channel number (usually 12 for primary output, 0 for primary input).

## Credits

This wrapper was developed using SWIG to interface with Astronics UA2430 hardware. It is based on the vendor's C examples, particularly EXAMP2.C and EXAMP3.C from the BTI429 library. 
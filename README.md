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

### Complete Example

See `transmit_ch12.js` for a complete example with proper error handling and cleanup.

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

### Schedule Building

- `buildSchedule(coreHandle, chanNum, msgAddr, minInterval, maxInterval)`: Build a schedule with one message
- `buildSchedule3(coreHandle, chanNum, msgAddr1, min1, max1, msgAddr2, min2, max2, msgAddr3, min3, max3)`: Build a schedule with three messages

## Important Notes

1. **Always reset the card** before configuring channels.
2. **Always start the card** before starting channels.
3. **Always build a schedule** before starting transmission.
4. **Always use proper cleanup** when done:
   - Stop channels
   - Stop card
   - Close card

5. **ARINC-429 Labels are octal** - always use the `0o` prefix for octal notation (e.g., `0o201`, not `201`).

## Troubleshooting

- **No transmission seen on scope**: Make sure you've built a schedule with `buildSchedule()`. This is essential for transmission.
- **Errors opening card**: Make sure the Astronics drivers are installed and the device is connected.
- **Channel not found**: Make sure you're using the correct channel number (usually 12 for primary output).
- **No data changes**: Make sure you're correctly updating the data with `BTI429_MsgDataWr()`.

## Credits

This wrapper was developed using SWIG to interface with Astronics UA2430 hardware. It is based on the vendor's C examples, particularly EXAMP2.C from the BTI429 library. 
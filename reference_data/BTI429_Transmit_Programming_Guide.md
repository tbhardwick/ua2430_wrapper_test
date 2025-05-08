# BTI429/UA2430 ARINC429 Transmit Programming Guide

## Introduction

This document provides detailed instructions for correctly programming the transmit functions of Ballard/Astronics BTI429 ARINC429 hardware, specifically the UA2430 USB device. Following these guidelines will help ensure successful implementation of ARINC429 transmission.

## Table of Contents

1. [Device Initialization](#device-initialization)
2. [Channel Configuration](#channel-configuration)
3. [Message Creation and Formatting](#message-creation-and-formatting)
4. [Building a Transmission Schedule](#building-a-transmission-schedule)
5. [Starting Transmission](#starting-transmission)
6. [Updating Message Data](#updating-message-data)
7. [Cleanup and Shutdown](#cleanup-and-shutdown)
8. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
9. [Complete Example](#complete-example)

## Device Initialization

Always begin by opening the card and core before performing any operations:

```c
HCARD hCard = NULL;
HCORE hCore = NULL;
ERRVAL status;
INT cardnum = 0;  // Card number is typically 0 for a single device
INT corenum = 0;  // Core number is typically 0 

// Open the card
status = BTICard_CardOpen(&hCard, cardnum);
if (status != 0 || hCard == NULL) {
    // Handle error
    printf("Error opening card: %s\n", BTICard_ErrDescStr(status, hCard));
    return ERROR_CODE;
}

// Open the core
status = BTICard_CoreOpen(&hCore, corenum, hCard);
if (status != 0 || hCore == NULL) {
    // Handle error
    printf("Error opening core: %s\n", BTICard_ErrDescStr(status, hCard));
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}

// Reset the card/core
BTICard_CardReset(hCore);
```

## Channel Configuration

### Working with Predetermined Channels

In production avionics systems, ARINC429 channels are physically wired to specific equipment, so channel numbers must be predetermined. Your application should use these predetermined channel numbers but still validate they're appropriate:

```c
// Predetermined transmit channel based on physical wiring
INT xmtchan = 12;  // Example: Using channel 12 for transmitting flight data

// Validate the channel is a valid transmit channel
if (!BTI429_ChIsXmt(xmtchan, hCore)) {
    printf("Error: Channel %d is not a valid transmit channel.\n", xmtchan);
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}

printf("Using transmit channel #%d\n", xmtchan);
```

### Alternative: Dynamic Channel Discovery

For testing environments or when flexibility is needed, you can dynamically discover available transmit channels:

```c
#define MAX_CHANNELS 32
INT xmtchan;

// Find a valid transmit channel
for (xmtchan = 0; xmtchan < MAX_CHANNELS; xmtchan++) {
    if (BTI429_ChIsXmt(xmtchan, hCore)) {
        break;  // Found a valid transmit channel
    }
}

if (xmtchan == MAX_CHANNELS) {
    // No valid transmit channels found
    printf("Error: No ARINC 429 transmit channels available.\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}

printf("Using transmit channel #%d\n", xmtchan);
```

### Configuring the Channel

Once a valid channel is identified, configure it for transmission:

```c
// Configure for high-speed (100 kHz) transmission
// Use CHCFG429_LOWSPEED for 12.5 kHz if needed
status = BTI429_ChConfig(CHCFG429_HIGHSPEED, xmtchan, hCore);
if (status != 0) {
    // Handle error
    printf("Error configuring channel: %s\n", BTICard_ErrDescStr(status, hCard));
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

## Message Creation and Formatting

### Creating Message Records

Create message records for each ARINC429 label you need to transmit:

```c
// Using the MSGSTRUCT429 structure for convenient data/address pairing
MSGSTRUCT429 message1, message2, message3;

// Create message records
message1.addr = BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
message2.addr = BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
message3.addr = BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);

// Verify successful creation
if (message1.addr == 0 || message2.addr == 0 || message3.addr == 0) {
    printf("Error creating message records\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

### Formatting ARINC429 Words

**Critical:** Always use the BTI429 helper functions to correctly format ARINC429 words. Don't manually manipulate the bit fields:

```c
// Initialize label field (octal values)
message1.data = BTI429_FldPutLabel(0L, 0206);  // Label 206 (octal)
message2.data = BTI429_FldPutLabel(0L, 0211);  // Label 211 (octal)
message3.data = BTI429_FldPutLabel(0L, 0212);  // Label 212 (octal)

// For BNR (Binary) format data:
// Parameters: (current_word, value, significant_bit, twos_complement_flag)
message1.data = BTI429_BNRPutMant(message1.data, 0L, 14, 0);
message2.data = BTI429_BNRPutMant(message2.data, 0L, 11, 0);
message3.data = BTI429_BNRPutMant(message3.data, 0L, 16, 0);

// For BCD (Binary-Coded Decimal) format:
// message.data = BTI429_BCDPutMant(message.data, value, significant_digits, sign_flag);

// For setting SDI (Source/Destination Identifier):
// message.data = BTI429_FldPutSDI(message.data, sdi_value);  // sdi_value: 0-3

// For setting SSM (Sign/Status Matrix):
// message.data = BTI429_BNRPutSSM(message.data, ssm_value);  // ssm_value: 0-3

// Write the formatted message data to the message records
BTI429_MsgDataWr(message1.data, message1.addr, hCore);
BTI429_MsgDataWr(message2.data, message2.addr, hCore);
BTI429_MsgDataWr(message3.data, message3.addr, hCore);
```

## Building a Transmission Schedule

### Setting Up Message Intervals

Create arrays for message addresses and their transmission intervals:

```c
MSGADDR msgaddr[3];        // Array of message addresses
INT min_intrvls[3];        // Minimum intervals in milliseconds
INT max_intrvls[3];        // Maximum intervals in milliseconds

// Set up the arrays
msgaddr[0] = message1.addr;
min_intrvls[0] = 250;  // 250 milliseconds minimum (4 Hz)
max_intrvls[0] = 500;  // 500 milliseconds maximum (2 Hz)

msgaddr[1] = message2.addr;
min_intrvls[1] = 250;  // 250 milliseconds
max_intrvls[1] = 500;  // 500 milliseconds

msgaddr[2] = message3.addr;
min_intrvls[2] = 100;  // 100 milliseconds (10 Hz)
min_intrvls[2] = 200;  // 200 milliseconds (5 Hz)
```

### Building the Schedule

```c
// Build the schedule
// Parameters: (number_of_messages, msgaddr_array, min_intervals, max_intervals, channel, core_handle)
status = BTI429_SchedBuild(3, msgaddr, min_intrvls, max_intrvls, xmtchan, hCore);
if (status != 0) {
    // Handle error
    printf("Error building schedule: %s\n", BTICard_ErrDescStr(status, hCard));
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

## Starting Transmission

After building the schedule, start the card to begin transmission:

```c
// Start the card (begins transmission)
status = BTICard_CardStart(hCore);
if (status != 0) {
    // Handle error
    printf("Error starting card: %s\n", BTICard_ErrDescStr(status, hCard));
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

## Updating Message Data

To update message data during transmission, read the current data, modify it, and write it back:

```c
// Read the current message data
message1.data = BTI429_MsgDataRd(message1.addr, hCore);
message2.data = BTI429_MsgDataRd(message2.addr, hCore);
message3.data = BTI429_MsgDataRd(message3.addr, hCore);

// Extract BNR data
ULONG data_value1 = BTI429_BNRGetMant(message1.data, 14);
ULONG data_value2 = BTI429_BNRGetMant(message2.data, 11);
ULONG data_value3 = BTI429_BNRGetMant(message3.data, 16);

// Modify data as needed
data_value1++;
data_value2++;
data_value3++;

// Update the BNR data in the messages
message1.data = BTI429_BNRPutMant(message1.data, data_value1, 14, 0);
message2.data = BTI429_BNRPutMant(message2.data, data_value2, 11, 0);
message3.data = BTI429_BNRPutMant(message3.data, data_value3, 16, 0);

// Write the updated message data back
BTI429_MsgDataWr(message1.data, message1.addr, hCore);
BTI429_MsgDataWr(message2.data, message2.addr, hCore);
BTI429_MsgDataWr(message3.data, message3.addr, hCore);
```

## Cleanup and Shutdown

Always stop the card and close all resources when done:

```c
// Stop the card
BTICard_CardStop(hCore);

// Close the card (releases resources)
BTICard_CardClose(hCard);
```

## Common Pitfalls and Solutions

1. **Invalid Channel Error (Error -51)**: 
   - **Problem**: Using a channel number that's not a valid transmit channel.
   - **Solution**: Always validate channels with `BTI429_ChIsXmt()` even when using predetermined channel numbers.

2. **Message Formatting Issues**:
   - **Problem**: Manually manipulating bit fields for ARINC429 words.
   - **Solution**: Always use the provided BTI429 functions (BTI429_FldPutLabel, BTI429_BNRPutMant, etc.).

3. **Transmission Rate Too High**:
   - **Problem**: Setting intervals too low for the hardware to handle.
   - **Solution**: Use realistic values based on hardware capabilities (typically 100ms or higher).

4. **No Data Transmission**:
   - **Problem**: Card not started after schedule creation.
   - **Solution**: Always call `BTICard_CardStart(hCore)` after building the schedule.

5. **Memory Leaks**:
   - **Problem**: Not closing card handles.
   - **Solution**: Always call `BTICard_CardClose(hCard)` before exiting.

## Complete Example

Here's a complete example for ARINC429 transmission with predetermined channels:

```c
#include <stdio.h>
#include <stdlib.h>
#include <windows.h>
#include "BTICARD.H"
#include "BTI429.H"

int main() {
    HCARD hCard;
    HCORE hCore;
    ERRVAL status;
    MSGSTRUCT429 comp_airspeed, tot_air_temp, altitude_rate;
    MSGADDR msgaddr[3];
    INT min_intrvls[3];
    INT max_intrvls[3];
    ULONG bnr_data[3];
    INT cardnum = 0;
    INT corenum = 0;
    int count = 0;
    
    // Predetermined channel based on hardware wiring
    INT xmtchan = 12;  // Example: Channel 12 is wired to the system's ARINC429 bus
    
    printf("UA2430 ARINC 429 Transmit Test\n");
    printf("------------------------------\n\n");
    
    // Open the Device
    printf("Opening card %d...\n", cardnum);
    status = BTICard_CardOpen(&hCard, cardnum);
    if (status != 0) {
        printf("Error: Either card number %u is not present, or\n", cardnum);
        printf("       an error occurred (%i) opening the card.\n", status);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        return 1;
    }
    printf("Card opened successfully!\n");
    printf("Using ARINC 429 card #%d (%s,%s,S/N %04d)\n", 
           cardnum, 
           BTICard_CardTypeStr(hCard), 
           BTICard_CardProductStr(hCard), 
           BTICard_CardGetInfo(INFOTYPE_SERIALNUM, 0, hCard));
    
    // Open the core
    printf("Opening core %d...\n", corenum);
    status = BTICard_CoreOpen(&hCore, corenum, hCard);
    if (status != 0) {
        printf("Error: Failed to open core %d. Error code: %d\n", corenum, status);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Core opened successfully!\n");
    
    // Validate the predetermined channel
    if (!BTI429_ChIsXmt(xmtchan, hCore)) {
        printf("Error: Channel %d is not a valid transmit channel.\n", xmtchan);
        BTICard_CardClose(hCard);
        return 1;
    }
    
    printf("Using transmit channel #%d\n", xmtchan);
    
    // Reset the core
    printf("Resetting card...\n");
    BTICard_CardReset(hCore);
    
    // Configure channel
    printf("Configuring channel %d for transmit...\n", xmtchan);
    status = BTI429_ChConfig(CHCFG429_HIGHSPEED, xmtchan, hCore);
    if (status != 0) {
        printf("Error: An error was encountered (%i) while configuring\n", status);
        printf("       channel #%d on core #%d.\n", xmtchan, corenum);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Channel %d configured successfully!\n", xmtchan);
    
    // Create message records
    printf("Creating message records...\n");
    comp_airspeed.addr = BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
    tot_air_temp.addr = BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
    altitude_rate.addr = BTI429_MsgCreate(MSGCRT429_DEFAULT, hCore);
    
    if (comp_airspeed.addr == 0 || tot_air_temp.addr == 0 || altitude_rate.addr == 0) {
        printf("Error: Failed to create one or more message records.\n");
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Message records created successfully!\n");
    
    // Set up arrays and transmit intervals
    printf("Setting up transmission schedule...\n");
    msgaddr[0] = comp_airspeed.addr;
    min_intrvls[0] = 250;  // milliseconds
    max_intrvls[0] = 500;  // milliseconds
    
    msgaddr[1] = tot_air_temp.addr;
    min_intrvls[1] = 250;  // milliseconds
    max_intrvls[1] = 500;  // milliseconds
    
    msgaddr[2] = altitude_rate.addr;
    min_intrvls[2] = 100;  // milliseconds
    max_intrvls[2] = 200;  // milliseconds
    
    // Build Schedule
    status = BTI429_SchedBuild(3, msgaddr, min_intrvls, max_intrvls, xmtchan, hCore);
    if (status != 0) {
        printf("Error: An error was encountered (%i) while building\n", status);
        printf("       a schedule on channel #%d of core #%d.\n", xmtchan, corenum);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Schedule created successfully!\n");
    
    // Initialize the Message Records
    printf("Initializing message data...\n");
    comp_airspeed.data = BTI429_FldPutLabel(0L, 0206);     // Init label field
    tot_air_temp.data = BTI429_FldPutLabel(0L, 0211);
    altitude_rate.data = BTI429_FldPutLabel(0L, 0212);
    
    comp_airspeed.data = BTI429_BNRPutMant(comp_airspeed.data, 0L, 14, 0);  // Init BNR data
    tot_air_temp.data = BTI429_BNRPutMant(tot_air_temp.data, 0L, 11, 0);
    altitude_rate.data = BTI429_BNRPutMant(altitude_rate.data, 0L, 16, 0);
    
    BTI429_MsgDataWr(comp_airspeed.data, comp_airspeed.addr, hCore);
    BTI429_MsgDataWr(tot_air_temp.data, tot_air_temp.addr, hCore);
    BTI429_MsgDataWr(altitude_rate.data, altitude_rate.addr, hCore);
    
    // Start the core
    printf("Starting card...\n");
    status = BTICard_CardStart(hCore);
    if (status != 0) {
        printf("Error: Failed to start card. Error code: %d\n", status);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Card started successfully! Transmission should be active.\n");
    
    // Update data in a loop for a period of time
    printf("Transmitting for 60 seconds...\n");
    
    while (count < 60) {
        // Read messages back
        comp_airspeed.data = BTI429_MsgDataRd(comp_airspeed.addr, hCore);
        tot_air_temp.data = BTI429_MsgDataRd(tot_air_temp.addr, hCore);
        altitude_rate.data = BTI429_MsgDataRd(altitude_rate.addr, hCore);
        
        // Extract BNR data
        bnr_data[0] = BTI429_BNRGetMant(comp_airspeed.data, 14);
        bnr_data[1] = BTI429_BNRGetMant(tot_air_temp.data, 11);
        bnr_data[2] = BTI429_BNRGetMant(altitude_rate.data, 16);
        
        // Change BNR data
        ++bnr_data[0];
        ++bnr_data[1];
        ++bnr_data[2];
        
        // Put BNR data back into messages
        comp_airspeed.data = BTI429_BNRPutMant(comp_airspeed.data, bnr_data[0], 14, 0);
        tot_air_temp.data = BTI429_BNRPutMant(tot_air_temp.data, bnr_data[1], 11, 0);
        altitude_rate.data = BTI429_BNRPutMant(altitude_rate.data, bnr_data[2], 16, 0);
        
        // Write new message values
        BTI429_MsgDataWr(comp_airspeed.data, comp_airspeed.addr, hCore);
        BTI429_MsgDataWr(tot_air_temp.data, tot_air_temp.addr, hCore);
        BTI429_MsgDataWr(altitude_rate.data, altitude_rate.addr, hCore);
        
        // Print status every 5 seconds
        if (count % 5 == 0) {
            printf("%d seconds elapsed...\n", count);
        }
        
        Sleep(1000);  // Sleep for 1 second
        count++;
    }
    
    printf("Test completed. Stopping card.\n");
    
    // Stop the card
    BTICard_CardStop(hCore);
    
    // Close the Device
    BTICard_CardClose(hCard);
    
    printf("\nTest complete!\n");
    return 0;
}
```

This example demonstrates all the key components required for successful ARINC429 transmission with the BTI429/UA2430 hardware. 
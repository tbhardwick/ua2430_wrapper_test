# BTI429/UA2430 ARINC429 Receive Programming Guide

## Introduction

This document provides detailed instructions for correctly programming the receive functions of Ballard/Astronics BTI429 ARINC429 hardware, specifically the UA2430 USB device. Following these guidelines will help ensure successful implementation of ARINC429 data reception.

## Table of Contents

1. [Device Initialization](#device-initialization)
2. [Channel Configuration](#channel-configuration)
3. [Setting Up Filters](#setting-up-filters)
4. [Starting Reception](#starting-reception)
5. [Reading Message Data](#reading-message-data)
6. [Data Processing Techniques](#data-processing-techniques)
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

In production avionics systems, ARINC429 channels are physically wired to specific equipment, so channel numbers must be predetermined. Your application should use these predetermined channel numbers but still validate them:

```c
// Predetermined receive channel based on physical wiring
INT rcvchan = 5;  // Example: Using channel 5 for receiving altitude data

// Validate the channel is a valid receive channel
if (!BTI429_ChIsRcv(rcvchan, hCore)) {
    printf("Error: Channel %d is not a valid receive channel.\n", rcvchan);
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}

printf("Using receive channel #%d\n", rcvchan);
```

### Alternative: Dynamic Channel Discovery

For testing environments or when flexibility is needed, you can dynamically discover available receive channels:

```c
#define MAX_CHANNELS 32
INT rcvchan;

// Find a valid receive channel
for (rcvchan = 0; rcvchan < MAX_CHANNELS; rcvchan++) {
    if (BTI429_ChIsRcv(rcvchan, hCore)) {
        break;  // Found a valid receive channel
    }
}

if (rcvchan == MAX_CHANNELS) {
    // No valid receive channels found
    printf("Error: No ARINC 429 receive channels available.\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}

printf("Using receive channel #%d\n", rcvchan);
```

### Configuring the Channel

Once a valid channel is identified, configure it for reception:

```c
// Configure for auto-speed detection to automatically handle both high and low-speed buses
// Use CHCFG429_HIGHSPEED or CHCFG429_LOWSPEED if the bus speed is known
status = BTI429_ChConfig(CHCFG429_AUTOSPEED, rcvchan, hCore);
if (status != 0) {
    // Handle error
    printf("Error configuring channel: %s\n", BTICard_ErrDescStr(status, hCard));
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

## Setting Up Filters

ARINC429 receivers must set up filters to specify which messages should be captured. This is a critical step that determines which ARINC labels will be processed.

### Default Filter

Always set up a default filter to capture any messages that don't match specific filters:

```c
MSGSTRUCT429 msg_default;

// Create a default filter that captures all messages not specifically filtered
msg_default.addr = BTI429_FilterDefault(MSGCRT429_DEFAULT, rcvchan, hCore);
if (msg_default.addr == 0) {
    printf("Error creating default filter\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

### Specific Label Filters

Set up filters for specific ARINC429 labels:

```c
MSGSTRUCT429 altitude, airspeed;

// Filter for altitude (Label 203 octal) with any SDI
altitude.addr = BTI429_FilterSet(MSGCRT429_DEFAULT, 0203, SDIALL, rcvchan, hCore);
if (altitude.addr == 0) {
    printf("Error setting altitude filter\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}

// Filter for airspeed (Label 206 octal) with any SDI
airspeed.addr = BTI429_FilterSet(MSGCRT429_DEFAULT, 0206, SDIALL, rcvchan, hCore);
if (airspeed.addr == 0) {
    printf("Error setting airspeed filter\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

### Specific SDI Filtering

To filter for a specific SDI (Source/Destination Identifier):

```c
MSGSTRUCT429 heading_sdi1;

// Filter for heading (Label 320 octal) with SDI = 01 only
// SDI values: SDI00 (0), SDI01 (1), SDI10 (2), SDI11 (3)
heading_sdi1.addr = BTI429_FilterSet(MSGCRT429_DEFAULT, 0320, SDI01, rcvchan, hCore);
if (heading_sdi1.addr == 0) {
    printf("Error setting heading filter with SDI01\n");
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

## Starting Reception

After setting up all filters, start the card to begin receiving data:

```c
// Start the card (begins reception)
status = BTICard_CardStart(hCore);
if (status != 0) {
    // Handle error
    printf("Error starting card: %s\n", BTICard_ErrDescStr(status, hCard));
    BTICard_CardClose(hCard);
    return ERROR_CODE;
}
```

## Reading Message Data

To read received message data:

```c
// Read the latest data from message records
msg_default.data = BTI429_MsgDataRd(msg_default.addr, hCore);
altitude.data = BTI429_MsgDataRd(altitude.addr, hCore);
airspeed.data = BTI429_MsgDataRd(airspeed.addr, hCore);

// Check if new data has been received
if (BTI429_MsgIsAccessed(altitude.addr, hCore)) {
    printf("New altitude data received: 0x%08X\n", altitude.data);
}

if (BTI429_MsgIsAccessed(airspeed.addr, hCore)) {
    printf("New airspeed data received: 0x%08X\n", airspeed.data);
}
```

## Data Processing Techniques

### Extracting ARINC429 Fields

Use BTI429 helper functions to extract data from received ARINC429 words:

```c
// Extract label from a received ARINC word
USHORT label = BTI429_FldGetLabel(altitude.data);

// Extract SDI (Source/Destination Identifier)
USHORT sdi = BTI429_FldGetSDI(altitude.data);

// For BNR (Binary) format data:
// Parameters: (word, significant_bit)
ULONG altitude_value = BTI429_BNRGetMant(altitude.data, 20);

// For BCD (Binary-Coded Decimal) format:
// ULONG bcd_value = BTI429_BCDGetMant(data_word, significant_digits);

// Get the Sign Status Matrix (SSM) field
USHORT ssm = BTI429_BNRGetSSM(altitude.data);

// Convert BNR data to a floating-point value with specified resolution
double alt_feet = BTI429_BNRGetValue(altitude.data, 20, 1.0); // Resolution of 1.0 ft

// Check parity
USHORT parity = BTI429_FldGetParity(altitude.data);
```

### Handling Data Rates and Activity

Monitor message activity and handle data according to reception rates:

```c
// Check message activity (indicates whether message was received)
USHORT activity = BTI429_MsgActivityRd(altitude.addr, hCore);
if (activity & MSGACT429_HIT) {
    // Message was received at least once
}

// Get message hit count (number of times received)
INT hit_count = BTI429_MsgCountRd(altitude.addr, hCore);
printf("Altitude message received %d times\n", hit_count);
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

1. **No Data Reception**: 
   - **Problem**: Filters not properly set up.
   - **Solution**: Always set up a default filter and specific filters for each label of interest.

2. **Invalid Channel Error**:
   - **Problem**: Using a channel number that's not a valid receive channel.
   - **Solution**: Always validate channels with `BTI429_ChIsRcv()` even when using predetermined channel numbers.

3. **Missing Messages**:
   - **Problem**: Incorrect label or SDI filtering.
   - **Solution**: Verify label values (octal) and use SDIALL if you're unsure about SDI values.

4. **Speed Mismatch**:
   - **Problem**: Bus speed incompatible with channel configuration.
   - **Solution**: Use `CHCFG429_AUTOSPEED` to automatically detect bus speed.

5. **Memory Leaks**:
   - **Problem**: Not closing card handles.
   - **Solution**: Always call `BTICard_CardClose(hCard)` before exiting.

## Complete Example

Here's a complete example for ARINC429 reception with predetermined channels:

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
    MSGSTRUCT429 msg_default, altitude, airspeed;
    INT cardnum = 0;
    INT corenum = 0;
    int count = 0;
    
    // Predetermined channel based on hardware wiring
    INT rcvchan = 5;  // Example: Channel 5 is wired to the system's ARINC429 bus
    
    printf("UA2430 ARINC 429 Receive Test\n");
    printf("----------------------------\n\n");
    
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
    if (!BTI429_ChIsRcv(rcvchan, hCore)) {
        printf("Error: Channel %d is not a valid receive channel.\n", rcvchan);
        BTICard_CardClose(hCard);
        return 1;
    }
    
    printf("Using receive channel #%d\n", rcvchan);
    
    // Reset the core
    printf("Resetting card...\n");
    BTICard_CardReset(hCore);
    
    // Configure channel
    printf("Configuring channel %d for receive...\n", rcvchan);
    status = BTI429_ChConfig(CHCFG429_AUTOSPEED, rcvchan, hCore);
    if (status != 0) {
        printf("Error: An error was encountered (%i) while configuring\n", status);
        printf("       channel #%d on core #%d.\n", rcvchan, corenum);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Channel %d configured successfully!\n", rcvchan);
    
    // Set up filters
    printf("Setting up message filters...\n");
    
    // Default filter for all unfiltered messages
    msg_default.addr = BTI429_FilterDefault(MSGCRT429_DEFAULT, rcvchan, hCore);
    if (msg_default.addr == 0) {
        printf("Error creating default filter\n");
        BTICard_CardClose(hCard);
        return 1;
    }
    
    // Specific filters for altitude and airspeed
    altitude.addr = BTI429_FilterSet(MSGCRT429_DEFAULT, 0203, SDIALL, rcvchan, hCore);
    if (altitude.addr == 0) {
        printf("Error setting altitude filter\n");
        BTICard_CardClose(hCard);
        return 1;
    }
    
    airspeed.addr = BTI429_FilterSet(MSGCRT429_DEFAULT, 0206, SDIALL, rcvchan, hCore);
    if (airspeed.addr == 0) {
        printf("Error setting airspeed filter\n");
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Filters set up successfully!\n");
    
    // Start the core
    printf("Starting card...\n");
    status = BTICard_CardStart(hCore);
    if (status != 0) {
        printf("Error: Failed to start card. Error code: %d\n", status);
        printf("       (%s)\n", BTICard_ErrDescStr(status, hCard));
        BTICard_CardClose(hCard);
        return 1;
    }
    printf("Card started successfully! Receiver is active.\n");
    printf("Waiting for ARINC 429 data...\n\n");
    
    // Read and display data for 60 seconds
    while (count < 60) {
        // Read current message data
        msg_default.data = BTI429_MsgDataRd(msg_default.addr, hCore);
        altitude.data = BTI429_MsgDataRd(altitude.addr, hCore);
        airspeed.data = BTI429_MsgDataRd(airspeed.addr, hCore);
        
        // Display data with label and value information
        printf("\r"); // Return to beginning of line
        printf("Default: 0x%08X  ", msg_default.data);
        
        if (BTI429_MsgIsAccessed(altitude.addr, hCore)) {
            USHORT label = BTI429_FldGetLabel(altitude.data);
            ULONG value = BTI429_BNRGetMant(altitude.data, 20);
            printf("Altitude(L%03o): %lu  ", label, value);
        } else {
            printf("Altitude: No Data  ");
        }
        
        if (BTI429_MsgIsAccessed(airspeed.addr, hCore)) {
            USHORT label = BTI429_FldGetLabel(airspeed.data);
            ULONG value = BTI429_BNRGetMant(airspeed.data, 14);
            printf("Airspeed(L%03o): %lu  ", label, value);
        } else {
            printf("Airspeed: No Data  ");
        }
        
        // Sleep briefly
        Sleep(100);
        
        // Print a new line every 5 seconds
        if (count % 5 == 0 && count > 0) {
            printf("\n%d seconds elapsed...\n", count);
        }
        
        // Increment counter every second
        static DWORD lastTick = 0;
        DWORD currentTick = GetTickCount();
        if (currentTick - lastTick >= 1000) {
            count++;
            lastTick = currentTick;
        }
    }
    
    printf("\nTest completed. Stopping card.\n");
    
    // Stop the card
    BTICard_CardStop(hCore);
    
    // Close the Device
    BTICard_CardClose(hCard);
    
    printf("\nTest complete!\n");
    return 0;
}
```

This example demonstrates all the key components required for successful ARINC429 reception with the BTI429/UA2430 hardware. 
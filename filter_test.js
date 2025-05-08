const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

// Test filter functions
function testFilterFunctions() {
  try {
    console.log("Testing filterDefault and filterSet functions...");

    // 1. Open card and core
    const hCard = ua2430.openCardNum(0);
    if (!hCard) {
      console.error("Failed to open card");
      return;
    }
    console.log("Card opened successfully");

    const hCore = ua2430.openCore(hCard, 0);
    if (!hCore) {
      console.error("Failed to open core");
      ua2430.closeCard(hCard);
      return;
    }
    console.log("Core opened successfully");

    // 2. Reset and initialize the card
    ua2430.resetCard(hCore);
    console.log("Card reset");

    // 3. Configure channel as receiver (channel 0)
    const chanNum = 0;
    const configResult = ua2430.config429(0, chanNum, hCore); // Low speed (default)
    if (configResult !== 0) {
      console.error(`Failed to configure channel ${chanNum}, error: ${configResult}`);
      ua2430.closeCard(hCard);
      return;
    }
    console.log(`Channel ${chanNum} configured as receiver`);

    // 4. Set default filter for all labels
    const filterDefaultAddr = ua2430.filterDefault(0, chanNum, hCore);
    console.log(`Default filter created at address: 0x${filterDefaultAddr.toString(16)}`);

    // 5. Set specific filter for label 123 (octal 173) with SDI mask = all SDIs
    const label = 123; // Decimal 123 (octal 173)
    const sdiMask = 0x0F; // All SDIs
    const filterSetAddr = ua2430.filterSet(0, label, sdiMask, chanNum, hCore);
    console.log(`Specific filter for label ${label} created at address: 0x${filterSetAddr.toString(16)}`);

    // 6. Start the card and channel
    ua2430.startCard(hCore);
    const startResult = ua2430.start429(chanNum, hCore);
    if (startResult !== 1) {
      console.error(`Failed to start channel ${chanNum}, error: ${startResult}`);
    } else {
      console.log(`Channel ${chanNum} started successfully`);
    }

    // 7. Wait a bit and stop
    console.log("Waiting for 2 seconds...");
    setTimeout(() => {
      ua2430.stop429(chanNum, hCore);
      ua2430.stopCard(hCore);
      ua2430.closeCard(hCard);
      console.log("Card closed");
    }, 2000);

  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Run the test
testFilterFunctions(); 
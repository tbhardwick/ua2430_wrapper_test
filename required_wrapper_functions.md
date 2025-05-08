# Required Wrapper Functions for EXAMP3.C

The following wrapper functions are needed to fully support the EXAMP3.C example code:

1. `BTICard_CardOpen` - Open a card by number
2. `BTICard_CoreOpen` - Open a core on a card
3. `BTICard_CardReset` - Reset the card
4. `BTI429_ChConfig` - Configure ARINC 429 channels
5. `BTI429_MsgCreate` - Create message records
6. `BTI429_SchedBuild` - Build a transmission schedule
7. `BTI429_FldPutLabel` - Set label field in a message
8. `BTI429_BNRPutMant` - Set BNR mantissa data in a message
9. `BTI429_MsgDataWr` - Write data to a message record
10. `BTI429_FilterDefault` - Create a default receive filter
11. `BTI429_FilterSet` - Create a specific label/SDI filter
12. `BTICard_SeqConfig` - Configure sequential monitor
13. `BTICard_CardStart` - Start the card operation
14. `BTICard_SeqBlkRd` - Read blocks from sequential monitor
15. `BTICard_SeqFindInit` - Initialize sequential record search
16. `BTICard_SeqFindNext429` - Find next ARINC 429 record
17. `BTICard_SeqFindCheckVersion` - Check sequential record version
18. `BTICard_CardStop` - Stop card operation
19. `BTICard_CardClose` - Close the card

These functions represent the core API calls needed to implement the ARINC 429 monitor example showcased in EXAMP3.C, handling card operations, channel configuration, message creation, filtering, scheduling, and sequential monitoring. 
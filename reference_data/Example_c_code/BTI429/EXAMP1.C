
/**
*
*  BTI429 DRIVER EXAMPLE 1  (07/30/2024)
*  Copyright 2001-2024
*  Astronics Advanced Electronic Systems Corp.
*  www.astronics.com
*  Ballard.Support@astronics.com
*
*  NAME:   EXAMP1.C -- Receiver example
*
**/

/**
*
*  This program opens Card Number 0, and configures the
*  first compatible core to receive 2 GPS messages into
*  separate Message Records, and receive all other
*  messages into a default Message Record.
*
**/

#include "BTICard.h"
#include "BTI429.h"
#include <stdio.h>
#include <stdlib.h>
#include <conio.h>

#define	CARDNUM		  0
#define	MAX_CORES     4
#define	MAX_CHANNELS  32

void main(void)
{
	HCARD hCard;
	HCORE hCore;
	ERRVAL errval;
	INT corenum;
	INT rcvchan;
	MSGSTRUCT429 msgdefault;
	MSGSTRUCT429 latitude;
	MSGSTRUCT429 longitude;

	printf("\n    **********************************************************************");
	printf("\n    *                                                                    *");
	printf("\n    *  EXAMP1  (07/30/2024)                                              *");
	printf("\n    *  Copyright 2001-2024  Astronics Advanced Electronic Systems Corp.  *");
	printf("\n    *  Kirkland WA USA                                                   *");
	printf("\n    *  Go to www.astronics.com or email Ballard.Support@astronics.com    *");
	printf("\n    *                                                                    *");
	printf("\n    *  BTI429 Example 1                                                  *");
	printf("\n    *  \"Program for receiver example.\"                                   *");
	printf("\n    *                                                                    *");
	printf("\n    **********************************************************************");
	printf("\n");

/**
*
*  Open the card with the specified card number.
*  An error value is returned which is tested
*  to determine if an error occurred.
*
**/

	errval = BTICard_CardOpen(&hCard,CARDNUM);

	if (errval)
	{
		printf("\nError:  Either card number %u is not present, or",CARDNUM);
		printf("\n        an error occurred (%i) opening the card.",errval);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		exit(1);
	}

	printf("\nUsing ARINC 429 card #%d (%s,%s,S/N %04d)",CARDNUM,BTICard_CardTypeStr(hCard),BTICard_CardProductStr(hCard),BTICard_CardGetInfo(INFOTYPE_SERIALNUM,0,hCard));

/**
*
*  Find the first ARINC 429 core with a receive channel.
*
**/

	for (corenum=0;corenum<MAX_CORES;corenum++)
	{
		errval = BTICard_CoreOpen(&hCore,corenum,hCard);
		if (errval) break;

		for (rcvchan=0;rcvchan<MAX_CHANNELS;rcvchan++)	if (BTI429_ChIsRcv(rcvchan,hCore)) break;

		if (rcvchan != MAX_CHANNELS) break;
	}

	if (errval || corenum == MAX_CORES || rcvchan == MAX_CHANNELS)
	{
		printf("\nError:  No ARINC 429 receive channels present in cardnum %d.",CARDNUM);
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

	printf("\nUsing ARINC 429 core #%d",corenum);
	printf("\nUsing receive channel #%d",rcvchan);
	printf("\n");

/**
*
*  Configure receiver channel for automatic speed detection.
*
**/

	BTICard_CardReset(hCore);

	errval = BTI429_ChConfig(CHCFG429_AUTOSPEED,rcvchan,hCore);

	if (errval)
	{
		printf("\nError:  An error was encountered (%i) while configuring",errval);
		printf("\n        channel #%d on core #%d.",rcvchan,corenum);
		printf("\n        (%s)",BTICard_ErrDescStr(errval,hCard));
		printf("\n");
		BTICard_CardClose(hCard);
		exit(1);
	}

/**
*
*  Before any messages can be received, filters must be set
*  for the receive channel.  First, the default filter is
*  created.  Then, two filters are set for the two messages
*  of interest.
*
**/

	msgdefault.addr = BTI429_FilterDefault(MSGCRT429_DEFAULT,rcvchan,hCore);
	latitude.addr   = BTI429_FilterSet(MSGCRT429_DEFAULT,0310,SDIALL,rcvchan,hCore);
	longitude.addr  = BTI429_FilterSet(MSGCRT429_DEFAULT,0311,SDIALL,rcvchan,hCore);

/**
*
*  Start operation of the card.
*
**/

	BTICard_CardStart(hCore);

/**
*
*  Display data on the screen.
*
**/

	printf("\nPress any key to exit....\n\n");

	while(!_kbhit())
	{
		/*Read message records*/
		msgdefault.data = BTI429_MsgDataRd(msgdefault.addr,hCore);
		latitude.data   = BTI429_MsgDataRd(latitude.addr,hCore);
		longitude.data  = BTI429_MsgDataRd(longitude.addr,hCore);

		/*Display values*/
		printf("\r");
		printf("Default=%08lX ",msgdefault.data);
		printf("Latitude=%08lX ",latitude.data);
		printf("Longitude=%08lX",longitude.data);
	}

/**
*
*  Stop the card.
*
**/

	BTICard_CardStop(hCore);

/**
*
*  The card MUST be closed before exiting the program.
*
**/

	BTICard_CardClose(hCard);
}

%module ua2430
%{
#include "BTICard.H"
#include "BTI429.H"
%}

%inline %{
void *openCard(const char *cardstr) {
    HCARD handle;
    BTICard_CardOpenStr(&handle, cardstr);
    return (void *)handle;
}
void *openCore(void *cardHandle, int coreNum) {
    HCORE core;
    BTICard_CoreOpen(&core, coreNum, (HCARD)cardHandle);
    return (void *)core;
}
int config429(unsigned long config, int channum, void *coreHandle) {
    return BTI429_ChConfig(config, channum, (HCORE)coreHandle);
}
int start429(int channum, void *coreHandle) {
    return BTI429_ChStart(channum, (HCORE)coreHandle);
}
int stop429(int channum, void *coreHandle) {
    return BTI429_ChStop(channum, (HCORE)coreHandle);
}
void resetCard(void *coreHandle) {
    BTICard_CardReset((HCORE)coreHandle);
}
int startCard(void *coreHandle) {
    return BTICard_CardStart((HCORE)coreHandle);
}
int stopCard(void *coreHandle) {
    return BTICard_CardStop((HCORE)coreHandle);
}
int closeCard(void *cardHandle) {
    HCARD hCard = (HCARD)cardHandle;
    return BTICard_CardClose(&hCard);
}
void *openCardNum(int cardnum) {
    HCARD handle;
    BTICard_CardOpen(&handle, cardnum);
    return (void *)handle;
}
int buildSchedule(void *coreHandle, int channum, unsigned long msgAddr, int minInterval, int maxInterval) {
    MSGADDR msgarray[1];
    INT minarray[1];
    INT maxarray[1];
    
    msgarray[0] = msgAddr;
    minarray[0] = minInterval;
    maxarray[0] = maxInterval;
    
    return BTI429_SchedBuild(1, msgarray, minarray, maxarray, channum, (HCORE)coreHandle);
}
int buildSchedule3(void *coreHandle, int channum, 
                  unsigned long msgAddr1, int min1, int max1,
                  unsigned long msgAddr2, int min2, int max2,
                  unsigned long msgAddr3, int min3, int max3) {
    MSGADDR msgarray[3];
    INT minarray[3];
    INT maxarray[3];
    
    msgarray[0] = msgAddr1;
    msgarray[1] = msgAddr2;
    msgarray[2] = msgAddr3;
    
    minarray[0] = min1;
    minarray[1] = min2;
    minarray[2] = min3;
    
    maxarray[0] = max1;
    maxarray[1] = max2;
    maxarray[2] = max3;
    
    return BTI429_SchedBuild(3, msgarray, minarray, maxarray, channum, (HCORE)coreHandle);
}
unsigned long filterDefault(unsigned long config, int channum, void *coreHandle) {
    return BTI429_FilterDefault(config, channum, (HCORE)coreHandle);
}
unsigned long filterSet(unsigned long config, int labelval, int sdimask, int channum, void *coreHandle) {
    return BTI429_FilterSet(config, labelval, sdimask, channum, (HCORE)coreHandle);
}
%}

// Typedefs for handles
typedef void * HCARD;
typedef void * HCORE;

// Structs needed for BTICard_SeqFindInit and BTICard_SeqFindNext429
typedef struct {
    unsigned short *pRecFirst;
    unsigned short *pRecNext;
    unsigned short *pRecLast;
} SEQFINDINFO;
typedef SEQFINDINFO * LPSEQFINDINFO;

typedef struct {
    unsigned short type;
    unsigned short count;
    unsigned long timestamp;
    unsigned short activity;
    unsigned short decgap;
    unsigned long data;
    unsigned long timestamph;
} SEQRECORD429;
typedef SEQRECORD429 * LPSEQRECORD429;

// BTICard API
int BTICard_CardOpenStr(HCARD *lpHandle, const char *cardstr);
int BTICard_CoreOpen(HCORE *lphCore, int corenum, HCARD hCard);
int BTICard_CardClose(HCARD *handleval);
int BTICard_CardOpen(HCARD *lpHandle, int cardnum);
void BTICard_CardReset(HCORE handleval);
int BTICard_CardStart(HCORE handleval);
int BTICard_CardStop(HCORE handleval);

// BTI429 API
int BTI429_ChConfig(unsigned long configval, int channum, HCORE handleval);
int BTI429_ChStart(int channum, HCORE handleval);
int BTI429_ChStop(int channum, HCORE handleval);
unsigned long BTI429_MsgCreate(unsigned long configval, HCORE handleval);
unsigned long BTI429_ListXmtCreate(unsigned long listconfigval, int count, unsigned long msgaddr, HCORE handleval);
int BTI429_ListDataWr(unsigned long value, unsigned long listaddr, HCORE handleval);
void BTI429_MsgDataWr(unsigned long value, unsigned long msgaddr, HCORE handleval);
unsigned long BTI429_FldPutLabel(unsigned long msgval, unsigned short label);
int BTI429_SchedBuild(int nummsgs, unsigned long *msgaddr, int *minperiod, int *maxperiod, int channum, HCORE handleval);
unsigned long BTI429_MsgDataRd(unsigned long msgaddr, HCORE handleval);
unsigned long BTI429_BNRPutMant(unsigned long msg, unsigned long value, unsigned short sigbit, unsigned short twos);
unsigned long BTI429_FilterDefault(unsigned long configval, int channum, HCORE handleval);
unsigned long BTI429_FilterSet(unsigned long configval, int labelval, int sdimask, int channum, HCORE handleval);

// BTICard Sequential Monitor API
int BTICard_SeqConfig(unsigned long configval, HCORE handleval);
unsigned long BTICard_SeqBlkRd(unsigned short *buf, unsigned long bufcount, unsigned long *blkcnt, HCORE handleval);
int BTICard_SeqFindInit(unsigned short *seqbuf, unsigned long seqbufsize, LPSEQFINDINFO sfinfo);
int BTICard_SeqFindNext429(LPSEQRECORD429 *pRecord, LPSEQFINDINFO sfinfo);
int BTICard_SeqFindCheckVersion(unsigned short *pRecord, unsigned short version); 

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <winsock2.h>
#include <ws2tcpip.h>

#pragma comment(lib, "ws2_32.lib")

#define PORT 8080
#define MAX_PATIENTS 500
#define HASH_SIZE 101
#define BUF_SIZE 16384

typedef struct {
    char id[20];
    char name[60];
    int age;
    char gender[15];
    char problem[120];
    int priority;          /* 1 Critical, 2 Serious, 3 Moderate, 4 Normal */
} Patient;

/* ---------- PRIORITY QUEUE ---------- */
Patient pq[MAX_PATIENTS];
int pqCount = 0;

/* ---------- FIFO QUEUE ---------- */
Patient normalQ[MAX_PATIENTS];
int qFront = 0, qRear = 0;

/* ---------- HASH TABLE ---------- */
typedef struct HNode {
    Patient p;
    struct HNode *next;
} HNode;
HNode *hashTable[HASH_SIZE];

/* ---------- LINKED-LIST STACK: treatment history ---------- */
typedef struct HistoryNode {
    Patient p;
    struct HistoryNode *next;
} HistoryNode;
HistoryNode *historyTop = NULL;

int treatedCount = 0;

void url_decode(char *s) {
    char *src = s, *dst = s;
    while (*src) {
        if (*src == '+') {
            *dst++ = ' ';
            src++;
        } else if (*src == '%' && src[1] && src[2]) {
            int x;
            sscanf(src + 1, "%2x", &x);
            *dst++ = (char)x;
            src += 3;
        } else {
            *dst++ = *src++;
        }
    }
    *dst = '\0';
}

void json_escape(const char *src, char *dst, int max) {
    int j = 0;
    for (int i = 0; src[i] && j < max - 2; i++) {
        char c = src[i];
        if (c == '"' || c == '\\') {
            if (j < max - 3) {
                dst[j++] = '\\';
                dst[j++] = c;
            }
        } else if (c == '\n') {
            if (j < max - 3) { dst[j++]='\\'; dst[j++]='n'; }
        } else {
            dst[j++] = c;
        }
    }
    dst[j] = '\0';
}

int hashFunc(const char *id) {
    unsigned long h = 0;
    for (int i = 0; id[i]; i++) h = (h * 31 + (unsigned char)id[i]) % HASH_SIZE;
    return (int)h;
}

void addHash(Patient p) {
    int h = hashFunc(p.id);
    HNode *n = (HNode*)malloc(sizeof(HNode));
    n->p = p;
    n->next = hashTable[h];
    hashTable[h] = n;
}

Patient *findPatient(const char *id) {
    int h = hashFunc(id);
    HNode *n = hashTable[h];
    while (n) {
        if (strcmp(n->p.id, id) == 0) return &n->p;
        n = n->next;
    }
    return NULL;
}

int priorityValue(int p) {
    return p >= 1 && p <= 4 ? p : 4;
}

const char *priorityText(int p) {
    switch (p) {
        case 1: return "Critical";
        case 2: return "Serious";
        case 3: return "Moderate";
        default: return "Normal";
    }
}

/* Insert into min-priority heap. Smaller priority number = higher priority. */
void pqPush(Patient p) {
    if (pqCount >= MAX_PATIENTS) return;
    int i = pqCount++;
    pq[i] = p;
    while (i > 0) {
        int parent = (i - 1) / 2;
        if (pq[parent].priority <= pq[i].priority) break;
        Patient t = pq[parent]; pq[parent] = pq[i]; pq[i] = t;
        i = parent;
    }
}

Patient pqPop(void) {
    Patient result = pq[0];
    pqCount--;
    if (pqCount > 0) {
        pq[0] = pq[pqCount];
        int i = 0;
        while (1) {
            int l = 2*i+1, r = 2*i+2, smallest = i;
            if (l < pqCount && pq[l].priority < pq[smallest].priority) smallest = l;
            if (r < pqCount && pq[r].priority < pq[smallest].priority) smallest = r;
            if (smallest == i) break;
            Patient t = pq[i]; pq[i] = pq[smallest]; pq[smallest] = t;
            i = smallest;
        }
    }
    return result;
}

void normalPush(Patient p) {
    if (qRear < MAX_PATIENTS) normalQ[qRear++] = p;
}

Patient normalPop(void) {
    Patient p = normalQ[qFront++];
    if (qFront == qRear) qFront = qRear = 0;
    return p;
}

void historyPush(Patient p) {
    HistoryNode *n = (HistoryNode*)malloc(sizeof(HistoryNode));
    n->p = p;
    n->next = historyTop;
    historyTop = n;
    treatedCount++;
}

void addPatient(Patient p) {
    addHash(p);
    if (p.priority <= 3) pqPush(p);
    else normalPush(p);
}

void sendResponse(SOCKET client, const char *type, const char *body) {
    char header[512];
    sprintf(header,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Cache-Control: no-cache\r\n"
        "Content-Length: %d\r\n\r\n",
        type, (int)strlen(body));
    send(client, header, (int)strlen(header), 0);
    send(client, body, (int)strlen(body), 0);
}

void send404(SOCKET client) {
    const char *body = "Not Found";
    char header[256];
    sprintf(header, "HTTP/1.1 404 Not Found\r\nContent-Length: %d\r\n\r\n", (int)strlen(body));
    send(client, header, (int)strlen(header), 0);
    send(client, body, (int)strlen(body), 0);
}

int getParam(const char *body, const char *key, char *out, int max) {
    char pattern[64];
    sprintf(pattern, "%s=", key);
    const char *start = strstr(body, pattern);
    if (!start) { out[0] = '\0'; return 0; }
    start += strlen(pattern);
    int i = 0;
    while (*start && *start != '&' && i < max-1) out[i++] = *start++;
    out[i] = '\0';
    url_decode(out);
    return 1;
}

void patientJson(Patient *p, char *out, int max) {
    char id[80], name[120], gender[50], problem[240];
    json_escape(p->id,id,sizeof(id));
    json_escape(p->name,name,sizeof(name));
    json_escape(p->gender,gender,sizeof(gender));
    json_escape(p->problem,problem,sizeof(problem));
    snprintf(out,max,
        "{\"id\":\"%s\",\"name\":\"%s\",\"age\":%d,\"gender\":\"%s\",\"problem\":\"%s\",\"priority\":%d,\"priorityText\":\"%s\"}",
        id,name,p->age,gender,problem,p->priority,priorityText(p->priority));
}

int countCritical(void);

void queueJson(char *out, int max) {
    int pos = 0;
    pos += snprintf(out+pos,max-pos,"{\"emergency\":[");
    for (int i=0;i<pqCount;i++) {
        if (i) pos += snprintf(out+pos,max-pos,",");
        char item[600]; patientJson(&pq[i],item,sizeof(item));
        pos += snprintf(out+pos,max-pos,"%s",item);
    }
    pos += snprintf(out+pos,max-pos,"],\"normal\":[");
    for (int i=qFront;i<qRear;i++) {
        if (i>qFront) pos += snprintf(out+pos,max-pos,",");
        char item[600]; patientJson(&normalQ[i],item,sizeof(item));
        pos += snprintf(out+pos,max-pos,"%s",item);
    }
    pos += snprintf(out+pos,max-pos,"],\"history\":[");
    HistoryNode *h=historyTop; int first=1;
    while(h) {
        if(!first) pos += snprintf(out+pos,max-pos,",");
        first=0;
        char item[600]; patientJson(&h->p,item,sizeof(item));
        pos += snprintf(out+pos,max-pos,"%s",item);
        h=h->next;
    }
    pos += snprintf(out+pos,max-pos,"],\"total\":%d,\"critical\":%d,\"waiting\":%d,\"treated\":%d}",
        pqCount+qRear-qFront+treatedCount,
        countCritical(), pqCount+qRear-qFront, treatedCount);
}

int countCritical(void) {
    int c=0;
    for(int i=0;i<pqCount;i++) if(pq[i].priority==1) c++;
    return c;
}

void handleAdd(SOCKET client, const char *body) {
    Patient p;
    char age[20], priority[20];
    getParam(body,"id",p.id,sizeof(p.id));
    getParam(body,"name",p.name,sizeof(p.name));
    getParam(body,"age",age,sizeof(age));
    getParam(body,"gender",p.gender,sizeof(p.gender));
    getParam(body,"problem",p.problem,sizeof(p.problem));
    getParam(body,"priority",priority,sizeof(priority));
    p.age=atoi(age); p.priority=priorityValue(atoi(priority));

    if (!p.id[0] || !p.name[0]) {
        sendResponse(client,"application/json","{\"success\":false,\"message\":\"Patient ID and name are required.\"}");
        return;
    }
    if (findPatient(p.id)) {
        sendResponse(client,"application/json","{\"success\":false,\"message\":\"Patient ID already exists.\"}");
        return;
    }
    addPatient(p);
    sendResponse(client,"application/json","{\"success\":true,\"message\":\"Patient registered successfully.\"}");
}

void handleSearch(SOCKET client, const char *body) {
    char id[40], json[800];
    getParam(body,"id",id,sizeof(id));
    Patient *p=findPatient(id);
    if(!p) {
        sendResponse(client,"application/json","{\"success\":false,\"message\":\"Patient not found.\"}");
        return;
    }
    patientJson(p,json,sizeof(json));
    char response[1000];
    snprintf(response,sizeof(response),"{\"success\":true,\"patient\":%s}",json);
    sendResponse(client,"application/json",response);
}

void handleTreat(SOCKET client, const char *body) {
    char type[20]; getParam(body,"type",type,sizeof(type));
    Patient p; int ok=0;
    if(strcmp(type,"emergency")==0 && pqCount>0) {
        p=pqPop(); ok=1;
    } else if(strcmp(type,"normal")==0 && qRear>qFront) {
        p=normalPop(); ok=1;
    }
    if(!ok) {
        sendResponse(client,"application/json","{\"success\":false,\"message\":\"No patient available in this queue.\"}");
        return;
    }
    historyPush(p);
    sendResponse(client,"application/json","{\"success\":true,\"message\":\"Patient treated successfully.\"}");
}

void handleClient(SOCKET client) {
    char req[BUF_SIZE+1];
    int n=recv(client,req,BUF_SIZE,0);
    if(n<=0){ closesocket(client); return; }
    req[n]='\0';

    char method[10], path[256];
    sscanf(req,"%9s %255s",method,path);

    if(strcmp(method,"GET")==0 && (strcmp(path,"/")==0 || strcmp(path,"/index.html")==0)) {
        FILE *f=fopen("index.html","rb");
        if(!f){ send404(client); closesocket(client); return; }
        fseek(f,0,SEEK_END); long len=ftell(f); rewind(f);
        char *data=(char*)malloc(len+1); fread(data,1,len,f); data[len]='\0'; fclose(f);
        sendResponse(client,"text/html; charset=UTF-8",data); free(data);
    }
    else if(strcmp(method,"GET")==0 && strcmp(path,"/style.css")==0) {
        FILE *f=fopen("style.css","rb");
        if(!f){ send404(client); closesocket(client); return; }
        fseek(f,0,SEEK_END); long len=ftell(f); rewind(f);
        char *data=(char*)malloc(len+1); fread(data,1,len,f); data[len]='\0'; fclose(f);
        sendResponse(client,"text/css; charset=UTF-8",data); free(data);
    }
    else if(strcmp(method,"GET")==0 && strcmp(path,"/script.js")==0) {
        FILE *f=fopen("script.js","rb");
        if(!f){ send404(client); closesocket(client); return; }
        fseek(f,0,SEEK_END); long len=ftell(f); rewind(f);
        char *data=(char*)malloc(len+1); fread(data,1,len,f); data[len]='\0'; fclose(f);
        sendResponse(client,"application/javascript; charset=UTF-8",data); free(data);
    }
    else if(strcmp(method,"GET")==0 && strcmp(path,"/queue")==0) {
        char json[12000]; queueJson(json,sizeof(json));
        sendResponse(client,"application/json",json);
    }
    else if(strcmp(method,"POST")==0 && strcmp(path,"/add")==0) {
        const char *body=strstr(req,"\r\n\r\n");
        handleAdd(client,body?body+4:"");
    }
    else if(strcmp(method,"POST")==0 && strcmp(path,"/search")==0) {
        const char *body=strstr(req,"\r\n\r\n");
        handleSearch(client,body?body+4:"");
    }
    else if(strcmp(method,"POST")==0 && strcmp(path,"/treat")==0) {
        const char *body=strstr(req,"\r\n\r\n");
        handleTreat(client,body?body+4:"");
    }
    else send404(client);

    closesocket(client);
}

int main(void) {
    WSADATA wsa;
    SOCKET server, client;
    struct sockaddr_in addr;
    int opt=1;

    printf("\n============================================\n");
    printf("   MEDQUEUE - HOSPITAL EMERGENCY SYSTEM\n");
    printf("============================================\n");

    if(WSAStartup(MAKEWORD(2,2),&wsa)!=0) {
        printf("WSAStartup failed.\n"); return 1;
    }

    server=socket(AF_INET,SOCK_STREAM,0);
    if(server==INVALID_SOCKET){ printf("Socket creation failed.\n"); WSACleanup(); return 1; }

    setsockopt(server,SOL_SOCKET,SO_REUSEADDR,(const char*)&opt,sizeof(opt));

    addr.sin_family=AF_INET;
    addr.sin_addr.s_addr=INADDR_ANY;
    addr.sin_port=htons(PORT);

    if(bind(server,(struct sockaddr*)&addr,sizeof(addr))==SOCKET_ERROR) {
        printf("Bind failed. Port %d may already be in use.\n",PORT);
        closesocket(server); WSACleanup(); return 1;
    }
    if(listen(server,10)==SOCKET_ERROR) {
        printf("Listen failed.\n"); closesocket(server); WSACleanup(); return 1;
    }

    printf("\nServer running at: http://localhost:%d\n",PORT);
    printf("Keep this window open while using the website.\n\n");

    while(1) {
        client=accept(server,NULL,NULL);
        if(client!=INVALID_SOCKET) handleClient(client);
    }

    closesocket(server);
    WSACleanup();
    return 0;
}

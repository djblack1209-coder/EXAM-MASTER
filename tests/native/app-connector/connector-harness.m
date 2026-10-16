#import <Foundation/Foundation.h>
#import "YoziConnectorTransport.h"
#include <stdio.h>

static NSString *decode(NSString *v) {return [[NSString alloc] initWithData:[[NSData alloc] initWithBase64EncodedString:v options:0] encoding:NSUTF8StringEncoding];}
static NSString *encode(id v) {return [[[v description] dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0];}
static id scalar(NSString *v) {return [NSJSONSerialization JSONObjectWithData:[v dataUsingEncoding:NSUTF8StringEncoding] options:NSJSONReadingFragmentsAllowed error:nil];}
static void emit(NSDictionary *v) {
    NSString *line=[NSString stringWithFormat:@"result\t%@\t%@\t%@\t%@\t%@\t%@\t%@\t%@\t%@\n",encode(v[@"id"]),v[@"code"]?:@"-",v[@"status"]?:@0,v[@"receivedBytes"]?:@0,encode(v[@"body"]?:@""),v[@"kind"]?:@"-",v[@"sequence"]?:@0,encode(v[@"contentType"]?:@""),[v[@"chunk"] base64EncodedStringWithOptions:0]?:@""];
    @synchronized(YoziConnectorTransport.class) {fputs(line.UTF8String,stdout);fflush(stdout);}
}
int main(void) {
    @autoreleasepool {
        NSDictionary *material=[YoziConnectorTransport capabilities][@"materialParse"];
        if(![material[@"contract"] isEqual:@"yozi-material-parse-v1"] || ![material[@"timeoutMs"] isEqual:@100000])return 2;
        YoziConnectorTransport *transport=[YoziConnectorTransport new];char *line=NULL;size_t size=0;
        fputs("ready\n",stdout);fflush(stdout);
        while(getline(&line,&size,stdin)>0) {
            @autoreleasepool {
                NSString *raw=[[NSString alloc] initWithUTF8String:line];
                NSArray<NSString *> *p=[[raw stringByTrimmingCharactersInSet:NSCharacterSet.newlineCharacterSet] componentsSeparatedByString:@"\t"];
                if([p[0] isEqual:@"cancel"]) {[transport cancel:decode(p[1])];continue;}
                if([p[0] isEqual:@"close"]) {[transport close];continue;}
                NSMutableDictionary *o=[@{@"id":decode(p[1]),@"url":decode(p[2]),@"method":decode(p[3]),@"token":decode(p[4]),@"allowedOrigins":[decode(p[5]) componentsSeparatedByString:@"\n"],@"timeout":scalar(p[7]),@"limit":scalar(p[8]),@"consent":scalar(p[9])} mutableCopy];
                if(![p[6] isEqual:@"-"])o[@"body"]=decode(p[6]);
                if([p[0] isEqual:@"stream"])[transport stream:o completion:^(NSDictionary *v){emit(v);}];else [transport request:o completion:^(NSDictionary *v){emit(v);}];
            }
        }
        free(line);[transport close];
    }
    return 0;
}

#import <Foundation/Foundation.h>
#import "WenliConnectorTransport.h"
#include <stdio.h>

static NSString *decode(NSString *v) {return [[NSString alloc] initWithData:[[NSData alloc] initWithBase64EncodedString:v options:0] encoding:NSUTF8StringEncoding];}
static NSString *encode(id v) {return [[[v description] dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0];}
static void emit(NSDictionary *v) {
    NSString *line=[NSString stringWithFormat:@"result\t%@\t%@\t%@\t%@\t%@\n",encode(v[@"id"]),v[@"code"]?:@"-",v[@"status"]?:@0,v[@"receivedBytes"]?:@0,encode(v[@"body"]?:@"")];
    @synchronized(WenliConnectorTransport.class) {fputs(line.UTF8String,stdout);fflush(stdout);}
}
int main(void) {
    @autoreleasepool {
        WenliConnectorTransport *transport=[WenliConnectorTransport new];char *line=NULL;size_t size=0;
        while(getline(&line,&size,stdin)>0) {
            @autoreleasepool {
                NSString *raw=[[NSString alloc] initWithUTF8String:line];
                NSArray<NSString *> *p=[[raw stringByTrimmingCharactersInSet:NSCharacterSet.newlineCharacterSet] componentsSeparatedByString:@"\t"];
                if([p[0] isEqual:@"cancel"]) {[transport cancel:decode(p[1])];continue;}
                if([p[0] isEqual:@"close"]) {[transport close];continue;}
                NSMutableDictionary *o=[@{@"id":decode(p[1]),@"url":decode(p[2]),@"method":decode(p[3]),@"token":decode(p[4]),@"allowedOrigins":[decode(p[5]) componentsSeparatedByString:@"\n"],@"timeout":@(p[7].doubleValue),@"limit":@(p[8].doubleValue),@"consent":@([p[9] isEqual:@"true"])} mutableCopy];
                if(![p[6] isEqual:@"-"])o[@"body"]=decode(p[6]);
                [transport request:o completion:^(NSDictionary *v){emit(v);}];
            }
        }
        free(line);[transport close];
    }
    return 0;
}

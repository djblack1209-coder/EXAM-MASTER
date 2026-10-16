#import "YoziMaterialFiles.h"
static NSString *root;static NSUInteger serial;
static void require(BOOL ok){if(!ok){fprintf(stderr,"native material assertion\n");exit(1);}}
static void check(NSString *name){printf("check\t%s\n",name.UTF8String);}
static NSURL *file(NSString *suffix,NSData *data){NSString *p=[root stringByAppendingPathComponent:[NSString stringWithFormat:@"synthetic_%lu%@",(unsigned long)++serial,suffix]];require([data writeToFile:p atomically:YES]);return [NSURL fileURLWithPath:p];}
static NSDictionary *await(void (^run)(void (^)(NSDictionary *))){dispatch_semaphore_t done=dispatch_semaphore_create(0);__block NSDictionary *r;run(^(NSDictionary *v){r=v;dispatch_semaphore_signal(done);});require(dispatch_semaphore_wait(done,dispatch_time(DISPATCH_TIME_NOW,12*NSEC_PER_SEC))==0);return r;}
static NSDictionary *pick(YoziMaterialFiles *core,NSURL *url){NSDictionary *r=await(^(void (^done)(NSDictionary *)){[core selectURL:url identifier:[NSString stringWithFormat:@"s_%lu",(unsigned long)++serial] completion:done];});require(!r[@"code"]);return r[@"file"];}
static NSDictionary *readFile(YoziMaterialFiles *core,NSString *handle,id consent){return await(^(void (^done)(NSDictionary *)){[core read:@{@"id":[NSString stringWithFormat:@"r_%lu",(unsigned long)++serial],@"handle":handle,@"consent":consent} completion:done];});}
static void code(NSDictionary *r,NSString *c){require([r[@"code"] isEqual:c] && !r[@"contentBase64"] && !r[@"url"]);}
/** 实际NSFileCoordinator与注册FilePresenter协商；故意延迟放行合成文件。 */
@interface GatePresenter : NSObject <NSFilePresenter>
@property (copy) NSURL *presentedItemURL;
@property NSOperationQueue *presentedItemOperationQueue;
@property dispatch_semaphore_t entered;
@property dispatch_semaphore_t permit;
@end
@implementation GatePresenter
- (instancetype)init{if((self=[super init])){_presentedItemOperationQueue=[NSOperationQueue new];_presentedItemOperationQueue.maxConcurrentOperationCount=1;_entered=dispatch_semaphore_create(0);_permit=dispatch_semaphore_create(0);}return self;}
- (void)relinquishPresentedItemToReader:(void (^)(void (^)(void)))reader{dispatch_semaphore_signal(_entered);dispatch_semaphore_wait(_permit,dispatch_time(DISPATCH_TIME_NOW,14*NSEC_PER_SEC));reader(^{});}
@end
int main(int argc,const char *argv[]){@autoreleasepool{
    require(argc==2);root=[NSString stringWithUTF8String:argv[1]];require([NSFileManager.defaultManager createDirectoryAtPath:root withIntermediateDirectories:YES attributes:nil error:nil]);
    require([[YoziMaterialFiles capabilities][@"maxBytes"] unsignedIntegerValue]==10485760);check(@"capabilities");
    YoziMaterialFiles *core=[YoziMaterialFiles new];NSURL *url=file(@".pdf",[@"test" dataUsingEncoding:NSUTF8StringEncoding]);NSDictionary *picked=pick(core,url);
    require([NSSet setWithArray:picked.allKeys].count==3 && picked[@"handle"] && picked[@"name"] && picked[@"size"]);check(@"metadata-only-contract");
    code(readFile(core,picked[@"handle"],@NO),@"CONSENT_REQUIRED");code(readFile(core,picked[@"handle"],@1),@"CONSENT_REQUIRED");check(@"strict-consent");
    require([readFile(core,picked[@"handle"],@YES)[@"contentBase64"] isEqual:@"dGVzdA=="]);check(@"approved-real-file");
    code(readFile(core,picked[@"handle"],@YES),@"FILE_EXPIRED");check(@"consumed-handle");[core close];
    for(NSNumber *n in @[@1,@2,@3,@255,@256,@8193]){
        NSMutableData *data=[NSMutableData dataWithLength:n.unsignedIntegerValue];uint8_t *bytes=data.mutableBytes;for(NSUInteger i=0;i<data.length;i++)bytes[i]=(uint8_t)i;
        core=[YoziMaterialFiles new];NSString *h=pick(core,file(@".PNG",data))[@"handle"];require([readFile(core,h,@YES)[@"contentBase64"] isEqual:[data base64EncodedStringWithOptions:0]]);check([@"exact-base64-" stringByAppendingString:n.stringValue]);[core close];
    }
    for(NSString *suffix in @[@".exe",@"\xC2\x85.pdf",@"\u202e.pdf",@"\u2066.pdf"]){core=[YoziMaterialFiles new];NSURL *u=file(suffix,[NSData dataWithBytes:"x" length:1]);code(await(^(void (^done)(NSDictionary *)){[core selectURL:u identifier:@"reject" completion:done];}),@"FILE_TYPE");check([NSString stringWithFormat:@"unsafe-name-%lu",(unsigned long)++serial]);[core close];}
    for(NSNumber *size in @[@0,@10485761]){core=[YoziMaterialFiles new];NSURL *u=file(@".pdf",[NSData data]);NSFileHandle *out=[NSFileHandle fileHandleForWritingAtPath:u.path];[out truncateFileAtOffset:size.unsignedLongLongValue];[out closeFile];code(await(^(void (^done)(NSDictionary *)){[core selectURL:u identifier:@"limit" completion:done];}),@"FILE_LIMIT");check(size.unsignedIntegerValue?@"oversize":@"empty");[core close];}
    core=[YoziMaterialFiles new];NSString *h=pick(core,url)[@"handle"];pick(core,url);code(await(^(void (^done)(NSDictionary *)){[core selectURL:url identifier:@"third" completion:done];}),@"FILE_LIMIT");check(@"two-handle-limit");[core releaseHandle:h];code(readFile(core,h,@YES),@"FILE_EXPIRED");check(@"release-handle");[core close];
    core=[YoziMaterialFiles new];h=pick(core,url)[@"handle"];require([[@"changed" dataUsingEncoding:NSUTF8StringEncoding] writeToURL:url atomically:YES]);code(readFile(core,h,@YES),@"FILE_CHANGED");check(@"changed-before-open");[core close];
    core=[YoziMaterialFiles new];NSURL *link=file(@".pdf",[NSData data]);[NSFileManager.defaultManager removeItemAtURL:link error:nil];require([NSFileManager.defaultManager createSymbolicLinkAtURL:link withDestinationURL:url error:nil]);code(await(^(void (^done)(NSDictionary *)){[core selectURL:link identifier:@"symlink" completion:done];}),@"FILE_TYPE");check(@"symlink-rejected");[core close];
    for(NSString *mode in @[@"cancel",@"timeout",@"close",@"release"]){
        core=[YoziMaterialFiles new];NSString *handle=pick(core,url)[@"handle"];GatePresenter *gate=[GatePresenter new];gate.presentedItemURL=url;[NSFileCoordinator addFilePresenter:gate];
        dispatch_semaphore_t done=dispatch_semaphore_create(0);__block NSDictionary *r;__block NSUInteger count=0;
        [core read:@{@"id":@"pending",@"handle":handle,@"consent":@YES} completion:^(NSDictionary *value){@synchronized(gate){count++;r=value;}dispatch_semaphore_signal(done);}];
        require(dispatch_semaphore_wait(gate.entered,dispatch_time(DISPATCH_TIME_NOW,2*NSEC_PER_SEC))==0);
        if([mode isEqual:@"cancel"]){code(readFile(core,handle,@YES),@"BUSY");check(@"busy");code(await(^(void (^cb)(NSDictionary *)){[core read:@{@"id":@"pending",@"handle":handle,@"consent":@YES} completion:cb];}),@"REQUEST_CONFLICT");check(@"duplicate-id");}
        NSTimeInterval at=NSProcessInfo.processInfo.systemUptime;if([mode isEqual:@"cancel"])[core cancel:@"pending"];else if([mode isEqual:@"close"])[core close];else if([mode isEqual:@"release"])[core releaseHandle:handle];
        require(dispatch_semaphore_wait(done,dispatch_time(DISPATCH_TIME_NOW,12*NSEC_PER_SEC))==0);code(r,[mode isEqual:@"timeout"]?@"TIMEOUT":@"CANCELLED");if(![mode isEqual:@"timeout"])require(NSProcessInfo.processInfo.systemUptime-at<0.4);
        dispatch_semaphore_signal(gate.permit);[NSFileCoordinator removeFilePresenter:gate];[gate.presentedItemOperationQueue waitUntilAllOperationsAreFinished];[NSThread sleepForTimeInterval:0.1];@synchronized(gate){require(count==1);}code(readFile(core,handle,@YES),@"FILE_EXPIRED");check([mode stringByAppendingString:@"-one-callback"]);[core close];
    }
    core=[YoziMaterialFiles new];code(await(^(void (^done)(NSDictionary *)){[core selectURL:[NSURL URLWithString:@"https://invalid.invalid/a.pdf"] identifier:@"remote" completion:done];}),@"INVALID_REQUEST");check(@"non-file-url-rejected");[core close];
    puts("ok");return 0;
}}

#import "YoziMaterialFiles.h"
static const NSUInteger YoziFileLimit=10*1024*1024;
@interface YoziMaterialJob : NSObject
@property NSString *identifier;
@property NSString *handle;
@property NSFileCoordinator *coordinator;
@property NSInputStream *stream;
@property NSLock *lock;
@property NSOperationQueue *cleanup;
@property BOOL finished;
@property dispatch_source_t timer;
@property (copy) void (^completion)(NSDictionary *);
- (BOOL)finish:(NSDictionary *)value;
- (void)fail:(NSString *)code;
@end
@implementation YoziMaterialJob
- (BOOL)finish:(NSDictionary *)value {
    [self.lock lock];if(self.finished){[self.lock unlock];return NO;}self.finished=YES;
    NSFileCoordinator *coordinator=self.coordinator;NSInputStream *stream=self.stream;
    void (^callback)(NSDictionary *)=self.completion;self.completion=nil;[self.lock unlock];
    if(self.timer)dispatch_source_cancel(self.timer);
    if(callback)callback(value);
    if(self.cleanup.operationCount<6)[self.cleanup addOperationWithBlock:^{[coordinator cancel];[stream close];}];
    return YES;
}
- (void)fail:(NSString *)code {[self finish:@{@"id":self.identifier,@"code":code}];}
@end

@implementation YoziMaterialFiles {NSMutableDictionary *_files;NSMutableDictionary *_jobs;NSLock *_lock;NSOperationQueue *_worker;NSOperationQueue *_cleanup;BOOL _closed;}
+ (NSDictionary *)capabilities {return @{@"contract":@"wenli-app-file-v1",@"selection":@"system",@"read":@"after_consent",@"handles":@"ephemeral",@"maxBytes":@(YoziFileLimit),@"boundedRead":@YES,@"cancel":@YES};}
- (instancetype)init {if((self=[super init])){_files=[NSMutableDictionary new];_jobs=[NSMutableDictionary new];_lock=[NSLock new];_worker=[NSOperationQueue new];_worker.maxConcurrentOperationCount=1;_cleanup=[NSOperationQueue new];_cleanup.maxConcurrentOperationCount=2;}return self;}
static BOOL identifierValid(NSString *value){return [value isKindOfClass:NSString.class] && [[NSPredicate predicateWithFormat:@"SELF MATCHES %@",@"[A-Za-z0-9_-]{1,128}"] evaluateWithObject:value];}
static BOOL safeName(NSString *name){
    if(![name isKindOfClass:NSString.class] || name.length>200 || ![@[@"pdf",@"png",@"jpg",@"jpeg"] containsObject:name.pathExtension.lowercaseString])return NO;
    for(NSUInteger i=0;i<name.length;i++){unichar c=[name characterAtIndex:i];if(c=='/' || c=='\\' || c<=0x1f || (c>=0x7f && c<=0x9f) || (c>=0x2028 && c<=0x202e) || (c>=0x2066 && c<=0x2069))return NO;}
    return YES;
}
static NSDictionary *metadata(NSURL *url){
    [url removeAllCachedResourceValues];NSError *error=nil;
    NSDictionary *v=[url resourceValuesForKeys:@[NSURLNameKey,NSURLFileSizeKey,NSURLContentModificationDateKey,NSURLIsRegularFileKey,NSURLIsSymbolicLinkKey] error:&error];
    if(error || ![v[NSURLIsRegularFileKey] boolValue] || [v[NSURLIsSymbolicLinkKey] boolValue])return nil;
    NSString *name=v[NSURLNameKey];NSNumber *size=v[NSURLFileSizeKey];
    if(!safeName(name) || ![size isKindOfClass:NSNumber.class])return nil;
    return @{@"name":name,@"size":size,@"modified":v[NSURLContentModificationDateKey]?:NSNull.null};
}
- (YoziMaterialJob *)start:(NSString *)identifier handle:(NSString *)handle completion:(void (^)(NSDictionary *))completion {
    if(!completion)return nil;
    if(!identifierValid(identifier)){completion(@{@"id":@"",@"code":@"INVALID_REQUEST"});return nil;}
    [_lock lock];
    if(_closed || _jobs.count || _worker.operationCount>=2 || _cleanup.operationCount>=6){NSString *code=_closed?@"CANCELLED":_jobs[identifier]?@"REQUEST_CONFLICT":@"BUSY";[_lock unlock];completion(@{@"id":identifier,@"code":code});return nil;}
    YoziMaterialJob *job=[YoziMaterialJob new];job.identifier=identifier;job.handle=handle;job.lock=[NSLock new];job.cleanup=_cleanup;job.coordinator=[[NSFileCoordinator alloc] initWithFilePresenter:nil];
    __weak YoziMaterialFiles *weakSelf=self;
    job.completion=^(NSDictionary *value){YoziMaterialFiles *strong=weakSelf;if(strong){[strong->_lock lock];[strong->_jobs removeObjectForKey:identifier];if(handle)[strong->_files removeObjectForKey:handle];[strong->_lock unlock];}completion(value);};
    job.timer=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,dispatch_get_global_queue(QOS_CLASS_UTILITY,0));__weak YoziMaterialJob *weakJob=job;
    dispatch_source_set_timer(job.timer,dispatch_time(DISPATCH_TIME_NOW,10*NSEC_PER_SEC),DISPATCH_TIME_FOREVER,0);dispatch_source_set_event_handler(job.timer,^{[weakJob fail:@"TIMEOUT"];});_jobs[identifier]=job;dispatch_resume(job.timer);[_lock unlock];return job;
}
- (void)expire {NSArray *handles=_files.allKeys;for(NSString *handle in handles)if(NSProcessInfo.processInfo.systemUptime-[_files[handle][@"created"] doubleValue]>600)[_files removeObjectForKey:handle];}
- (void)selectURL:(NSURL *)url identifier:(NSString *)identifier completion:(void (^)(NSDictionary *))completion {
    if(!completion)return;if(![url isKindOfClass:NSURL.class] || !url.isFileURL){completion(@{@"id":identifierValid(identifier)?identifier:@"",@"code":@"INVALID_REQUEST"});return;}
    [_lock lock];[self expire];BOOL full=_files.count>=2;[_lock unlock];if(full){completion(@{@"id":identifierValid(identifier)?identifier:@"",@"code":@"FILE_LIMIT"});return;}
    YoziMaterialJob *job=[self start:identifier handle:nil completion:completion];if(!job)return;
    [_worker addOperationWithBlock:^{
        BOOL scope=[url startAccessingSecurityScopedResource];
        @try {
            NSError *error=nil;
            [job.coordinator coordinateReadingItemAtURL:url options:NSFileCoordinatorReadingWithoutChanges error:&error byAccessor:^(NSURL *selected){
                [job.lock lock];BOOL ended=job.finished;[job.lock unlock];if(ended)return;
                NSDictionary *info=metadata(selected);if(!info){[job fail:@"FILE_TYPE"];return;}
                if([info[@"size"] longLongValue]<=0 || [info[@"size"] unsignedLongLongValue]>YoziFileLimit){[job fail:@"FILE_LIMIT"];return;}
                NSString *handle=[@"file_" stringByAppendingString:NSUUID.UUID.UUIDString.lowercaseString];
                [self->_lock lock];[job.lock lock];BOOL valid=!job.finished && !self->_closed;[job.lock unlock];if(valid)self->_files[handle]=@{@"url":url,@"metadata":info,@"created":@(NSProcessInfo.processInfo.systemUptime)};[self->_lock unlock];if(!valid)return;
                NSDictionary *file=@{@"handle":handle,@"name":info[@"name"],@"size":info[@"size"]};
                if(![job finish:@{@"id":identifier,@"file":file}]){[self->_lock lock];[self->_files removeObjectForKey:handle];[self->_lock unlock];}
            }];
            if(error)[job fail:@"FILE_READ_FAILED"];
        }@catch(NSException *exception){[job fail:@"FILE_READ_FAILED"];}
        @finally{if(scope)[url stopAccessingSecurityScopedResource];}
    }];
}
- (void)read:(NSDictionary *)options completion:(void (^)(NSDictionary *))completion {
    if(!completion)return;
    if(![options isKindOfClass:NSDictionary.class] || !identifierValid(options[@"id"]) || ![options[@"handle"] isKindOfClass:NSString.class]){completion(@{@"id":@"",@"code":@"INVALID_REQUEST"});return;}
    NSString *identifier=options[@"id"],*handle=options[@"handle"];
    id consent=options[@"consent"];
    if(![consent isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)consent)!=CFBooleanGetTypeID() || ![consent boolValue]){completion(@{@"id":identifier,@"code":@"CONSENT_REQUIRED"});return;}
    [_lock lock];[self expire];NSDictionary *entry=_files[handle];[_lock unlock];if(!entry){completion(@{@"id":identifier,@"code":@"FILE_EXPIRED"});return;}
    YoziMaterialJob *job=[self start:identifier handle:handle completion:completion];if(!job)return;NSURL *url=entry[@"url"];
    [_worker addOperationWithBlock:^{
        BOOL scope=[url startAccessingSecurityScopedResource];
        @try{
            NSError *error=nil;
            [job.coordinator coordinateReadingItemAtURL:url options:NSFileCoordinatorReadingWithoutChanges error:&error byAccessor:^(NSURL *selected){
                [job.lock lock];BOOL ended=job.finished;[job.lock unlock];if(ended)return;
                NSDictionary *before=metadata(selected);if(!before || ![before isEqual:entry[@"metadata"]]){[job fail:@"FILE_CHANGED"];return;}
                NSInputStream *stream=[NSInputStream inputStreamWithURL:selected];
                [job.lock lock];ended=job.finished;if(!ended)job.stream=stream;[job.lock unlock];if(ended)return;
                [stream open];NSMutableData *data=[NSMutableData new];uint8_t part[8192];
                while(YES){[job.lock lock];BOOL done=job.finished;[job.lock unlock];if(done)return;NSInteger n=[stream read:part maxLength:MIN(sizeof(part),[before[@"size"] unsignedIntegerValue]-data.length+1)];if(n<0){[job fail:@"FILE_READ_FAILED"];return;}if(n==0)break;if(data.length+(NSUInteger)n>[before[@"size"] unsignedIntegerValue] || data.length+(NSUInteger)n>YoziFileLimit){[job fail:@"FILE_CHANGED"];return;}[data appendBytes:part length:(NSUInteger)n];}
                if(data.length!=[before[@"size"] unsignedIntegerValue] || ![before isEqual:metadata(selected)]){[job fail:@"FILE_CHANGED"];return;}
                [job finish:@{@"id":identifier,@"handle":handle,@"name":before[@"name"],@"size":before[@"size"],@"contentBase64":[data base64EncodedStringWithOptions:0]}];
            }];if(error)[job fail:@"FILE_READ_FAILED"];
        }@catch(NSException *exception){[job fail:@"FILE_READ_FAILED"];}
        @finally{[job.stream close];if(scope)[url stopAccessingSecurityScopedResource];}
    }];
}
- (void)cancel:(NSString *)identifier {if(![identifier isKindOfClass:NSString.class])return;[_lock lock];YoziMaterialJob *job=_jobs[identifier];[_lock unlock];[job fail:@"CANCELLED"];}
- (void)releaseHandle:(NSString *)handle {if(![handle isKindOfClass:NSString.class])return;[_lock lock];[_files removeObjectForKey:handle];NSArray *jobs=_jobs.allValues;[_lock unlock];for(YoziMaterialJob *job in jobs)if([job.handle isEqual:handle])[job fail:@"CANCELLED"];}
- (void)close {[_lock lock];_closed=YES;[_files removeAllObjects];NSArray *jobs=_jobs.allValues;[_lock unlock];for(YoziMaterialJob *job in jobs)[job fail:@"CANCELLED"];[_worker cancelAllOperations];}
@end

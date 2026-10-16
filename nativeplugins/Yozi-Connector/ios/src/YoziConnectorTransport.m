#import "YoziConnectorTransport.h"

static NSString * const YoziOrigin = @"https://wenli-app.invalid";
@interface YoziConnectorJob : NSObject <NSURLSessionDataDelegate>
@property NSString *identifier;
@property NSMutableData *data;
@property NSUInteger limit;
@property NSUInteger status;
@property NSURLSession *session;
@property NSURLSessionDataTask *task;
@property dispatch_source_t timer;
@property NSRecursiveLock *lock;
@property BOOL finished;
@property BOOL streaming;
@property NSUInteger sequence;
@property NSUInteger chunks;
@property (copy) void (^completion)(NSDictionary *);
- (void)fail:(NSString *)code;
- (BOOL)event:(NSDictionary *)value;
@end
@implementation YoziConnectorJob
- (void)finish:(NSDictionary *)value {
    [self.lock lock]; if (self.finished) { [self.lock unlock]; return; } self.finished=YES;
    NSMutableDictionary *result=[value mutableCopy];
    if(self.streaming && !result[@"code"]){result[@"kind"]=@"complete";result[@"sequence"]=@(++self.sequence);}
    if(self.timer)dispatch_source_cancel(self.timer);
    [self.session invalidateAndCancel]; self.task=nil; self.session=nil;
    void (^callback)(NSDictionary *)=self.completion; self.completion=nil;
    if(callback)callback(result);
    [self.lock unlock];
}
- (BOOL)event:(NSDictionary *)value {
    [self.lock lock];if(self.finished){[self.lock unlock];return NO;}
    NSMutableDictionary *result=[value mutableCopy];result[@"id"]=self.identifier;result[@"sequence"]=@(++self.sequence);
    if(self.completion)self.completion(result);
    BOOL active=!self.finished;[self.lock unlock];return active;
}
- (void)fail:(NSString *)code { [self finish:@{@"id":self.identifier,@"code":code}]; }
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request completionHandler:(void (^)(NSURLRequest *))handler {
    handler(nil); [self fail:@"REDIRECT_FORBIDDEN"];
}
- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)task didReceiveResponse:(NSURLResponse *)response completionHandler:(void (^)(NSURLSessionResponseDisposition))handler {
    if(![response isKindOfClass:NSHTTPURLResponse.class]) {handler(NSURLSessionResponseCancel);[self fail:@"INVALID_RESPONSE"];return;}
    NSHTTPURLResponse *http=(NSHTTPURLResponse *)response; self.status=http.statusCode;
    BOOL location=NO; NSString *length=nil,*contentType=@"";
    for(id key in http.allHeaderFields) {NSString *name=[[(NSString *)key lowercaseString] copy];if([name isEqual:@"location"])location=YES;if([name isEqual:@"content-length"])length=[http.allHeaderFields[key] description];if([name isEqual:@"content-type"])contentType=[http.allHeaderFields[key] description];}
    if((self.status>=300 && self.status<400) || location) {handler(NSURLSessionResponseCancel);[self fail:@"REDIRECT_FORBIDDEN"];return;}
    if(self.status<100 || self.status>=600) {handler(NSURLSessionResponseCancel);[self fail:@"INVALID_RESPONSE"];return;}
    if(length && (![[NSPredicate predicateWithFormat:@"SELF MATCHES %@",@"[0-9]{1,10}"] evaluateWithObject:length] || length.longLongValue>self.limit)) {handler(NSURLSessionResponseCancel);[self fail:@"RESPONSE_LIMIT"];return;}
    if(self.streaming){if(contentType.length>200){handler(NSURLSessionResponseCancel);[self fail:@"INVALID_RESPONSE"];return;}if(![self event:@{@"kind":@"headers",@"status":@(self.status),@"contentType":contentType,@"receivedBytes":@0}]){handler(NSURLSessionResponseCancel);return;}}
    handler(NSURLSessionResponseAllow);
}
- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)task didReceiveData:(NSData *)data {
    [self.lock lock];if(self.finished){[self.lock unlock];return;}
    if(self.data.length+data.length>self.limit){[self fail:@"RESPONSE_LIMIT"];[self.lock unlock];return;}
    if(!self.streaming)[self.data appendData:data];
    else for(NSUInteger offset=0;offset<data.length;offset+=8192){
        if(++self.chunks>256){[self fail:@"RESPONSE_LIMIT"];break;}
        NSData *part=[data subdataWithRange:NSMakeRange(offset,MIN((NSUInteger)8192,data.length-offset))];[self.data appendData:part];
        if(![self event:@{@"kind":@"chunk",@"chunk":part,@"receivedBytes":@(self.data.length)}])break;
    }
    [self.lock unlock];
}
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    if(error) {[self fail:error.code==NSURLErrorTimedOut?@"TIMEOUT":@"CONNECTION_FAILED"];return;}
    NSString *body=[[NSString alloc] initWithData:self.data encoding:NSUTF8StringEncoding];
    if(!body){[self fail:@"INVALID_ENCODING"];return;}
    [self finish:self.streaming?@{@"id":self.identifier,@"receivedBytes":@(self.data.length)}:@{@"id":self.identifier,@"status":@(self.status),@"body":body,@"receivedBytes":@(self.data.length)}];
}
@end

@implementation YoziConnectorTransport { NSMutableDictionary<NSString *,YoziConnectorJob *> *_jobs; NSLock *_lock; BOOL _closed; }
+ (NSDictionary *)capabilities {return @{@"contract":@"wenli-app-connector-v1",@"redirect":@"reject",@"responseLimit":@"bytes",@"utf8":@"strict",@"tls":@"system",@"cancel":@YES,@"materialParse":@{@"contract":@"yozi-material-parse-v1",@"timeoutMs":@100000},@"stream":@{@"contract":@"wenli-app-stream-v1",@"chunks":@"base64",@"sequence":@YES,@"maxBytes":@2097152,@"maxChunks":@256,@"timeoutMs":@45000}};}
- (instancetype)init {if((self=[super init])){_jobs=[NSMutableDictionary new];_lock=[NSLock new];}return self;}
- (void)request:(NSDictionary *)o completion:(void (^)(NSDictionary *))completion {
    [self request:o completion:completion streaming:NO];
}
- (void)stream:(NSDictionary *)o completion:(void (^)(NSDictionary *))completion {
    [self request:o completion:completion streaming:YES];
}
- (void)request:(NSDictionary *)o completion:(void (^)(NSDictionary *))completion streaming:(BOOL)streaming {
    if(!completion)return;
    if(![o isKindOfClass:NSDictionary.class]) {completion(@{@"id":@"",@"code":@"INVALID_REQUEST"});return;}
    if(![o[@"id"] isKindOfClass:NSString.class] || ![o[@"url"] isKindOfClass:NSString.class] || ![o[@"method"] isKindOfClass:NSString.class] || ![o[@"token"] isKindOfClass:NSString.class]) {completion(@{@"id":@"",@"code":@"INVALID_REQUEST"});return;}
    NSString *identifier=[o[@"id"] isKindOfClass:NSString.class]?o[@"id"]:@"";
    if(![[NSPredicate predicateWithFormat:@"SELF MATCHES %@",@"[A-Za-z0-9_-]{1,128}"] evaluateWithObject:identifier]){completion(@{@"id":@"",@"code":@"INVALID_REQUEST"});return;}
    NSURLComponents *url=[o[@"url"] isKindOfClass:NSString.class]?[NSURLComponents componentsWithString:o[@"url"]]:nil;
    NSString *method=o[@"method"],*token=o[@"token"],*body=o[@"body"];
    NSString *host=url.host; if([host containsString:@":"] && ![host hasPrefix:@"["])host=[NSString stringWithFormat:@"[%@]",host];
    NSNumber *port=url.port; BOOL normal=(!port || ([url.scheme isEqual:@"http"] && port.intValue==80) || ([url.scheme isEqual:@"https"] && port.intValue==443));
    NSString *origin=[NSString stringWithFormat:@"%@://%@%@",url.scheme,host,normal?@"":[NSString stringWithFormat:@":%@",port]];
    id consent=o[@"consent"];
    BOOL route=streaming?([url.percentEncodedPath isEqual:@"/proxy-ai-stream"] && [method isEqual:@"POST"]):([@[@"/health",@"/chat",@"/parse",@"/delete"] containsObject:url.percentEncodedPath] && [@[@"GET",@"POST"] containsObject:method]);
    BOOL valid=[consent isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)consent)==CFBooleanGetTypeID() && [consent boolValue] && [o[@"url"] length]<=4096 && url.URL && (!port || (port.integerValue>=1 && port.integerValue<=65535)) && [@[@"http",@"https"] containsObject:url.scheme] && host.length && !url.user && !url.password && !url.query && !url.fragment && route && [[NSPredicate predicateWithFormat:@"SELF MATCHES %@",@"[!-~]{32,4096}"] evaluateWithObject:token] && [o[@"allowedOrigins"] isKindOfClass:NSArray.class] && [o[@"allowedOrigins"] count]<=16 && [o[@"allowedOrigins"] containsObject:origin];
    NSNumber *timeout=o[@"timeout"],*limit=o[@"limit"];
    BOOL materialParse=!streaming && [url.percentEncodedPath isEqual:@"/parse"] && [method isEqual:@"POST"];
    valid=valid && [timeout isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)timeout)!=CFBooleanGetTypeID() && timeout.doubleValue==timeout.integerValue && timeout.integerValue>=1 && timeout.integerValue<=(streaming?45000:materialParse?100000:35000) && [limit isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)limit)!=CFBooleanGetTypeID() && limit.doubleValue==limit.integerValue && limit.integerValue>=1 && limit.integerValue<=(streaming?2097152:2000000);
    NSData *payload=nil; if(body){valid=valid && [body isKindOfClass:NSString.class] && [body length]<=15*1024*1024 && [method isEqual:@"POST"];if(valid)payload=[body dataUsingEncoding:NSUTF8StringEncoding];valid=valid && payload && payload.length<=15*1024*1024;}
    if(streaming && !body)valid=NO;
    if(!valid){completion(@{@"id":identifier,@"code":@"INVALID_REQUEST"});return;}
    [_lock lock];
    if(_closed || _jobs[identifier] || _jobs.count>=4) {NSString *code=_closed?@"CANCELLED":_jobs[identifier]?@"REQUEST_CONFLICT":@"RATE_LIMIT";[_lock unlock];completion(@{@"id":identifier,@"code":code});return;}
    YoziConnectorJob *job=[YoziConnectorJob new];job.identifier=identifier;job.data=[NSMutableData new];job.limit=limit.unsignedIntegerValue;job.lock=[NSRecursiveLock new];job.streaming=streaming;
    __weak YoziConnectorTransport *weakSelf=self;
    job.completion=^(NSDictionary *value){BOOL terminal=![value[@"kind"] isEqual:@"headers"] && ![value[@"kind"] isEqual:@"chunk"];YoziConnectorTransport *strong=weakSelf;if(strong && terminal){[strong->_lock lock];[strong->_jobs removeObjectForKey:identifier];[strong->_lock unlock];}completion(value);};
    NSURLSessionConfiguration *config=NSURLSessionConfiguration.ephemeralSessionConfiguration;config.HTTPCookieStorage=nil;config.HTTPShouldSetCookies=NO;config.URLCache=nil;config.requestCachePolicy=NSURLRequestReloadIgnoringLocalCacheData;config.timeoutIntervalForRequest=timeout.doubleValue/1000;config.timeoutIntervalForResource=timeout.doubleValue/1000;
    NSOperationQueue *queue=[NSOperationQueue new];queue.maxConcurrentOperationCount=1;
    job.session=[NSURLSession sessionWithConfiguration:config delegate:job delegateQueue:queue];
    NSMutableURLRequest *request=[NSMutableURLRequest requestWithURL:url.URL];request.HTTPMethod=method;request.HTTPBody=payload;[request setValue:[@"Bearer " stringByAppendingString:token] forHTTPHeaderField:@"Authorization"];[request setValue:YoziOrigin forHTTPHeaderField:@"Origin"];[request setValue:@"identity" forHTTPHeaderField:@"Accept-Encoding"];if(payload)[request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    if(streaming)[request setValue:@"text/event-stream" forHTTPHeaderField:@"Accept"];
    job.task=[job.session dataTaskWithRequest:request];_jobs[identifier]=job;
    job.timer=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,dispatch_get_global_queue(QOS_CLASS_UTILITY,0));
    __weak YoziConnectorJob *weakJob=job;dispatch_source_set_timer(job.timer,dispatch_time(DISPATCH_TIME_NOW,timeout.longLongValue*NSEC_PER_MSEC),DISPATCH_TIME_FOREVER,0);dispatch_source_set_event_handler(job.timer,^{[weakJob fail:@"TIMEOUT"];});dispatch_resume(job.timer);
    [_lock unlock];[job.task resume];
}
- (void)cancel:(NSString *)identifier {if(![identifier isKindOfClass:NSString.class])return;[_lock lock];YoziConnectorJob *job=_jobs[identifier];[_lock unlock];[job fail:@"CANCELLED"];}
- (void)close {[_lock lock];_closed=YES;NSArray *jobs=_jobs.allValues;[_lock unlock];for(YoziConnectorJob *job in jobs)[job fail:@"CANCELLED"];}
@end

#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <CoreML/CoreML.h>
#import <ImageIO/ImageIO.h>
#import <CoreGraphics/CoreGraphics.h>

static const NSUInteger MaxBytes=10*1024*1024,MaxPixels=24000000,MaxOutput=2*1024*1024;
static const NSString *Contract=@"wenli-apple-vision-v1";
static NSDictionary *fail(NSString *code){return @{@"success":@NO,@"code":code};}
static BOOL realBoolean(id v){return [v isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)v)==CFBooleanGetTypeID() && [v boolValue];}
static VNRecognizeTextRequest *request(void){
    VNRecognizeTextRequest *r=[VNRecognizeTextRequest new];r.revision=VNRecognizeTextRequestRevision3;
    r.recognitionLevel=VNRequestTextRecognitionLevelAccurate;
    r.usesLanguageCorrection=NO; // 题干/公式保留原识别候选，不用语言纠错猜改关键条件。
    return r;
}
// 固定CPU；缺受支持设备则关闭能力，不回到自动硬件/别的引擎。
static BOOL configureCPU(VNRecognizeTextRequest *r){
    NSError *error=nil;NSDictionary *stages=[r supportedComputeStageDevicesAndReturnError:&error];
    if(error || !stages.count)return NO;
    for(NSString *stage in stages){id cpu=nil;
        for(id device in stages[stage])if([device isKindOfClass:MLCPUComputeDevice.class]){cpu=device;break;}
        if(!cpu)return NO;[r setComputeDevice:cpu forComputeStage:stage];
    }return YES;
}
static CGImageRef thumbnail(CGImageSourceRef source,NSUInteger edge){
    NSDictionary *options=@{(__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways:@YES,
        (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform:@YES,
        (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize:@(edge),
        (__bridge NSString *)kCGImageSourceShouldCacheImmediately:@YES};
    return CGImageSourceCreateThumbnailAtIndex(source,0,(__bridge CFDictionaryRef)options);
}
static NSDictionary *recognize(NSDictionary *input){
    if(![input isKindOfClass:NSDictionary.class])return fail(@"INVALID_REQUEST");
    if(!realBoolean(input[@"consent"]))return fail(@"CONSENT_REQUIRED");
    for(NSString *key in input)if(![@[@"consent",@"contentBase64",@"languages"] containsObject:key])return fail(@"INVALID_REQUEST");
    NSString *encoded=input[@"contentBase64"];
    if(![encoded isKindOfClass:NSString.class] || encoded.length>4*((MaxBytes+2)/3))return fail(@"RESOURCE_LIMIT");
    NSData *data=[[NSData alloc] initWithBase64EncodedString:encoded options:0];
    if(!data.length || data.length>MaxBytes || ![[data base64EncodedStringWithOptions:0] isEqual:encoded])return fail(@"IMAGE_INVALID");
    NSArray *languages=input[@"languages"];
    if(![languages isKindOfClass:NSArray.class] || languages.count<1 || languages.count>3)return fail(@"LANGUAGE_UNSUPPORTED");
    VNRecognizeTextRequest *r=request();NSError *error=nil;NSArray *supported=[r supportedRecognitionLanguagesAndReturnError:&error];
    if(error || !supported)return fail(@"ENGINE_UNAVAILABLE");
    for(id language in languages)if(![language isKindOfClass:NSString.class] || ![supported containsObject:language])return fail(@"LANGUAGE_UNSUPPORTED");
    if([NSSet setWithArray:languages].count!=languages.count)return fail(@"LANGUAGE_UNSUPPORTED");
    r.recognitionLanguages=languages;if(!configureCPU(r))return fail(@"ENGINE_UNAVAILABLE");
    CGImageSourceRef source=CGImageSourceCreateWithData((__bridge CFDataRef)data,(__bridge CFDictionaryRef)@{(__bridge NSString *)kCGImageSourceShouldCache:@NO});
    if(!source)return fail(@"IMAGE_INVALID");
    NSDictionary *props=CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source,0,NULL));
    NSString *type=(__bridge NSString *)CGImageSourceGetType(source);
    NSUInteger width=[props[(__bridge NSString *)kCGImagePropertyPixelWidth] unsignedIntegerValue],height=[props[(__bridge NSString *)kCGImagePropertyPixelHeight] unsignedIntegerValue];
    if(![@[@"public.png",@"public.jpeg"] containsObject:type] || CGImageSourceGetCount(source)!=1){CFRelease(source);return fail(@"IMAGE_TYPE");}
    if(!width || !height || width>MaxPixels || height>MaxPixels || width>MaxPixels/height){CFRelease(source);return fail(@"PIXEL_LIMIT");}
    CGImageRef image=thumbnail(source,3200);if(!image){CFRelease(source);return fail(@"IMAGE_INVALID");}
    VNImageRequestHandler *handler=[[VNImageRequestHandler alloc] initWithCGImage:image options:@{}];
    BOOL ok=[handler performRequests:@[r] error:&error];CGImageRelease(image);
    if(!ok || error){CFRelease(source);return fail(@"RECOGNITION_FAILED");}
    NSData *preview=nil;NSUInteger previewWidth=0,previewHeight=0;
    for(NSUInteger edge=1200;edge>=300;edge=edge*3/4){
        CGImageRef small=thumbnail(source,edge);if(!small)break;
        NSMutableData *bytes=[NSMutableData new];CGImageDestinationRef out=CGImageDestinationCreateWithData((__bridge CFMutableDataRef)bytes,CFSTR("public.png"),1,NULL);
        if(out){CGImageDestinationAddImage(out,small,(__bridge CFDictionaryRef)@{});BOOL saved=CGImageDestinationFinalize(out);CFRelease(out);
            if(saved && bytes.length<=512*1024){preview=bytes;previewWidth=CGImageGetWidth(small);previewHeight=CGImageGetHeight(small);}}
        CGImageRelease(small);if(preview)break;
    }
    CFRelease(source);if(!preview)return fail(@"PREVIEW_LIMIT");
    NSMutableArray *lines=[NSMutableArray new];NSMutableString *content=[NSMutableString new];
    for(VNRecognizedTextObservation *observation in r.results){
        VNRecognizedText *candidate=[observation topCandidates:1].firstObject;NSString *text=candidate.string;
        if(!text.length)continue;
        if(lines.count>=3000 || content.length+text.length+1>20000)return fail(@"TEXT_LIMIT");
        CGRect b=observation.boundingBox;
        if(!isfinite(b.origin.x) || !isfinite(b.origin.y) || !isfinite(b.size.width) || !isfinite(b.size.height) || b.origin.x<0 || b.origin.y<0 || b.size.width<=0 || b.size.height<=0 || CGRectGetMaxX(b)>1.00001 || CGRectGetMaxY(b)>1.00001)return fail(@"INVALID_RESULT");
        NSArray *box=@[@(MAX(0,b.origin.x)*previewWidth),@(MAX(0,1-CGRectGetMaxY(b))*previewHeight),@(MIN(1,CGRectGetMaxX(b))*previewWidth),@(MIN(1,1-b.origin.y)*previewHeight)];
        [lines addObject:@{@"text":text,@"bbox":box,@"confidence":@(candidate.confidence),@"role":@"unassigned",@"granularity":@"line"}];
        if(content.length)[content appendString:@"\n"];[content appendString:text];
    }
    return @{@"success":@YES,@"data":@{@"contract":Contract,@"revision":@(r.revision),@"content":content,@"words":lines,@"languages":languages,
        @"preview": [@"data:image/png;base64," stringByAppendingString:[preview base64EncodedStringWithOptions:0]],
        @"dimensions":@{@"width":@(previewWidth),@"height":@(previewHeight)},@"coordinateSpace":@"preview_pixels_top_left",
        @"compute":@"cpu",@"method":@"apple_vision",@"reviewRequired":@YES,@"dataFlow":@"device_only",@"languageCorrection":@NO}};
}
int main(int argc,const char *argv[]){@autoreleasepool{
    NSDictionary *value;
    @try{
        if(argc==2 && strcmp(argv[1],"--capabilities")==0){
            NSError *error=nil;VNRecognizeTextRequest *r=request();NSArray *languages=[r supportedRecognitionLanguagesAndReturnError:&error];
            value=error || !languages || !configureCPU(r)?fail(@"ENGINE_UNAVAILABLE"):@{@"success":@YES,@"data":@{@"contract":Contract,@"revision":@(r.revision),
                @"languages":languages,@"maxBytes":@(MaxBytes),@"maxPixels":@(MaxPixels),@"compute":@"cpu",@"recognitionState":@"not_tested",@"dataFlow":@"device_only"}};
        }else if(argc==2 && strcmp(argv[1],"--recognize")==0){
            NSMutableData *input=[NSMutableData new];NSUInteger limit=4*((MaxBytes+2)/3)+10000;
            while(input.length<=limit){NSData *part=[NSFileHandle.fileHandleWithStandardInput readDataOfLength:MIN(8192,limit-input.length+1)];if(!part.length)break;[input appendData:part];}
            value=input.length>limit?fail(@"RESOURCE_LIMIT"):recognize([NSJSONSerialization JSONObjectWithData:input options:0 error:nil]);
        }else value=fail(@"INVALID_REQUEST");
    }@catch(NSException *exception){value=fail(@"RECOGNITION_FAILED");}
    NSData *out=[NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    if(!out || out.length>MaxOutput)out=[NSJSONSerialization dataWithJSONObject:fail(@"OUTPUT_LIMIT") options:0 error:nil];
    fwrite(out.bytes,1,out.length,stdout);fputc('\n',stdout);return 0;
}}

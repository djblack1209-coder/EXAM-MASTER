#import <Foundation/Foundation.h>
@interface WenliMaterialFiles : NSObject
+ (NSDictionary *)capabilities;
- (void)selectURL:(NSURL *)url identifier:(NSString *)identifier completion:(void (^)(NSDictionary *))completion;
- (void)read:(NSDictionary *)options completion:(void (^)(NSDictionary *))completion;
- (void)cancel:(NSString *)identifier;
- (void)releaseHandle:(NSString *)handle;
- (void)close;
@end

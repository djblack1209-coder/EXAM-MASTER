#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN
@interface WenliConnectorTransport : NSObject
+ (NSDictionary *)capabilities;
- (void)request:(NSDictionary *)options completion:(void (^)(NSDictionary *))completion;
- (void)cancel:(NSString *)identifier;
- (void)close;
@end
NS_ASSUME_NONNULL_END

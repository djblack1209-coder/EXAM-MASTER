#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <UserNotifications/UserNotifications.h>
#include <stdlib.h>
#include <string.h>

extern void yozi_notification_action(const char *payload);
static NSString *const Prefix = @"yozi-learning-v1-";
static NSString *const TestRequestedAt = @"YoziLearningTestNotificationRequestedAt";

@interface YoziLearningNotificationDelegate : NSObject <UNUserNotificationCenterDelegate>
@end
@implementation YoziLearningNotificationDelegate
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
      willPresentNotification:(UNNotification *)notification
        withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completion {
    completion(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound);
}
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
 didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completion {
    if ([response.notification.request.identifier hasPrefix:Prefix]) {
        NSData *data = [NSJSONSerialization dataWithJSONObject:response.notification.request.content.userInfo options:0 error:nil];
        if (data) {
            NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
            yozi_notification_action(text.UTF8String);
        }
    }
    completion();
}
@end

static UNUserNotificationCenter *Center(void) {
    static YoziLearningNotificationDelegate *delegate;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ delegate = [YoziLearningNotificationDelegate new]; });
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    center.delegate = delegate;
    return center;
}
static void Bootstrap(void) {
    static id observer;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        observer = [[NSNotificationCenter defaultCenter] addObserverForName:NSApplicationWillFinishLaunchingNotification
            object:nil queue:nil usingBlock:^(NSNotification *notification) {
                Center();
            }];
    });
}
static char *Reply(NSDictionary *value) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    if (!data) return NULL;
    char *reply = malloc(data.length + 1);
    if (!reply) return NULL;
    memcpy(reply, data.bytes, data.length); reply[data.length] = 0;
    return reply;
}
static NSArray<UNNotificationRequest *> *Pending(UNUserNotificationCenter *center) {
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block NSArray *requests = nil;
    [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray *value) {
        requests = value; dispatch_semaphore_signal(semaphore);
    }];
    if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC))) return nil;
    return requests;
}
static NSDictionary *Permission(UNUserNotificationCenter *center) {
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block NSString *permission = @"unknown";
    [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
        switch (settings.authorizationStatus) {
            case UNAuthorizationStatusAuthorized: permission = @"granted"; break;
            case UNAuthorizationStatusProvisional: permission = @"granted"; break;
            case UNAuthorizationStatusDenied: permission = @"denied"; break;
            case UNAuthorizationStatusNotDetermined: permission = @"default"; break;
            default: break;
        }
        dispatch_semaphore_signal(semaphore);
    }];
    if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC))) return @{ @"ok": @NO };
    __block BOOL testDelivered = NO;
    NSTimeInterval requestedAt = [[NSUserDefaults standardUserDefaults] doubleForKey:TestRequestedAt];
    if (requestedAt > 0) {
        dispatch_semaphore_t delivered = dispatch_semaphore_create(0);
        [center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *items) {
            for (UNNotification *item in items)
                if ([item.request.identifier isEqualToString:[Prefix stringByAppendingString:@"test"]] &&
                    item.date.timeIntervalSince1970 >= requestedAt) testDelivered = YES;
            dispatch_semaphore_signal(delivered);
        }];
        if (dispatch_semaphore_wait(delivered, dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC))) testDelivered = NO;
    }
    return @{ @"ok": @YES, @"permission": permission, @"channel": @"macos", @"testDelivered": testDelivered ? @YES : @NO };
}

char *yozi_notifications_call(const char *requestText) {
    @autoreleasepool {
        @try {
            NSData *data = [NSData dataWithBytes:requestText length:strlen(requestText)];
            NSDictionary *request = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
            NSString *action = request[@"action"];
            if ([action isEqualToString:@"bootstrap"]) { Bootstrap(); return Reply(@{@"ok": @YES}); }
            UNUserNotificationCenter *center = Center();
            if ([action isEqualToString:@"settings"]) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"x-apple.systempreferences:com.apple.Notifications-Settings.extension"]];
                });
                return Reply(@{@"ok": @YES});
            }
            if ([action isEqualToString:@"test"]) {
                NSDictionary *permission = Permission(center);
                if (![permission[@"permission"] isEqualToString:@"granted"]) return Reply(@{@"ok": @NO});
                UNMutableNotificationContent *content = [UNMutableNotificationContent new];
                content.title = @"Yozi AI";
                content.body = @"学习提醒已就绪。";
                content.sound = [UNNotificationSound defaultSound];
                UNNotificationRequest *test = [UNNotificationRequest requestWithIdentifier:[Prefix stringByAppendingString:@"test"] content:content
                    trigger:[UNTimeIntervalNotificationTrigger triggerWithTimeInterval:5 repeats:NO]];
                dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
                __block BOOL accepted = NO;
                NSTimeInterval requestedAt = [NSDate date].timeIntervalSince1970;
                [center addNotificationRequest:test withCompletionHandler:^(NSError *error) { accepted = error == nil; dispatch_semaphore_signal(semaphore); }];
                BOOL timedOut = dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC));
                if (!timedOut && accepted) [[NSUserDefaults standardUserDefaults] setDouble:requestedAt forKey:TestRequestedAt];
                // C logical expressions box as an integer; the bridge requires a JSON boolean.
                return Reply(@{@"ok": !timedOut && accepted ? @YES : @NO});
            }
            if ([action isEqualToString:@"permission"]) {
                NSDictionary *before = Permission(center);
                if (![before[@"ok"] boolValue]) return Reply(before);
                // 已拒绝时由设置恢复，不反复申请，也不把拒绝误报为未知桥错误。
                if ([request[@"request"] boolValue] && [before[@"permission"] isEqualToString:@"default"]) {
                    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
                    __block NSError *failure = nil;
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [center requestAuthorizationWithOptions:UNAuthorizationOptionAlert | UNAuthorizationOptionSound
                          completionHandler:^(BOOL granted, NSError *error) { failure = error; dispatch_semaphore_signal(semaphore); }];
                    });
                    if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 45 * NSEC_PER_SEC)))
                        return Reply(@{@"ok": @NO, @"failure": @"permission-timeout"});
                    if (failure) {
                        NSString *domain = [@[UNErrorDomain, NSCocoaErrorDomain, NSPOSIXErrorDomain] containsObject:failure.domain] ? failure.domain : @"system";
                        return Reply(@{@"ok": @NO, @"failure": @"permission-error", @"errorDomain": domain, @"errorCode": @(failure.code)});
                    }
                    return Reply(Permission(center));
                }
                return Reply(before);
            }
            if (![action isEqualToString:@"replace"]) return Reply(@{@"ok": @NO});
            NSArray *jobs = request[@"jobs"];
            if (jobs.count == 0 && [request[@"clearDelivered"] boolValue]) {
                [center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *items) {
                    NSMutableArray *ids = [NSMutableArray array];
                    for (UNNotification *item in items) if ([item.request.identifier hasPrefix:Prefix]) [ids addObject:item.request.identifier];
                    [center removeDeliveredNotificationsWithIdentifiers:ids];
                }];
            }
            NSArray *before = Pending(center);
            if (!before) return Reply(@{@"ok": @NO});
            NSMutableSet *wanted = [NSMutableSet set];
            NSMutableArray *remove = [NSMutableArray array];
            for (NSDictionary *job in jobs) [wanted addObject:[Prefix stringByAppendingString:job[@"id"]]];
            for (UNNotificationRequest *item in before)
                if ([item.identifier hasPrefix:Prefix] && ![wanted containsObject:item.identifier] &&
                    (![item.identifier isEqualToString:[Prefix stringByAppendingString:@"test"]] || [request[@"clearDelivered"] boolValue])) [remove addObject:item.identifier];
            [center removePendingNotificationRequestsWithIdentifiers:remove];
            NSMutableArray *failed = [NSMutableArray array];
            NSMutableSet *confirmed = [NSMutableSet set];
            NSTimeInterval deadline = [NSDate date].timeIntervalSince1970 + 15;
            for (NSDictionary *job in jobs) {
                NSString *identifier = [Prefix stringByAppendingString:job[@"id"]];
                BOOL exists = NO;
                for (UNNotificationRequest *item in before) if ([item.identifier isEqualToString:identifier]) { exists = YES; break; }
                if (exists) { [confirmed addObject:job[@"id"]]; continue; }
                if ([NSDate date].timeIntervalSince1970 >= deadline) { [failed addObject:job[@"id"]]; continue; }
                NSTimeInterval seconds = [job[@"dueAt"] doubleValue] / 1000 - [NSDate date].timeIntervalSince1970;
                if (seconds < 1) { [failed addObject:job[@"id"]]; continue; }
                UNMutableNotificationContent *content = [UNMutableNotificationContent new];
                content.title = @"Yozi AI";
                BOOL english = [request[@"language"] isEqualToString:@"en"];
                content.body = english ? ([job[@"kind"] isEqualToString:@"review"] ? @"A review is due. Open Yozi AI to try it independently." :
                    [job[@"kind"] isEqualToString:@"recap"] ? @"Review today’s learning and choose your next step." : @"It is time for your scheduled study.") :
                    [job[@"kind"] isEqualToString:@"review"] ? @"有学习任务到期，打开后独立复测。" :
                    [job[@"kind"] isEqualToString:@"recap"] ? @"回顾今天的学习，确认下一步安排。" : @"到了你安排的学习时间。";
                content.sound = [UNNotificationSound defaultSound];
                NSMutableDictionary *info = [job mutableCopy];
                if (info[@"questionKey"] == [NSNull null]) [info removeObjectForKey:@"questionKey"];
                content.userInfo = info;
                UNNotificationRequest *notification = [UNNotificationRequest requestWithIdentifier:identifier content:content
                    trigger:[UNTimeIntervalNotificationTrigger triggerWithTimeInterval:seconds repeats:NO]];
                dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
                __block BOOL accepted = NO;
                [center addNotificationRequest:notification withCompletionHandler:^(NSError *error) {
                    accepted = error == nil; dispatch_semaphore_signal(semaphore);
                }];
                NSTimeInterval remaining = MIN(5, MAX(0, deadline - [NSDate date].timeIntervalSince1970));
                if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(remaining * NSEC_PER_SEC))) || !accepted)
                    [failed addObject:job[@"id"]];
                else [confirmed addObject:job[@"id"]];
            }
            NSArray *after = Pending(center);
            if (!after) return Reply(@{@"ok": @NO});
            NSMutableArray *accepted = [NSMutableArray arrayWithArray:confirmed.allObjects];
            for (UNNotificationRequest *item in after) if ([wanted containsObject:item.identifier])
                if (![confirmed containsObject:[item.identifier substringFromIndex:Prefix.length]])
                    [accepted addObject:[item.identifier substringFromIndex:Prefix.length]];
            BOOL cancelled = YES;
            for (UNNotificationRequest *item in after) if ([remove containsObject:item.identifier]) cancelled = NO;
            return Reply(@{@"ok": @YES, @"acceptedIds": accepted, @"failedIds": failed, @"cancelled": @(cancelled)});
        } @catch (NSException *error) { return Reply(@{@"ok": @NO}); }
    }
}
void yozi_notifications_free(char *reply) { free(reply); }

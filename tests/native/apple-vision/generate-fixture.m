#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>
#import <ImageIO/ImageIO.h>

// 只生成公开合成文字，不读取用户文件；用于真实框架识别及方向/空白验证。
int main(int argc,const char *argv[]){@autoreleasepool{
    if(argc!=2)return 2;NSString *directory=@(argv[1]);
    CGColorSpaceRef colors=CGColorSpaceCreateDeviceRGB();
    CGContextRef context=CGBitmapContextCreate(NULL,1800,1200,8,0,colors,(CGBitmapInfo)kCGImageAlphaPremultipliedLast);
    CGColorSpaceRelease(colors);if(!context)return 2;
    CGContextSetRGBFillColor(context,1,1,1,1);CGContextFillRect(context,CGRectMake(0,0,1800,1200));
    CGImageRef blank=CGBitmapContextCreateImage(context);
    CTFontRef font=CTFontCreateWithName(CFSTR("PingFangSC-Regular"),64,NULL);
    NSArray *lines=@[@"题目：计算十二加八。",@"Question: Calculate twelve plus eight.",@"条件：x > 0，单位 cm。",@"参考答案：20。批注仍需校对。"];
    CGFloat y=1020;
    for(NSString *text in lines){
        NSDictionary *attributes=@{(__bridge NSString *)kCTFontAttributeName:(__bridge id)font,
            (__bridge NSString *)kCTForegroundColorAttributeName:(__bridge id)CGColorGetConstantColor(kCGColorBlack)};
        NSAttributedString *attributed=[[NSAttributedString alloc] initWithString:text attributes:attributes];
        CTLineRef line=CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)attributed);
        CGContextSetTextPosition(context,90,y);CTLineDraw(line,context);CFRelease(line);y-=170;
    }
    CFRelease(font);CGImageRef image=CGBitmapContextCreateImage(context);CGContextRelease(context);
    for(NSString *name in @[@"printed.png",@"printed.jpg",@"oriented.jpg",@"blank.png"]){
        BOOL png=[name hasSuffix:@"png"];NSURL *url=[NSURL fileURLWithPath:[directory stringByAppendingPathComponent:name]];
        CGImageDestinationRef out=CGImageDestinationCreateWithURL((__bridge CFURLRef)url,png?CFSTR("public.png"):CFSTR("public.jpeg"),1,NULL);
        NSDictionary *props=[name isEqual:@"oriented.jpg"]?@{(__bridge NSString *)kCGImagePropertyOrientation:@6}:@{};
        CGImageDestinationAddImage(out,[name isEqual:@"blank.png"]?blank:image,(__bridge CFDictionaryRef)props);
        if(!CGImageDestinationFinalize(out))return 2;CFRelease(out);
    }
    NSURL *pdf=[NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"scanned.pdf"]];
    CGDataConsumerRef consumer=CGDataConsumerCreateWithURL((__bridge CFURLRef)pdf);CGRect rect=CGRectMake(0,0,600,400);
    CGContextRef document=CGPDFContextCreate(consumer,&rect,NULL);CGDataConsumerRelease(consumer);
    for(int page=0;page<6;page++){CGPDFContextBeginPage(document,NULL);CGContextDrawImage(document,rect,image);CGPDFContextEndPage(document);}
    CGPDFContextClose(document);CGContextRelease(document);CGImageRelease(image);CGImageRelease(blank);return 0;
}}

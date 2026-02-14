//
//  poppy_seedsView.m
//  poppy_seeds
//
//  Created by Anna Toidze on 13.02.2026.
//

#import "poppy_seedsView.h"
#import <WebKit/WebKit.h>

@implementation poppy_seedsView
{
    WKWebView *_webView;
}

- (instancetype)initWithFrame:(NSRect)frame isPreview:(BOOL)isPreview
{
    self = [super initWithFrame:frame isPreview:isPreview];
    if (self) {
        [self setAnimationTimeInterval:1/30.0];
        
        WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
        config.suppressesIncrementalRendering = YES;
        config.defaultWebpagePreferences.preferredContentMode = WKContentModeRecommended;
        config.defaultWebpagePreferences.allowsContentJavaScript = YES;

        _webView = [[WKWebView alloc] initWithFrame:self.bounds configuration:config];
        _webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
        _webView.allowsBackForwardNavigationGestures = NO;
        _webView.allowsMagnification = NO;
// _webView.drawsBackground = NO;
        // Make WKWebView background transparent on macOS
        _webView.wantsLayer = YES;
        _webView.layer.backgroundColor = NSColor.clearColor.CGColor;

        // Also ensure the HTML background is transparent
        NSString *css = @"html, body { background: transparent !important; }";
        NSString *js = [NSString stringWithFormat:
            @"var style = document.createElement('style');"
             "style.innerHTML = `%@`;"
             "document.head.appendChild(style);", css];

//         Inject after content loads
        __weak typeof(_webView) weakWebView = _webView;
        [_webView.configuration.userContentController addUserScript:
            [[WKUserScript alloc] initWithSource:js
                                   injectionTime:WKUserScriptInjectionTimeAtDocumentEnd
                                forMainFrameOnly:YES]];
        
        // Load local index.html from the bundle so it can reference screensaver.js relatively
        NSBundle *bundle = [NSBundle bundleForClass:[self class]];
        NSURL *htmlURL = [bundle URLForResource:@"index" withExtension:@"html"];
        if (htmlURL) {
            // Allow the web view to load local resources relative to the HTML file
            [_webView loadFileURL:htmlURL allowingReadAccessToURL:[htmlURL URLByDeletingLastPathComponent]];
        }

        [self addSubview:_webView];
    }
    return self;
}

- (void)startAnimation
{
    [super startAnimation];
    // Resume animations/timers in the web content if needed
    [_webView evaluateJavaScript:@"if (window.saverStart) { window.saverStart(); }" completionHandler:nil];
}

- (void)stopAnimation
{
    [super stopAnimation];
    // Pause animations/timers in the web content if needed
    [_webView evaluateJavaScript:@"if (window.saverStop) { window.saverStop(); }" completionHandler:nil];
}

- (void)drawRect:(NSRect)rect
{
    // Intentionally empty; WKWebView handles rendering.
}

- (void)animateOneFrame
{
    // If your JS wants a tick, expose window.saverTick() in screensaver.js
    [_webView evaluateJavaScript:@"if (window.saverTick) { window.saverTick(); }" completionHandler:nil];
    return;
}

- (void)resizeSubviewsWithOldSize:(NSSize)oldSize
{
    [super resizeSubviewsWithOldSize:oldSize];
    _webView.frame = self.bounds;
}

- (BOOL)hasConfigureSheet
{
    return NO;
}

- (NSWindow*)configureSheet
{
    return nil;
}

@end

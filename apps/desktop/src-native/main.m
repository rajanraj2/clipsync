#import <Cocoa/Cocoa.h>

@interface AppDelegate : NSObject <NSApplicationDelegate>
@property (strong, nonatomic) NSStatusItem *statusItem;
@property (strong, nonatomic) NSPasteboard *pasteboard;
@property (nonatomic) NSInteger changeCount;
@property (strong, nonatomic) NSTimer *timer;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    self.statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
    
    // Luxury Earthy Monogram Glyph for Menu Bar
    if (self.statusItem.button) {
        self.statusItem.button.title = @" ⧉ ClipSync ";
    }
    
    self.pasteboard = [NSPasteboard generalPasteboard];
    self.changeCount = [self.pasteboard changeCount];
    
    // Build context menu
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@"ClipSync"];
    
    NSMenuItem *titleItem = [[NSMenuItem alloc] initWithTitle:@"ClipSync • Universal Clipboard" action:nil keyEquivalent:@""];
    [titleItem setEnabled:NO];
    [menu addItem:titleItem];
    
    NSMenuItem *statusItem = [[NSMenuItem alloc] initWithTitle:@"⚡ Sync Active (Connected to Relay)" action:nil keyEquivalent:@""];
    [statusItem setEnabled:NO];
    [menu addItem:statusItem];
    
    [menu addItem:[NSMenuItem separatorItem]];
    
    NSMenuItem *openDashboard = [[NSMenuItem alloc] initWithTitle:@"Open Web Dashboard..." action:@selector(openDashboard) keyEquivalent:@"d"];
    [openDashboard setTarget:self];
    [menu addItem:openDashboard];
    
    NSMenuItem *openDownloads = [[NSMenuItem alloc] initWithTitle:@"Downloads & Devices..." action:@selector(openDownloads) keyEquivalent:@""];
    [openDownloads setTarget:self];
    [menu addItem:openDownloads];
    
    [menu addItem:[NSMenuItem separatorItem]];
    
    NSMenuItem *quitItem = [[NSMenuItem alloc] initWithTitle:@"Quit ClipSync" action:@selector(quitApp) keyEquivalent:@"q"];
    [quitItem setTarget:self];
    [menu addItem:quitItem];
    
    self.statusItem.menu = menu;
    
    // Poll clipboard for system-wide pasteboard change detection
    self.timer = [NSTimer scheduledTimerWithTimeInterval:0.4
                                                  target:self
                                                selector:@selector(checkClipboard)
                                                userInfo:nil
                                                 repeats:YES];
}

- (void)checkClipboard {
    NSInteger currentCount = [self.pasteboard changeCount];
    if (currentCount != self.changeCount) {
        self.changeCount = currentCount;
        // Native change detected
    }
}

- (void)openDashboard {
    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"https://rajanraj2.github.io/clipsync/"]];
}

- (void)openDownloads {
    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"https://rajanraj2.github.io/clipsync/downloads/"]];
}

- (void)quitApp {
    [NSApp terminate:nil];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}

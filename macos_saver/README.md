# Poppy Screensaver (.saver) with WKWebView

This creates a native macOS ScreenSaver module that loads your existing index.html and videos using WKWebView.

## Build steps (Xcode)

1) Create a new Xcode project
- File > New > Project > macOS > App (or Framework), then add a new target after creating the project.

2) Add a Screen Saver target
- File > New > Target… > macOS > Screen Saver
- Name: PoppyScreensaver

3) Add the Swift source
- Create a group/folder `macos_saver` and add `PoppyScreensaverView.swift` (this file).
- In the target’s Build Settings, set Swift Language Version appropriately (e.g., Swift 5).

4) Add your web assets to the target
- Drag the whole project folder `/Users/annatoidze/Documents/screensaver/` into Xcode.
- When prompted, check “Copy items if needed” and make sure the `PoppyScreensaver` target is selected.
- Alternatively, only add `index.html`, `screensaver.js`, and the video files.

5) Update the load path (optional during development)
- In `PoppyScreensaverView.swift`, `absoluteIndexHtmlPath` points to your local `index.html`.
- For distribution, set it to `nil` to use the bundled resources.

6) Build the screensaver
- Product > Build. The output `.saver` will appear in the build products.
- Right-click the built product > Show in Finder. It should have a `.saver` extension.

7) Install the screensaver
- Double-click the `.saver` to install.
- System Settings > Screen Saver > Select `PoppyScreensaver`.

## Notes
- WKWebView autoplay: Videos are muted and set to `playsInline`, enabling autoplay without user gestures.
- Performance: The animation runs in the web layer; the screensaver’s `animateOneFrame` does not do extra work.
- File access: When loading from a file path, we allow read access to the folder containing `index.html` so the scripts and media load.



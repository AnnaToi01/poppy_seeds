import ScreenSaver
import WebKit

final class PoppyScreensaverView: ScreenSaverView {
  private var webView: WKWebView!

  // Optional: point directly to your dev HTML during development
  // For distribution, bundle the files and load from the app bundle instead.
  private let absoluteIndexHtmlPath: String? = "/Users/annatoidze/Documents/screensaver/index.html"

  override init?(frame: NSRect, isPreview: Bool) {
    super.init(frame: frame, isPreview: isPreview)

    let config = WKWebViewConfiguration()
    if #available(macOS 10.12, *) {
      config.mediaTypesRequiringUserActionForPlayback = []
    }
    config.allowsAirPlayForMediaPlayback = false

    webView = WKWebView(frame: .zero, configuration: config)
    webView.translatesAutoresizingMaskIntoConstraints = false
    webView.allowsBackForwardNavigationGestures = false
    webView.setValue(false, forKey: "drawsBackground")
    webView.layer?.backgroundColor = NSColor.black.cgColor

    addSubview(webView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: trailingAnchor),
      webView.topAnchor.constraint(equalTo: topAnchor),
      webView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])

    loadScreensaverContent()

    // 30 FPS is plenty for this
    animationTimeInterval = 1.0 / 30.0
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  private func loadScreensaverContent() {
    // 1) Prefer local absolute path during development
    if let path = absoluteIndexHtmlPath {
      let url = URL(fileURLWithPath: path)
      if FileManager.default.fileExists(atPath: url.path) {
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        return
      }
    }

    // 2) Fall back to the bundled index.html (drag your folder into the target with "Copy items if needed")
    let bundle = Bundle(for: Self.self)
    if let fileUrl = bundle.url(forResource: "index", withExtension: "html") {
      webView.loadFileURL(fileUrl, allowingReadAccessTo: fileUrl.deletingLastPathComponent())
      return
    }

    // 3) As a last resort, show a simple message
    let html = """
    <!doctype html><meta charset='utf-8'>
    <style>html,body{height:100%;margin:0;background:#000;color:#e8e8e8;display:grid;place-items:center;font:14px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}</style>
    <div>Could not find index.html. Ensure the file exists or is added to the bundle.</div>
    """
    webView.loadHTMLString(html, baseURL: nil)
  }

  override func startAnimation() {
    super.startAnimation()
  }

  override func stopAnimation() {
    super.stopAnimation()
  }

  override func animateOneFrame() {
    // No per-frame work needed; WKWebView animates independently
    setNeedsDisplay(bounds)
  }
}



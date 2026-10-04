
  // 预览/开发专用：直接用浏览器打开本文件（file://，无 chrome.* 扩展环境）时提供最小桩，
  // 方便双击查看 UI 效果与 ?demo=pro|free|paywall 演示态。在真实扩展环境中本段不生效。
  if (typeof chrome === "undefined" || !chrome.storage) {
    window.__previewMode = true;
    window.chrome = {
      storage: { onChanged: { addListener: () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
      runtime: { sendMessage: () => Promise.resolve(), onMessage: { addListener: () => {} } },
      tabs: { query: async () => [{ url: "https://example.com", title: "示例页面" }] },
      scripting: { executeScript: async () => [{ result: { title: "示例页面", url: "https://example.com", excerpt: "" } }] },
    };
  }
  
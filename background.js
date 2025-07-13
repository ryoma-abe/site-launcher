// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log("Site Launcher がインストールされました");

  // 初回インストール時にデフォルトサイトを設定
  chrome.storage.sync.get(["sites"], (result) => {
    if (!result.sites) {
      const defaultSites = [
        { name: "Google", url: "https://google.com", key: "G" },
      ];
      chrome.storage.sync.set({ sites: defaultSites });
    }
  });
});

// キーボードショートカットのコマンドを処理
chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    // ポップアップを開く
    chrome.action.openPopup();
  }
});

// 拡張機能のアイコンがクリックされた時の処理
// (manifest.jsonでdefault_popupが設定されているので、自動的にポップアップが開きます)

/**
 * Site Launcher Chrome Extension Background Script
 * 
 * このスクリプトは拡張機能のバックグラウンドで動作し、
 * インストール時の初期化とキーボードショートカットの処理を行います。
 */

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Site Launcher がインストールされました");

  try {
    // 既存のサイトデータがあるかチェック
    const result = await chrome.storage.sync.get(["sites"]);
    
    // 初回インストール時のみデフォルトサイトを設定
    if (!result.sites) {
      const defaultSites = [
        { name: "Google", url: "https://google.com", key: "G" },
      ];
      await chrome.storage.sync.set({ sites: defaultSites });
      console.log("デフォルトサイトを設定しました");
    }
  } catch (error) {
    console.error("初期化処理でエラーが発生しました:", error);
  }
});

// キーボードショートカットのコマンドを処理
chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    try {
      chrome.action.openPopup();
    } catch (error) {
      console.error("ポップアップを開けませんでした:", error);
    }
  }
});

export {};
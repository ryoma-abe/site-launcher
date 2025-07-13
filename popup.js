// デフォルトのサイト
const defaultSites = [{ name: "Google", url: "https://google.com", key: "G" }];

let sites = [];

// ページ読み込み時の処理
document.addEventListener("DOMContentLoaded", async () => {
  await loadSites();
  displaySites();
  setupEventListeners();

  // フォーカスを検索ボックスに設定
  document.getElementById("searchBox").focus();
});

// サイトリストを読み込む
async function loadSites() {
  const result = await chrome.storage.sync.get(["sites"]);
  sites = result.sites || defaultSites;
}

// サイトリストを保存する
async function saveSites() {
  await chrome.storage.sync.set({ sites });
}

// サイトリストを表示する
function displaySites(filter = "") {
  const siteList = document.getElementById("siteList");
  siteList.innerHTML = "";

  const filteredSites = sites.filter(
    (site) =>
      site.name.toLowerCase().includes(filter.toLowerCase()) ||
      site.url.toLowerCase().includes(filter.toLowerCase()) ||
      site.key.toLowerCase().includes(filter.toLowerCase())
  );

  filteredSites.forEach((site, index) => {
    const li = document.createElement("li");
    li.className = "site-item";
    li.innerHTML = `
      <span class="site-key">${site.key}</span>
      <div style="flex: 1;">
        <div class="site-name">${site.name}</div>
        <div class="site-url">${site.url}</div>
      </div>
      <button class="delete-btn" data-index="${sites.indexOf(
        site
      )}">削除</button>
    `;

    // クリックでサイトを開く
    li.addEventListener("click", (e) => {
      if (!e.target.classList.contains("delete-btn")) {
        openSite(site.url);
      }
    });

    siteList.appendChild(li);
  });
}

// サイトを開く
function openSite(url) {
  chrome.tabs.create({ url });
  window.close();
}

// イベントリスナーの設定
function setupEventListeners() {
  // 検索ボックス
  document.getElementById("searchBox").addEventListener("input", (e) => {
    displaySites(e.target.value);
  });

  // キーボードショートカット
  document.addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    const site = sites.find((s) => s.key.toUpperCase() === key);
    if (site) {
      openSite(site.url);
    }
  });

  // サイト追加ボタン
  document.getElementById("addSite").addEventListener("click", addSite);

  // Enterキーでサイト追加
  ["siteName", "siteUrl", "siteKey"].forEach((id) => {
    document.getElementById(id).addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addSite();
      }
    });
  });

  // 削除ボタン（イベント委任）
  document.getElementById("siteList").addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const index = parseInt(e.target.dataset.index);
      deleteSite(index);
    }
  });
}

// サイトを追加する
async function addSite() {
  const name = document.getElementById("siteName").value.trim();
  const url = document.getElementById("siteUrl").value.trim();
  const key = document.getElementById("siteKey").value.trim().toUpperCase();

  // バリデーション
  if (!name || !url || !key) {
    showMessage("すべてのフィールドを入力してください", "error");
    return;
  }

  if (!/^[A-Z0-9]$/.test(key)) {
    showMessage("ショートカットキーはA-Z、0-9の1文字にしてください", "error");
    return;
  }

  if (sites.some((s) => s.key.toUpperCase() === key)) {
    showMessage("そのショートカットキーは既に使用されています", "error");
    return;
  }

  // URLの正規化
  let normalizedUrl = url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    normalizedUrl = "https://" + url;
  }

  // サイトを追加
  sites.push({ name, url: normalizedUrl, key });
  await saveSites();

  // UIをリセット
  document.getElementById("siteName").value = "";
  document.getElementById("siteUrl").value = "";
  document.getElementById("siteKey").value = "";
  displaySites();

  showMessage("サイトを追加しました", "success");
}

// サイトを削除する
async function deleteSite(index) {
  if (confirm("このサイトを削除しますか？")) {
    sites.splice(index, 1);
    await saveSites();
    displaySites();
    showMessage("サイトを削除しました", "success");
  }
}

// メッセージを表示する
function showMessage(text, type) {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;

  setTimeout(() => {
    messageDiv.textContent = "";
    messageDiv.className = "message";
  }, 3000);
}

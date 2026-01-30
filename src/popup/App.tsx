import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Site } from "../types";
import { loadSites, removeSiteByIndex } from "../shared/sites";
import "./App.css";

const getFaviconUrl = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
};

const getLogoUrl = (): string => {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("icon48.png");
    }
  } catch {}
  return "/icon48.png";
};

const REVIEW_URL =
  "https://chromewebstore.google.com/detail/site-launcher/jahndejpknmaippmlngfodgkkmiodfai/reviews";
const REVIEW_MILESTONE = 10;

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const initialSites = await loadSites();
      setSites(initialSites);
    };
    initialize();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      const key = e.key.toUpperCase();
      const site = sites.find((s) => s.key.toUpperCase() === key);
      if (site) {
        openSite(site.url);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sites]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [message]);

  // レビュー依頼: 10サイト達成時に一度だけ表示
  useEffect(() => {
    const checkReviewPrompt = async () => {
      try {
        if (sites.length < REVIEW_MILESTONE) return;
        const result = await chrome.storage.local.get(["reviewPromptShown"]);
        if (result.reviewPromptShown) return;
        await chrome.storage.local.set({ reviewPromptShown: true });
        setShowReviewPrompt(true);
      } catch (error) {
        console.error("Failed to check review prompt", error);
      }
    };
    checkReviewPrompt();
  }, [sites.length]);

  const openSite = useCallback((url: string) => {
    chrome.windows.getLastFocused({ populate: true }, (window) => {
      const activeTab = window.tabs?.find((tab) => tab.active);
      if (activeTab && activeTab.id) {
        chrome.tabs.update(activeTab.id, { url });
      }
    });
    window.close();
  }, []);

  const deleteSite = useCallback(
    async (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("このサイトを削除しますか？")) return;

      const updated = await removeSiteByIndex(index, sites);
      setSites(updated);
      showMessage("サイトを削除しました", "success");
    },
    [showMessage, sites],
  );

  const openSettingsPage = useCallback(() => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    }
    window.close();
  }, []);

  const openGuidePage = useCallback(() => {
    chrome.tabs.create({ url: "https://ryx.jp/products/site-launcher/guide" });
    window.close();
  }, []);

  const openReviewPage = useCallback(() => {
    chrome.tabs.create({ url: REVIEW_URL });
    setShowReviewPrompt(false);
    window.close();
  }, []);

  const dismissReviewPrompt = useCallback(() => {
    setShowReviewPrompt(false);
  }, []);

  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return sites;
    const query = searchQuery.toLowerCase();
    return sites.filter(
      (site) =>
        site.name.toLowerCase().includes(query) ||
        site.url.toLowerCase().includes(query) ||
        site.key.toLowerCase().includes(query),
    );
  }, [sites, searchQuery]);

  const logoUrl = useMemo(() => getLogoUrl(), []);

  return (
    <div className="app">
      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {showReviewPrompt && (
        <div className="review-overlay" onClick={dismissReviewPrompt}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="review-icon">🎉</div>
            <h3 className="review-title">{REVIEW_MILESTONE}サイト登録達成！</h3>
            <p className="review-text">
              Site Launcher をご愛用いただきありがとうございます。
              <br />
              よろしければレビューで応援していただけると励みになります。
            </p>
            <div className="review-actions">
              <button className="review-btn primary" onClick={openReviewPage}>
                レビューを書く
              </button>
              <button className="review-btn" onClick={dismissReviewPrompt}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="header">
        <div className="header-logo">
          <img src={logoUrl} alt="RYX-Site Launcher" />
        </div>
        <div className="header-actions">
          <button className="header-btn" onClick={openGuidePage}>
            ガイド
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <button className="header-btn primary" onClick={openSettingsPage}>
            設定
          </button>
        </div>
      </div>

      <div className="search-container">
        <svg
          className="search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="main-panel">
        {filteredSites.length === 0 ? (
          <div className="site-empty">
            <div className="site-empty-text">
              {searchQuery
                ? "見つかりませんでした"
                : "サイトが登録されていません"}
            </div>
          </div>
        ) : (
          <div className="site-grid">
            {filteredSites.map((site) => {
              const faviconUrl = getFaviconUrl(site.url);
              const originalIndex = sites.findIndex(
                (s) => s.key === site.key && s.url === site.url,
              );

              return (
                <div
                  key={`${site.key}-${site.url}`}
                  className="site-item"
                  onClick={() => openSite(site.url)}
                >
                  <div className="site-icon-wrapper">
                    <div className="site-icon">
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt=""
                          className="site-favicon"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget
                              .nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className="site-fallback"
                        style={{ display: faviconUrl ? "none" : "flex" }}
                      >
                        {site.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="site-key-badge">
                      {site.key.toUpperCase()}
                    </span>
                    <button
                      className="site-delete"
                      onClick={(e) => deleteSite(originalIndex, e)}
                    >
                      ×
                    </button>
                  </div>
                  <span className="site-name">{site.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="footer">
        <div className="footer-left">
          <button className="settings-btn" onClick={openSettingsPage}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <div className="shortcut-hint">
            <svg
              className="shortcut-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
            </svg>
            <span className="shortcut-text">Cmd+M / Ctrl+M</span>
          </div>
        </div>
        <div className="footer-right">
          <button className="add-btn" onClick={openSettingsPage}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            追加
          </button>
        </div>
      </div>
    </div>
  );
};

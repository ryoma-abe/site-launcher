import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AddSiteForm } from "../components/AddSiteForm";
import { Message } from "../components/Message";
import { NavBar } from "../components/NavBar";
import { Site } from "../types";
import {
  PendingSitePayload,
  addSite as persistSite,
  exportSitesAsJson,
  generateKey,
  importSitesFromJson,
  loadSites,
  normalizeUrl,
  removeSiteByIndex,
  saveSites,
} from "../shared/sites";
import "./App.css";

type MessageState = {
  text: string;
  type: "success" | "error";
};

type FormMode = "add" | "edit";

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [initialFormValues, setInitialFormValues] = useState<Partial<Site> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
  }, []);

  const resetFormState = useCallback(() => {
    setFormMode("add");
    setEditingIndex(null);
    setInitialFormValues(null);
  }, []);

  const loadPendingSite = useCallback(
    async (currentSites: Site[]) => {
      try {
        const result = await chrome.storage.local.get(["pendingSite"]);
        const pending = result.pendingSite as PendingSitePayload | undefined;
        if (!pending) {
          return;
        }

        await chrome.storage.local.remove("pendingSite");

        const normalizedUrl = pending.url ? normalizeUrl(pending.url) : "";
        const duplicateIndex = normalizedUrl
          ? currentSites.findIndex((site) => site.url === normalizedUrl)
          : -1;

        if (duplicateIndex !== -1) {
          setFormMode("edit");
          setEditingIndex(duplicateIndex);
          setInitialFormValues(currentSites[duplicateIndex]);
          showMessage(
            "このサイトは既に登録されています。内容を更新できます。",
            "error"
          );
          return;
        }

        const availableKey = generateKey(currentSites, pending.preferredKey);
        setFormMode("add");
        setInitialFormValues({
          name: pending.name ?? "",
          url: normalizedUrl,
          key: availableKey ?? pending.preferredKey ?? "",
        });

        if (!availableKey && pending.preferredKey) {
          showMessage(
            "利用可能なショートカットキーがありません。別のキーを指定してください。",
            "error"
          );
        } else {
          showMessage(
            "右クリックから追加されたサイトです。内容を確認して登録してください。",
            "success"
          );
        }
      } catch (error) {
        console.error("Failed to load pending site payload", error);
      }
    },
    [generateKey, normalizeUrl, setEditingIndex, setFormMode, showMessage]
  );

  const refreshSites = useCallback(async () => {
    setIsLoading(true);
    const loaded = await loadSites();
    setSites(loaded);
    await loadPendingSite(loaded);
    setIsLoading(false);
  }, [loadPendingSite]);

  useEffect(() => {
    refreshSites();
  }, [refreshSites]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleDelete = useCallback(
    async (index: number) => {
      if (!confirm("このサイトを削除しますか？")) {
        return;
      }

      const updated = await removeSiteByIndex(index, sites);
      setSites(updated);
      showMessage("サイトを削除しました", "success");

      if (editingIndex === index) {
        resetFormState();
      }
    },
    [editingIndex, resetFormState, showMessage, sites]
  );

  const handleFormSubmit = useCallback(
    async (site: Site) => {
      if (formMode === "edit" && editingIndex !== null) {
        const trimmedName = site.name.trim();
        const trimmedUrl = normalizeUrl(site.url);
        const normalizedKey = site.key.trim().toUpperCase();

        if (!trimmedName || !trimmedUrl || !normalizedKey) {
          showMessage("すべてのフィールドを入力してください", "error");
          return false;
        }

        const duplicateKeyIndex = sites.findIndex(
          (item, idx) =>
            idx !== editingIndex && item.key.toUpperCase() === normalizedKey
        );
        if (duplicateKeyIndex !== -1) {
          showMessage(
            "他のサイトで同じショートカットキーが使われています",
            "error"
          );
          return false;
        }

        const updated = [...sites];
        updated[editingIndex] = {
          name: trimmedName,
          url: trimmedUrl,
          key: normalizedKey,
        };

        await saveSites(updated);
        setSites(updated);
        showMessage("サイトを更新しました", "success");
        resetFormState();
        return true;
      }

      const result = await persistSite(site, sites);
      if (!result.success) {
        showMessage(result.message, "error");
        return false;
      }

      setSites(result.sites);
      showMessage("サイトを追加しました", "success");
      return true;
    },
    [editingIndex, formMode, sites, showMessage, resetFormState]
  );

  const handleEdit = useCallback(
    (index: number) => {
      setFormMode("edit");
      setEditingIndex(index);
      setInitialFormValues(sites[index]);
    },
    [sites]
  );

  const handleCancelEdit = useCallback(() => {
    resetFormState();
  }, [resetFormState]);

  const openShortcutSettings = useCallback(() => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }, []);

  const openGuidePage = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("import-export.html") });
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      const json = await exportSitesAsJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.href = url;
      anchor.download = `site-launcher-backup-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showMessage("サイトのエクスポートが完了しました", "success");
    } catch (error) {
      console.error("Failed to export sites", error);
      showMessage("エクスポートに失敗しました", "error");
    } finally {
      setIsExporting(false);
    }
  }, [exportSitesAsJson, showMessage]);

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        setIsImporting(true);
        const text = await file.text();
        const result = await importSitesFromJson(text);
        if (!result.success) {
          showMessage(result.message, "error");
          return;
        }
        setSites(result.sites);
        showMessage("サイトのインポートが完了しました", "success");
        resetFormState();
      } catch (error) {
        console.error("Failed to import sites", error);
        showMessage("インポート中にエラーが発生しました", "error");
      } finally {
        setIsImporting(false);
        event.target.value = "";
      }
    },
    [importSitesFromJson, resetFormState, showMessage]
  );

  const navActions = useMemo(
    () => [
      { label: "ガイド", onClick: openGuidePage, variant: "ghost" as const },
      {
        label: "ショートカット設定",
        onClick: openShortcutSettings,
        variant: "tonal" as const,
      },
      {
        label: isExporting ? "エクスポート中…" : "エクスポート",
        onClick: handleExport,
        variant: "tonal" as const,
        disabled: isExporting,
      },
      {
        label: isImporting ? "インポート中…" : "インポート",
        onClick: triggerImport,
        variant: "primary" as const,
        disabled: isImporting,
      },
    ],
    [
      handleExport,
      isExporting,
      isImporting,
      openGuidePage,
      openShortcutSettings,
      triggerImport,
    ]
  );

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const formTitle = formMode === "edit" ? "サイトを編集" : "新しいサイトを追加";
  const formSubmitLabel = formMode === "edit" ? "変更を保存" : "サイトを追加";

  return (
    <div className="options-app">
      <NavBar title="SITE LAUNCHER" subtitle="SETTINGS" actions={navActions} />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleImportChange}
      />

      {message && <Message text={message.text} type={message.type} />}

      <div className="main-layout">
        <section className="panel panel-sites">
          <h2 className="panel-title">登録済みサイト</h2>
          {isLoading ? (
            <div className="site-grid-empty">読み込み中...</div>
          ) : sites.length === 0 ? (
            <div className="site-grid-empty">登録されたサイトはありません</div>
          ) : (
            <div className="site-grid-options">
              {sites.map((site, index) => {
                const faviconUrl = getFaviconUrl(site.url);
                const shortcut = site.key.toUpperCase();
                const isEditing = editingIndex === index;

                return (
                  <div
                    key={`${site.key}-${site.url}`}
                    className={`site-card-options ${isEditing ? "editing" : ""}`}
                  >
                    <div className="site-card-options-header">
                      <span className="site-key-options">{shortcut}</span>
                      <div className="site-card-options-actions">
                        <button
                          type="button"
                          className="site-action-btn edit"
                          onClick={() => handleEdit(index)}
                          aria-label="編集"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="site-action-btn delete"
                          onClick={() => handleDelete(index)}
                          aria-label="削除"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="site-card-options-icon">
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt=""
                          className="site-favicon-options"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget
                              .nextElementSibling as HTMLElement | null;
                            fallback?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <span
                        className={`site-icon-fallback-options ${faviconUrl ? "hidden" : ""}`}
                      >
                        {site.name.charAt(0).toUpperCase() || shortcut}
                      </span>
                    </div>
                    <div className="site-card-options-name">{site.name}</div>
                    <div className="site-card-options-url">{site.url}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel panel-form">
          <div className="form-header">
            <h2 className="panel-title">{formTitle}</h2>
            {formMode === "edit" && (
              <button
                type="button"
                className="btn-link"
                onClick={handleCancelEdit}
              >
                キャンセル
              </button>
            )}
          </div>
          <AddSiteForm
            onAdd={handleFormSubmit}
            initialValues={initialFormValues}
            submitLabel={formSubmitLabel}
            onSubmitSuccess={resetFormState}
            title={null}
          />
        </section>
      </div>
    </div>
  );
};

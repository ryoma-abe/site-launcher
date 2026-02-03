import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formKey, setFormKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
  }, []);

  const resetFormState = useCallback(() => {
    setFormMode("add");
    setEditingIndex(null);
    setFormName("");
    setFormUrl("");
    setFormKey("");
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
          const existingSite = currentSites[duplicateIndex];
          setFormName(existingSite.name);
          setFormUrl(existingSite.url);
          setFormKey(existingSite.key);
          showMessage(
            chrome.i18n.getMessage("siteAlreadyRegistered"),
            "error",
          );
          return;
        }

        const availableKey = generateKey(currentSites, pending.preferredKey);
        setFormMode("add");
        setFormName(pending.name ?? "");
        setFormUrl(normalizedUrl);
        setFormKey(availableKey ?? pending.preferredKey ?? "");

        if (!availableKey && pending.preferredKey) {
          showMessage(
            chrome.i18n.getMessage("noAvailableShortcutKey"),
            "error",
          );
        } else {
          showMessage(
            chrome.i18n.getMessage("siteFromContextMenu"),
            "success",
          );
        }
      } catch (error) {
        console.error("Failed to load pending site payload", error);
      }
    },
    [showMessage],
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
      if (!confirm(chrome.i18n.getMessage("deleteSiteConfirm"))) {
        return;
      }

      const updated = await removeSiteByIndex(index, sites);
      setSites(updated);
      showMessage(chrome.i18n.getMessage("siteDeleted"), "success");

      if (editingIndex === index) {
        resetFormState();
      }
    },
    [editingIndex, resetFormState, showMessage, sites],
  );

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = formName.trim();
      const trimmedUrl = normalizeUrl(formUrl);
      const normalizedKey = formKey.trim().toUpperCase();

      if (!trimmedName || !trimmedUrl || !normalizedKey) {
        showMessage(chrome.i18n.getMessage("fillAllFields"), "error");
        return;
      }

      if (formMode === "edit" && editingIndex !== null) {
        const duplicateKeyIndex = sites.findIndex(
          (item, idx) =>
            idx !== editingIndex && item.key.toUpperCase() === normalizedKey,
        );
        if (duplicateKeyIndex !== -1) {
          showMessage(
            chrome.i18n.getMessage("duplicateShortcutKey"),
            "error",
          );
          return;
        }

        const updated = [...sites];
        updated[editingIndex] = {
          name: trimmedName,
          url: trimmedUrl,
          key: normalizedKey,
        };

        await saveSites(updated);
        setSites(updated);
        showMessage(chrome.i18n.getMessage("siteUpdated"), "success");
        resetFormState();
        return;
      }

      const site: Site = {
        name: trimmedName,
        url: trimmedUrl,
        key: normalizedKey,
      };

      const result = await persistSite(site, sites);
      if (!result.success) {
        showMessage(result.message, "error");
        return;
      }

      setSites(result.sites);
      showMessage(chrome.i18n.getMessage("siteAdded"), "success");
      resetFormState();
    },
    [
      editingIndex,
      formKey,
      formMode,
      formName,
      formUrl,
      sites,
      showMessage,
      resetFormState,
    ],
  );

  const handleEdit = useCallback(
    (index: number) => {
      setFormMode("edit");
      setEditingIndex(index);
      const site = sites[index];
      setFormName(site.name);
      setFormUrl(site.url);
      setFormKey(site.key);
    },
    [sites],
  );

  const handleCancelEdit = useCallback(() => {
    resetFormState();
  }, [resetFormState]);

  const openShortcutSettings = useCallback(() => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }, []);

  const openGuidePage = useCallback(() => {
    chrome.tabs.create({ url: "https://ryx.jp/products/site-launcher/guide" });
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
      showMessage(chrome.i18n.getMessage("exportCompleted"), "success");
    } catch (error) {
      console.error("Failed to export sites", error);
      showMessage(chrome.i18n.getMessage("exportFailed"), "error");
    } finally {
      setIsExporting(false);
    }
  }, [showMessage]);

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
        showMessage(chrome.i18n.getMessage("importCompleted"), "success");
        resetFormState();
      } catch (error) {
        console.error("Failed to import sites", error);
        showMessage(chrome.i18n.getMessage("importError"), "error");
      } finally {
        setIsImporting(false);
        event.target.value = "";
      }
    },
    [resetFormState, showMessage],
  );

  const logoUrl = useMemo(() => {
    try {
      const manifest = chrome.runtime.getManifest();
      const icons = manifest.icons || {};
      const iconPath =
        icons["128"] || icons["48"] || icons["32"] || icons["16"];
      return iconPath ? chrome.runtime.getURL(iconPath) : null;
    } catch {
      return null;
    }
  }, []);

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const formTitle = formMode === "edit" ? chrome.i18n.getMessage("editSite") : chrome.i18n.getMessage("addNew");
  const formSubmitLabel = formMode === "edit" ? chrome.i18n.getMessage("saveChanges") : chrome.i18n.getMessage("add");

  return (
    <div className="options-app">
      {message && <Message text={message.text} type={message.type} />}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleImportChange}
      />

      {/* Header */}
      <header className="header">
        <div className="header-logo">
          {logoUrl && <img src={logoUrl} alt="RYX-Site Launcher" />}
        </div>
        <div className="header-title">
          <h1>RYX-Site Launcher</h1>
          <p>Settings</p>
        </div>
        <div className="header-actions">
          <button className="header-btn" onClick={openGuidePage}>
            {chrome.i18n.getMessage("guide")}
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
          <button className="header-btn" onClick={openShortcutSettings}>
            {chrome.i18n.getMessage("shortcutSettings")}
          </button>
          <button
            className="header-btn"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? chrome.i18n.getMessage("exporting") : chrome.i18n.getMessage("export")}
          </button>
          <button
            className="header-btn primary"
            onClick={triggerImport}
            disabled={isImporting}
          >
            {isImporting ? chrome.i18n.getMessage("importing") : chrome.i18n.getMessage("import")}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sites Panel */}
        <section className="panel panel-sites">
          <h2 className="panel-title">{chrome.i18n.getMessage("registeredSites")}</h2>
          {isLoading ? (
            <div className="site-grid-empty">{chrome.i18n.getMessage("loading")}</div>
          ) : sites.length === 0 ? (
            <div className="site-grid-empty">{chrome.i18n.getMessage("noSitesRegistered")}</div>
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
                    onClick={() => handleEdit(index)}
                  >
                    <div className="site-icon-wrapper-options">
                      <div className="site-icon-options">
                        {faviconUrl ? (
                          <img
                            src={faviconUrl}
                            alt=""
                            className="site-favicon-options"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fallback = e.currentTarget
                                .nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <span
                          className="site-fallback-options"
                          style={{ display: faviconUrl ? "none" : "flex" }}
                        >
                          {site.name.charAt(0).toUpperCase() || shortcut}
                        </span>
                      </div>
                      <span className="site-key-badge-options">{shortcut}</span>
                    </div>
                    <span className="site-card-options-name">{site.name}</span>
                    <div className="site-card-options-actions">
                      <button
                        type="button"
                        className="site-action-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(index);
                        }}
                        aria-label={chrome.i18n.getMessage("delete")}
                      >
                        <svg
                          width="12"
                          height="12"
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
                );
              })}
            </div>
          )}
        </section>

        {/* Form Panel */}
        <section className="panel panel-form">
          <div className="form-header">
            <h2 className="panel-title">{formTitle}</h2>
            {formMode === "edit" && (
              <button
                type="button"
                className="btn-link"
                onClick={handleCancelEdit}
              >
                {chrome.i18n.getMessage("cancel")}
              </button>
            )}
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="form-group">
              <label className="form-label">{chrome.i18n.getMessage("siteName")}</label>
              <input
                type="text"
                className="form-input"
                placeholder={chrome.i18n.getMessage("exampleSiteName")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{chrome.i18n.getMessage("url")}</label>
              <input
                type="text"
                className="form-input"
                placeholder={chrome.i18n.getMessage("exampleUrl")}
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{chrome.i18n.getMessage("shortcutKey")}</label>
              <input
                type="text"
                className="form-input"
                placeholder={chrome.i18n.getMessage("exampleKey")}
                maxLength={1}
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toUpperCase())}
              />
            </div>
            <button type="submit" className="form-submit">
              {formSubmitLabel}
            </button>
          </form>
        </section>
      </div>

      {/* Footer - Support Section */}
      <footer className="support-footer">
        <div className="support-content">
          <div className="support-icon">💬</div>
          <div className="support-text-wrapper">
            <h3 className="support-title">{chrome.i18n.getMessage("feedbackTitle")}</h3>
            <p className="support-text">
              {chrome.i18n.getMessage("feedbackText")}
            </p>
          </div>
          <div className="support-actions">
            <a
              href="https://ryx.jp/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="support-btn"
            >
              {chrome.i18n.getMessage("sendFeedback")}
            </a>
            <a
              href="https://chromewebstore.google.com/detail/site-launcher/jahndejpknmaippmlngfodgkkmiodfai/reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="support-btn primary"
            >
              {chrome.i18n.getMessage("writeReviewWithStar")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Message: React.FC<MessageState> = ({ text, type }) => (
  <div className={`message ${type}`}>{text}</div>
);

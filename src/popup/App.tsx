import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Site } from "../types";
import { SiteList } from "../components/SiteList";
import { AddSiteForm } from "../components/AddSiteForm";
import { Message } from "../components/Message";
import { NavBar } from "../components/NavBar";
import {
  addSite as persistSite,
  loadSites,
  removeSiteByIndex,
} from "../shared/sites";
import "./App.css";

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

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
    if (!message) {
      return;
    }

    const timeout = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [message]);

  const openSite = useCallback((url: string) => {
    chrome.windows.getLastFocused({ populate: true }, (window) => {
      const activeTab = window.tabs?.find((tab) => tab.active);
      if (activeTab && activeTab.id) {
        chrome.tabs.update(activeTab.id, { url });
      }
    });
    window.close();
  }, []);

  const addSite = useCallback(
    async (site: Site) => {
      const result = await persistSite(site, sites);
      if (!result.success) {
        showMessage(result.message, "error");
        return false;
      }

      setSites(result.sites);
      showMessage("サイトを追加しました", "success");
      return true;
    },
    [showMessage, sites]
  );

  const deleteSite = useCallback(
    async (index: number) => {
      if (!confirm("このサイトを削除しますか？")) {
        return;
      }

      const updated = await removeSiteByIndex(index, sites);
      setSites(updated);
      showMessage("サイトを削除しました", "success");
    },
    [showMessage, sites]
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

  const navActions = useMemo(
    () => [
      { label: "設定", onClick: openSettingsPage, variant: "primary" as const },
      {
        label: "ガイド",
        onClick: openGuidePage,
        variant: "ghost" as const,
        external: true,
      },
    ],
    [openGuidePage, openSettingsPage]
  );

  return (
    <div className="app">
      <NavBar
        title="SITE LAUNCHER"
        subtitle="QUICK ACCESS"
        actions={navActions}
      />
      {message && <Message text={message.text} type={message.type} />}
      <div className="main-layout">
        <div className="panel panel-sites">
          <h3 className="panel-title">SITES</h3>
          <SiteList
            sites={sites}
            onSiteClick={openSite}
            onDelete={deleteSite}
          />
        </div>
        <div className="panel panel-form">
          <h3 className="panel-title">ADD NEW</h3>
          <AddSiteForm onAdd={addSite} title={null} />
        </div>
      </div>
    </div>
  );
};

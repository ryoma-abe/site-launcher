import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Site } from '../types';
import { SiteList } from '../components/SiteList';
import { AddSiteForm } from '../components/AddSiteForm';
import { Message } from '../components/Message';
import { NavBar } from '../components/NavBar';
import { addSite as persistSite, loadSites, removeSiteByIndex } from '../shared/sites';
import './App.css';

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
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
      // 入力フィールドにフォーカスがある場合はショートカットを無効にする
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toUpperCase();
      const site = sites.find((s) => s.key.toUpperCase() === key);
      if (site) {
        openSite(site.url);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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

  const addSite = useCallback(async (site: Site) => {
    const result = await persistSite(site, sites);
    if (!result.success) {
      showMessage(result.message, 'error');
      return false;
    }

    setSites(result.sites);
    showMessage('サイトを追加しました', 'success');
    return true;
  }, [showMessage, sites]);

  const deleteSite = useCallback(async (index: number) => {
    if (!confirm('このサイトを削除しますか？')) {
      return;
    }

    const updated = await removeSiteByIndex(index, sites);
    setSites(updated);
    showMessage('サイトを削除しました', 'success');
  }, [showMessage, sites]);

  const openSettingsPage = useCallback(() => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
    window.close();
  }, []);

  const openGuidePage = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('import-export.html') });
    window.close();
  }, []);

  const navActions = useMemo(
    () => [
      { label: '設定ページ', onClick: openSettingsPage, variant: 'primary' as const },
      { label: '説明ページ', onClick: openGuidePage, variant: 'tonal' as const },
    ],
    [openGuidePage, openSettingsPage]
  );

  const shortcutInfo = useMemo(() => (
    <p>
      💡 詳細な設定やショートカットの変更は設定ページから行えます
    </p>
  ), []);

  return (
    <div className="app">
      <NavBar title="Site Launcher" subtitle="お気に入りサイトへワンクリック" actions={navActions} />
      {message && <Message text={message.text} type={message.type} />}
      <div className="surface">
        <SiteList sites={sites} onSiteClick={openSite} onDelete={deleteSite} />
      </div>
      <div className="surface">
        <AddSiteForm onAdd={addSite} />
      </div>
      <div className="shortcut-info">
        {shortcutInfo}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Site } from '../types';
import { SiteList } from './components/SiteList';
import { AddSiteForm } from './components/AddSiteForm';
import { Message } from './components/Message';
import { SettingsIcon } from './components/SettingsIcon';
import './App.css';

const defaultSites: Site[] = [{ name: "Google", url: "https://google.com", key: "G" }];

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSites();
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

  // データ永続化関連の処理
  const loadSites = async () => {
    try {
      const result = await chrome.storage.sync.get(['sites']);
      setSites(result.sites || defaultSites);
    } catch (error) {
      console.error('Failed to load sites:', error);
      showMessage('サイトの読み込みに失敗しました', 'error');
      setSites(defaultSites);
    }
  };

  const saveSites = async (newSites: Site[]) => {
    try {
      await chrome.storage.sync.set({ sites: newSites });
      setSites(newSites);
    } catch (error) {
      console.error('Failed to save sites:', error);
      showMessage('サイトの保存に失敗しました', 'error');
    }
  };

  // サイトを新しいタブで開く
  const openSite = (url: string) => {
    try {
      chrome.tabs.create({ url });
      window.close();
    } catch (error) {
      console.error('Failed to open site:', error);
      showMessage('サイトを開けませんでした', 'error');
    }
  };

  const addSite = async (site: Site) => {
    if (sites.some((s) => s.key.toUpperCase() === site.key.toUpperCase())) {
      showMessage('そのショートカットキーは既に使用されています', 'error');
      return false;
    }

    const newSites = [...sites, site];
    await saveSites(newSites);
    showMessage('サイトを追加しました', 'success');
    return true;
  };

  const deleteSite = async (index: number) => {
    if (confirm('このサイトを削除しますか？')) {
      const newSites = sites.filter((_, i) => i !== index);
      await saveSites(newSites);
      showMessage('サイトを削除しました', 'success');
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };


  const openShortcutSettings = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  return (
    <div className="app">
      <div className="header">
        <h2>Site Launcher</h2>
        <button className="settings-btn" onClick={openShortcutSettings} title="ショートカット設定">
          <SettingsIcon />
        </button>
      </div>
      {message && <Message text={message.text} type={message.type} />}
      <SiteList sites={sites} onSiteClick={openSite} onDelete={deleteSite} />
      <AddSiteForm onAdd={addSite} />
      <div className="shortcut-info">
        <p>💡 ランチャーを開くショートカットは設定で変更できます</p>
      </div>
    </div>
  );
};
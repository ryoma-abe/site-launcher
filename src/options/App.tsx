import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddSiteForm } from '../components/AddSiteForm';
import { Message } from '../components/Message';
import { NavBar } from '../components/NavBar';
import { Site } from '../types';
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
} from '../shared/sites';
import './App.css';

type MessageState = {
  text: string;
  type: 'success' | 'error';
};

type FormMode = 'add' | 'edit';

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [initialFormValues, setInitialFormValues] = useState<Partial<Site> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showMessage = useCallback((text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
  }, []);

  const resetFormState = useCallback(() => {
    setFormMode('add');
    setEditingIndex(null);
    setInitialFormValues(null);
  }, []);

  const loadPendingSite = useCallback(async (currentSites: Site[]) => {
    try {
      const result = await chrome.storage.local.get(['pendingSite']);
      const pending = result.pendingSite as PendingSitePayload | undefined;
      if (!pending) {
        return;
      }

      await chrome.storage.local.remove('pendingSite');

      const normalizedUrl = pending.url ? normalizeUrl(pending.url) : '';
      const duplicateIndex = normalizedUrl
        ? currentSites.findIndex((site) => site.url === normalizedUrl)
        : -1;

      if (duplicateIndex !== -1) {
        setFormMode('edit');
        setEditingIndex(duplicateIndex);
        setInitialFormValues(currentSites[duplicateIndex]);
        showMessage('このサイトは既に登録されています。内容を更新できます。', 'error');
        return;
      }

      const availableKey = generateKey(currentSites, pending.preferredKey);
      setFormMode('add');
      setInitialFormValues({
        name: pending.name ?? '',
        url: normalizedUrl,
        key: availableKey ?? pending.preferredKey ?? '',
      });

      if (!availableKey && pending.preferredKey) {
        showMessage('利用可能なショートカットキーがありません。別のキーを指定してください。', 'error');
      } else {
        showMessage('右クリックから追加されたサイトです。内容を確認して登録してください。', 'success');
      }
    } catch (error) {
      console.error('Failed to load pending site payload', error);
    }
  }, [generateKey, normalizeUrl, setEditingIndex, setFormMode, showMessage]);

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

  const handleDelete = useCallback(async (index: number) => {
    if (!confirm('このサイトを削除しますか？')) {
      return;
    }

    const updated = await removeSiteByIndex(index, sites);
    setSites(updated);
    showMessage('サイトを削除しました', 'success');

    if (editingIndex === index) {
      resetFormState();
    }
  }, [editingIndex, resetFormState, showMessage, sites]);

  const handleFormSubmit = useCallback(async (site: Site) => {
    if (formMode === 'edit' && editingIndex !== null) {
      const trimmedName = site.name.trim();
      const trimmedUrl = normalizeUrl(site.url);
      const normalizedKey = site.key.trim().toUpperCase();

      if (!trimmedName || !trimmedUrl || !normalizedKey) {
        showMessage('すべてのフィールドを入力してください', 'error');
        return false;
      }

      const duplicateKeyIndex = sites.findIndex((item, idx) => idx !== editingIndex && item.key.toUpperCase() === normalizedKey);
      if (duplicateKeyIndex !== -1) {
        showMessage('他のサイトで同じショートカットキーが使われています', 'error');
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
      showMessage('サイトを更新しました', 'success');
      resetFormState();
      return true;
    }

    const result = await persistSite(site, sites);
    if (!result.success) {
      showMessage(result.message, 'error');
      return false;
    }

    setSites(result.sites);
    showMessage('サイトを追加しました', 'success');
    return true;
  }, [editingIndex, formMode, sites, showMessage, resetFormState]);

  const handleEdit = useCallback((index: number) => {
    setFormMode('edit');
    setEditingIndex(index);
    setInitialFormValues(sites[index]);
  }, [sites]);

  const handleCancelEdit = useCallback(() => {
    resetFormState();
  }, [resetFormState]);

  const openShortcutSettings = useCallback(() => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }, []);

  const openGuidePage = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('import-export.html') });
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      const json = await exportSitesAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      anchor.href = url;
      anchor.download = `site-launcher-backup-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showMessage('サイトのエクスポートが完了しました', 'success');
    } catch (error) {
      console.error('Failed to export sites', error);
      showMessage('エクスポートに失敗しました', 'error');
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
          showMessage(result.message, 'error');
          return;
        }
        setSites(result.sites);
        showMessage('サイトのインポートが完了しました', 'success');
        resetFormState();
      } catch (error) {
        console.error('Failed to import sites', error);
        showMessage('インポート中にエラーが発生しました', 'error');
      } finally {
        setIsImporting(false);
        event.target.value = '';
      }
    },
    [importSitesFromJson, resetFormState, showMessage]
  );

  const navActions = useMemo(
    () => [
      { label: '説明ページ', onClick: openGuidePage, variant: 'ghost' as const },
      { label: 'ショートカット設定', onClick: openShortcutSettings, variant: 'tonal' as const },
      { label: isExporting ? 'エクスポート中…' : 'エクスポート', onClick: handleExport, variant: 'tonal' as const, disabled: isExporting },
      { label: isImporting ? 'インポート中…' : 'インポート', onClick: triggerImport, variant: 'primary' as const, disabled: isImporting },
    ],
    [handleExport, isExporting, isImporting, openGuidePage, openShortcutSettings, triggerImport]
  );

  const tableBody = useMemo(() => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={4} className="table-placeholder">
            読み込み中...
          </td>
        </tr>
      );
    }

    if (!sites.length) {
      return (
        <tr>
          <td colSpan={4} className="table-placeholder">
            登録されたサイトはありません。
          </td>
        </tr>
      );
    }

    return sites.map((site, index) => (
      <tr key={`${site.key}-${site.url}`} className={editingIndex === index ? 'editing-row' : ''}>
        <td className="col-key">{site.key}</td>
        <td className="col-name">{site.name}</td>
        <td className="col-url">{site.url}</td>
        <td className="col-actions">
          <button type="button" onClick={() => handleEdit(index)} className="btn btn-tonal">
            編集
          </button>
          <button type="button" onClick={() => handleDelete(index)} className="btn btn-danger">
            削除
          </button>
        </td>
      </tr>
    ));
  }, [editingIndex, handleDelete, handleEdit, isLoading, sites]);

  const formTitle = formMode === 'edit' ? 'サイトを編集' : '新しいサイトを追加';
  const formSubmitLabel = formMode === 'edit' ? '変更を保存' : 'サイトを追加';

  return (
    <div className="options-app">
      <NavBar
        title="Site Launcher 設定"
        subtitle="サイトの管理やバックアップはこちらから行えます。"
        actions={navActions}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleImportChange}
      />

      {message && <Message text={message.text} type={message.type} />}

      <section className="section">
        <h2>登録済みサイト</h2>
        <table className="site-table">
          <thead>
            <tr>
              <th className="col-key">キー</th>
              <th className="col-name">サイト名</th>
              <th className="col-url">URL</th>
              <th className="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </section>

      <section className="section">
        <div className="form-header">
          <h2>{formTitle}</h2>
          {formMode === 'edit' && (
            <button type="button" className="btn-link" onClick={handleCancelEdit}>
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
  );
};

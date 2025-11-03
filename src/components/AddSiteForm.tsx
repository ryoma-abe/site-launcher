import React, { useEffect, useState } from 'react';
import { Site } from '../types';
import { normalizeUrl } from '../shared/sites';
import './AddSiteForm.css';

interface AddSiteFormProps {
  onAdd: (site: Site) => Promise<boolean>;
  initialValues?: Partial<Site> | null;
  submitLabel?: string;
  onSubmitSuccess?: () => void;
  title?: string | null;
}

export const AddSiteForm: React.FC<AddSiteFormProps> = ({
  onAdd,
  initialValues = null,
  submitLabel = 'サイトを追加',
  onSubmitSuccess,
  title = '新しいサイトを追加',
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [shortcutKey, setShortcutKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValues) {
      setName('');
      setUrl('');
      setShortcutKey('');
      setError(null);
      return;
    }

    setName(initialValues.name ?? '');
    setUrl(initialValues.url ?? '');
    setShortcutKey(initialValues.key ?? '');
    setError(null);
  }, [initialValues]);

  // 入力値のバリデーション
  const validateInput = (name: string, url: string, key: string) => {
    if (!name || !url || !key) {
      setError('すべてのフィールドを入力してください');
      return false;
    }

    if (name.length > 50) {
      setError('サイト名は50文字以内で入力してください');
      return false;
    }

    if (!/^[A-Z0-9]$/.test(key)) {
      setError('ショートカットキーはA-Z、0-9の1文字にしてください');
      return false;
    }

    // 基本的なURL形式チェック
    try {
      new URL(url.startsWith('http') ? url : 'https://' + url);
    } catch {
      setError('有効なURLを入力してください');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedKey = shortcutKey.trim().toUpperCase();

    if (!validateInput(trimmedName, trimmedUrl, trimmedKey)) {
      return;
    }

    const normalizedUrl = normalizeUrl(trimmedUrl);

    const success = await onAdd({
      name: trimmedName,
      url: normalizedUrl,
      key: trimmedKey,
    });

    if (success) {
      setName('');
      setUrl('');
      setShortcutKey('');
      setError(null);
      onSubmitSuccess?.();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="add-site-section">
      {title !== null && <h3>{title}</h3>}
      <div className="input-group">
        <label htmlFor="siteName">サイト名</label>
        <input
          type="text"
          id="siteName"
          placeholder="例: Google"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
      <div className="input-group">
        <label htmlFor="siteUrl">URL</label>
        <input
          type="text"
          id="siteUrl"
          placeholder="例: https://google.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
      <div className="input-group">
        <label htmlFor="siteKey">ショートカットキー (A-Z, 0-9)</label>
        <input
          type="text"
          id="siteKey"
          placeholder="例: G"
          maxLength={1}
          value={shortcutKey}
          onChange={(e) => setShortcutKey(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn-add" onClick={handleSubmit}>
        {submitLabel}
      </button>
    </div>
  );
};

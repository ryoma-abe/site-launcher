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
  submitLabel = chrome.i18n.getMessage('addSite'),
  onSubmitSuccess,
  title = chrome.i18n.getMessage('addNewSite'),
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
      setError(chrome.i18n.getMessage('fillAllFields'));
      return false;
    }

    if (name.length > 50) {
      setError(chrome.i18n.getMessage('siteNameTooLong'));
      return false;
    }

    if (!/^[A-Z0-9]$/.test(key)) {
      setError(chrome.i18n.getMessage('invalidShortcutKey'));
      return false;
    }

    // 基本的なURL形式チェック
    try {
      new URL(url.startsWith('http') ? url : 'https://' + url);
    } catch {
      setError(chrome.i18n.getMessage('invalidUrl'));
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
        <label htmlFor="siteName">{chrome.i18n.getMessage('siteName')}</label>
        <input
          type="text"
          id="siteName"
          placeholder={chrome.i18n.getMessage('exampleSiteName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
      <div className="input-group">
        <label htmlFor="siteUrl">{chrome.i18n.getMessage('url')}</label>
        <input
          type="text"
          id="siteUrl"
          placeholder={chrome.i18n.getMessage('exampleUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
      <div className="input-group">
        <label htmlFor="siteKey">{chrome.i18n.getMessage('shortcutKeyLabel')}</label>
        <input
          type="text"
          id="siteKey"
          placeholder={chrome.i18n.getMessage('exampleKey')}
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

import React, { useState } from 'react';
import { Site } from '../../types';
import './AddSiteForm.css';

interface AddSiteFormProps {
  onAdd: (site: Site) => Promise<boolean>;
}

export const AddSiteForm: React.FC<AddSiteFormProps> = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  // 入力値のバリデーション
  const validateInput = (name: string, url: string, key: string) => {
    if (!name || !url || !key) {
      alert('すべてのフィールドを入力してください');
      return false;
    }

    if (name.length > 50) {
      alert('サイト名は50文字以内で入力してください');
      return false;
    }

    if (!/^[A-Z0-9]$/.test(key)) {
      alert('ショートカットキーはA-Z、0-9の1文字にしてください');
      return false;
    }

    // 基本的なURL形式チェック
    try {
      new URL(url.startsWith('http') ? url : 'https://' + url);
    } catch {
      alert('有効なURLを入力してください');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedKey = key.trim().toUpperCase();

    if (!validateInput(trimmedName, trimmedUrl, trimmedKey)) {
      return;
    }

    // URLの正規化
    let normalizedUrl = trimmedUrl;
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + trimmedUrl;
    }

    const success = await onAdd({
      name: trimmedName,
      url: normalizedUrl,
      key: trimmedKey,
    });

    if (success) {
      setName('');
      setUrl('');
      setKey('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="add-site-section">
      <h3>新しいサイトを追加</h3>
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
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyPress={handleKeyPress}
        />
      </div>
      <button className="btn-add" onClick={handleSubmit}>
        サイトを追加
      </button>
    </div>
  );
};
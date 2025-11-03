import React from 'react';
import { Site } from '../types';
import './SiteList.css';

interface SiteListProps {
  sites: Site[];
  onSiteClick: (url: string) => void;
  onDelete: (index: number) => void;
}

export const SiteList: React.FC<SiteListProps> = ({ sites, onSiteClick, onDelete }) => {
  // サイトのファビコンURLを取得する
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  return (
    <ul className="site-list">
      {sites.map((site, index) => {
        const faviconUrl = getFaviconUrl(site.url);
        const shortcut = site.key.toUpperCase();

        return (
          <li
            key={index}
            className="site-item"
            onClick={(e) => {
              if (!(e.target as HTMLElement).classList.contains('delete-btn')) {
                onSiteClick(site.url);
              }
            }}
          >
            <div className="site-main">
              <div className="site-icon-wrapper">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt="サイトのファビコン"
                    className="site-favicon"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      fallback?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <span className={`site-icon-fallback ${faviconUrl ? 'hidden' : ''}`} aria-hidden="true">
                  {site.name.charAt(0).toUpperCase() || shortcut}
                </span>
              </div>
              <div className="site-info">
                <div className="site-name">{site.name}</div>
                <div className="site-url">{site.url}</div>
              </div>
            </div>
            <span className="site-key-pill" aria-label={`ショートカット ${shortcut}`}>
              {shortcut}
            </span>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
            >
              削除
            </button>
          </li>
        );
      })}
    </ul>
  );
};

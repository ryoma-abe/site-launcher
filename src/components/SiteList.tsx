import React from "react";
import { Site } from "../types";
import "./SiteList.css";

interface SiteListProps {
  sites: Site[];
  onSiteClick: (url: string) => void;
  onDelete: (index: number) => void;
}

export const SiteList: React.FC<SiteListProps> = ({
  sites,
  onSiteClick,
  onDelete,
}) => {
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  if (sites.length === 0) {
    return (
      <div className="site-empty">
        <span className="site-empty-text">{chrome.i18n.getMessage("noSitesRegistered")}</span>
      </div>
    );
  }

  return (
    <div className="site-grid">
      {sites.map((site, index) => {
        const faviconUrl = getFaviconUrl(site.url);
        const shortcut = site.key.toUpperCase();

        return (
          <div
            key={index}
            className="site-card"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest(".delete-btn")) {
                onSiteClick(site.url);
              }
            }}
          >
            <div className="site-card-header">
              <span className="site-key">{shortcut}</span>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
                aria-label={chrome.i18n.getMessage("delete")}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="site-card-icon">
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="site-favicon"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget
                      .nextElementSibling as HTMLElement | null;
                    fallback?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <span
                className={`site-icon-fallback ${faviconUrl ? "hidden" : ""}`}
                aria-hidden="true"
              >
                {site.name.charAt(0).toUpperCase() || shortcut}
              </span>
            </div>
            <div className="site-card-name">{site.name}</div>
          </div>
        );
      })}
    </div>
  );
};

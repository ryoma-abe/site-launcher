import React from 'react';
import './NavBar.css';

type NavActionVariant = 'primary' | 'tonal' | 'ghost';

interface NavAction {
  label: string;
  onClick: () => void;
  variant?: NavActionVariant;
  disabled?: boolean;
  external?: boolean;
}

interface NavBarProps {
  title: string;
  subtitle?: string;
  actions?: NavAction[];
  logoSrc?: string;
  logoAlt?: string;
}

type IconDefinition = string | Record<string, string> | undefined;

const pickIconPath = (icon: IconDefinition): string | undefined => {
  if (!icon) {
    return undefined;
  }
  if (typeof icon === 'string') {
    return icon;
  }
  return icon['48'] || icon['128'] || icon['32'] || icon['16'] || Object.values(icon)[0];
};

const resolveLogoSrc = (): string => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      const iconPath =
        pickIconPath(manifest.action?.default_icon as IconDefinition) ||
        pickIconPath(manifest.icons as IconDefinition) ||
        'icon48.png';

      if (chrome.runtime.getURL) {
        return chrome.runtime.getURL(iconPath);
      }
      return iconPath;
    }
  } catch (error) {
    console.warn('Failed to resolve default logo', error);
  }
  return '/icon48.png';
};

const ExternalIcon: React.FC = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginLeft: 4 }}
  >
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const defaultLogoSrc = resolveLogoSrc();

export const NavBar: React.FC<NavBarProps> = ({
  title,
  subtitle,
  actions = [],
  logoSrc = defaultLogoSrc,
  logoAlt = 'Site Launcher',
}) => {
  return (
    <header className="nav-bar">
      <div className="nav-title">
        <img src={logoSrc} alt={logoAlt} className="nav-logo" width={28} height={28} />
        <div className="nav-text">
          <h1>{title}</h1>
          {subtitle && <p className="nav-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="nav-actions">
        {actions.map(({ label, onClick, variant = 'tonal', disabled = false, external = false }) => (
          <button
            key={label}
            type="button"
            className={`nav-btn nav-btn-${variant}`}
            onClick={onClick}
            disabled={disabled}
          >
            {label}
            {external && <ExternalIcon />}
          </button>
        ))}
      </div>
    </header>
  );
};

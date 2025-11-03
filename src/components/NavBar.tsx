import React from 'react';
import './NavBar.css';

type NavActionVariant = 'primary' | 'tonal' | 'ghost';

interface NavAction {
  label: string;
  onClick: () => void;
  variant?: NavActionVariant;
  disabled?: boolean;
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
        {actions.map(({ label, onClick, variant = 'tonal', disabled = false }) => (
          <button
            key={label}
            type="button"
            className={`nav-btn nav-btn-${variant}`}
            onClick={onClick}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
};

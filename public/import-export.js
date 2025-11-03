(function () {
  const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime;
  const README_URL = 'https://github.com/ryoma-abe/site-launcher#readme';

  const pickIconPath = (icon) => {
    if (!icon) return undefined;
    if (typeof icon === 'string') return icon;
    return icon['48'] || icon['128'] || icon['32'] || icon['16'] || Object.values(icon)[0];
  };

  const resolveUrl = (path) => {
    if (hasChrome && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    return path;
  };

  const openOptions = () => {
    if (hasChrome && typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage();
      return;
    }
    window.open(resolveUrl('options.html'), '_blank');
  };

  const openReadme = () => {
    window.open(README_URL, '_blank');
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    openOptions();
  };

  const updateLogo = () => {
    const img = document.querySelector('.nav-logo');
    if (!img) return;

    const fallback = 'icon48.png';

    if (hasChrome && chrome.runtime.getManifest) {
      try {
        const manifest = chrome.runtime.getManifest();
        const iconPath =
          pickIconPath(manifest.action?.default_icon) ||
          pickIconPath(manifest.icons) ||
          fallback;
        img.src = chrome.runtime.getURL(iconPath || fallback);
        return;
      } catch (error) {
        console.warn('Failed to load logo', error);
      }
    }

    img.src = fallback;
  };

  const attachHandler = (id, handler) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('click', (event) => {
      event.preventDefault();
      handler();
    });
  };

  attachHandler('nav-back', goBack);
  attachHandler('nav-options', openOptions);
  attachHandler('nav-readme', openReadme);
  updateLogo();
})();

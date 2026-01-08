import {
  DEFAULT_SITES,
  PendingSitePayload,
  SITES_STORAGE_KEY,
  generateKey,
  loadSites,
} from '../shared/sites';

const CONTEXT_MENU_ID = 'site-launcher-add-current';
const MIGRATION_KEY = 'migrated_to_local_v1';

const migrateFromSyncToLocal = async (): Promise<boolean> => {
  try {
    const migrationStatus = await chrome.storage.local.get([MIGRATION_KEY]);
    if (migrationStatus[MIGRATION_KEY]) {
      return false;
    }

    const syncResult = await chrome.storage.sync.get([SITES_STORAGE_KEY]);
    const syncSites = syncResult[SITES_STORAGE_KEY];

    if (syncSites && Array.isArray(syncSites) && syncSites.length > 0) {
      await chrome.storage.local.set({ [SITES_STORAGE_KEY]: syncSites });
      console.info('Migrated sites from sync to local storage:', syncSites.length, 'sites');
    }

    await chrome.storage.local.set({ [MIGRATION_KEY]: true });
    return true;
  } catch (error) {
    console.error('Failed to migrate from sync to local', error);
    return false;
  }
};

const ensureDefaultSites = async () => {
  try {
    await migrateFromSyncToLocal();

    const result = await chrome.storage.local.get([SITES_STORAGE_KEY]);
    if (!result[SITES_STORAGE_KEY]) {
      await chrome.storage.local.set({ [SITES_STORAGE_KEY]: DEFAULT_SITES });
      console.info('Default sites initialised');
    }
  } catch (error) {
    console.error('Failed to initialise default sites', error);
  }
};

const registerContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    const removeError = chrome.runtime.lastError;
    if (removeError) {
      console.debug('Context menu cleanup notice:', removeError.message);
    }

    chrome.contextMenus.create(
      {
        id: CONTEXT_MENU_ID,
        title: 'RYX-Site Launcher に追加',
        contexts: ['page', 'frame', 'link'],
      },
      () => {
        const createError = chrome.runtime.lastError;
        if (createError) {
          console.error('Failed to create context menu', createError);
        }
      }
    );
  });
};

const extractPreferredKey = (url: URL): string | undefined => {
  const hostname = url.hostname.replace(/^www\./, '');
  const firstChar = hostname[0];
  if (!firstChar) {
    return undefined;
  }
  const candidate = firstChar.toUpperCase();
  return /[A-Z0-9]/.test(candidate) ? candidate : undefined;
};

const handleContextMenuClick = async (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  const rawUrl = (info.linkUrl ?? info.pageUrl ?? tab?.url ?? '').trim();
  if (!rawUrl) {
    console.warn('No URL available for context menu action');
    return;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      console.warn('Unsupported protocol for context menu action', targetUrl.protocol);
      return;
    }
  } catch (error) {
    console.warn('Invalid URL for context menu action', rawUrl, error);
    return;
  }

  const existingSites = await loadSites();
  const preferredKey = extractPreferredKey(targetUrl);
  const availableKey = generateKey(existingSites, preferredKey);
  const siteTitle = tab?.title?.trim() || targetUrl.hostname;

  const payload: PendingSitePayload = {
    name: siteTitle,
    url: targetUrl.href,
    preferredKey: availableKey ?? preferredKey,
  };

  await chrome.storage.local.set({ pendingSite: payload });

  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  }
};

// インストール時
chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaultSites();
  registerContextMenu();
});

// ブラウザ起動時
chrome.runtime.onStartup.addListener(() => {
  registerContextMenu();
});

// サービスワーカー起動時に毎回コンテキストメニューを確認・登録
// これによりスリープから復帰した時も確実に動作する
registerContextMenu();

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    try {
      chrome.action.openPopup();
    } catch (error) {
      console.error('ポップアップを開けませんでした:', error);
    }
  }
});

export {};

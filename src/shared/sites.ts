import { Site } from '../types';

export const SITES_STORAGE_KEY = 'sites';

export const DEFAULT_SITES: Site[] = [
  { name: 'Google', url: 'https://google.com', key: 'G' },
];

export interface PendingSitePayload {
  name?: string;
  url?: string;
  preferredKey?: string;
}

const VALID_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

export const sanitizeSite = (site: Site): Site | null => {
  if (!site || typeof site !== 'object') {
    return null;
  }

  const { name, url, key } = site;

  if (!name || typeof name !== 'string') {
    return null;
  }

  if (!url || typeof url !== 'string') {
    return null;
  }

  if (!key || typeof key !== 'string') {
    return null;
  }

  const normalizedKey = key.trim().toUpperCase();
  if (!VALID_KEYS.includes(normalizedKey)) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    return null;
  }

  return {
    name: name.trim(),
    url: normalizeUrl(url),
    key: normalizedKey,
  };
};

export const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

export const loadSites = async (): Promise<Site[]> => {
  try {
    const result = await chrome.storage.local.get([SITES_STORAGE_KEY]);
    const rawSites = result[SITES_STORAGE_KEY] as Site[] | undefined;

    if (!rawSites || !Array.isArray(rawSites)) {
      return [...DEFAULT_SITES];
    }

    const sanitized = rawSites
      .map(sanitizeSite)
      .filter((site): site is Site => site !== null);

    const deduplicated: Site[] = [];
    const seenKeys = new Set<string>();

    for (const site of sanitized) {
      if (seenKeys.has(site.key)) {
        continue;
      }
      seenKeys.add(site.key);
      deduplicated.push(site);
    }

    return deduplicated.length ? deduplicated : [...DEFAULT_SITES];
  } catch (error) {
    console.error('Failed to load sites from storage', error);
    return [...DEFAULT_SITES];
  }
};

export const saveSites = async (sites: Site[]): Promise<void> => {
  await chrome.storage.local.set({ [SITES_STORAGE_KEY]: sites });
};

export const sanitizeSiteList = (sites: Site[] | unknown): Site[] => {
  if (!Array.isArray(sites)) {
    return [];
  }

  const sanitized = sites
    .map(sanitizeSite)
    .filter((site): site is Site => site !== null);

  const deduplicated: Site[] = [];
  const seenKeys = new Set<string>();

  for (const site of sanitized) {
    const upperKey = site.key.toUpperCase();
    if (seenKeys.has(upperKey)) {
      continue;
    }
    seenKeys.add(upperKey);
    deduplicated.push({ ...site, key: upperKey });
  }

  return deduplicated;
};

export const generateKey = (existingSites: Site[], preferred?: string): string | null => {
  const used = new Set(existingSites.map((site) => site.key.toUpperCase()));

  if (preferred) {
    const normalizedPreferred = preferred.trim().toUpperCase();
    if (VALID_KEYS.includes(normalizedPreferred) && !used.has(normalizedPreferred)) {
      return normalizedPreferred;
    }
  }

  for (const candidate of VALID_KEYS) {
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const addSite = async (site: Site, baseSites?: Site[]): Promise<{ success: true; sites: Site[] } | { success: false; message: string }> => {
  const sites = baseSites ? [...baseSites] : await loadSites();
  const existing = sites.find((s) => s.key.toUpperCase() === site.key.toUpperCase());

  if (existing) {
    return { success: false, message: chrome.i18n.getMessage('shortcutKeyAlreadyUsed') };
  }

  const normalizedSite = sanitizeSite(site);
  if (!normalizedSite) {
    return { success: false, message: chrome.i18n.getMessage('invalidSiteInfo') };
  }

  const updated = [...sites, normalizedSite];
  await saveSites(updated);
  return { success: true, sites: updated };
};

export const removeSiteByIndex = async (index: number, baseSites?: Site[]): Promise<Site[]> => {
  const sites = baseSites ? [...baseSites] : await loadSites();
  const updated = sites.filter((_, i) => i !== index);
  await saveSites(updated);
  return updated;
};

export const upsertSite = async (site: Site): Promise<Site[]> => {
  const sites = await loadSites();
  const normalizedSite = sanitizeSite(site);
  if (!normalizedSite) {
    return sites;
  }

  const existingIndex = sites.findIndex((s) => s.key === normalizedSite.key);
  let updated: Site[];

  if (existingIndex >= 0) {
    updated = [...sites];
    updated[existingIndex] = normalizedSite;
  } else {
    updated = [...sites, normalizedSite];
  }

  await saveSites(updated);
  return updated;
};

export const exportSitesAsJson = async (): Promise<string> => {
  const sites = await loadSites();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sites }, null, 2);
};

export const importSitesFromJson = async (json: string): Promise<{ success: true; sites: Site[] } | { success: false; message: string }> => {
  try {
    const parsed = JSON.parse(json);
    const candidate = Array.isArray(parsed?.sites) ? parsed.sites : parsed;
    const sanitized = sanitizeSiteList(candidate);

    if (!sanitized.length) {
      return { success: false, message: chrome.i18n.getMessage('noSitesToImport') };
    }

    await saveSites(sanitized);
    return { success: true, sites: sanitized };
  } catch (error) {
    console.error('Failed to import sites', error);
    return { success: false, message: chrome.i18n.getMessage('jsonParseFailed') };
  }
};

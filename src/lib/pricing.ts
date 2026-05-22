export const DEFAULT_GLOBAL_MARKUP_PCT = 10;
export const GLOBAL_MARKUP_STORAGE_KEY = "tiba_global_markup_pct";

export const getStoredGlobalMarkupPct = (): number => {
  if (typeof window === "undefined") return DEFAULT_GLOBAL_MARKUP_PCT;

  try {
    const raw = window.localStorage.getItem(GLOBAL_MARKUP_STORAGE_KEY);
    if (!raw) return DEFAULT_GLOBAL_MARKUP_PCT;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : DEFAULT_GLOBAL_MARKUP_PCT;
  } catch {
    return DEFAULT_GLOBAL_MARKUP_PCT;
  }
};

export const saveGlobalMarkupPct = (markupPct: number) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(GLOBAL_MARKUP_STORAGE_KEY, String(markupPct));
  window.dispatchEvent(new CustomEvent("global-markup-updated"));
};
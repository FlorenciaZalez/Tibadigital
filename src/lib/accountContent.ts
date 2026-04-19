const EMAIL_REGEX = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
const PASSWORD_LINE_REGEX = /(?:contrasena|contraseña|clave|password)\s*:\s*(.+)$/im;
const CODE_REGEX = /^\s*([A-Za-z0-9-]+)/;
const TIER_REGEX = /\b(PRIMARIA|SECUNDARIA)\b/i;
const PLATFORM_REGEX = /\b(PS4\/PS5|PS5|PS4)\b/i;

const extractPartsFromNotes = (notes: string | null | undefined) => {
  const parts = (notes ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    code: parts[0] ?? "",
    tier: parts.find((part) => TIER_REGEX.test(part)) ?? "",
    platform: parts.find((part) => PLATFORM_REGEX.test(part)) ?? "",
  };
};

export const formatDeliveredAccountContent = ({
  content,
  notes,
  title,
}: {
  content: string | null | undefined;
  notes?: string | null | undefined;
  title?: string | null | undefined;
}) => {
  const rawContent = (content ?? "").trim();
  if (!rawContent) return "";

  const tabParts = rawContent.split("\t").map((part) => part.trim()).filter(Boolean);
  if (tabParts.length >= 6) {
    return tabParts.slice(0, 6).join("\t");
  }

  const noteParts = extractPartsFromNotes(notes);
  const email = rawContent.match(EMAIL_REGEX)?.[1]?.trim() ?? "";
  const passwordFromLabel = rawContent.match(PASSWORD_LINE_REGEX)?.[1]?.trim() ?? "";
  const code = noteParts.code || rawContent.match(CODE_REGEX)?.[1]?.trim() || "";
  const tier = (noteParts.tier || rawContent.match(TIER_REGEX)?.[1] || "").toUpperCase();
  const platform = (noteParts.platform || rawContent.match(PLATFORM_REGEX)?.[1] || "").toUpperCase();

  let password = passwordFromLabel;
  if (!password && email) {
    const afterEmail = rawContent.split(email)[1] ?? "";
    password = afterEmail
      .split(/\s+/)
      .map((part) => part.trim())
      .find((part) => part && !TIER_REGEX.test(part) && !PLATFORM_REGEX.test(part) && !part.includes(":")) ?? "";
  }

  const normalizedTitle = title?.trim() || tabParts[1] || "";
  const normalized = [code, normalizedTitle, email, password, tier, platform].filter(Boolean);

  return normalized.length >= 4 ? normalized.join("\t") : rawContent;
};

/** Parses formatted tab-separated account content into labeled fields for UI display */
export const parseAccountFields = (formatted: string): { label: string; value: string }[] => {
  const parts = formatted.split("\t").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) return [{ label: "Datos", value: formatted }];

  const labels = ["Código", "Juego", "Email", "Contraseña", "Tipo", "Consola"];
  return parts.map((value, i) => ({ label: labels[i] ?? `Campo ${i + 1}`, value }));
};
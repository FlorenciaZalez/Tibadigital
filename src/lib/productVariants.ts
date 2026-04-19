export type AccountTier = "primary" | "secondary";
export type PlatformVariant = "PS4" | "PS5" | "PS4/PS5";

type VariantLike = {
  account_tier?: string | null;
  genre?: string | null;
  platform?: string | null;
  slug?: string | null;
  title?: string | null;
};

const SECONDARY_REGEX = /\b(secundaria|secondary)\b/i;
const PRIMARY_REGEX = /\b(primaria|primary|general)\b/i;
const COMBINED_PLATFORM_REGEX = /(ps4\s*\/\s*ps5|ps5\s*\/\s*ps4|ps4-ps5|ps5-ps4)/i;
const START_VARIANT_PREFIX_REGEX = /^\s*((primaria|secundaria|ps4\s*\/\s*ps5|ps5\s*\/\s*ps4|ps4|ps5)\s*(\||·|-|:)\s*)+/i;

export const inferAccountTier = (value: VariantLike): AccountTier => {
  if (value.account_tier === "secondary") return "secondary";
  if (value.account_tier === "primary" || value.account_tier === "general") return "primary";

  const source = [value.genre, value.slug, value.title].filter(Boolean).join(" ");
  if (SECONDARY_REGEX.test(source)) return "secondary";
  if (PRIMARY_REGEX.test(source)) return "primary";

  return "primary";
};

export const getAccountTierLabel = (tier: string | null | undefined) =>
  tier === "secondary" ? "Secundaria" : "Primaria";

export const inferPlatform = (value: VariantLike): PlatformVariant => {
  const source = [value.genre, value.slug, value.title].filter(Boolean).join(" ");

  if (COMBINED_PLATFORM_REGEX.test(source)) return "PS4/PS5";
  if (value.platform === "PS4/PS5") return "PS4/PS5";
  if (value.platform === "PS4") return "PS4";
  if (value.platform === "PS5") return "PS5";
  if (/\bps4\b/i.test(source)) return "PS4";

  return "PS5";
};

export const getPlatformLabel = (platform: string | null | undefined) =>
  inferPlatform({ platform });

export const stripAccountTierFromGenre = (genre: string | null | undefined) => {
  if (!genre) return "";

  return genre
    .replace(START_VARIANT_PREFIX_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const embedAccountTierInGenre = (genre: string | null | undefined, accountTier: AccountTier) => {
  const cleanGenre = stripAccountTierFromGenre(genre);
  const prefix = getAccountTierLabel(accountTier);
  return cleanGenre ? `${prefix} | ${cleanGenre}` : prefix;
};

export const embedPlatformInGenre = (genre: string | null | undefined, platform: PlatformVariant) => {
  const cleanGenre = stripAccountTierFromGenre(genre);
  return cleanGenre ? `${platform} | ${cleanGenre}` : platform;
};

export const getLegacyCompatiblePlatform = (platform: PlatformVariant) =>
  platform === "PS4/PS5" ? "PS5" : platform;

export const isMissingAccountTierColumnError = (error: { message?: string | null; code?: string | null } | null | undefined) => {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";
  return (
    ((error.code === "42703" || error.code === "PGRST204") && message.includes("account_tier")) ||
    (message.includes("account_tier") && message.includes("does not exist")) ||
    (message.includes("account_tier") && message.includes("schema cache")) ||
    (message.includes("could not find") && message.includes("account_tier"))
  );
};

export const isInvalidCombinedPlatformError = (error: { message?: string | null; code?: string | null } | null | undefined) => {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("invalid input value for enum platform") && message.includes("ps4/ps5");
};
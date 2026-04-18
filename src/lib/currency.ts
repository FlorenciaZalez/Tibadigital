export type CountryCode = "AR" | "UY" | "OTHER";

export interface ExchangeRates {
  arsPerUsd: number;
  uyuPerUsd: number;
}

export const EXCHANGE_RATES_STORAGE_KEY = "tiba_exchange_rates";

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  arsPerUsd: 1100,
  uyuPerUsd: 40,
};

export const COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "AR", label: "🇦🇷 Argentina" },
  { value: "UY", label: "🇺🇾 Uruguay" },
  { value: "VE", label: "🇻🇪 Venezuela" },
  { value: "BO", label: "🇧🇴 Bolivia" },
  { value: "BR", label: "🇧🇷 Brasil" },
  { value: "CL", label: "🇨🇱 Chile" },
  { value: "CO", label: "🇨🇴 Colombia" },
  { value: "EC", label: "🇪🇨 Ecuador" },
  { value: "PY", label: "🇵🇾 Paraguay" },
  { value: "PE", label: "🇵🇪 Perú" },
  { value: "US", label: "🇺🇸 Estados Unidos" },
  { value: "CA", label: "🇨🇦 Canadá" },
  { value: "MX", label: "🇲🇽 México" },
  { value: "CR", label: "🇨🇷 Costa Rica" },
  { value: "CU", label: "🇨🇺 Cuba" },
  { value: "DO", label: "🇩🇴 República Dominicana" },
  { value: "SV", label: "🇸🇻 El Salvador" },
  { value: "GT", label: "🇬🇹 Guatemala" },
  { value: "HN", label: "🇭🇳 Honduras" },
  { value: "NI", label: "🇳🇮 Nicaragua" },
  { value: "PA", label: "🇵🇦 Panamá" },
  { value: "BZ", label: "🇧🇿 Belice" },
  { value: "JM", label: "🇯🇲 Jamaica" },
  { value: "TT", label: "🇹🇹 Trinidad y Tobago" },
  { value: "BS", label: "🇧🇸 Bahamas" },
  { value: "BB", label: "🇧🇧 Barbados" },
  { value: "ES", label: "🇪🇸 España" },
  { value: "PT", label: "🇵🇹 Portugal" },
  { value: "FR", label: "🇫🇷 Francia" },
  { value: "IT", label: "🇮🇹 Italia" },
  { value: "DE", label: "🇩🇪 Alemania" },
  { value: "GB", label: "🇬🇧 Reino Unido" },
  { value: "IE", label: "🇮🇪 Irlanda" },
  { value: "NL", label: "🇳🇱 Países Bajos" },
  { value: "BE", label: "🇧🇪 Bélgica" },
  { value: "LU", label: "🇱🇺 Luxemburgo" },
  { value: "CH", label: "🇨🇭 Suiza" },
  { value: "AT", label: "🇦🇹 Austria" },
  { value: "DK", label: "🇩🇰 Dinamarca" },
  { value: "NO", label: "🇳🇴 Noruega" },
  { value: "SE", label: "🇸🇪 Suecia" },
  { value: "FI", label: "🇫🇮 Finlandia" },
  { value: "IS", label: "🇮🇸 Islandia" },
  { value: "PL", label: "🇵🇱 Polonia" },
  { value: "CZ", label: "🇨🇿 Chequia" },
  { value: "SK", label: "🇸🇰 Eslovaquia" },
  { value: "HU", label: "🇭🇺 Hungría" },
  { value: "RO", label: "🇷🇴 Rumania" },
  { value: "BG", label: "🇧🇬 Bulgaria" },
  { value: "GR", label: "🇬🇷 Grecia" },
  { value: "HR", label: "🇭🇷 Croacia" },
  { value: "SI", label: "🇸🇮 Eslovenia" },
  { value: "RS", label: "🇷🇸 Serbia" },
  { value: "BA", label: "🇧🇦 Bosnia y Herzegovina" },
  { value: "ME", label: "🇲🇪 Montenegro" },
  { value: "AL", label: "🇦🇱 Albania" },
  { value: "MK", label: "🇲🇰 Macedonia del Norte" },
  { value: "UA", label: "🇺🇦 Ucrania" },
  { value: "MD", label: "🇲🇩 Moldavia" },
  { value: "LT", label: "🇱🇹 Lituania" },
  { value: "LV", label: "🇱🇻 Letonia" },
  { value: "EE", label: "🇪🇪 Estonia" },
  { value: "TR", label: "🇹🇷 Turquía" },
  { value: "RU", label: "🇷🇺 Rusia" },
  { value: "CN", label: "🇨🇳 China" },
  { value: "JP", label: "🇯🇵 Japón" },
  { value: "KR", label: "🇰🇷 Corea del Sur" },
  { value: "IN", label: "🇮🇳 India" },
  { value: "PK", label: "🇵🇰 Pakistán" },
  { value: "BD", label: "🇧🇩 Bangladesh" },
  { value: "LK", label: "🇱🇰 Sri Lanka" },
  { value: "NP", label: "🇳🇵 Nepal" },
  { value: "TH", label: "🇹🇭 Tailandia" },
  { value: "VN", label: "🇻🇳 Vietnam" },
  { value: "KH", label: "🇰🇭 Camboya" },
  { value: "LA", label: "🇱🇦 Laos" },
  { value: "MY", label: "🇲🇾 Malasia" },
  { value: "SG", label: "🇸🇬 Singapur" },
  { value: "ID", label: "🇮🇩 Indonesia" },
  { value: "PH", label: "🇵🇭 Filipinas" },
  { value: "MN", label: "🇲🇳 Mongolia" },
  { value: "KZ", label: "🇰🇿 Kazajistán" },
  { value: "UZ", label: "🇺🇿 Uzbekistán" },
  { value: "AE", label: "🇦🇪 Emiratos Árabes Unidos" },
  { value: "SA", label: "🇸🇦 Arabia Saudita" },
  { value: "QA", label: "🇶🇦 Qatar" },
  { value: "KW", label: "🇰🇼 Kuwait" },
  { value: "BH", label: "🇧🇭 Baréin" },
  { value: "OM", label: "🇴🇲 Omán" },
  { value: "IL", label: "🇮🇱 Israel" },
  { value: "JO", label: "🇯🇴 Jordania" },
  { value: "LB", label: "🇱🇧 Líbano" },
  { value: "EG", label: "🇪🇬 Egipto" },
  { value: "MA", label: "🇲🇦 Marruecos" },
  { value: "DZ", label: "🇩🇿 Argelia" },
  { value: "TN", label: "🇹🇳 Túnez" },
  { value: "LY", label: "🇱🇾 Libia" },
  { value: "ZA", label: "🇿🇦 Sudáfrica" },
  { value: "NG", label: "🇳🇬 Nigeria" },
  { value: "GH", label: "🇬🇭 Ghana" },
  { value: "CM", label: "🇨🇲 Camerún" },
  { value: "KE", label: "🇰🇪 Kenia" },
  { value: "ET", label: "🇪🇹 Etiopía" },
  { value: "TZ", label: "🇹🇿 Tanzania" },
  { value: "UG", label: "🇺🇬 Uganda" },
  { value: "AO", label: "🇦🇴 Angola" },
  { value: "MZ", label: "🇲🇿 Mozambique" },
  { value: "ZM", label: "🇿🇲 Zambia" },
  { value: "ZW", label: "🇿🇼 Zimbabue" },
  { value: "BW", label: "🇧🇼 Botsuana" },
  { value: "NA", label: "🇳🇦 Namibia" },
  { value: "MG", label: "🇲🇬 Madagascar" },
  { value: "AU", label: "🇦🇺 Australia" },
  { value: "NZ", label: "🇳🇿 Nueva Zelanda" },
  { value: "PG", label: "🇵🇬 Papúa Nueva Guinea" },
  { value: "FJ", label: "🇫🇯 Fiyi" },
  { value: "WS", label: "🇼🇸 Samoa" },
  { value: "TO", label: "🇹🇴 Tonga" },
  { value: "OTHER", label: "🌍 Otro país / Internacional" },
];

export const normalizeCountry = (value?: string | null): CountryCode => {
  const v = (value ?? "").trim().toLowerCase();

  if (!v) return "AR";
  if (["ar", "argentina"].includes(v)) return "AR";
  if (["uy", "uruguay"].includes(v)) return "UY";

  return "OTHER";
};

export const getStoredExchangeRates = (): ExchangeRates => {
  if (typeof window === "undefined") return DEFAULT_EXCHANGE_RATES;

  try {
    const raw = window.localStorage.getItem(EXCHANGE_RATES_STORAGE_KEY);
    if (!raw) return DEFAULT_EXCHANGE_RATES;

    const parsed = JSON.parse(raw) as Partial<ExchangeRates>;
    return {
      arsPerUsd: Number(parsed.arsPerUsd) || DEFAULT_EXCHANGE_RATES.arsPerUsd,
      uyuPerUsd: Number(parsed.uyuPerUsd) || DEFAULT_EXCHANGE_RATES.uyuPerUsd,
    };
  } catch {
    return DEFAULT_EXCHANGE_RATES;
  }
};

export const saveExchangeRates = (rates: ExchangeRates) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(EXCHANGE_RATES_STORAGE_KEY, JSON.stringify(rates));
  window.dispatchEvent(new CustomEvent("exchange-rates-updated"));
};

export const formatMoney = (
  amount: number,
  currency: "ARS" | "UYU" | "USD",
  decimals?: number,
) => {
  const localeMap = {
    ARS: "es-AR",
    UYU: "es-UY",
    USD: "en-US",
  } as const;

  const fractionDigits = decimals ?? (currency === "USD" ? 2 : 0);

  return new Intl.NumberFormat(localeMap[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
};

export const getPricePresentation = (
  baseArs: number,
  country?: string | null,
  customRates?: ExchangeRates,
) => {
  const rates = customRates ?? getStoredExchangeRates();
  const normalizedCountry = normalizeCountry(country);
  const usd = baseArs / Math.max(rates.arsPerUsd, 1);

  if (normalizedCountry === "UY") {
    return {
      primary: formatMoney(usd * rates.uyuPerUsd, "UYU"),
      secondary: formatMoney(usd, "USD", 2),
    };
  }

  if (normalizedCountry === "OTHER") {
    return {
      primary: formatMoney(usd, "USD", 2),
      secondary: undefined,
    };
  }

  return {
    primary: formatMoney(baseArs, "ARS"),
    secondary: formatMoney(usd, "USD", 2),
  };
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type Env = {
  serviceAccountEmail: string | null;
  privateKey: string | null;
  spreadsheetId: string | null;
  sheetName: string | null;
  codeColumn: string;
  checkboxColumn: string;
};

const getEnv = (): Env => ({
  serviceAccountEmail: Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  privateKey: Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"),
  spreadsheetId: Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID"),
  sheetName: Deno.env.get("GOOGLE_SHEETS_TAB_NAME"),
  codeColumn: Deno.env.get("GOOGLE_SHEETS_CODE_COLUMN") ?? "A",
  checkboxColumn: Deno.env.get("GOOGLE_SHEETS_CHECKBOX_COLUMN") ?? "H",
});

export const isGoogleSheetsSyncConfigured = () => {
  const env = getEnv();
  return Boolean(env.serviceAccountEmail && env.privateKey && env.spreadsheetId && env.sheetName);
};

export const syncGoogleSheetCheckboxes = async (sourceCodes: string[]) => {
  const uniqueCodes = Array.from(new Set(sourceCodes.map((code) => code.trim()).filter(Boolean)));
  if (uniqueCodes.length === 0) return { updatedCodes: [], missingCodes: [] };

  const env = getEnv();
  if (!env.serviceAccountEmail || !env.privateKey || !env.spreadsheetId || !env.sheetName) {
    throw new Error("Google Sheets sync no configurado");
  }

  const accessToken = await getGoogleAccessToken(env.serviceAccountEmail, env.privateKey);
  const values = await getSheetValues({
    accessToken,
    spreadsheetId: env.spreadsheetId,
    sheetName: env.sheetName,
    codeColumn: env.codeColumn,
    checkboxColumn: env.checkboxColumn,
  });

  const rowByCode = new Map<string, number>();
  values.forEach((row, index) => {
    const code = (row[0] ?? "").trim();
    if (code && !rowByCode.has(code)) {
      rowByCode.set(code, index + 2);
    }
  });

  const matchedRows = uniqueCodes
    .map((code) => ({ code, row: rowByCode.get(code) }))
    .filter((entry): entry is { code: string; row: number } => Boolean(entry.row));

  const missingCodes = uniqueCodes.filter((code) => !rowByCode.has(code));

  if (matchedRows.length > 0) {
    await updateCheckboxCells({
      accessToken,
      spreadsheetId: env.spreadsheetId,
      sheetName: env.sheetName,
      checkboxColumn: env.checkboxColumn,
      rows: matchedRows.map((entry) => entry.row),
    });
  }

  return { updatedCodes: matchedRows.map((entry) => entry.code), missingCodes };
};

const getSheetValues = async ({
  accessToken,
  spreadsheetId,
  sheetName,
  codeColumn,
  checkboxColumn,
}: {
  accessToken: string;
  spreadsheetId: string;
  sheetName: string;
  codeColumn: string;
  checkboxColumn: string;
}) => {
  const range = `${sheetName}!${codeColumn}2:${checkboxColumn}`;
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`No pudimos leer Google Sheets: ${await response.text()}`);
  }

  const payload = await response.json();
  return (payload.values ?? []) as string[][];
};

const updateCheckboxCells = async ({
  accessToken,
  spreadsheetId,
  sheetName,
  checkboxColumn,
  rows,
}: {
  accessToken: string;
  spreadsheetId: string;
  sheetName: string;
  checkboxColumn: string;
  rows: number[];
}) => {
  const body = {
    valueInputOption: "USER_ENTERED",
    data: rows.map((row) => ({
      range: `${sheetName}!${checkboxColumn}${row}`,
      values: [[true]],
    })),
  };

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`No pudimos actualizar Google Sheets: ${await response.text()}`);
  }
};

const getGoogleAccessToken = async (serviceAccountEmail: string, privateKey: string) => {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }, privateKey);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`No pudimos autenticar Google Sheets: ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.access_token as string;
};

const signJwt = async (claims: Record<string, string | number>, privateKey: string) => {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const normalizedKey = privateKey.replace(/\\n/g, "\n");
  const importedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(normalizedKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    importedKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
};

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const base64UrlEncode = (value: string | ArrayBuffer) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
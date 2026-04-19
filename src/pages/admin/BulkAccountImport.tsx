import { ChangeEvent, useMemo, useState } from "react";
import Papa from "papaparse";
import { Link } from "react-router-dom";
import { ChevronLeft, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getAccountTierLabel, inferAccountTier, inferPlatform, type AccountTier, type PlatformVariant } from "@/lib/productVariants";
import { addSourceCodeToNotes } from "@/lib/sourceMetadata";
import { toast } from "sonner";

type CsvRow = Record<string, string | undefined>;
type CsvMatrixRow = string[];

interface ProductMatch {
  account_tier: AccountTier;
  id: string;
  slug: string;
  title: string;
  platform: PlatformVariant;
  genre: string | null;
  stock: number;
}

interface PreviewRow {
  index: number;
  sourceCode: string;
  product_slug: string;
  product_title: string;
  platform: PlatformVariant | "";
  accountTier: "primary" | "secondary" | "";
  key_type: "account" | "code";
  content: string;
  notes: string;
  matchedProduct: ProductMatch | null;
  error: string | null;
}

const normalize = (value: string) => value.trim().toLowerCase();
const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeTitle = (value: string) =>
  normalizeHeader(value)
    .replace(/\b(ps4|ps5|primaria|secundaria)\b/g, " ")
    .replace(/_+/g, " ")
    .trim();

const POSITIONAL_COLUMNS = [
  "codigo",
  "juego",
  "usuario",
  "correo",
  "contrasena",
  "p_s",
  "consola",
  "estado",
  "marca",
  "notes",
];

const KNOWN_HEADERS = new Set([
  "codigo",
  "product_slug",
  "slug",
  "product_title",
  "titulo",
  "title",
  "juego",
  "producto",
  "nombre",
  "usuario",
  "user",
  "username",
  "correo",
  "email",
  "mail",
  "contrasena",
  "clave",
  "password",
  "pass",
  "p_s",
  "ps",
  "categoria",
  "tipo_cuenta",
  "consola",
  "platform",
  "plataforma",
  "estado",
  "status",
  "notes",
  "nota",
  "notas",
  "observaciones",
  "comentarios",
]);

const rowLooksLikeHeader = (row: CsvMatrixRow) => {
  const normalizedCells = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
  const headerMatches = normalizedCells.filter((cell) => KNOWN_HEADERS.has(cell)).length;
  return headerMatches >= 2;
};

const mapMatrixRowToObject = (row: CsvMatrixRow) => {
  const mappedRow: CsvRow = {};

  row.forEach((value, index) => {
    const key = POSITIONAL_COLUMNS[index] ?? `extra_${index}`;
    mappedRow[key] = value?.trim() ?? "";
  });

  return mappedRow;
};

const parseCsvRows = (csvText: string) => {
  const matrixParse = Papa.parse<CsvMatrixRow>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  if (matrixParse.errors.length > 0) {
    return { rows: [] as CsvRow[], error: matrixParse.errors[0].message };
  }

  const matrixRows = matrixParse.data.filter((row) => row.some((cell) => (cell ?? "").trim() !== ""));
  if (matrixRows.length === 0) {
    return { rows: [] as CsvRow[], error: null };
  }

  if (rowLooksLikeHeader(matrixRows[0])) {
    const headerParse = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    });

    if (headerParse.errors.length > 0) {
      return { rows: [] as CsvRow[], error: headerParse.errors[0].message };
    }

    return { rows: headerParse.data, error: null };
  }

  return { rows: matrixRows.map(mapMatrixRowToObject), error: null };
};

const getFirstValue = (row: CsvRow, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[alias]?.trim();
    if (value) return value;
  }

  return "";
};

const humanizeField = (key: string) => {
  const labels: Record<string, string> = {
    codigo: "Codigo",
    usuario: "Usuario",
    user: "Usuario",
    username: "Usuario",
    correo: "Correo",
    email: "Correo",
    mail: "Correo",
    cuenta: "Cuenta",
    cuenta_numero: "Numero de cuenta",
    numero_de_cuenta: "Numero de cuenta",
    contrasena: "Contrasena",
    clave: "Clave",
    password: "Contrasena",
    pass: "Contrasena",
  };

  if (labels[key]) return labels[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const parsePlatform = (value: string) => {
  const current = normalize(value);
  if (!current) return "";
  if ((current.includes("ps4") && current.includes("ps5")) || current.includes("ps4/ps5")) return "PS4/PS5" as const;
  if (current.includes("ps5")) return "PS5" as const;
  if (current.includes("ps4")) return "PS4" as const;
  return "";
};

const parseAccountTier = (value: string) => {
  const current = normalize(value);
  if (!current) return "";
  if (current.includes("prim")) return "primary" as const;
  if (current.includes("sec")) return "secondary" as const;
  return "";
};

const isAvailableStatus = (value: string) => {
  const current = normalize(value);
  if (!current) return true;
  return ["disponible", "available", "stock", "ok"].includes(current);
};

const buildDuplicateKey = (productId: string, content: string) =>
  `${productId}::${content.trim().toLowerCase()}`;

const buildAccountContent = (row: CsvRow) => {
  const explicitContent = getFirstValue(row, ["content", "contenido"]);
  if (explicitContent) return explicitContent;

  const ignoredFields = new Set([
    "product_slug",
    "slug",
    "product_title",
    "titulo",
    "title",
    "juego",
    "producto",
    "nombre",
    "key_type",
    "notes",
    "nota",
    "notas",
    "observaciones",
    "comentarios",
    "codigo",
    "consola",
    "platform",
    "plataforma",
    "p_s",
    "ps",
    "categoria",
    "tipo_cuenta",
    "estado",
    "status",
    "marca",
    "fecha_compra",
    "costo",
  ]);

  const lines = Object.entries(row)
    .map(([key, value]) => [key, value?.trim() ?? ""] as const)
    .filter(([key, value]) => value && !ignoredFields.has(key))
    .map(([key, value]) => `${humanizeField(key)}: ${value}`);

  return lines.join("\n");
};

const buildNotes = (row: CsvRow, platform: PlatformVariant | "", accountTier: "primary" | "secondary" | "") => {
  const explicitNotes = getFirstValue(row, ["notes", "nota", "notas", "observaciones", "comentarios"]);
  if (explicitNotes) return explicitNotes;

  const parts = [
    getFirstValue(row, ["codigo"]),
    accountTier ? getAccountTierLabel(accountTier) : "",
    platform,
  ].filter(Boolean);

  return parts.join(" | ");
};

const matchProduct = ({
  products,
  productSlug,
  productTitle,
  platform,
  accountTier,
}: {
  products: ProductMatch[];
  productSlug: string;
  productTitle: string;
  platform: PlatformVariant | "";
  accountTier: "primary" | "secondary" | "";
}) => {
  const slugMatch = productSlug ? products.filter((product) => normalize(product.slug) === normalize(productSlug)) : [];
  const titleMatch = productTitle
    ? products.filter((product) => normalizeTitle(product.title) === normalizeTitle(productTitle))
    : [];

  const baseCandidates = slugMatch.length > 0 ? slugMatch : titleMatch;
  if (baseCandidates.length === 0) {
    return { matchedProduct: null, error: "No encontramos el juego en productos" };
  }

  const platformCandidates = platform
    ? baseCandidates.filter((product) => {
        const productPlatform = inferPlatform(product);
        return productPlatform === platform || (platform !== "PS4/PS5" && productPlatform === "PS4/PS5");
      })
    : baseCandidates;

  if (platform && platformCandidates.length === 0) {
    return { matchedProduct: null, error: `No existe ${productTitle || productSlug} para ${platform}` };
  }

  const tierCandidates = accountTier
    ? platformCandidates.filter((product) => product.account_tier === accountTier)
    : platformCandidates;

  if (accountTier && tierCandidates.length === 0) {
    return {
      matchedProduct: null,
      error: `No existe ${productTitle || productSlug} ${accountTier === "primary" ? "primaria" : "secundaria"} en ${platform || "la consola indicada"}`,
    };
  }

  if (tierCandidates.length > 1) {
    return { matchedProduct: null, error: "Hay varios productos coincidentes; ajusta titulo, consola o P/s" };
  }

  if (tierCandidates.length === 1) {
    return { matchedProduct: tierCandidates[0], error: null };
  }

  if (platformCandidates.length > 1) {
    return { matchedProduct: null, error: "Falta P/s para diferenciar el producto" };
  }

  if (platformCandidates.length === 1) {
    return { matchedProduct: platformCandidates[0], error: null };
  }

  return { matchedProduct: null, error: "No encontramos un producto unico para esa fila" };
};

const BulkAccountImport = () => {
  const [csvText, setCsvText] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(() => previewRows.filter((row) => !row.error && row.matchedProduct), [previewRows]);
  const invalidRows = useMemo(() => previewRows.filter((row) => row.error || !row.matchedProduct), [previewRows]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    event.target.value = "";
  };

  const buildPreview = async () => {
    if (!csvText.trim()) {
      toast.error("Pegá el CSV o subí un archivo primero");
      return;
    }

    setLoadingPreview(true);
    const { rows, error: parseError } = parseCsvRows(csvText);

    if (parseError) {
      toast.error(`CSV inválido: ${parseError}`);
      setLoadingPreview(false);
      return;
    }

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, slug, title, platform, genre, stock");

    if (productError || !products) {
      toast.error("No pudimos cargar el catálogo para validar el CSV");
      setLoadingPreview(false);
      return;
    }

    const nextPreview = rows.map((rawRow, index) => {
      const productSlug = getFirstValue(rawRow, ["product_slug", "slug"]);
      const productTitle = getFirstValue(rawRow, ["product_title", "titulo", "title", "juego", "producto", "nombre"]);
      const accountTier = parseAccountTier(getFirstValue(rawRow, ["p_s", "ps", "categoria", "tipo_cuenta"]));
      const platform = parsePlatform(getFirstValue(rawRow, ["consola", "platform", "plataforma"])) || (accountTier === "secondary" ? "PS4/PS5" : "");
      const keyType = getFirstValue(rawRow, ["key_type"]).toLowerCase() === "code" ? "code" : "account";
      const content = buildAccountContent(rawRow);
      const notes = buildNotes(rawRow, platform, accountTier);
      const sourceCode = getFirstValue(rawRow, ["codigo"]);
      const status = getFirstValue(rawRow, ["estado", "status"]);

      const { matchedProduct, error: matchError } = matchProduct({
        products: (products ?? []).map((product) => ({
          ...product,
          account_tier: inferAccountTier(product),
          platform: inferPlatform(product),
        })) as ProductMatch[],
        productSlug,
        productTitle,
        platform,
        accountTier,
      });

      let error: string | null = null;
      if (!productSlug && !productTitle) error = "Falta un identificador del juego";
      else if (!platform) error = "Falta consola (PS4 o PS5)";
      else if (!accountTier) error = "Falta P/s (Primaria o Secundaria)";
      else if (!isAvailableStatus(status)) error = `Estado no importable: ${status}`;
      else if (!content) error = "Falta content";
      else if (matchError) error = matchError;

      return {
        index: index + 1,
        sourceCode,
        product_slug: productSlug,
        product_title: productTitle,
        platform,
        accountTier,
        key_type: keyType,
        content,
        notes,
        matchedProduct,
        error,
      } satisfies PreviewRow;
    });

    const matchedProductIds = Array.from(
      new Set(nextPreview.flatMap((row) => (row.matchedProduct ? [row.matchedProduct.id] : [])))
    );

    let existingDuplicateKeys = new Set<string>();
    if (matchedProductIds.length > 0) {
      const { data: existingKeys, error: existingKeysError } = await supabase
        .from("product_keys")
        .select("product_id, content")
        .in("product_id", matchedProductIds);

      if (existingKeysError) {
        toast.error("No pudimos validar duplicados contra el stock actual");
        setLoadingPreview(false);
        return;
      }

      existingDuplicateKeys = new Set(
        (existingKeys ?? []).map((keyRow) => buildDuplicateKey(keyRow.product_id, keyRow.content))
      );
    }

    const csvDuplicateKeys = new Set<string>();
    const dedupedPreview = nextPreview.map((row) => {
      if (row.error || !row.matchedProduct) return row;

      const duplicateKey = buildDuplicateKey(row.matchedProduct.id, row.content);
      if (existingDuplicateKeys.has(duplicateKey)) {
        return { ...row, error: "La cuenta ya existe en el stock" };
      }

      if (csvDuplicateKeys.has(duplicateKey)) {
        return { ...row, error: "La cuenta está repetida dentro del CSV" };
      }

      csvDuplicateKeys.add(duplicateKey);
      return row;
    });

    setPreviewRows(dedupedPreview);
    setLoadingPreview(false);
    toast.success(`Preview lista: ${dedupedPreview.length} fila(s)`);
  };

  const syncProductStock = async (productIds: string[]) => {
    const uniqueProductIds = Array.from(new Set(productIds));
    if (uniqueProductIds.length === 0) return;

    const { data: keyRows, error: keyError } = await supabase
      .from("product_keys")
      .select("product_id")
      .in("product_id", uniqueProductIds)
      .eq("status", "available");

    if (keyError) throw keyError;

    const counts = new Map<string, number>();
    uniqueProductIds.forEach((productId) => counts.set(productId, 0));
    keyRows?.forEach((row) => counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1));

    const updates = uniqueProductIds.map((productId) =>
      supabase.from("products").update({ stock: counts.get(productId) ?? 0 }).eq("id", productId)
    );

    const results = await Promise.all(updates);
    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate?.error) throw failedUpdate.error;
  };

  const importRows = async () => {
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }

    setImporting(true);

    const payload = validRows.map((row) => ({
      product_id: row.matchedProduct!.id,
      key_type: row.key_type,
      content: row.content,
      notes: row.notes || null,
      source_code: row.sourceCode || null,
    }));

    let { error } = await supabase.from("product_keys").insert(payload);

    if (error?.message?.toLowerCase().includes("source_code") && error.message.toLowerCase().includes("does not exist")) {
      const legacyPayload = payload.map((row) => ({
        product_id: row.product_id,
        key_type: row.key_type,
        content: row.content,
        notes: addSourceCodeToNotes(row.notes, row.source_code),
      }));
      ({ error } = await supabase.from("product_keys").insert(legacyPayload));
    }

    setImporting(false);
    if (error) {
      toast.error(`Error al importar: ${error.message}`);
      return;
    }

    try {
      await syncProductStock(payload.map((row) => row.product_id));
    } catch (stockError: any) {
      toast.error(`Importamos, pero no pudimos actualizar el stock visible: ${stockError.message}`);
      return;
    }

    toast.success(`Importadas ${payload.length} cuenta(s)`);
    setPreviewRows([]);
    setCsvText("");
  };

  return (
    <div className="container py-10 max-w-6xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link to="/admin"><ChevronLeft />Admin</Link>
      </Button>

      <div>
        <h1 className="font-display font-black text-3xl md:text-4xl">
          IMPORTAR <span className="text-gradient-neon">CUENTAS</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Subí un CSV exportado desde Google Sheets. La fila se vincula por <b>juego</b> + <b>consola</b> + <b>P/s</b>, y se importa solo si el <b>estado</b> está disponible.
        </p>
      </div>

      <div className="card-cyber rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-display font-bold uppercase tracking-wider">
            <FileSpreadsheet className="h-4 w-4 text-secondary" />CSV de origen
          </div>

          <Textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={14}
            className="bg-input font-mono text-xs"
            placeholder={"codigo,juego,usuario,contrasena,p/s,consola,estado\nKS023,Sonic Colours: Ultimate,su0jyhpm@duck.com,Pelon3523,SECUNDARIA,PS5,DISPONIBLE"}
          />

          <div className="flex gap-3 flex-wrap">
            <label>
              <input type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
              <Button asChild variant="outline">
                <span><Upload className="h-4 w-4" />Subir CSV</span>
              </Button>
            </label>
            <Button onClick={buildPreview} variant="hero" disabled={loadingPreview}>
              {loadingPreview ? "Validando..." : "Generar preview"}
            </Button>
          </div>
      </div>

      <div className="card-cyber rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display font-bold uppercase tracking-wider">Preview</div>
            <div className="text-sm text-muted-foreground">{validRows.length} válidas · {invalidRows.length} con error</div>
          </div>
          <Button onClick={importRows} variant="hero" disabled={importing || validRows.length === 0}>
            {importing ? "Importando..." : `Importar ${validRows.length} fila(s)`}
          </Button>
        </div>

        {previewRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Todavía no generaste preview.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Fila</th>
                  <th className="text-left p-3">Codigo</th>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-left p-3">Match</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.index} className="border-t border-border align-top">
                    <td className="p-3">{row.index}</td>
                    <td className="p-3 text-xs text-muted-foreground">{row.sourceCode || "—"}</td>
                    <td className="p-3">
                      <div className="font-medium">{row.product_slug || row.product_title || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.platform || "Sin consola"} · {row.accountTier ? getAccountTierLabel(row.accountTier) : "Sin P/s"}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{row.content}</div>
                    </td>
                    <td className="p-3 text-xs">
                      {row.matchedProduct ? (
                        <>
                          <div>{row.matchedProduct.title}</div>
                          <div className="text-muted-foreground">{row.matchedProduct.slug} · {row.matchedProduct.platform} · {getAccountTierLabel(row.matchedProduct.account_tier)}</div>
                        </>
                      ) : "—"}
                    </td>
                    <td className="p-3 uppercase font-display text-xs">{row.key_type}</td>
                    <td className="p-3 text-xs">
                      {row.error ? (
                        <span className="text-destructive">{row.error}</span>
                      ) : (
                        <span className="text-success">Lista para importar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkAccountImport;
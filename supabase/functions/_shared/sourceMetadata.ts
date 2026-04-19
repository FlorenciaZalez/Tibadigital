const SOURCE_CODE_MARKER_REGEX = /\s*\[\[SRC:([^\]]+)\]\]\s*$/i;
const SOURCE_CODE_VISIBLE_NOTES_REGEX = /^\s*([A-Za-z0-9-]+)\s*(?:\||$)/;
const SOURCE_CODE_CONTENT_REGEX = /^\s*([A-Za-z0-9-]+)\t/;

export const extractSourceCodeFromNotes = (notes: string | null | undefined) => {
  const match = notes?.match(SOURCE_CODE_MARKER_REGEX);
  if (match?.[1]?.trim()) return match[1].trim();

  const visibleMatch = notes?.match(SOURCE_CODE_VISIBLE_NOTES_REGEX);
  return visibleMatch?.[1]?.trim() ?? null;
};

export const extractSourceCodeFromContent = (content: string | null | undefined) => {
  const match = content?.match(SOURCE_CODE_CONTENT_REGEX);
  return match?.[1]?.trim() ?? null;
};

export const stripSourceMetadata = (notes: string | null | undefined) => {
  if (!notes) return "";
  return notes.replace(SOURCE_CODE_MARKER_REGEX, "").trim();
};
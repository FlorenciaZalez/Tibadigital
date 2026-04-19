const SOURCE_CODE_MARKER_REGEX = /\s*\[\[SRC:([^\]]+)\]\]\s*$/i;

export const extractSourceCodeFromNotes = (notes: string | null | undefined) => {
  const match = notes?.match(SOURCE_CODE_MARKER_REGEX);
  return match?.[1]?.trim() ?? null;
};

export const stripSourceMetadata = (notes: string | null | undefined) => {
  if (!notes) return "";
  return notes.replace(SOURCE_CODE_MARKER_REGEX, "").trim();
};
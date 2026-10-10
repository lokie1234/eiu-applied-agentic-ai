/** Original source routing. These IDs identify destinations, not credentials. */
export const SECTION_SOURCE_DESTINATIONS = {
  tsx: "1J0Kudr8xTczKjujXDZ3ek7Aq2pvEz1Ir",
  pdf: "1EgGdT63Och3qucdtY7yTwzZlOfxWiNPM",
  pptx: "1M6MLl542jzThnN0SpNPHAUAeZa0Ejcvv",
} as const;

export type SectionSourceType = keyof typeof SECTION_SOURCE_DESTINATIONS;

export function sectionSourceType(filename: string): SectionSourceType {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension !== "tsx" && extension !== "pdf" && extension !== "pptx") {
    throw new Error("Only PDF, PPTX and TSX source files are supported.");
  }
  return extension;
}

function label(value: string, fallback: string, limit = 70) {
  // Preserve Vietnamese accents and remove path/control characters from labels.
  const normalized = value.normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ").trim();
  return Array.from(normalized || fallback).slice(0, limit).join("");
}

export function describeSectionSource(input: {
  folderName: string;
  courseTitle: string;
  sectionTitle: string;
  originalFilename: string;
  sourceId: string;
  uploadedAt: Date;
}) {
  const type = sectionSourceType(input.originalFilename);
  if (!Number.isFinite(input.uploadedAt.getTime())) throw new Error("Invalid upload time.");
  // Retry identity is stored in Drive appProperties, separate from the readable filename.
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.sourceId)) throw new Error("Invalid source ID.");
  const name = [
    label(input.folderName, "Unassigned folder"),
    label(input.courseTitle, "Untitled course"),
    label(input.sectionTitle, "Untitled section"),
  ].join(" — ") + `.${type}`;
  return { type, driveFolderId: SECTION_SOURCE_DESTINATIONS[type] as string, name };
}

export function driveDocumentName(value: string, defaultName: string, type: SectionSourceType | "js") {
  const stem = value.trim() ? value.trim().replace(/\.(pdf|pptx|tsx|js)$/i, "") : defaultName.replace(/\.(pdf|pptx|tsx|js)$/i, "");
  return label(stem, "Document", 150) + `.${type}`;
}

export function driveSectionName(position: number, title: string, type: SectionSourceType | "js") {
  if (!Number.isInteger(position) || position < 1) throw new Error("Invalid section position.");
  return driveDocumentName("", `Section ${position} — ${title}`, type);
}

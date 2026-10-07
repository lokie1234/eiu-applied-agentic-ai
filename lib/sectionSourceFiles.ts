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

function label(value: string, fallback: string) {
  // Preserve Vietnamese accents and remove path/control characters from labels.
  const normalized = value.normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ").trim();
  return Array.from(normalized || fallback).slice(0, 70).join("");
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
  // A source UUID is allocated before upload and reused for retries. Distinct
  // sources must not overwrite each other when filenames/timestamps match.
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.sourceId)) throw new Error("Invalid source ID.");
  const timestamp = input.uploadedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const originalStem = input.originalFilename.replace(/\.[^.]+$/, "");
  const name = [
    label(input.folderName, "Unassigned folder"),
    label(input.courseTitle, "Untitled course"),
    label(input.sectionTitle, "Untitled section"),
    label(originalStem, "Source"),
    `${timestamp}-${input.sourceId}`,
  ].join(" — ") + `.${type}`;
  return { type, driveFolderId: SECTION_SOURCE_DESTINATIONS[type], name };
}

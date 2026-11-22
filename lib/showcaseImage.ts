import "server-only";
import sharp from "sharp";

export const SHOWCASE_IMAGE_BUCKET = "learner-showcase-images";
export const SHOWCASE_UPLOAD_LIMIT = 4 * 1024 * 1024;
export const SHOWCASE_IMAGE_LIMIT = 1024 * 1024;

export class ShowcaseInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readShowcaseBytes(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max) throw new ShowcaseInputError("The submission is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ShowcaseInputError("The upload is empty.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > max) { await reader.cancel(); throw new ShowcaseInputError("The submission is too large.", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function readShowcaseForm(request: Request) {
  const bytes = await readShowcaseBytes(request, SHOWCASE_UPLOAD_LIMIT + 64 * 1024);
  try {
    return await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") || "" }, body: bytes }).formData();
  } catch { throw new ShowcaseInputError("The upload is incomplete. Choose the image again."); }
}

export async function prepareShowcaseImage(file: File) {
  if (!file.size || file.size > SHOWCASE_UPLOAD_LIMIT) throw new ShowcaseInputError("Choose an image smaller than 4 MB.", 413);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new ShowcaseInputError("Use a PNG, JPG or WebP image.");
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const input = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
    const info = await input.metadata();
    if (!["png", "jpeg", "webp"].includes(info.format || "") || !info.width || !info.height || info.width > 10000 || info.height > 10000 || (info.pages || 1) !== 1) {
      throw new ShowcaseInputError("Use a single PNG, JPG or WebP image, up to 16 megapixels.");
    }
    // Decode and re-encode: strip metadata and never serve the uploaded bytes.
    const image = await input.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 3 }).toBuffer();
    if (image.byteLength > SHOWCASE_IMAGE_LIMIT) throw new ShowcaseInputError("This image is too detailed. Crop it or choose a smaller image.", 413);
    return image;
  } catch (error) {
    if (error instanceof ShowcaseInputError) throw error;
    throw new ShowcaseInputError("This image could not be read. Choose a valid PNG, JPG or WebP image.");
  }
}

export function showcaseImagePath(courseId: string, sectionId: string, imageId: string) {
  if (![courseId, sectionId, imageId].every(value => /^[a-f0-9-]{36}$/i.test(value))) throw new ShowcaseInputError("Invalid image scope.");
  return `${courseId}/${sectionId}/${imageId}.webp`;
}

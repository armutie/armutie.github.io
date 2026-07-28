import imageCompression from "browser-image-compression";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export class ImageValidationError extends Error {}

export function validateImage(file: File) {
  const supported =
    SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number]) ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

  if (!supported) {
    throw new ImageValidationError("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("This photo is larger than 20 MB. Choose a smaller image.");
  }
}

export async function prepareImage(file: File) {
  validateImage(file);
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 2.5,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.86,
      preserveExif: false,
    });
    return new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
      throw new ImageValidationError(
        "This browser could not read the HEIC photo. Export it as JPEG or use your camera in most-compatible mode.",
      );
    }
    throw new ImageValidationError("The photo could not be prepared. Try another image.");
  }
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

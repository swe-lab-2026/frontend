/** Mirrors the server's limits, so a bad file is refused before it is sent. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageProblem(file: Pick<File, "type" | "size">): "UNSUPPORTED_IMAGE" | "UPLOAD_TOO_LARGE" | "EMPTY_UPLOAD" | null {
  if (!IMAGE_TYPES.includes(file.type)) return "UNSUPPORTED_IMAGE";
  if (file.size === 0) return "EMPTY_UPLOAD";
  return file.size > MAX_IMAGE_BYTES ? "UPLOAD_TOO_LARGE" : null;
}

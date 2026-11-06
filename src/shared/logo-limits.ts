// How large an institute logo may be. The server enforces the same limit
// (papers/src/lib/instituteLogo.ts MAX_LOGO_BYTES); the app checks first so a
// teacher hears about a too-large image before waiting for an upload.

/** The server's limit on a logo, in bytes. */
export const MAX_LOGO_BYTES = 600 * 1024;
export const MAX_LOGO_KB = Math.round(MAX_LOGO_BYTES / 1024);

/** The size in bytes of an image given as base64 (without a data: prefix). */
export const base64Bytes = (base64: string) => Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);

/** The type an image's base64 really is, from how its bytes begin: PNG or JPEG; null for anything else. */
export function logoContentType(base64: string): 'image/png' | 'image/jpeg' | null {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  return null;
}

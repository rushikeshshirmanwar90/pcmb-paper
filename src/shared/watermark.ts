// The watermark a teacher can print across every page of an exam paper (never
// on a Smart PDF). The server keeps a copy of the cleaning rule in
// papers/src/lib/questionPaper/watermark.ts; change both together.

/** Longest watermark, in characters. */
export const MAX_WATERMARK = 40;

/** One line of at most MAX_WATERMARK characters: whitespace and control characters become single spaces. */
export function cleanWatermark(value: string): string {
  const oneLine = value.replace(/[\p{Cc}\s]+/gu, ' ').trim();
  return Array.from(oneLine).slice(0, MAX_WATERMARK).join('');
}

/** Where a signed-in account's watermark is kept on this phone. */
export const watermarkPrefsKey = (userId: string) => `pdfWatermark.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

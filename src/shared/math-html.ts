import katex from 'katex';
import { splitLatex } from '@/shared/latex';

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Question text as HTML: the text escaped with its line breaks kept, and the
 * maths (\( \) and \[ \]) as MathML. iOS and Android web views and their
 * print engines draw MathML themselves, so nothing (no KaTeX script,
 * stylesheet or fonts) has to download before the maths shows.
 */
export function mathTextToHtml(text: string | undefined): string {
  const key = text ?? '';
  const known = converted.get(key);
  if (known !== undefined) return known;

  const html = splitLatex(key)
    .map((piece) => {
      if (piece.kind === 'text') return escapeHtml(piece.value).replace(/\n/g, '<br>');
      try {
        return katex.renderToString(piece.value, {
          displayMode: piece.display,
          output: 'mathml',
          throwOnError: false,
          strict: 'ignore',
        });
      } catch {
        return escapeHtml(piece.value);
      }
    })
    .join('');

  if (converted.size >= REMEMBERED) converted.delete(converted.keys().next().value!);
  converted.set(key, html);
  return html;
}

// KaTeX is slow on a phone, and the same texts come round again: a card's
// question and options are converted for the screen, then again for the PDF.
// Remember recent results, dropping the oldest past the limit.
const REMEMBERED = 1500;
const converted = new Map<string, string>();

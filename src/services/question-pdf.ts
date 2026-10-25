import { Platform } from 'react-native';
import * as Print from 'expo-print';
import katex from 'katex';
import { hasLatex, splitLatex } from '@/shared/latex';
import { parseMathNodes, type MathNode, type AccentType } from '@/shared/mathText';
import { parseExplanation } from '@/shared/explanation';
import { addPdf, loadPdfQuestions, type PdfContent, type SavedPdf } from '@/services/pdf-library';
import type { Question } from '@/types/pcmb';

/**
 * What goes in the PDF:
 * - questions: a paper to hand out
 * - answers:   the paper, then an answer key on its own page
 * - solutions: each question followed by its answer and worked solution
 */
export type { PdfContent };

export interface QuestionPdfOptions {
  /** Printed at the top of the paper. */
  title: string;
  /** Name in My PDFs and of the file; defaults to the title. */
  fileName?: string;
  /** Short line under the title, e.g. "11th · Physics". */
  subtitle?: string;
  questions: Question[];
  content: PdfContent;
  /** Marks per question; leave out to hide marks. */
  marksPerQuestion?: number;
  /** Kept with the PDF in My PDFs, for its details and filters. */
  standard?: string;
  subject?: string;
}

// A4 in points (72 per inch).
const PAGE = { width: 595, height: 842 };
const MARGIN = 36;

// ─── Text → HTML ────────────────────────────────────────────────────────────

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

const ACCENT_GLYPH: Record<AccentType, string> = {
  vector: '→',
  hat: '^',
  tilde: '~',
  acute: '´',
  grave: '`',
};

/** Plain-text math markers from PDF extraction (fractions, roots, superscripts). */
function mathNodesToHtml(nodes: MathNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === 'frac') {
        return `<span class="frac"><span>${mathNodesToHtml(node.num)}</span><span class="den">${mathNodesToHtml(node.den)}</span></span>`;
      }
      if (node.kind === 'root') {
        return `√<span class="radicand">${mathNodesToHtml(node.radicand)}</span>`;
      }
      return node.segments
        .map((seg) => {
          if (seg.accent) return `${escapeHtml(seg.text)}<sup>${ACCENT_GLYPH[seg.accent]}</sup>`;
          if (seg.sup) return `<sup>${escapeHtml(seg.text)}</sup>`;
          return escapeHtml(seg.text);
        })
        .join('');
    })
    .join('');
}

/**
 * Question text as HTML. LaTeX becomes MathML, which the print engine draws
 * itself, so the PDF needs no web fonts or stylesheets to load first.
 */
function textToHtml(raw: string | undefined | null): string {
  const text = (raw || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return '';
  if (!hasLatex(text)) return mathNodesToHtml(parseMathNodes(text));

  return splitLatex(text)
    .map((piece) => {
      if (piece.kind === 'text') return escapeHtml(piece.value);
      try {
        return katex.renderToString(piece.value, {
          displayMode: piece.display,
          throwOnError: false,
          strict: 'ignore',
          output: 'mathml',
        });
      } catch {
        return escapeHtml(piece.value);
      }
    })
    .join('');
}

function solutionToHtml(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (hasLatex(text)) return `<p>${textToHtml(text)}</p>`;
  return parseExplanation(text)
    .blocks.map((block) => {
      const body = textToHtml(block.chunks.map((chunk) => chunk.value).join(' '));
      return block.kind === 'step'
        ? `<p class="step"><span class="step-label">${escapeHtml(block.label)}</span>${body}</p>`
        : `<p>${body}</p>`;
    })
    .join('');
}

function imagesHtml(urls: string[] | undefined, images: Map<string, string>, className = 'figure') {
  if (!urls?.length) return '';
  return urls
    .map((url) => `<img class="${className}" src="${escapeHtml(images.get(url) ?? url)}" alt=""/>`)
    .join('');
}

// ─── Figures: embedded so the PDF never prints before they download ─────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function embedImages(questions: Question[]): Promise<Map<string, string>> {
  const urls = new Set<string>();
  for (const q of questions) {
    q.diagramUrls?.forEach((u) => urls.add(u));
    q.explanationDiagramUrls?.forEach((u) => urls.add(u));
    Object.values(q.optionDiagramUrls ?? {}).forEach((list) => list?.forEach((u) => urls.add(u)));
  }

  const embedded = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) embedded.set(url, await blobToDataUrl(await res.blob()));
      } catch {
        // Keep the link instead; the print engine may still fetch it.
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return embedded;
}

// ─── Page ──────────────────────────────────────────────────────────────────

function questionHtml(q: Question, index: number, opts: QuestionPdfOptions, images: Map<string, string>) {
  const isNumerical = q.answerType === 'Numerical';
  const options = (['A', 'B', 'C', 'D'] as const).map((key) => {
    const text = q[`option${key}`];
    const optionImages = imagesHtml(q.optionDiagramUrls?.[key], images, 'figure small');
    return `<div class="option"><span class="opt-key">(${key})</span><span>${textToHtml(text)}${optionImages}</span></div>`;
  });

  const marks = opts.marksPerQuestion ? `<span class="marks">[${opts.marksPerQuestion}]</span>` : '';
  const answerBlock = isNumerical
    ? opts.content === 'solutions'
      ? ''
      : '<div class="numeric-answer">Answer: ______________________</div>'
    : `<div class="options">${options.join('')}</div>`;

  let solution = '';
  if (opts.content === 'solutions') {
    const answer = q.correctAnswer
      ? `<div class="answer">Answer: ${isNumerical ? textToHtml(q.correctAnswer) : `(${escapeHtml(q.correctAnswer)})`}</div>`
      : '';
    const explanation = q.explanation ? `<div class="solution-body">${solutionToHtml(q.explanation)}</div>` : '';
    const figures = imagesHtml(q.explanationDiagramUrls, images);
    if (answer || explanation) solution = `<div class="solution">${answer}${explanation}${figures}</div>`;
  }

  return `
    <section class="question">
      <div class="q-head">
        <span class="q-num">Q${index + 1}.</span>
        <div class="q-text">${textToHtml(q.questionText)}${imagesHtml(q.diagramUrls, images)}</div>
        ${marks}
      </div>
      ${answerBlock}
      ${solution}
    </section>`;
}

function answerKeyHtml(questions: Question[]) {
  const cells = questions
    .map((q, i) => {
      const answer = q.correctAnswer
        ? q.answerType === 'Numerical'
          ? textToHtml(q.correctAnswer)
          : escapeHtml(q.correctAnswer)
        : '—';
      return `<div class="key-cell"><span class="key-num">${i + 1}.</span> ${answer}</div>`;
    })
    .join('');
  return `<section class="answer-key"><h2>Answer key</h2><div class="key-grid">${cells}</div></section>`;
}

function buildHtml(opts: QuestionPdfOptions, images: Map<string, string>) {
  const { title, subtitle, questions, marksPerQuestion } = opts;
  const meta = [
    subtitle,
    `${questions.length} question${questions.length === 1 ? '' : 's'}`,
    marksPerQuestion ? `${questions.length * marksPerQuestion} marks` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  // iOS takes the margins as a print option; elsewhere the page CSS sets them.
  const pageMargin = Platform.OS === 'ios' ? 0 : MARGIN;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: ${pageMargin}pt; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11.5pt; line-height: 1.45; }
  header { border-bottom: 1.5pt solid #111; padding-bottom: 8pt; margin-bottom: 14pt; }
  h1 { font-size: 17pt; margin: 0 0 3pt; }
  .meta { display: flex; justify-content: space-between; color: #444; font-size: 10pt; }
  .student { display: flex; gap: 24pt; margin-top: 10pt; font-size: 10pt; color: #333; }
  .question { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14pt; }
  .q-head { display: flex; gap: 6pt; align-items: flex-start; }
  .q-num { font-weight: 700; min-width: 26pt; }
  .q-text { flex: 1; }
  .marks { color: #555; font-size: 9.5pt; white-space: nowrap; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt 16pt; margin: 6pt 0 0 32pt; }
  .option { display: flex; gap: 5pt; }
  .opt-key { font-weight: 600; }
  .numeric-answer { margin: 8pt 0 0 32pt; color: #333; }
  .figure { display: block; max-width: 100%; max-height: 200pt; margin: 6pt 0; }
  .figure.small { max-height: 110pt; }
  .solution { margin: 8pt 0 0 32pt; padding: 7pt 9pt; border-left: 2pt solid #2e7d32; background: #f4f8f4; }
  .answer { font-weight: 700; color: #1b5e20; margin-bottom: 3pt; }
  .solution-body p { margin: 3pt 0; }
  .step-label { font-weight: 700; margin-right: 5pt; }
  .answer-key { break-before: page; page-break-before: always; }
  .answer-key h2 { font-size: 14pt; border-bottom: 1pt solid #111; padding-bottom: 4pt; }
  .key-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6pt; }
  .key-cell { border: 0.75pt solid #bbb; border-radius: 3pt; padding: 4pt 6pt; }
  .key-num { font-weight: 700; }
  .frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; margin: 0 2px; font-size: 0.9em; }
  .frac .den { border-top: 0.75pt solid currentColor; }
  .radicand { border-top: 0.75pt solid currentColor; padding: 0 1px; }
  math[display="block"] { display: block; margin: 4pt 0; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta"><span>${escapeHtml(meta)}</span><span>${escapeHtml(date)}</span></div>
    ${opts.content === 'solutions' ? '' : '<div class="student"><span>Name: ______________________</span><span>Roll no: __________</span></div>'}
  </header>
  ${questions.map((q, i) => questionHtml(q, i, opts, images)).join('')}
  ${opts.content === 'answers' ? answerKeyHtml(questions) : ''}
</body>
</html>`;
}

// ─── Export ────────────────────────────────────────────────────────────────

/** " (answer key)" for the answer-key version of a paper, and so on. */
export const VERSION_SUFFIX: Record<PdfContent, string> = {
  questions: '',
  answers: ' (answer key)',
  solutions: ' (solutions)',
};

/**
 * Builds a PDF of the questions and saves it to My PDFs, returning it.
 *
 * On the web there is no file storage: the paper opens in a new tab with the
 * print dialog, where "Save as PDF" saves it, and this returns null.
 *
 * expo-print's own file sits in a cache folder other apps may not be allowed
 * to read (in Expo Go, Android gives each project its own cache folder), so
 * the PDF comes back as base64 and My PDFs writes its own copy.
 */
export async function createQuestionsPdf(opts: QuestionPdfOptions): Promise<SavedPdf | null> {
  if (opts.questions.length === 0) throw new Error('Pick at least one question for the PDF.');

  if (Platform.OS === 'web') {
    // Opened before anything is awaited, while it still counts as the tap,
    // or the browser blocks it as a pop-up. The browser loads the figures.
    const win = window.open('', '_blank');
    if (!win) throw new Error('Allow pop-ups for this site to save the PDF.');
    let printed = false;
    const print = () => {
      if (printed) return;
      printed = true;
      win.focus();
      win.print();
    };
    win.document.open();
    win.document.write(buildHtml(opts, new Map()));
    win.document.close();
    // After close(): document.open() clears the window's listeners.
    win.addEventListener('load', print);
    // In case the load event never fires (e.g. a figure that hangs).
    setTimeout(print, 4000);
    return null;
  }

  const images = await embedImages(opts.questions);
  const html = buildHtml(opts, images);

  const printed = await Print.printToFileAsync({
    html,
    width: PAGE.width,
    height: PAGE.height,
    margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    base64: true,
  });
  if (!printed.base64) throw new Error('Could not make the PDF. Try again.');

  return addPdf({
    name: opts.fileName ?? opts.title,
    base64: printed.base64,
    pageCount: printed.numberOfPages,
    questions: opts.questions,
    content: opts.content,
    totalMarks: opts.marksPerQuestion ? opts.marksPerQuestion * opts.questions.length : undefined,
    standard: opts.standard,
    subject: opts.subject,
  });
}

/**
 * Makes another version of a saved PDF from its kept questions, e.g. the
 * answer key of a paper already handed out. Returns the new PDF.
 */
export async function createPdfVersion(source: SavedPdf, content: PdfContent): Promise<SavedPdf | null> {
  const questions = loadPdfQuestions(source.id);
  if (!questions?.length) throw new Error("This PDF's questions weren't kept, so another version can't be made.");
  // "Kinematics test (answer key)" → "Kinematics test"
  const baseName = Object.values(VERSION_SUFFIX).reduce(
    (name, suffix) => (suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name),
    source.name
  );
  const marksPerQuestion =
    source.totalMarks && source.questionCount ? source.totalMarks / source.questionCount : undefined;
  return createQuestionsPdf({
    title: baseName,
    fileName: `${baseName}${VERSION_SUFFIX[content]}`,
    subtitle: [source.standard, source.subject].filter(Boolean).join(' · ') || undefined,
    questions,
    content,
    marksPerQuestion,
    standard: source.standard,
    subject: source.subject,
  });
}

import { Platform } from 'react-native';
import { authHeaders, reportLoginExpired } from '@/services/api-client';
import { API_BASE_URL } from '@/services/apiService';
import { addPdf, loadPdfQuestions, type PaperDetails, type PdfContent, type SavedPdf } from '@/services/pdf-library';
import type { SmartSlideSettings } from '@/shared/smart-slide-layout';
import type { Question } from '@/types/pcmb';

// PDFs are made on the server (papers backend, POST /api/question-paper-pdf)
// with headless Chrome, then saved to My PDFs. Phones used to print them with
// expo-print, and Android's print engine could sit on a long paper full of
// maths for minutes, or for good, freezing the app while it did.

/**
 * What goes in the PDF:
 * - questions: a paper to hand out
 * - answers:   the paper, then an answer key on its own page
 * - solutions: the paper, the answer key, then each question's worked solution
 * - answerKey: the answer key alone
 */
export type { PaperDetails, PdfContent };

/**
 * What a teacher asks for, in the three ways the PDF flow offers it:
 * - answers:   one PDF, the questions then the answer key
 * - solutions: one PDF, the questions, the answer key, then the solutions
 * - separate:  two PDFs, the question paper and the answer key
 */
export type PdfChoice = 'answers' | 'solutions' | 'separate';

export const PDF_CHOICES: { value: PdfChoice; label: string; hint: string }[] = [
  { value: 'answers', label: 'Questions + Answer Key', hint: 'One PDF; the answer key is on its own page' },
  { value: 'solutions', label: 'Questions + Answer Key + Solutions', hint: 'One PDF, with the answer key and solutions on new pages' },
  { value: 'separate', label: 'Separate PDFs', hint: 'Two PDFs: the question paper and the answer key' },
];

export interface QuestionPdfOptions {
  /** Printed at the top of the paper. */
  title: string;
  /** Name in My PDFs and of the file; defaults to the title. */
  fileName?: string;
  questions: Question[];
  content: PdfContent;
  marksPerQuestion?: number;
  /** Printed under the title, and kept with the PDF for My PDFs' filters. */
  standard?: string;
  subject?: string;
  /** Paper set, date and duration printed in the header; the server prints a dash for what's missing. */
  paper?: PaperDetails;
  /** Makes a Smart PDF (16:9 slides, questions only) with this layout instead of the exam paper. */
  smart?: SmartSlideSettings;
}

/** What createQuestionsPdf is doing, for the screen to show. */
export type PdfStage = 'making' | 'downloading';

/** The PDF couldn't be made; the message says why, for the screen to show. */
export class PdfRequestError extends Error {}

/** The most questions the server prints in one PDF. */
export const MAX_PDF_QUESTIONS = 300;

const DEFAULT_MARKS_PER_QUESTION = 4;

// The server gives itself two minutes; a little more here covers the transfer.
const REQUEST_TIMEOUT_MS = 150000;

const SERVER_SECTIONS: Record<PdfContent, { questionPaper: boolean; answerKey: boolean; solutions: boolean }> = {
  questions: { questionPaper: true, answerKey: false, solutions: false },
  answers: { questionPaper: true, answerKey: true, solutions: false },
  solutions: { questionPaper: true, answerKey: true, solutions: true },
  answerKey: { questionPaper: false, answerKey: true, solutions: false },
};

/** " (answer key)" for the answer-key version of a paper, and so on. */
export const VERSION_SUFFIX: Record<PdfContent, string> = {
  questions: '',
  answers: ' (answer key)',
  solutions: ' (solutions)',
  answerKey: ' (answer key only)',
};

/** " (slides)" after a Smart PDF's name in My PDFs. */
export const SMART_SUFFIX = ' (slides)';

/** "11th", or "11th, 12th" when the questions come from more than one. */
const namesIn = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean))].join(', ');

/** Only what the printed paper shows, so the request stays small. */
function requestBody(opts: QuestionPdfOptions, marksPerQuestion: number): string {
  const { questionPaper, answerKey, solutions } = SERVER_SECTIONS[opts.content];
  return JSON.stringify({
    title: opts.title,
    standard: opts.standard ?? namesIn(opts.questions.map((q) => q.standard)),
    subject: opts.subject ?? namesIn(opts.questions.map((q) => q.subject)),
    marksPerQuestion,
    paperSet: opts.paper?.paperSet,
    date: opts.paper?.date,
    durationMinutes: opts.paper?.durationMinutes,
    questionPaper,
    answerKey,
    solutions,
    // Exam papers only: a Smart PDF carries no watermark and has its own settings.
    ...(opts.smart
      ? { format: 'smart', slides: opts.smart }
      : {
          ...(opts.paper?.watermark ? { watermark: opts.paper.watermark } : {}),
          // The server accepts only the listed fonts, sizes and so on, and falls back to the default for the rest.
          ...(opts.paper?.style ? { style: opts.paper.style } : {}),
        }),
    questions: opts.questions.map((q) => ({
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      answerType: q.answerType,
      correctAnswer: q.correctAnswer,
      explanation: solutions ? q.explanation : '',
      chapter: q.chapter,
      source: q.source ?? '',
      diagramUrls: q.diagramUrls ?? [],
      optionDiagramUrls: {
        A: q.optionDiagramUrls?.A ?? [],
        B: q.optionDiagramUrls?.B ?? [],
        C: q.optionDiagramUrls?.C ?? [],
        D: q.optionDiagramUrls?.D ?? [],
      },
      explanationDiagramUrls: solutions ? (q.explanationDiagramUrls ?? []) : [],
    })),
  });
}

/** The server's reason for a failed request, if it gave one. */
async function serverError(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    // The underlying error, for the developer: the screen shows `error`.
    if (__DEV__) console.warn(`[PDF] server answered ${res.status}:`, body?.detail ?? body?.error);
    return typeof body?.error === 'string' && body.error ? body.error : null;
  } catch {
    if (__DEV__) console.warn(`[PDF] server answered ${res.status} without a JSON body`);
    return null;
  }
}

/** Has the server print the paper; returns the PDF and its page count. */
async function downloadPdf(
  opts: QuestionPdfOptions,
  marksPerQuestion: number,
  onStage?: (stage: PdfStage) => void
): Promise<{ bytes: Uint8Array; pages: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/question-paper-pdf`, {
        method: 'POST',
        // The server makes PDFs only for signed-in teachers and tuition accounts.
        headers: { 'Content-Type': 'application/json', Accept: 'application/pdf', ...authHeaders() },
        body: requestBody(opts, marksPerQuestion),
        signal: controller.signal,
      });
    } catch {
      throw new PdfRequestError(
        controller.signal.aborted
          ? 'The server took too long to make the PDF. Try again, or pick fewer questions.'
          : "Couldn't reach the server. Check your internet connection and try again."
      );
    }
    if (!res.ok || !res.headers.get('content-type')?.includes('application/pdf')) {
      const message = await serverError(res);
      // Signs the user out, as every other signed-in request does on a 401.
      if (res.status === 401) reportLoginExpired();
      throw new PdfRequestError(message ?? 'The server could not make the PDF. Try again.');
    }

    const serverDone = Date.now();
    onStage?.('downloading');
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      throw new PdfRequestError('The download was cut off. Check your internet connection and try again.');
    }
    // A PDF starts with "%PDF-"; anything else (e.g. a proxy's error page) isn't saved.
    if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') {
      throw new PdfRequestError('The server sent back something that isn’t a PDF. Try again.');
    }

    const pages = Number(res.headers.get('x-page-count')) || 0;
    if (__DEV__) {
      console.log(
        `[PDF] ${opts.questions.length} questions, ${pages} pages, ${Math.round(bytes.length / 1024)} KB: ` +
          `server ${serverDone - started} ms (render ${res.headers.get('x-render-ms')} ms), ` +
          `download ${Date.now() - serverDone} ms`
      );
    }
    return { bytes, pages };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Has the server make a PDF of the questions and saves it to My PDFs,
 * returning it. Reports each stage as it starts.
 */
export async function createQuestionsPdf(
  opts: QuestionPdfOptions,
  onStage?: (stage: PdfStage) => void
): Promise<SavedPdf> {
  if (opts.questions.length === 0) throw new PdfRequestError('Pick at least one question for the PDF.');
  if (opts.questions.length > MAX_PDF_QUESTIONS) {
    throw new PdfRequestError(
      `A PDF can have up to ${MAX_PDF_QUESTIONS} questions, and these are ${opts.questions.length}. ` +
        'Pick fewer questions or narrow the filters.'
    );
  }
  // The web app has no file storage for My PDFs.
  if (Platform.OS === 'web') {
    throw new PdfRequestError('PDFs are made in the iPhone and Android app, not the web version.');
  }

  onStage?.('making');
  const marksPerQuestion = opts.marksPerQuestion ?? DEFAULT_MARKS_PER_QUESTION;
  const { bytes, pages } = await downloadPdf(opts, marksPerQuestion, onStage);

  try {
    return addPdf({
      name: opts.fileName ?? opts.title,
      bytes,
      pageCount: pages || undefined,
      questions: opts.questions,
      content: opts.content,
      totalMarks: marksPerQuestion * opts.questions.length,
      standard: opts.standard,
      subject: opts.subject,
      paper: { ...opts.paper, title: opts.title },
      format: opts.smart ? ('smart' as const) : ('exam' as const),
    });
  } catch {
    throw new PdfRequestError("The PDF was made but couldn't be saved on this phone. Check its free space and try again.");
  }
}

/**
 * Makes what a teacher asked for and saves it to My PDFs: one PDF, or for
 * "separate" the question paper and then the answer key, as two. Returns them
 * in that order. If the answer key fails, the question paper is already saved
 * and the error says so.
 */
export async function createPdfsFor(
  opts: Omit<QuestionPdfOptions, 'content' | 'fileName'>,
  choice: PdfChoice,
  onStage?: (stage: PdfStage) => void
): Promise<SavedPdf[]> {
  if (choice !== 'separate') return [await createQuestionsPdf({ ...opts, content: choice }, onStage)];

  const paper = await createQuestionsPdf(
    { ...opts, content: 'questions', fileName: `${opts.title} - Question Paper` },
    onStage
  );
  try {
    const key = await createQuestionsPdf(
      { ...opts, content: 'answerKey', fileName: `${opts.title} - Answer Key` },
      onStage
    );
    return [paper, key];
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Try again.';
    throw new PdfRequestError(`The question paper is saved in My PDFs, but the answer key couldn't be made. ${reason}`);
  }
}

/**
 * Makes a Smart PDF of the picked questions with this layout and saves it to
 * My PDFs as "<title> (slides)". Questions only: no answers or solutions.
 */
export function createSmartPdf(
  opts: Pick<QuestionPdfOptions, 'title' | 'questions' | 'standard' | 'subject'>,
  settings: SmartSlideSettings,
  onStage?: (stage: PdfStage) => void
): Promise<SavedPdf> {
  return createQuestionsPdf(
    // Slides carry no marks, so My PDFs shows none.
    { ...opts, content: 'questions', fileName: `${opts.title}${SMART_SUFFIX}`, marksPerQuestion: 0, smart: settings },
    onStage
  );
}

/**
 * Makes another version of a saved PDF from its kept questions, e.g. the
 * answer key of a paper already handed out. Returns the new PDF.
 */
export async function createPdfVersion(source: SavedPdf, content: PdfContent): Promise<SavedPdf> {
  const questions = loadPdfQuestions(source.id);
  if (!questions?.length) throw new Error("This PDF's questions weren't kept, so another version can't be made.");
  // "Kinematics test (answer key)" → "Kinematics test"
  const baseName = [...Object.values(VERSION_SUFFIX), SMART_SUFFIX].reduce(
    (name, suffix) => (suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name),
    source.name
  );
  const marksPerQuestion =
    source.totalMarks && source.questionCount ? source.totalMarks / source.questionCount : undefined;
  return createQuestionsPdf({
    // The title the paper was made with (as edited), not its file name.
    title: source.paper?.title || baseName,
    fileName: `${baseName}${VERSION_SUFFIX[content]}`,
    questions,
    content,
    marksPerQuestion,
    standard: source.standard,
    subject: source.subject,
    paper: source.paper,
  });
}

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Question } from '@/types/pcmb';

/**
 * My PDFs: every PDF the app makes, kept in the app's document folder, which
 * lasts until the app is uninstalled (unlike the cache, which the system may
 * clear). Layout:
 *
 *   <documents>/my-pdfs/files/<name>.pdf      the PDFs, named as shown
 *   <documents>/my-pdfs/library.json          their details, newest first
 *   <documents>/my-pdfs/questions/<id>.json   each PDF's questions, to make
 *                                             another version from
 *
 * The web app has no file storage, so PDFs are made in the phone app only.
 */

export type PdfContent = 'questions' | 'answers' | 'solutions';

export const PDF_CONTENT_LABELS: Record<PdfContent, string> = {
  questions: 'Questions only',
  answers: 'With answer key',
  solutions: 'With solutions',
};

export interface SavedPdf {
  id: string;
  /** Shown in the list and used as the file name, without ".pdf". */
  name: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  pageCount: number | null;
  questionCount: number;
  totalMarks: number | null;
  content: PdfContent;
  standard?: string;
  subject?: string;
  chapters: string[];
  /** Whether the questions were kept, so another version can be made. */
  hasQuestions: boolean;
}

export interface NewPdf {
  name: string;
  /** The PDF file itself. */
  bytes: Uint8Array;
  pageCount?: number;
  questions: Question[];
  content: PdfContent;
  totalMarks?: number;
  standard?: string;
  subject?: string;
}

export const pdfLibraryAvailable = Platform.OS !== 'web';

// ─── Storage ───────────────────────────────────────────────────────────────

const root = () => new Directory(Paths.document, 'my-pdfs');
const filesDir = () => new Directory(root(), 'files');
const questionsDir = () => new Directory(root(), 'questions');
const indexFile = () => new File(root(), 'library.json');
const pdfFile = (pdf: Pick<SavedPdf, 'fileName'>) => new File(filesDir(), pdf.fileName);
const questionsFile = (id: string) => new File(questionsDir(), `${id}.json`);

function ensureFolders() {
  for (const dir of [root(), filesDir(), questionsDir()]) {
    if (!dir.exists) dir.create({ intermediates: true });
  }
}

let items: SavedPdf[] = [];
let loaded = false;
const listeners = new Set<() => void>();

/** Reads the list once, dropping any PDF whose file has gone missing. */
function load() {
  if (loaded || !pdfLibraryAvailable) return;
  loaded = true;
  try {
    const index = indexFile();
    if (!index.exists) return;
    const parsed: unknown = JSON.parse(index.textSync());
    const list = Array.isArray(parsed) ? (parsed as SavedPdf[]) : [];
    items = list.filter((pdf) => pdf?.fileName && pdfFile(pdf).exists);
    if (items.length !== list.length) persist();
  } catch {
    items = [];
  }
}

function persist() {
  ensureFolders();
  const index = indexFile();
  if (!index.exists) index.create();
  index.write(JSON.stringify(items));
}

function commit(next: SavedPdf[]) {
  items = next;
  persist();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  load();
  return items;
}

/** Every saved PDF, newest first; re-renders when one is added, renamed or deleted. */
export function usePdfLibrary(): SavedPdf[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getSavedPdf(id: string): SavedPdf | undefined {
  load();
  return items.find((pdf) => pdf.id === id);
}

// ─── Names ─────────────────────────────────────────────────────────────────

/** Strips what a file name can't hold on Android, iOS or Windows. */
export function cleanPdfName(name: string) {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|#%{}^~[\]`\x00-\x1f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** The name, or "name (2)", "name (3)"… if another PDF already has it. */
function uniqueName(wanted: string, exceptId?: string) {
  const base = cleanPdfName(wanted) || 'Question paper';
  const taken = new Set(items.filter((pdf) => pdf.id !== exceptId).map((pdf) => pdf.fileName.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(`${name}.pdf`.toLowerCase()); n++) name = `${base} (${n})`;
  return name;
}

// ─── Changes ───────────────────────────────────────────────────────────────

export function addPdf(input: NewPdf): SavedPdf {
  load();
  ensureFolders();
  const id = `pdf-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const name = uniqueName(input.name);
  const fileName = `${name}.pdf`;

  const file = new File(filesDir(), fileName);
  file.create({ overwrite: true });
  file.write(input.bytes);

  let hasQuestions = false;
  try {
    const qFile = questionsFile(id);
    qFile.create({ overwrite: true });
    qFile.write(JSON.stringify(input.questions));
    hasQuestions = true;
  } catch {
    // The PDF still works; only "make another version" needs these.
  }

  const pdf: SavedPdf = {
    id,
    name,
    fileName,
    createdAt: new Date().toISOString(),
    sizeBytes: file.size,
    pageCount: input.pageCount ?? null,
    questionCount: input.questions.length,
    totalMarks: input.totalMarks ?? null,
    content: input.content,
    standard: input.standard,
    subject: input.subject,
    chapters: [...new Set(input.questions.map((q) => q.chapter).filter(Boolean))],
    hasQuestions,
  };
  commit([pdf, ...items]);
  return pdf;
}

/** Renames the PDF and its file; returns the name it got. */
export function renamePdf(id: string, wanted: string): string {
  const pdf = getSavedPdf(id);
  if (!pdf) throw new Error('This PDF is no longer on the device.');
  const cleaned = cleanPdfName(wanted);
  if (!cleaned) throw new Error('Enter a name.');
  if (cleaned === pdf.name) return pdf.name;

  const taken = items.some((other) => other.id !== id && other.name.toLowerCase() === cleaned.toLowerCase());
  if (taken) throw new Error('Another PDF already has this name.');

  const fileName = `${cleaned}.pdf`;
  try {
    pdfFile(pdf).rename(fileName);
  } catch {
    throw new Error('Could not rename the file. Try another name.');
  }
  commit(items.map((item) => (item.id === id ? { ...item, name: cleaned, fileName } : item)));
  return cleaned;
}

export function deletePdf(id: string) {
  const pdf = getSavedPdf(id);
  if (!pdf) return;
  try {
    const file = pdfFile(pdf);
    if (file.exists) file.delete();
    const qFile = questionsFile(id);
    if (qFile.exists) qFile.delete();
  } finally {
    commit(items.filter((item) => item.id !== id));
  }
}

/** The questions a PDF was made from, or null if they weren't kept. */
export function loadPdfQuestions(id: string): Question[] | null {
  try {
    const qFile = questionsFile(id);
    if (!qFile.exists) return null;
    const parsed: unknown = JSON.parse(qFile.textSync());
    return Array.isArray(parsed) ? (parsed as Question[]) : null;
  } catch {
    return null;
  }
}

export function totalLibrarySize(list: SavedPdf[]) {
  return list.reduce((sum, pdf) => sum + (pdf.sizeBytes || 0), 0);
}

// ─── Open, share, print ────────────────────────────────────────────────────

function existingFile(pdf: SavedPdf) {
  const file = pdfFile(pdf);
  if (!file.exists) {
    commit(items.filter((item) => item.id !== pdf.id));
    throw new Error('This PDF is no longer on the device.');
  }
  return file;
}

export async function sharePdf(pdf: SavedPdf) {
  const file = existingFile(pdf);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: pdf.name,
  });
}

// Lets the viewer app read the file it's handed.
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Opens the PDF in a PDF app already on the phone. Android asks the system to
 * view it (Drive, Files, Adobe…); with no PDF app, the share sheet opens
 * instead. iOS has no such call for apps, so it opens the share sheet, which
 * offers "Open in Books", "Save to Files" and other PDF apps.
 */
export async function openPdf(pdf: SavedPdf) {
  const file = existingFile(pdf);
  if (Platform.OS === 'android') {
    try {
      // Not awaited: it resolves only when the viewer is closed.
      IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: file.contentUri,
        type: 'application/pdf',
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      }).catch(() => sharePdf(pdf).catch(() => {}));
      return;
    } catch {
      // Fall through to the share sheet.
    }
  }
  await sharePdf(pdf);
}

/** The system print dialog, which shows a preview of every page. */
export async function printPdf(pdf: SavedPdf) {
  const file = existingFile(pdf);
  await Print.printAsync({ uri: file.uri });
}

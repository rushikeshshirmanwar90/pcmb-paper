export type ExamCategory = "Foundation" | "JEE/NEET";
export type Standard = "9th" | "10th" | "11th" | "12th";
export type Subject = "Physics" | "Chemistry" | "Mathematics" | "Biology" | "Science";
export type DifficultyLevel = "Easy" | "Mid" | "Hard";

export interface FilterState {
  examCategory: ExamCategory | "All";
  standard: Standard | "All";
  subject: Subject | "All";
  chapter: string;
  topic: string;
  level: DifficultyLevel | "All";
  searchQuery: string;
}

export interface Question {
  _id: string;
  paperId?: string;
  questionNumber: number;
  examCategory: ExamCategory;
  standard: Standard;
  subject: Subject;
  chapter: string;
  topic: string;
  difficulty: DifficultyLevel;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D" | string;
  /** "Numerical" questions have no options — the answer is a value. */
  answerType?: "MCQ" | "Numerical" | "Bonus";
  explanation: string;
  source?: string;
  /** Figures cut from the paper, as absolute URLs. */
  diagramUrls?: string[];
  optionDiagramUrls?: Partial<Record<"A" | "B" | "C" | "D", string[]>>;
  explanationDiagramUrls?: string[];
}

export interface Paper {
  _id: string;
  title: string;
  examCategory: ExamCategory;
  standard: Standard;
  examType: "JEE" | "NEET" | "FOUNDATION";
  year: number;
  subjects: Subject[];
  chapter?: string;
  topic?: string;
  difficulty?: DifficultyLevel;
  totalQuestions: number;
  pdfUrl?: string;
  uploadedDate: string;
  subjectBreakdown?: { subject: Subject; count: number }[];
}

export interface FilterOptions {
  examCategories: ExamCategory[];
  standards: { category: ExamCategory; values: Standard[] }[];
  subjects: Subject[];
  chapters: string[];
  topics: string[];
  levels: DifficultyLevel[];
}

export interface ExamRoom {
  _id: string;
  roomCode: string;
  title: string;
  examCategory: ExamCategory | "All";
  standard: Standard | "All";
  subject: Subject | "All";
  difficulty: DifficultyLevel | "All";
  durationMinutes: number;
  totalMarks: number;
  questions: Question[];
  createdAt: string;
  status: "active" | "completed";
}


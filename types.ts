

export interface ParsedFile {
  id: string;
  name: string;
  images: string[];
  text?: string;
  type: 'past_exam' | 'lecture' | 'doctor_notes' | 'additional_doctor_notes';
  uploadDate: Date;
}

export interface ImageFile {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface MatchedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  reason: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface SavedSnippet {
  id: string;
  text: string;
  sourceTitle: string;
  createdAt: Date;
  imageData?: string; // Base64 string for the attached image
}

export interface FullArchive {
  id: string;
  title: string;
  content: string | MatchedQuestion[];
  type: 'quiz_set' | 'summary_doc';
  createdAt: Date;
}

export interface SubFolder {
  id: string;
  name: string;
  subFolders?: SubFolder[]; // Recursive nesting
  questions: MatchedQuestion[];
  snippets: SavedSnippet[];
  archives: FullArchive[];
  createdAt: Date;
  isIgnoredByDoctor?: boolean; // New property to exclude from AI
}

export interface QuestionFolder {
  id: string;
  name: string;
  type: 'questions' | 'snippets' | 'quiz_sets' | 'summaries';
  subFolders: SubFolder[];
  questions: MatchedQuestion[];
  snippets: SavedSnippet[];
  archives: FullArchive[];
  createdAt: Date;
  isIgnoredByDoctor?: boolean; // New property to exclude from AI
}

export interface HistoryEntry {
  id: string;
  name: string;
  date: Date;
  score: number;
  totalQuestions: number;
  questions: MatchedQuestion[];
}

// --- NEW TYPES FOR NOTES ---
export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
}

export interface NoteFolder {
  id: string;
  name: string;
  subFolders?: NoteFolder[]; // Recursive nesting
  notes: Note[];
  createdAt: Date;
}

// --- NEW TYPES FOR TASKS/PLANNER ---
export type TaskStatus = 'pending' | 'completed' | 'failed';

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: Date;
}
// ---------------------------

export interface Slide {
  id: string;
  title: string;
  content: string[];
  imagePrompt: string;
  imageUrl?: string;
  isLoadingImage?: boolean;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PARSING_PDF = 'PARSING_PDF',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type AppMode = 'extraction' | 'generation' | 'summary' | 'summary_mega' | 'custom' | 'google_form' | 'direct_export' | 'image_injection' | 'template2_smart';

export interface AnalysisResult {
  lectureName: string;
  matches: MatchedQuestion[];
}
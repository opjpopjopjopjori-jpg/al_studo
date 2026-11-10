
import React, { useState, useEffect, useRef } from 'react';
import { ParsedFile, AppStatus, MatchedQuestion, QuestionFolder, AppMode, FullArchive, SavedSnippet, SubFolder, HistoryEntry, NoteFolder, Note, Task, ImageFile } from './types';
import { convertPdfToImages, extractPdfForLocalAI } from './services/pdfUtils';
import { analyzeMatches, generateMentorInsight, getTranslation, generateDoctorAdvice, improveTextFormatting, correctCodeSnippet, correctMathAndScientificNotation, correctMathSymbols, formatSummaryForPDF, formatSummaryForPDFTemplate2, generateExamsForPDF, injectImagesIntoHTML, distillToExamImportantPoints } from './services/gemini';
import { storageService } from './services/storage';
import { soundService } from './services/sound';
import { FileDropzone } from './components/FileDropzone';
import { 
  BrainCircuit, AlertCircle, Loader2, CheckCircle, 
  XCircle, ArrowLeft, Trophy, Bookmark, Folder, X, 
  Sparkles, Download, Filter, Telescope, BookOpen, Save, FileText,
  Quote, Highlighter, Trash2, Check, Plus, FolderPlus, Upload,
  History, RotateCcw, Calendar, Clock, Moon, Sun, Lightbulb, UserCheck,
  NotebookPen, Edit3, ChevronRight, ChevronLeft, Home, Bold, Underline, Eye, Languages,
  Settings, Database, FileUp, FileDown, Volume2, Stethoscope, MessageCircle, GraduationCap, CloudOff, Info, Image as ImageIcon, ZoomIn, PenTool,
  Maximize2, Copy, RefreshCw, LayoutGrid, ScanLine, Binary, ShieldCheck, Pencil, GripVertical, EyeOff, Wand2, Undo2, Minimize2, Flame, ExternalLink,
  ListTodo, CheckSquare, XSquare, Printer, Layers, ClipboardList,
  ChevronDown, BugOff, Globe
} from 'lucide-react';

// Declaration for KaTeX
declare global {
  interface Window {
    katex: any;
  }
}

const isArabicText = (text: string) => text ? /[\u0600-\u06FF]/.test(text) : false;

// IMPROVED MATH AND FORMATTING RENDERER
const renderFormattedText = (text: string) => {
  if (!text) return null;

  // 1. CLEANUP & PREP
  const cleanText = text.replace(/\\\$/g, '$');

  // 2. SPLIT BY MATH DELIMITERS
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?:\$[^\$]+\$))/g;
  
  const parts = cleanText.split(mathRegex);

  return parts.map((part, index) => {
    // 3. DETECT AND RENDER MATH
    if (/^(\$\$|\\\[|\\\(|\$)/.test(part)) {
       try {
         if (window.katex) {
            const isBlock = part.startsWith('$$') || part.startsWith('\\[');
            let raw = part;
            if (part.startsWith('$$')) raw = part.slice(2, -2);
            else if (part.startsWith('\\[')) raw = part.slice(2, -2);
            else if (part.startsWith('\\(')) raw = part.slice(2, -2);
            else if (part.startsWith('$')) raw = part.slice(1, -1);

            const html = window.katex.renderToString(raw, {
              throwOnError: false,
              displayMode: isBlock,
              output: 'html'
            });
            return <span key={index} dangerouslySetInnerHTML={{__html: html}} className={isBlock ? "block my-2 text-center overflow-x-auto" : "inline-block mx-1"} dir="ltr" />;
         } else {
            return <span key={index} className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded mx-1">{part}</span>;
         }
       } catch(e) { 
         console.warn("Math parse error", e);
         return <span key={index}>{part}</span>; 
       }
    }

    // --- ARROW & SYMBOL FIX ---
    const fixedPart = part
      .replace(/&rarr;/g, '→').replace(/&larr;/g, '←').replace(/&uarr;/g, '↑').replace(/&darr;/g, '↓').replace(/&harr;/g, '↔')
      .replace(/\\rightarrow/g, '→').replace(/\\leftarrow/g, '←').replace(/\\uparrow/g, '↑').replace(/\\downarrow/g, '↓').replace(/\\leftrightarrow/g, '↔')
      .replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐')
      .replace(/-->/g, '→').replace(/<--/g, '←').replace(/<->/g, '↔')
      .replace(/==>/g, '⇒').replace(/<==/g, '⇐')
      .replace(/&nbsp;/g, ' ');

    // 4. DETECT CUSTOM FORMATTING
    const formatRegex = /(\*{2}[\s\S]+?\*{2}|_{2}[\s\S]+?_{2}|\({2}[\s\S]+?\){2}|\[{2}[\s\S]+?\]{2})/g;
    const subParts = fixedPart.split(formatRegex);

    return (
      <span key={index}>
        {subParts.map((subPart, subIdx) => {
           if (/^\*{2}.+\*{2}$/.test(subPart)) {
              return <span key={subIdx} className="font-black text-slate-900 dark:text-white mx-1">{subPart.replace(/^\*{2}|\*{2}$/g, '')}</span>;
           }
           if (/^_{2}.+_{2}$/.test(subPart)) {
              return <span key={subIdx} className="inline-block border-b-2 border-indigo-500 font-bold text-indigo-800 dark:text-indigo-300 mx-1 pb-0.5">{subPart.replace(/^_{2}|_{2}$/g, '')}</span>;
           }
           if (/^\({2}.+\){2}$/.test(subPart)) {
              return <span key={subIdx} className="font-black text-red-600 dark:text-red-400 mx-1 bg-red-50 dark:bg-red-900/20 px-1.5 rounded border border-red-100 dark:border-red-900/30">{subPart.replace(/^\({2}|\){2}$/g, '')}</span>;
           }
           if (/^\[{2}.+\]{2}$/.test(subPart)) {
              return <span key={subIdx} className="fire-text mx-1 px-1.5 rounded-lg">{subPart.replace(/^\[{2}|\]{2}$/g, '')}</span>;
           }
           return subPart;
        })}
      </span>
    );
  });
};

const MarkdownRenderer = ({ text }: { text: string }) => {
  if (!text) return null;
  const isGlobalRTL = isArabicText(text);
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (keyIndex: number) => {
    if (tableBuffer.length === 0) return null;
    const rows = tableBuffer.filter(row => row.trim().startsWith('|'));
    if (rows.length < 2) {
      const content = tableBuffer.map((line, idx) => <p key={`${keyIndex}-badtable-${idx}`} className="mb-1">{renderFormattedText(line)}</p>);
      tableBuffer = [];
      return content;
    }
    const headerRow = rows[0].split('|').map(c => c.trim()).filter(c => c);
    const bodyRows = rows.slice(2).map(row => row.split('|').map(c => c.trim()).filter(c => c !== ''));
    const tableDir = isArabicText(headerRow.join('')) ? 'rtl' : 'ltr';
    const numCols = headerRow.length;
    const tableLayoutClass = numCols > 3 ? "w-max min-w-full" : "w-full table-auto";

    const tableElement = (
      <div key={`table-${keyIndex}`} className="my-10 w-full overflow-hidden rounded-[12px] shadow-[0_4px_16px_rgba(79,60,53,0.08)] border border-[#D7CCC8] dark:border-[#4F3C35] bg-white dark:bg-[#1f1614] break-inside-avoid" dir={tableDir}>
        <div className="overflow-x-auto">
          <table className={`${tableLayoutClass} text-base border-collapse border-spacing-0`}>
            <thead>
              <tr className="bg-[#4F3C35] dark:bg-[#3E2723]">
                {headerRow.map((head, hIdx) => (
                  <th key={hIdx} scope="col" className={`p-4 sm:p-[18px] text-[15px] font-black tracking-[0.5px] text-white border border-[#D7CCC8] dark:border-[#5F4A42] align-top whitespace-normal break-normal [word-break:normal] [overflow-wrap:normal] [hyphens:none] ${tableDir === 'rtl' ? 'text-right' : 'text-left'} ${hIdx === 0 ? 'w-auto min-w-[150px]' : 'min-w-[170px]'}`}>
                    {renderFormattedText(head)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="bg-white dark:bg-[#1f1614] group transition-colors hover:bg-[#FDFBF7] dark:hover:bg-[#2a1d1a]">
                  {row.map((cell, cIdx) => (
                     <td key={cIdx} className={`p-4 sm:p-[18px] text-[15px] font-medium leading-[1.6] border border-[#D7CCC8] dark:border-[#4F3C35] align-top whitespace-normal break-normal [word-break:normal] [overflow-wrap:normal] [hyphens:none] ${tableDir === 'rtl' ? 'text-right' : 'text-left'} text-slate-800 dark:text-slate-200 ${cIdx === 0 ? 'bg-[#E3D8D5] dark:bg-[#3E2723] text-[#3E2723] dark:text-[#E3D8D5] font-bold min-w-[150px] group-hover:bg-[#d6c7c2] dark:group-hover:bg-[#4F3C35]' : ''}`}>
                      {renderFormattedText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
    tableBuffer = [];
    return tableElement;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```html') || /^<(div|ol|ul|table|figure|section)\b/i.test(trimmed)) {
       // Extract raw HTML block
       let htmlContent = '';
       let j = i;
       if (trimmed.startsWith('```html')) j++; // skip ```html line
       
       let tagDepth = 0;
       const isCodeBlock = trimmed.startsWith('```html');
       
       for (; j < lines.length; j++) {
           const currentLine = lines[j];
           const currentTrimmed = currentLine.trim();

           // Handle markdown codeblock end
           if (isCodeBlock && currentTrimmed === '```') {
               break;
           }

           if (!isCodeBlock) {
               const tagOpens = (currentLine.match(/<(div|ol|ul|table|figure|section)\b/gi) || []).length;
               const tagCloses = (currentLine.match(/<\/(div|ol|ul|table|figure|section)>/gi) || []).length;
               tagDepth += tagOpens;
               tagDepth -= tagCloses;
               
               htmlContent += currentLine + '\n';
               if (tagDepth <= 0 && j >= i) break; // Reached the end of the root block
           } else {
               htmlContent += currentLine + '\n';
           }
       }
       if (lines[j]?.trim() === '```' || tagDepth <= 0) {
           elements.push(<div key={`raw-html-${i}`} className="my-8 overflow-x-auto" dangerouslySetInnerHTML={{ __html: htmlContent }} />);
           i = j;
           continue;
       }
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') { elements.push(<div key={i} className="my-10 flex items-center justify-center gap-4"><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div><div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div></div>); continue; }
    if (trimmed.startsWith('|')) { tableBuffer.push(trimmed); if (i === lines.length - 1 || !lines[i + 1].trim().startsWith('|')) elements.push(flushTable(i)); continue; }
    if (!trimmed) continue;
    
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
       elements.push(<div key={i} className="my-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">{renderFormattedText(trimmed)}</div>);
       continue;
    }

    const isLineArabic = /[\u0600-\u06FF]/.test(trimmed);
    const dir = isLineArabic ? 'rtl' : 'ltr';
    const alignClass = isLineArabic ? 'text-right' : 'text-left';
    
    // REDESIGNED HEADERS AND LISTS
    if (line.startsWith('# ')) {
        elements.push(
          <div key={i} className={`mt-14 mb-8 p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-xl transform hover:scale-[1.01] transition-transform ${alignClass}`} dir={dir}>
             <h1 className="text-3xl md:text-4xl font-black leading-tight flex items-center gap-4 font-serif">
               <span className="p-2 bg-white/20 rounded-xl"><Sparkles className="w-8 h-8 text-yellow-300" /></span>
               {renderFormattedText(line.slice(2))}
             </h1>
          </div>
        );
    }
    else if (line.startsWith('## ')) {
        elements.push(
          <div key={i} className={`mt-12 mb-6 flex items-center gap-4 ${isLineArabic ? 'flex-row' : 'flex-row-reverse justify-end'}`} dir={dir}>
             <div className="w-2 h-10 bg-indigo-500 rounded-full shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
             <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug font-serif">
               {renderFormattedText(line.slice(3))}
             </h2>
          </div>
        );
    }
    else if (line.startsWith('### ')) {
        elements.push(
           <div key={i} className={`mt-8 mb-4 flex items-center gap-3 ${isLineArabic ? 'flex-row' : 'flex-row-reverse justify-end'}`} dir={dir}>
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
             <h3 className={`text-xl font-bold text-indigo-700 dark:text-indigo-300 ${alignClass}`}>
               {renderFormattedText(line.slice(4))}
             </h3>
           </div>
        );
    }
    else if (/^(\d+)\.\s+(.*)/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s+(.*)/)!;
        const num = match[1];
        const content = match[2];
        
        const isRtl = isLineArabic;
        
        const boxBgStr = isRtl 
          ? 'linear-gradient(135deg, transparent 7px, #3f2a1d 0)'
          : 'linear-gradient(225deg, transparent 7px, #3f2a1d 0)';
          
        elements.push(
            <div key={i} className={`flex items-start gap-4 mb-4 py-4 border-b border-dashed border-slate-300 dark:border-slate-700 last:border-b-0 flex-row medical-list-item`} dir={dir}>
                
                {/* The Number Box */}
                <div className={`relative shrink-0 flex items-center justify-center shadow-md text-white w-10 h-10 text-lg rounded-[3px]`} style={{ background: boxBgStr }}>
                   <div 
                      className="absolute top-0 bg-[#6d4c38] shadow-sm" 
                      style={{ 
                          width: '9.9px', 
                          height: '9.9px', 
                          [isRtl ? 'left' : 'right']: 0,
                          clipPath: isRtl ? 'polygon(100% 0, 0 100%, 100% 100%)' : 'polygon(0 0, 0 100%, 100% 100%)',
                          borderBottomLeftRadius: isRtl ? '0' : '2px',
                          borderBottomRightRadius: isRtl ? '2px' : '0'
                      }} 
                   />
                   <span className="font-bold font-sans tracking-tighter mt-px">{num}</span>
                </div>
                
                {/* Vertical Divider Line */}
                <div className={`shrink-0 w-0.5 h-10 bg-[#e5cfb9] dark:bg-[#5c4535] rounded-full`}></div>
                
                {/* Text Content */}
                <div className={`flex-1 text-lg pt-1 leading-relaxed text-slate-800 dark:text-slate-300 ${alignClass} 
                  [&_span.text-indigo-900]:!text-[#1a0f08] [&_span.text-indigo-900]:dark:!text-[#f0d8c9] 
                  [&_span.bg-indigo-50]:!bg-transparent [&_span.bg-indigo-50]:!p-0
                  [&_span.text-indigo-900]:!font-black`}>
                   {renderFormattedText(content)}
                </div>
                
            </div>
        );
    }

    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
       elements.push(
         <div key={i} className={`group flex items-start gap-4 mb-4 p-4 rounded-2xl transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 bg-white dark:bg-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md ${isLineArabic ? 'flex-row' : 'flex-row-reverse'}`} dir={dir}>
           <div className={`mt-1.5 w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-hover:scale-110 ${isLineArabic ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-slate-100 text-slate-500'}`}>
              <Check className="w-3.5 h-3.5" />
           </div>
           <p className={`flex-1 text-lg leading-loose text-slate-700 dark:text-slate-300 font-medium ${alignClass}`}>
             {renderFormattedText(trimmed.slice(2))}
           </p>
         </div>
       );
    }
    else {
       elements.push(
         <p key={i} className={`mb-5 text-lg leading-loose text-slate-600 dark:text-slate-300 ${alignClass} ${trimmed.length > 200 ? 'bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/50' : ''}`} dir="auto">
           {renderFormattedText(trimmed)}
         </p>
       );
    }
  }
  return <div className={`font-cairo ${isGlobalRTL ? 'text-right' : 'text-left'} max-w-none pb-10`}>{elements}</div>;
};

// IMPROVED SAFE PARSING TO HANDLE IMAGES CORRECTLY
const safeSubFolderParse = (sf: any): SubFolder => ({ 
  id: sf.id || Math.random().toString(36).substr(2, 9), 
  name: sf.name || "مجلد فرعي", 
  subFolders: Array.isArray(sf.subFolders) ? sf.subFolders.map(safeSubFolderParse) : [], 
  questions: Array.isArray(sf.questions) ? sf.questions : [], 
  snippets: Array.isArray(sf.snippets) ? sf.snippets.map((s:any) => ({
      id: s.id || Math.random().toString(36),
      text: s.text || "",
      sourceTitle: s.sourceTitle || "",
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      imageData: s.imageData // Explicitly keeping image data
  })) : [], 
  archives: Array.isArray(sf.archives) ? sf.archives : [], 
  createdAt: sf.createdAt ? new Date(sf.createdAt) : new Date(),
  isIgnoredByDoctor: sf.isIgnoredByDoctor || false
});

const safeFolderParse = (data: any): QuestionFolder[] => { 
  if (!Array.isArray(data)) return []; 
  return data.map((f: any) => ({ 
    id: f.id || Math.random().toString(36).substr(2, 9), 
    name: f.name || "مجلد", 
    type: f.type || 'questions', 
    subFolders: Array.isArray(f.subFolders) ? f.subFolders.map(safeSubFolderParse) : [], 
    questions: Array.isArray(f.questions) ? f.questions : [], 
    snippets: Array.isArray(f.snippets) ? f.snippets.map((s:any) => ({
        id: s.id || Math.random().toString(36),
        text: s.text || "",
        sourceTitle: s.sourceTitle || "",
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        imageData: s.imageData // Explicitly keeping image data
    })) : [], 
    archives: Array.isArray(f.archives) ? f.archives : [], 
    createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
    isIgnoredByDoctor: f.isIgnoredByDoctor || false 
  })); 
};

const safeNotesParse = (data: any): NoteFolder[] => { if (!Array.isArray(data)) return []; const parseRecursive = (folders: any[]): NoteFolder[] => { return folders.map((f: any) => ({ id: f.id || Math.random().toString(36).substr(2, 9), name: f.name || "مجلد ملاحظات", subFolders: Array.isArray(f.subFolders) ? parseRecursive(f.subFolders) : [], notes: Array.isArray(f.notes) ? f.notes.map((n: any) => ({ id: n.id || Math.random().toString(36), title: n.title || "بدون عنوان", content: n.content || "", updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date() })) : [], createdAt: f.createdAt ? new Date(f.createdAt) : new Date() })); }; return parseRecursive(data); };
const updateFolderInTree = (folders: any[], targetId: string, action: (f: any) => any): any[] => folders.map(f => { if (f.id === targetId) return action(f); if (f.subFolders) return { ...f, subFolders: updateFolderInTree(f.subFolders, targetId, action) }; return f; });

// Modified to respect isIgnoredByDoctor and only collect snippets
const collectTextFromFavorites = (folders: QuestionFolder[]): string[] => { 
  const texts: string[] = []; 
  const traverse = (list: any[]) => { 
    list.forEach(item => { 
      if (item.isIgnoredByDoctor) return; // SKIP EXCLUDED FOLDERS
      if (item.snippets) item.snippets.forEach((s: SavedSnippet) => texts.push(`Snippet Source: ${s.sourceTitle} \n Content: ${s.text}`)); 
      // Doctor only reads snippets now, questions are ignored as per request
      if (item.subFolders) traverse(item.subFolders); 
    }); 
  }; 
  traverse(folders); 
  return texts; 
};

// Notes collection removed from Doctor usage as requested
const collectTextFromNotes = (folders: NoteFolder[]): string[] => { const texts: string[] = []; const traverse = (list: any[]) => { list.forEach(item => { if (item.notes) item.notes.forEach((n: Note) => texts.push(`Note Title: ${n.title}. Content: ${n.content}`)); if (item.subFolders) traverse(item.subFolders); }); }; traverse(folders); return texts; };

export default function App() {
  const [pastExamFiles, setPastExamFiles] = useState<ParsedFile[]>([]);
  const [lectureFiles, setLectureFiles] = useState<ParsedFile[]>([]);
  const [readAllPdfImages, setReadAllPdfImages] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ready: boolean; message: string} | null>(null);
  useEffect(() => { fetch('/api/ai/status').then(r => r.json()).then(setAiStatus).catch(() => setAiStatus({ready: false, message: 'تعذر التحقق من خدمة الذكاء الاصطناعي.'})); }, []); 
  const [doctorNotesFiles, setDoctorNotesFiles] = useState<ParsedFile[]>([]); 
  const [additionalDoctorNotesFiles, setAdditionalDoctorNotesFiles] = useState<ParsedFile[]>([]);
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [results, setResults] = useState<MatchedQuestion[]>([]);
  const [textResult, setTextResult] = useState<string | null>(null); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>('extraction');
  const [mentorContent, setMentorContent] = useState<string | null>(null);
  const [showMentor, setShowMentor] = useState(false);
  const [isMentorActive, setIsMentorActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => { if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches); return false; });
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);
  const [isDoctorThinking, setIsDoctorThinking] = useState(false);
  const [showDoctorChat, setShowDoctorChat] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeRootFolderId, setActiveRootFolderId] = useState<string | null>(null);
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<FullArchive | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState<SavedSnippet | null>(null); 
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyNameInput, setHistoryNameInput] = useState("");
  const [isHistorySaved, setIsHistorySaved] = useState(false);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>([]);
  const [showNotesSidebar, setShowNotesSidebar] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [noteNavigationPath, setNoteNavigationPath] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNoteFolderName, setNewNoteFolderName] = useState("");
  const [isCreatingNoteFolder, setIsCreatingNoteFolder] = useState(false);
  const [noteSelection, setNoteSelection] = useState<{start: number, end: number, top: number, left: number} | null>(null);
  const [isNotePreview, setIsNotePreview] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [saveTarget, setSaveTarget] = useState<{ type: 'quiz' | 'summary' | 'snippet' | 'question' | 'convert_to_snippets', data: any } | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveFolderId, setSaveFolderId] = useState<string>("root");
  const [saveImage, setSaveImage] = useState<string | null>(null); 
  const [lightboxImage, setLightboxImage] = useState<string | null>(null); 
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, text: string } | null>(null);
  const [activeTranslation, setActiveTranslation] = useState<{ x: number, y: number, text: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showManualSnippetModal, setShowManualSnippetModal] = useState(false);
  const [manualSnippetData, setManualSnippetData] = useState({ text: "", sourceTitle: "مقتطف يدوي", folderId: "f_s", image: null as string | null });
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<{folders: number, history: number, notes: number, tasksCount: number} | null>(null);
  const [importStep, setImportStep] = useState<'idle' | 'analyzing' | 'confirming' | 'restoring'>('idle');
  
  // TASKS / PLANNER STATE
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTasksSidebar, setShowTasksSidebar] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  
  // TEMPLATE 2 OPTIONS STATE
  const [showTemplate2Modal, setShowTemplate2Modal] = useState<{summaryText: string, skipMainText: boolean} | null>(null);
  const [template2Options, setTemplate2Options] = useState({
    includeEnglishSummary: true,
    includeDoctorNotes: true,
    includeAdditionalNotes: true,
    includeArabicGuide: true,
    includePastQuestions: true,
    includeExpectedQuestions: true,
    removeFakeInfoConfirm: true,
    separateLectures: false,
    enableMathSuperCheck: true,
    closePastExamGaps: true,
    onlyImportantExamPoints: false,
    lectureConfigs: {} as Record<string, { include: boolean, customName: string }>
  });

  // DAILY SUMMARY EXAM REVIEW / IMPORTANT POINTS ONLY STATE
  const [dailyOnlyImportantExamPoints, setDailyOnlyImportantExamPoints] = useState<boolean>(false);
  const [isDistillingImportant, setIsDistillingImportant] = useState<boolean>(false);
  const [originalFullSummary, setOriginalFullSummary] = useState<string | null>(null);

  // HTML EXPORT MODAL STATE
  const [showHtmlExportModal, setShowHtmlExportModal] = useState<string | null>(null);
  const [htmlExportOptions, setHtmlExportOptions] = useState({
    includeEnglishSummary: true,
    includeArabicGuide: true,
    includePastQuestions: true,
    includeExpectedQuestions: true,
    includeDoctorNotes: true,
    removeExtraneousInfo: true,
    ensureAllPastQuestions: true,
    enableMathSuperCheck: true,
  });

  // GENERATION SETTINGS STATE
  const [generationCount, setGenerationCount] = useState<number>(15);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customIncludeGuide, setCustomIncludeGuide] = useState<boolean>(false);
  const [customIncludeMainSummary, setCustomIncludeMainSummary] = useState<boolean>(true);
  const [doubleCheckEnabled, setDoubleCheckEnabled] = useState<boolean>(false);
  const [verifyPastQuestionsFirstEnabled, setVerifyPastQuestionsFirstEnabled] = useState<boolean>(false);
  const [cachedPastQuestions, setCachedPastQuestions] = useState<MatchedQuestion[] | null>(null);
  const [customIncludePastExams, setCustomIncludePastExams] = useState<boolean>(false);
  const [customIncludePredictions, setCustomIncludePredictions] = useState<boolean>(false);
  const [customExportAllPastExams, setCustomExportAllPastExams] = useState<boolean>(false);
  const [directExportComprehensive, setDirectExportComprehensive] = useState<boolean>(true);
  const [megaConcise, setMegaConcise] = useState<boolean>(false);

  // TEMPLATE 2 SMART EXPORT STATE
  const [template2SmartFormat, setTemplate2SmartFormat] = useState<'html' | 'print'>('html');
  const [template2AntiIntruder, setTemplate2AntiIntruder] = useState<boolean>(true);
  const [template2CloseExamGaps, setTemplate2CloseExamGaps] = useState<boolean>(true);

  // STATE TO ENSURE KATEX RELOADS PROPERLY
  const [katexLoaded, setKatexLoaded] = useState(false);
  
  // DRAG AND DROP & RENAME STATE
  const [draggedItem, setDraggedItem] = useState<{ type: string, id: string | number, sourceFolderId: string, data: any } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [renamingTarget, setRenamingTarget] = useState<{ id: string, name: string, type: 'fav_folder' | 'note_folder' } | null>(null);

  // SMART FORMATTING STATE
  const [isFormatting, setIsFormatting] = useState(false);
  const [isCorrectingCode, setIsCorrectingCode] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<{ original: string, formatted: string } | null>(null);

  useEffect(() => { if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); } }, [isDarkMode]);

  // EFFECT TO POLL FOR KATEX LOAD (FIX FOR MATH RENDERING RACE CONDITION)
  useEffect(() => {
    if (typeof window !== 'undefined') {
       if (window.katex) {
          setKatexLoaded(true);
       } else {
          const interval = setInterval(() => {
             if (window.katex) {
                setKatexLoaded(true);
                clearInterval(interval);
             }
          }, 500);
          return () => clearInterval(interval);
       }
    }
  }, []);

  const DEFAULT_FOLDERS: QuestionFolder[] = [
    { id: 'f_s', name: 'مقتطفات ومعلومات', type: 'snippets', subFolders: [], questions: [], snippets: [], archives: [], createdAt: new Date() }
  ];

  useEffect(() => {
    const initData = async () => {
      try {
        const dbFolders = await storageService.getFolders();
        const dbHistory = await storageService.getHistory();
        const dbNotes = await storageService.getNotes();
        const dbTasks = await storageService.getTasks();

        if (dbFolders && Array.isArray(dbFolders) && dbFolders.length > 0) {
            // Filter out the old default folders that are no longer needed
            const filteredFolders = safeFolderParse(dbFolders).filter(f => 
              f.id === 'f_s' || (!['f_q', 'f_z', 'f_m'].includes(f.id))
            );
            
            // Ensure f_s exists
            if (!filteredFolders.find(f => f.id === 'f_s')) {
               filteredFolders.push(DEFAULT_FOLDERS[0]);
            }
            
            setFolders(filteredFolders);
        } else {
            // Restore default structure if DB is empty or invalid
            setFolders(DEFAULT_FOLDERS);
        }

        if (dbHistory && Array.isArray(dbHistory)) setHistory(dbHistory.map((h: any) => ({ ...h, date: new Date(h.date), questions: h.questions || [] })));
        if (dbNotes && Array.isArray(dbNotes)) setNoteFolders(safeNotesParse(dbNotes));
        else setNoteFolders([]); 

        if (dbTasks && Array.isArray(dbTasks)) setTasks(dbTasks.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })));
        else setTasks([]);

      } catch (err) { 
          console.error("Init Data Error:", err); 
          // Fallback to default if everything fails
          setFolders(DEFAULT_FOLDERS);
      } finally { 
          setIsDataLoaded(true); 
      }
    };
    initData();
  }, []);



  // DEBOUNCED SAVING
  useEffect(() => { 
      if (isDataLoaded && !isImporting) {
          const timeout = setTimeout(() => {
              storageService.saveFolders(folders); 
          }, 1000); 
          return () => clearTimeout(timeout);
      } 
  }, [folders, isDataLoaded, isImporting]);

  useEffect(() => { 
      if (isDataLoaded && !isImporting) {
          const timeout = setTimeout(() => {
              storageService.saveHistory(history); 
          }, 1000);
          return () => clearTimeout(timeout);
      } 
  }, [history, isDataLoaded, isImporting]);

  useEffect(() => { 
      if (isDataLoaded && !isImporting) {
          const timeout = setTimeout(() => {
              storageService.saveNotes(noteFolders); 
          }, 1000);
          return () => clearTimeout(timeout);
      } 
  }, [noteFolders, isDataLoaded, isImporting]);

  useEffect(() => { 
    if (isDataLoaded && !isImporting) {
        const timeout = setTimeout(() => {
            storageService.saveTasks(tasks); 
        }, 1000);
        return () => clearTimeout(timeout);
    } 
  }, [tasks, isDataLoaded, isImporting]);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Allow global selection box to appear even in preview/divs, but not in specific editors if handled internally
      // REMOVED the check that prevented it in textareas, so it works everywhere now for 'SelectionBox' state
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 2) {
        let x = e.clientX; let y = e.clientY;
        if (selection && selection.rangeCount > 0) { const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect(); x = rect.left + (rect.width / 2); y = rect.top; }
        // Offset Y slightly up to appear above text
        setSelectionBox({ x, y: y - 50, text });
      } else { 
          // Only clear if we are not clicking ON the selection box itself
          const target = e.target as HTMLElement;
          if (!target.closest('.selection-bubble')) {
             setSelectionBox(null); 
             if (activeTranslation && !target.closest('.translation-bubble')) setActiveTranslation(null); 
          }
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [activeTranslation]);

  // --- TASK MANAGER LOGIC ---
  const addTask = () => {
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTaskText,
      status: 'pending',
      createdAt: new Date()
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTaskText("");
    soundService.playSuccess();
  };

  const updateTaskStatus = (id: string, status: 'completed' | 'failed') => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        // Toggle behavior: if already this status, go back to pending
        return { ...t, status: t.status === status ? 'pending' : status };
      }
      return t;
    }));
    if (status === 'completed') soundService.playSuccess();
    else soundService.playError();
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    soundService.playPop();
  };
  // --------------------------

  // --- PDF EXPORT LOGIC (ENGLISH ONLY & LTR) ---
  const handleExportQuizToGoogleForm = () => {
    if (!results || results.length === 0) return;
    soundService.playMagic();
    const questionsDataString = results.map(q => {
        const pQ = JSON.stringify(q.question);
        const pChoices = JSON.stringify(q.options);
        const pCorrect = JSON.stringify(q.correctAnswer);
        return `{ question: ${pQ}, choices: ${pChoices}, correct: ${pCorrect} }`;
    }).join(",\n      ");
    
    const script = `\`\`\`javascript
function doGet() {
  var html = \`
    <h2 style="text-align:center; color:#1a73e8;">إنشاء الاختبار</h2>
    <p style="text-align:center;">اضغط الزر لإنشاء الاختبار</p>
    <div style="text-align:center; margin:40px 0;">
      <button id="createBtn" onclick="createQuizNow()" style="padding:16px 32px; font-size:18px; background:#1a73e8; color:white; border:none; border-radius:8px; cursor:pointer;">إنشاء الاختبار الآن</button>
    </div>
    <div id="result" style="text-align:center; margin-top:30px; font-size:17px; line-height:1.6;"></div>
    <script>
      function createQuizNow() {
        document.getElementById("createBtn").disabled = true;
        document.getElementById("createBtn").textContent = "جاري الإنشاء...";
        google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onError).createMedicalQuiz();
      }
      function onSuccess(data) {
        document.getElementById("result").innerHTML = "<p style='color:green;'>✅ تم إنشاء الاختبار بنجاح!</p>";
        
        var p = document.createElement("p");
        p.innerHTML = "<strong>رابط التعديل للمدير:</strong><br><a href='" + data.editUrl + "' target='_blank' style='color:#1a73e8; word-break:break-all;'>" + data.editUrl + "</a>";
        document.getElementById("result").appendChild(p);

        var p2 = document.createElement("p");
        p2.innerHTML = "<em>(ملاحظة: تأكد من مراجعة الإجابات الصحيحة في الإعدادات بشكل نهائي إن لزم الأمر)</em>";
        document.getElementById("result").appendChild(p2);

        var p3 = document.createElement("p");
        p3.innerHTML = "<strong>رابط الاختبار للطلاب (نشر):</strong><br><a href='" + data.publishedUrl + "' target='_blank' style='color:#1a73e8; word-break:break-all;'>" + data.publishedUrl + "</a>";
        document.getElementById("result").appendChild(p3);

        var btn = document.createElement("button");
        btn.textContent = "فتح الاختبار للطلاب";
        btn.style.cssText = "padding:10px 20px; background:#34a853; color:white; border:none; border-radius:6px; cursor:pointer; margin-top:15px;";
        btn.onclick = function() { window.open(data.publishedUrl, '_blank'); };
        document.getElementById("result").appendChild(btn);
      }
      function onError(error) {
        document.getElementById("result").innerHTML = "<p style='color:red;'>❌ حدث خطأ: " + error.message + "</p>";
        console.error(error);
      }
    </script>
  \`;
  return HtmlService.createHtmlOutput(html).setTitle("إنشاء اختبار").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createMedicalQuiz() {
  try {
    const form = FormApp.create('اختبار مراجعة - Exam Matcher AI');
    form.setIsQuiz(true);
    form.setDescription('اختبار مراجعة من إنشاء النظام الذكي للوقوف على مستوى الطالب ومراجعة المحاضرات.');

    form.addTextItem().setTitle('الاسم الرباعي').setRequired(true);

    const questionsData = [
      ${questionsDataString}
    ];

    questionsData.forEach(q => {
      const item = form.addMultipleChoiceItem();
      item.setTitle(q.question);
      item.setPoints(1);
      item.setRequired(true);
      const choices = q.choices.map(choice => item.createChoice(choice, choice === q.correct));
      item.setChoices(choices);
    });

    form.addParagraphTextItem().setTitle('ملاحظات (اختياري)').setHelpText('اكتب ملاحظاتك إذا كان هناك شيء تود تعديله أو الاستفسار عنه.').setRequired(false);

    return { editUrl: form.getEditUrl(), publishedUrl: form.getPublishedUrl() };
  } catch (err) {
    throw new Error(err.toString());
  }
}
\`\`\``;

    setAppMode('google_form');
    setTextResult(script);
  };

  const handleExportPDF = (questionsToExport: MatchedQuestion[]) => {
    if (!questionsToExport || questionsToExport.length === 0) return;
    soundService.playMechanical();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the file.");
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html lang="en" dir="ltr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Practice Exam - Exam Matcher AI</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; direction: ltr; }
          h1 { text-align: center; color: #4f46e5; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
          .question-block { margin-bottom: 30px; page-break-inside: avoid; }
          .q-text { font-weight: 600; font-size: 18px; margin-bottom: 12px; line-height: 1.5; }
          .options { list-style-type: none; padding: 0; }
          .option { padding: 12px 16px; font-size: 16px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s; background: #f8fafc; }
          .option:hover { background: #e2e8f0; }
          .option.correct { background: #10b981 !important; color: white !important; border-color: #10b981 !important; }
          .option.incorrect { background: #ef4444 !important; color: white !important; border-color: #ef4444 !important; }
          .key-page { page-break-before: always; margin-top: 50px; }
          .key-item { margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
          .correct-ans { color: #059669; font-weight: bold; }
          .reason { color: #475569; font-size: 14px; margin-top: 8px; font-style: italic; line-height: 1.6; background: #f8fafc; padding: 10px; border-radius: 8px; }
          .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 50px; }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            button { display: none; }
          }
          @media (max-width: 768px) {
            body { padding: 15px; }
            .question-block { margin-bottom: 20px; }
            .option { padding: 10px 12px; font-size: 15px; }
            h1 { font-size: 1.5rem; margin-bottom: 20px; padding-bottom: 10px; }
          }
        </style>
      </head>
      <body>
        <h1>Practice Exam</h1>
        
        <div class="questions">
          ${questionsToExport.map((q, i) => {
            const isDirRtl = isArabicText(q.question);
            return `
            <div class="question-block" dir="${isDirRtl ? 'rtl' : 'ltr'}" style="text-align: ${isDirRtl ? 'right' : 'left'};">
              <div class="q-text"><span dir="ltr">Q${i+1}:</span> ${q.question}</div>
              <ul class="options" data-answered="false">
                ${q.options.map((opt, optIdx) => {
                  const isCorrect = opt === q.correctAnswer;
                  const safeOpt = opt.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                  return `
                  <li class="option" onclick="checkAns(this, ${isCorrect})">
                    <span style="font-weight:bold; ${isDirRtl ? 'margin-left:8px;' : 'margin-right:8px;'}" dir="ltr">${String.fromCharCode(65+optIdx)}.</span> ${safeOpt}
                  </li>
                  `;
                }).join('')}
              </ul>
            </div>
            `;
          }).join('')}
        </div>

        <div class="key-page">
          <h1>Answer Key & Explanations</h1>
          ${questionsToExport.map((q, i) => {
            const isRtlReason = isArabicText(q.reason);
            const isRtlAns = isArabicText(q.correctAnswer);
            return `
            <div class="key-item">
              <div style="font-weight:bold; margin-bottom:5px; font-size: 16px; text-align: ${isRtlAns ? 'right' : 'left'};" dir="${isRtlAns ? 'rtl' : 'ltr'}"><span dir="ltr">Q${i+1}: </span><span class="correct-ans">${q.correctAnswer}</span></div>
              <div class="reason" dir="${isRtlReason ? 'rtl' : 'ltr'}" style="text-align: ${isRtlReason ? 'right' : 'left'};"><strong>Rationale:</strong> ${q.reason}</div>
            </div>
            `;
          }).join('')}
        </div>
        
        <div class="footer">Generated by Exam Matcher AI</div>

        <script>
          function checkAns(el, isCorrect) {
            const parent = el.parentNode;
            if (parent.getAttribute('data-answered') === 'true') return;
            parent.setAttribute('data-answered', 'true');
            
            if (isCorrect) {
              el.classList.add('correct');
            } else {
              el.classList.add('incorrect');
              Array.from(parent.children).forEach(li => {
                if (li.getAttribute('onclick').includes('true')) {
                  li.classList.add('correct');
                }
              });
            }
          }

          // Add floating actions
          const actionsDiv = document.createElement('div');
          actionsDiv.id = 'floating-actions';
          actionsDiv.style.cssText = 'position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px; z-index: 9999; font-family: sans-serif;';
          actionsDiv.dir = 'rtl';
          
          const printBtn = document.createElement('button');
          printBtn.innerHTML = '🖨️ طباعة (PDF)';
          printBtn.style.cssText = 'background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 16px;';
          printBtn.onclick = () => window.print();
          
          const downloadBtn = document.createElement('button');
          downloadBtn.innerHTML = '💾 تحميل كملف HTML';
          downloadBtn.style.cssText = 'background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 16px;';
          downloadBtn.onclick = () => {
            const htmlContent = document.documentElement.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Practice_Exam.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          };
          
          actionsDiv.appendChild(printBtn);
          actionsDiv.appendChild(downloadBtn);
          
          const style = document.createElement('style');
          style.innerHTML = '@media print { #floating-actions { display: none !important; } .correct-answer-box { display: block !important; } }';
          
          window.onload = function() {
            if (!document.getElementById('floating-actions')) {
              document.body.appendChild(actionsDiv);
            }
            if (!document.querySelector('style[data-practice-exams-style]')) {
              style.setAttribute('data-practice-exams-style', 'true');
              document.head.appendChild(style);
            }
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };
  // -------------------------

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportStatusText, setExportStatusText] = useState<string>('');

  const handleExportSummaryPDFTemplate2 = async (
    summaryText: string, 
    options: typeof template2Options,
    exportMode: 'print' | 'html' = 'print'
  ) => {
    const isExportAllPastExams = appMode === 'direct_export' && customExportAllPastExams;
    if (!summaryText && !isExportAllPastExams) return;
    soundService.playMechanical();

    setIsExportingPDF(true);
    setExportStatusText("جاري فحص وتجهيز محتوى المحاضرة بالقالب 2...");
    try {
      const allFilesForExport = isExportAllPastExams ? [...pastExamFiles, ...lectureFiles] : pastExamFiles;
      const questionFilesText = allFilesForExport
        .map(f => `--- File: ${f.name} ---\n${f.text || ''}`)
        .join('\n\n');

      const includeGuide = options.includeArabicGuide;
      const includePast = options.includePastQuestions;
      const includePredictions = options.includeExpectedQuestions;
      const finalSkipMainText = !options.includeEnglishSummary;
      const strictPast = ((options as any).ensureAllPastQuestions ?? options.includePastQuestions);

      // FIRST PASS AI MATH & SCIENTIFIC NOTATION CORRECTOR
      let preprocessedText = summaryText;
      let preprocessedDoctorNotes = doctorNotesFiles;
      let preprocessedAdditionalNotes = additionalDoctorNotesFiles;

      if (options.enableMathSuperCheck && !isExportAllPastExams) {
        setExportStatusText("جاري فحص وتصحيح المعادلات والرموز الرياضية بالقالب 2...");
        try {
          if (summaryText && summaryText.trim()) {
            preprocessedText = await correctMathAndScientificNotation(summaryText);
          }
          if (doctorNotesFiles && doctorNotesFiles.length > 0) {
            preprocessedDoctorNotes = await Promise.all(doctorNotesFiles.map(async f => {
              if (f.text && f.text.trim()) {
                try {
                  const fixed = await correctMathAndScientificNotation(f.text);
                  return { ...f, text: fixed };
                } catch (e) { return f; }
              }
              return f;
            }));
          }
          if (additionalDoctorNotesFiles && additionalDoctorNotesFiles.length > 0) {
            preprocessedAdditionalNotes = await Promise.all(additionalDoctorNotesFiles.map(async f => {
              if (f.text && f.text.trim()) {
                try {
                  const fixed = await correctMathAndScientificNotation(f.text);
                  return { ...f, text: fixed };
                } catch (e) { return f; }
              }
              return f;
            }));
          }
        } catch (mathErr) {
          console.warn("First-pass AI Math check failed:", mathErr);
          throw mathErr;
        }
      }

      // DISTILL TO HIGH-YIELD EXAM REVIEW IF REQUESTED
      if ((options.onlyImportantExamPoints || (appMode === 'summary' && dailyOnlyImportantExamPoints)) && !isExportAllPastExams) {
        setExportStatusText("جاري تركيز المحتوى على الركائز الامتحانية المهمة...");
        try {
          if (preprocessedText && preprocessedText.trim()) {
            preprocessedText = await distillToExamImportantPoints(preprocessedText);
          }
        } catch (distillErr) {
          console.warn("Distill to exam points failed:", distillErr);
          throw distillErr;
        }
      }

      setExportStatusText("جاري توليد وتنسيق ملف HTML المنقح (قالب 2)...");
      const [formattedHtml, examsHtml] = await Promise.all([
        isExportAllPastExams ? Promise.resolve('') : formatSummaryForPDFTemplate2(
            preprocessedText, 
            options.includeArabicGuide, 
            finalSkipMainText, 
            options.includeDoctorNotes ? preprocessedDoctorNotes : [], 
            false, // doubleCheckNotes 
            options.removeFakeInfoConfirm, 
            lectureFiles, 
            options.includeAdditionalNotes ? preprocessedAdditionalNotes : [],
            options.separateLectures,
            options.lectureConfigs,
            options.enableMathSuperCheck
        ),
        (!options.includePastQuestions && !options.includeExpectedQuestions && !isExportAllPastExams) ? Promise.resolve('') : generateExamsForPDF(
            preprocessedText, 
            questionFilesText, 
            options.includePastQuestions, 
            options.includeExpectedQuestions, 
            strictPast, 
            isExportAllPastExams, 
            allFilesForExport, 
            options.removeFakeInfoConfirm, 
            cachedPastQuestions ? JSON.stringify(cachedPastQuestions) : ""
        )
      ]);
      
      if (!isExportAllPastExams && (!formattedHtml || formattedHtml.trim() === '')) {
         throw new Error("عذراً، فشل الذكاء الاصطناعي في توليد المحتوى وأرجع ملفاً فارغاً بسبب حجم البيانات. يرجى تقليل مساحة النص أو المحاولة لاحقاً.");
      }

      let content = formattedHtml;
      
      if (isExportAllPastExams) {
        content = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Past Exams - Interactive Export</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 20px; text-align: left; direction: ltr; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    h1 { color: #1e293b; margin-bottom: 30px; text-align: center; font-size: 2em; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .generated-exams-section { text-align: left; margin-top: 20px; }
    .mcq-option { margin-bottom: 10px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: white; font-weight: bold; word-wrap: break-word; overflow-wrap: break-word; }
    .mcq-option:hover { background: #f1f5f9; border-color: #94a3b8; }
    .correct-answer-box { display: none; margin-top: 10px; padding: 12px; background-color: #f0fdf4; border-left: 4px solid #16a34a; color: #166534; font-weight: bold; border-radius: 6px; word-wrap: break-word; overflow-wrap: break-word; }
    .exam-question-item { border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 20px; border-radius: 8px; word-wrap: break-word; overflow-wrap: break-word; }
    .question-block { word-wrap: break-word; overflow-wrap: break-word; }
    .question-text { word-wrap: break-word; overflow-wrap: break-word; }
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 15px; border-radius: 8px; }
      .exam-question-item { padding: 15px; }
      h1 { font-size: 1.5em; margin-bottom: 20px; padding-bottom: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Past Exams</h1>
  </div>
</body>
</html>`;
      }
      
      const scriptToInject = `
        ${examsHtml ? `<div class="generated-exams-section" style="width: 100%; clear: both; display: block;">
          ${examsHtml}
        </div>` : ''}
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&family=Comic+Neue:ital,wght@0,400;0,700;1,700&family=Kalam:wght@400;700&family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <script>
          // Resilient & Instant KaTeX Auto-Render Helper
          function renderMathFormulas() {
            if (typeof renderMathInElement === 'function') {
              try {
                renderMathInElement(document.body, {
                  delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\\\(', right: '\\\\)', display: false},
                    {left: '\\\\[', right: '\\\\]', display: true}
                  ],
                  throwOnError: false,
                  errorColor: '#b91c1c',
                  strict: false,
                  ignoredTags: ["script", "noscript", "style", "textarea", "option"]
                });
                return true;
              } catch(err) {
                console.warn("Math rendering error:", err);
                return false;
              }
            }
            return false;
          }

          // Trigger immediately and poll until KaTeX is fully ready
          (function() {
            var rendered = renderMathFormulas();
            var attempts = 0;
            var timer = setInterval(function() {
              attempts++;
              if (renderMathFormulas() || attempts > 150) {
                clearInterval(timer);
              }
            }, 40);

            document.addEventListener('DOMContentLoaded', renderMathFormulas);
            window.addEventListener('load', renderMathFormulas);
            setTimeout(renderMathFormulas, 150);
            setTimeout(renderMathFormulas, 500);
            setTimeout(renderMathFormulas, 1200);
            setTimeout(renderMathFormulas, 2500);
          })();

          // Comprehensive Interactive MCQ Engine
          function checkAnswer(el) {
            if (!el) return;
            // Support clicking anywhere inside the option
            var optionEl = (el.closest && el.closest('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option')) || el;
            
            // Find the closest question container
            var questionContainer = (optionEl.closest && optionEl.closest('.question-block, .question-box, .exam-question-item, .question-item, [data-question-block]')) || optionEl.parentElement;
            
            // Check if this specific question is already answered
            if (questionContainer && questionContainer !== document.body && !questionContainer.classList.contains('container') && !questionContainer.classList.contains('generated-exams-section') && !questionContainer.classList.contains('tab-content')) {
              if (questionContainer.getAttribute('data-answered') === 'true') return;
              questionContainer.setAttribute('data-answered', 'true');
            } else if (optionEl.getAttribute('data-answered') === 'true') {
              return;
            }
            optionEl.setAttribute('data-answered', 'true');
            
            // Locate all options for THIS specific question
            var siblingOptions = [];
            if (questionContainer && questionContainer !== document.body && !questionContainer.classList.contains('container') && !questionContainer.classList.contains('generated-exams-section') && !questionContainer.classList.contains('tab-content')) {
              siblingOptions = Array.from(questionContainer.querySelectorAll('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option'));
            }
            if (!siblingOptions || siblingOptions.length === 0 || siblingOptions.length > 8) {
              var directParent = optionEl.parentElement;
              if (directParent) {
                siblingOptions = Array.from(directParent.querySelectorAll('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option'));
              }
            }
            if (!siblingOptions || siblingOptions.length === 0) {
              siblingOptions = [optionEl];
            }

            // Find the correct answer box for THIS specific question
            var answerBox = null;
            if (questionContainer && questionContainer !== document.body && !questionContainer.classList.contains('container') && !questionContainer.classList.contains('generated-exams-section') && !questionContainer.classList.contains('tab-content')) {
              answerBox = questionContainer.querySelector('.correct-answer-box, .answer-box, .correct-answer, [class*="correct-answer"]');
            }
            if (!answerBox) {
              // Search upcoming sibling elements
              var nextNode = (optionEl.parentElement ? optionEl.parentElement.nextElementSibling : null) || optionEl.nextElementSibling;
              while (nextNode) {
                if (nextNode.matches && (nextNode.matches('.correct-answer-box, .answer-box, .correct-answer') || nextNode.querySelector('.correct-answer-box'))) {
                  answerBox = nextNode.matches('.correct-answer-box, .answer-box, .correct-answer') ? nextNode : nextNode.querySelector('.correct-answer-box');
                  break;
                }
                if (nextNode.matches && nextNode.matches('.question-block, .question-box, .exam-question-item')) break;
                nextNode = nextNode.nextElementSibling;
              }
            }

            // Extract the expected letter or text from answer box if available
            var answerBoxText = answerBox ? (answerBox.textContent || answerBox.innerText || '').trim() : '';
            var expectedLetter = '';
            var letterMatch = answerBoxText.match(/(?:Answer|Correct Answer|الإجابة|الجواب)\s*[:：\-]?\s*\(?([A-Ea-e1-5])\)?/i);
            if (letterMatch) {
              expectedLetter = letterMatch[1].toUpperCase();
            }

            // Determine if the clicked option is correct
            var dataCorrect = (optionEl.getAttribute('data-correct') || optionEl.getAttribute('data-is-correct') || '').toLowerCase().trim();
            var optionText = (optionEl.textContent || optionEl.innerText || '').trim();
            var optionLetterMatch = optionText.match(/^\s*\(?([A-Ea-e1-5])[\)\.\-:\s]/);
            var currentOptionLetter = optionLetterMatch ? optionLetterMatch[1].toUpperCase() : '';

            var isCorrect = (dataCorrect === 'true' || dataCorrect === '1');
            if (!isCorrect && expectedLetter && currentOptionLetter && currentOptionLetter === expectedLetter) {
              isCorrect = true;
            }
            if (!isCorrect && answerBoxText && optionText && optionText.length > 2) {
              var cleanOption = optionText.replace(/^\s*\(?[A-Ea-e1-5][\)\.\-:\s]\s*/, '').trim().toLowerCase();
              if (cleanOption.length > 3 && answerBoxText.toLowerCase().includes(cleanOption)) {
                isCorrect = true;
              }
            }

            // Apply styles to the clicked option
            if (isCorrect) {
              optionEl.style.setProperty('background-color', '#10b981', 'important');
              optionEl.style.setProperty('color', '#ffffff', 'important');
              optionEl.style.setProperty('border-color', '#059669', 'important');
              optionEl.setAttribute('data-state', 'correct');
            } else {
              optionEl.style.setProperty('background-color', '#ef4444', 'important');
              optionEl.style.setProperty('color', '#ffffff', 'important');
              optionEl.style.setProperty('border-color', '#dc2626', 'important');
              optionEl.setAttribute('data-state', 'incorrect');
              
              // Highlight the true correct option among siblings
              var foundCorrectSibling = false;
              siblingOptions.forEach(function(child) {
                var childDataCorrect = (child.getAttribute('data-correct') || child.getAttribute('data-is-correct') || '').toLowerCase().trim();
                var childText = (child.textContent || child.innerText || '').trim();
                var childLetterMatch = childText.match(/^\s*\(?([A-Ea-e1-5])[\)\.\-:\s]/);
                var childLetter = childLetterMatch ? childLetterMatch[1].toUpperCase() : '';
                
                var isChildCorrect = (childDataCorrect === 'true' || childDataCorrect === '1');
                if (!isChildCorrect && expectedLetter && childLetter && childLetter === expectedLetter) {
                  isChildCorrect = true;
                }
                if (isChildCorrect) {
                  child.style.setProperty('background-color', '#10b981', 'important');
                  child.style.setProperty('color', '#ffffff', 'important');
                  child.style.setProperty('border-color', '#059669', 'important');
                  child.setAttribute('data-state', 'correct');
                  foundCorrectSibling = true;
                }
              });

              if (!foundCorrectSibling && expectedLetter) {
                siblingOptions.forEach(function(child) {
                  var childText = (child.textContent || child.innerText || '').trim();
                  if (childText.toUpperCase().startsWith(expectedLetter + ')') || 
                      childText.toUpperCase().startsWith(expectedLetter + '.') || 
                      childText.toUpperCase().startsWith('(' + expectedLetter + ')')) {
                    child.style.setProperty('background-color', '#10b981', 'important');
                    child.style.setProperty('color', '#ffffff', 'important');
                    child.style.setProperty('border-color', '#059669', 'important');
                    child.setAttribute('data-state', 'correct');
                  }
                });
              }
            }

            // Disable further clicks on siblings
            siblingOptions.forEach(function(opt) {
              opt.setAttribute('data-disabled', 'true');
              opt.style.cursor = 'default';
            });

            // Reveal the correct answer box for this question
            if (answerBox) {
              answerBox.style.setProperty('display', 'block', 'important');
              answerBox.style.setProperty('visibility', 'visible', 'important');
            }
          }
          window.checkAnswer = checkAnswer;

          // Global Event Delegation for clicks (ensures clicking works even if inline onclick is missing or wrapped)
          document.addEventListener('click', function(event) {
            var target = event.target;
            if (!target) return;
            var option = target.closest ? target.closest('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option') : null;
            if (option) {
              checkAnswer(option);
            }
          });

          const actionsDiv = document.createElement('div');
          actionsDiv.id = 'floating-actions';
          actionsDiv.style.cssText = 'position: fixed; bottom: 24px; right: 24px; display: flex; gap: 12px; z-index: 9999; font-family: system-ui, -apple-system, sans-serif;';
          actionsDiv.dir = 'rtl';
          
          const printBtn = document.createElement('button');
          printBtn.innerHTML = '🖨️ طباعة (PDF)';
          printBtn.style.cssText = 'background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 14px rgba(79,70,229,0.3); font-size: 15px; transition: transform 0.15s;';
          printBtn.onclick = () => {
            renderMathFormulas();
            setTimeout(() => window.print(), 100);
          };
          
          const downloadBtn = document.createElement('button');
          downloadBtn.innerHTML = '💾 تحميل كملف HTML';
          downloadBtn.style.cssText = 'background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.3); font-size: 15px; transition: transform 0.15s;';
          downloadBtn.onclick = () => {
            renderMathFormulas();
            const htmlContent = document.documentElement.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Golden_Summary_Template2.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          };
          
          actionsDiv.appendChild(printBtn);
          actionsDiv.appendChild(downloadBtn);
          
          const style = document.createElement('style');
          style.innerHTML = \`
            @media print { 
              #floating-actions { display: none !important; } 
              .correct-answer-box { display: block !important; } 
              .tab-content, .file-tab-content, #core-summary-section, #doctor-notes-section, #arabic-guide-section, #past-exams-section, #prediction-exams-section { display: block !important; } 
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { margin: 12mm; size: auto; }
              body { padding: 0 !important; background: white !important; font-family: 'Inter', -apple-system, sans-serif !important; }
              .template2-document, .container { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
            }
            body { 
              margin: 0; 
              padding: 24px 16px; 
              background-color: #f8fafc; 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              box-sizing: border-box; 
              color: #1e293b;
              -webkit-font-smoothing: antialiased;
            }
            .template2-document { 
              max-width: 1020px !important; 
              width: 100% !important; 
              margin: 0 auto !important; 
              min-height: 100%; 
              box-sizing: border-box; 
              background: #ffffff; 
              padding: 52px 64px; 
              border-radius: 16px; 
              box-shadow: 0 10px 40px rgba(0,0,0,0.06); 
            }
            .container:not(.template2-document) {
              max-width: 1020px !important;
              width: 100% !important;
              margin: 0 auto !important;
              background: #ffffff;
              padding: 48px 56px;
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.06);
              box-sizing: border-box;
            }
            @media (max-width: 768px) {
              body { padding: 10px 6px; }
              .template2-document, .container { padding: 24px 18px !important; border-radius: 10px; }
            }
            .tab-content, .file-tab-content, #core-summary-section, #doctor-notes-section, #arabic-guide-section, #past-exams-section, #prediction-exams-section {
              display: block !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              padding: 0;
            }
            .generated-exams-section {
               display: block !important;
               break-before: auto; page-break-before: auto;
               margin-top: 36px;
               max-width: 1020px;
               margin-left: auto;
               margin-right: auto;
            }
            .katex { direction: ltr !important; unicode-bidi: isolate !important; text-align: left; font-size: 1.06em !important; }
            .katex-display { direction: ltr !important; text-align: center; margin: 18px 0 !important; overflow-x: auto; padding: 6px 0; }
            .math-block { direction: ltr !important; text-align: center; background: #faf8f5 !important; border: 1.5px solid #e7ded5 !important; border-radius: 10px !important; padding: 14px 20px !important; margin: 16px 0 !important; overflow-x: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important; }
            .clinical-pearls-box { background-color: #f0fdf4 !important; border: 1.5px solid #a7f3d0 !important; border-radius: 16px !important; padding: 22px 24px !important; margin: 24px 0 !important; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.05) !important; text-align: left !important; direction: ltr !important; page-break-inside: avoid !important; break-inside: avoid !important; }
            .clinical-pearls-box h3 { color: #065f46 !important; font-size: 20px !important; font-weight: 900 !important; margin: 0 0 16px 0 !important; display: flex !important; align-items: center !important; gap: 8px !important; }
            .clinical-pearls-box strong { color: #064e3b !important; font-weight: 800 !important; }
            .mcq-option {
              margin-bottom: 12px !important;
              padding: 14px 18px !important;
              border: 1.5px solid #cbd5e1 !important;
              border-radius: 10px !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
              background: #ffffff !important;
              font-weight: 600 !important;
              font-size: 15px !important;
              color: #1e293b !important;
              display: block !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              user-select: none !important;
              box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
            }
            .mcq-option:hover:not([data-disabled="true"]) {
              background: #f1f5f9 !important;
              border-color: #6366f1 !important;
              transform: translateY(-1px) !important;
              box-shadow: 0 4px 10px rgba(99,102,241,0.1) !important;
            }
            .correct-answer-box {
              display: none;
              margin-top: 14px !important;
              padding: 14px 18px !important;
              background-color: #f0fdf4 !important;
              border-left: 5px solid #16a34a !important;
              border-right: 1px solid #bbf7d0 !important;
              border-top: 1px solid #bbf7d0 !important;
              border-bottom: 1px solid #bbf7d0 !important;
              color: #166534 !important;
              font-weight: 700 !important;
              font-size: 15px !important;
              border-radius: 8px !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              box-shadow: 0 2px 6px rgba(22,163,74,0.06) !important;
            }
            .question-block, .question-box, .exam-question-item {
              border: 1.5px solid #e2e8f0 !important;
              padding: 24px !important;
              margin-bottom: 24px !important;
              border-radius: 14px !important;
              background: #ffffff !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .question-text {
              font-weight: 800 !important;
              margin-bottom: 18px !important;
              font-size: 1.15rem !important;
              color: #0f172a !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              line-height: 1.6 !important;
            }
          \`;
          
          function initTemplate2Enhancements() {
            renderMathFormulas();
            if (!document.getElementById('floating-actions')) {
               document.body.appendChild(actionsDiv);
            }
            if (!document.querySelector('style[data-clean-doc-style]')) {
               style.setAttribute('data-clean-doc-style', 'true');
               document.head.appendChild(style);
            }

            // Ensure all mcq-options have pointer cursor and interactive attributes
            try {
              var opts = document.querySelectorAll('.mcq-option, [data-correct], [data-mcq-option]');
              for (var i = 0; i < opts.length; i++) {
                opts[i].style.cursor = 'pointer';
                if (!opts[i].getAttribute('tabindex')) opts[i].setAttribute('tabindex', '0');
              }
            } catch (err) {}

            let container = document.querySelector('.template2-document') || document.querySelector('.container') || document.querySelector('.summary-container');
            if (!container) {
              container = document.createElement('div');
              container.className = 'template2-document';
              const nodes = Array.from(document.body.childNodes);
              nodes.forEach(node => {
                if (node.id !== 'floating-actions' && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'LINK') {
                  container.appendChild(node);
                }
              });
              document.body.insertBefore(container, document.body.firstChild);
            } else {
              const examsSection = document.querySelector('.generated-exams-section');
              if (examsSection && examsSection.parentElement !== container) {
                container.appendChild(examsSection);
              }
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initTemplate2Enhancements);
          } else {
            initTemplate2Enhancements();
          }
          window.addEventListener('load', initTemplate2Enhancements);
        </script>
      `;

      const finalHtml = content.replace('</body>', `${scriptToInject}</body>`);
      const outputHtml = finalHtml.includes('</body>') ? finalHtml : content + scriptToInject;

      if (appMode === 'direct_export' || exportMode === 'html') {
        const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const isImportantMode = dailyOnlyImportantExamPoints || options.onlyImportantExamPoints;
        a.download = appMode === 'direct_export' 
          ? 'Direct_Export_Summary_Template2.html' 
          : (isImportantMode ? 'Daily_Summary_Important_Only_Exam_Review_Template2.html' : 'Golden_Summary_Template2.html');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        soundService.playSuccess();
        setShowHtmlExportModal(null);
        setShowTemplate2Modal(null);
      } else {
        // Print / Interactive Preview mode
        let windowOpened = false;
        try {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(outputHtml);
            printWindow.document.close();
            windowOpened = true;
          }
        } catch (pwErr) {
          console.warn("window.open blocked, using iframe printing and direct download", pwErr);
          windowOpened = false;
        }

        if (!windowOpened) {
          // If popup is blocked by the browser or iframe sandbox, fallback to hidden iframe printing
          try {
            const printIframe = document.createElement('iframe');
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);
            const doc = printIframe.contentWindow?.document;
            if (doc) {
              doc.open();
              doc.write(outputHtml);
              doc.close();
              setTimeout(() => {
                try {
                  printIframe.contentWindow?.focus();
                  printIframe.contentWindow?.print();
                } catch(e) {}
                setTimeout(() => {
                  try { document.body.removeChild(printIframe); } catch(e) {}
                }, 4000);
              }, 400);
            }
          } catch(iframeErr) {
            console.warn("Iframe printing failed:", iframeErr);
          }

          // Direct file download fallback so the user always receives their Template 2 file
          try {
            const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Golden_Summary_Template2_Printable.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch(dlErr) {
            console.warn("Direct download fallback failed:", dlErr);
          }
        }

        soundService.playSuccess();
        setShowHtmlExportModal(null);
        setShowTemplate2Modal(null);
      }
      
    } catch (error) {
      console.error("Error exporting PDF Template 2:", error);
      const message = error instanceof Error ? error.message : 'تعذر تصدير القالب الثاني.';
      setErrorMsg(message);
      setStatus(AppStatus.ERROR);
      alert(message);
      throw error;
    } finally {
      setIsExportingPDF(false);
      setExportStatusText('');
    }
  };

  const handleExportHtmlModalAction = async (mode: 'html' | 'print') => {
    if (!showHtmlExportModal) return;
    const text = showHtmlExportModal;

    const mappedOptions = {
      ...template2Options,
      includeEnglishSummary: htmlExportOptions.includeEnglishSummary,
      includeArabicGuide: htmlExportOptions.includeArabicGuide,
      includePastQuestions: htmlExportOptions.includePastQuestions,
      includeExpectedQuestions: htmlExportOptions.includeExpectedQuestions,
      includeDoctorNotes: htmlExportOptions.includeDoctorNotes,
      includeAdditionalNotes: additionalDoctorNotesFiles.length > 0,
      removeFakeInfoConfirm: htmlExportOptions.removeExtraneousInfo,
      ensureAllPastQuestions: htmlExportOptions.ensureAllPastQuestions,
      enableMathSuperCheck: htmlExportOptions.enableMathSuperCheck,
      onlyImportantExamPoints: false,
    };

    await handleExportSummaryPDFTemplate2(text, mappedOptions as any, mode);
  };

  const handleExportSummaryPDF = async (
    summaryText: string, 
    options: typeof htmlExportOptions = htmlExportOptions, 
    exportMode: 'print' | 'download' = 'print'
  ) => {
    if (!summaryText) return;
    soundService.playMechanical();

    setIsExportingPDF(true);
    setExportStatusText("جاري قراءة وتجهيز محتوى المحاضرة...");
    try {
      const questionFilesText = pastExamFiles
        .map(f => `--- File: ${f.name} ---\n${f.text || ''}`)
        .join('\n\n');

      const isCustomMode = appMode === 'custom' || appMode === 'summary_mega' || appMode === 'direct_export';
      const includeGuide = options ? options.includeArabicGuide : (isCustomMode ? customIncludeGuide : true);
      const includePast = options ? options.includePastQuestions : (isCustomMode ? customIncludePastExams : true);
      const includePredictions = options ? options.includeExpectedQuestions : (isCustomMode ? customIncludePredictions : true);
      const includeEnglish = options ? options.includeEnglishSummary : true;
      const removeExtraneous = options ? options.removeExtraneousInfo : false;
      const ensureAllPast = options ? options.ensureAllPastQuestions : false;
      const isImportantMode = appMode === 'summary' && dailyOnlyImportantExamPoints;

      let textToExport = summaryText;

      // 1. Math check if enabled
      if (options?.enableMathSuperCheck) {
        setExportStatusText("جاري فحص وتصحيح المعادلات والرموز الرياضية بالذكاء الاصطناعي...");
        try {
          textToExport = await correctMathAndScientificNotation(textToExport);
        } catch (mErr) {
          console.warn("Math check failed:", mErr);
        }
      }

      // 2. Distillation to exam-only important points if enabled
      if (isImportantMode) {
        setExportStatusText("جاري تركيز المحتوى على الركائز الامتحانية المهمة...");
        try {
          textToExport = await distillToExamImportantPoints(textToExport);
        } catch (e) {
          console.warn("Distillation failed, using original text", e);
        }
      }

      setExportStatusText("جاري تطبيق تصفية الدخيل وتضمين أسئلة السنين وتنسيق ملف HTML...");
      // Use AI to format the summary for PDF and generate exams in parallel
      const [formattedHtml, examsHtml] = await Promise.all([
        formatSummaryForPDF(textToExport, includeGuide, removeExtraneous, lectureFiles),
        (!includePast && !includePredictions) 
          ? Promise.resolve('') 
          : generateExamsForPDF(
              textToExport, 
              questionFilesText, 
              includePast, 
              includePredictions, 
              ensureAllPast, 
              false, 
              pastExamFiles, 
              removeExtraneous, 
              cachedPastQuestions ? JSON.stringify(cachedPastQuestions) : ""
            )
      ]);

      let content = formattedHtml;

      // If user unselected English summary, remove core summary section
      if (!includeEnglish) {
        content = content.replace(/<div id="core-summary-section"[\s\S]*?<\/div>\s*(?=<div id="doctor-notes|<div id="arabic-guide|<\/body|$)/i, '');
      }

      if (isImportantMode) {
        const badge = `
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 14px 20px; border-radius: 12px; margin-bottom: 24px; text-align: center; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(245,158,11,0.25);">
            ⚡ ملخص الأمور المهمة فقط - مراجعة سريعة قبل الامتحان (High-Yield Pre-Exam Review)
          </div>
        `;
        if (content.includes('<div class="container">')) {
          content = content.replace('<div class="container">', `<div class="container">${badge}`);
        } else if (content.includes('<body')) {
          content = content.replace(/<body[^>]*>/, `$&${badge}`);
        }
      }
      const scriptToInject = `
        ${examsHtml ? `<div class="generated-exams-section" style="width: 100%; clear: both; display: block;">
          ${examsHtml}
        </div>` : ''}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <script>
          // Resilient & Instant KaTeX Auto-Render Helper
          function renderMathFormulas() {
            if (typeof renderMathInElement === 'function') {
              try {
                renderMathInElement(document.body, {
                  delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\\\(', right: '\\\\)', display: false},
                    {left: '\\\\[', right: '\\\\]', display: true}
                  ],
                  throwOnError: false,
                  errorColor: '#b91c1c',
                  strict: false,
                  ignoredTags: ["script", "noscript", "style", "textarea", "option"]
                });
                return true;
              } catch(err) {
                console.warn("Math rendering error:", err);
                return false;
              }
            }
            return false;
          }

          // Trigger immediately and poll until KaTeX is fully ready
          (function() {
            var rendered = renderMathFormulas();
            var attempts = 0;
            var timer = setInterval(function() {
              attempts++;
              if (renderMathFormulas() || attempts > 150) {
                clearInterval(timer);
              }
            }, 40);

            document.addEventListener('DOMContentLoaded', renderMathFormulas);
            window.addEventListener('load', renderMathFormulas);
            setTimeout(renderMathFormulas, 150);
            setTimeout(renderMathFormulas, 500);
            setTimeout(renderMathFormulas, 1200);
            setTimeout(renderMathFormulas, 2500);
          })();

          // Comprehensive Interactive MCQ Engine
          function checkAnswer(el) {
            if (!el) return;
            // Support clicking anywhere inside the option
            var optionEl = (el.closest && el.closest('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option')) || el;
            
            // Find the closest question container
            var questionContainer = (optionEl.closest && optionEl.closest('.question-block, .question-box, .exam-question-item, .question-item, [data-question-block]')) || optionEl.parentElement;
            
            // Check if this specific question is already answered
            if (questionContainer && questionContainer !== document.body && !questionContainer.classList.contains('container') && !questionContainer.classList.contains('generated-exams-section') && !questionContainer.classList.contains('tab-content')) {
              if (questionContainer.getAttribute('data-answered') === 'true') return;
              questionContainer.setAttribute('data-answered', 'true');
            } else if (optionEl.getAttribute('data-answered') === 'true') {
              return;
            }
            optionEl.setAttribute('data-answered', 'true');
            
            // Locate all options for THIS specific question
            var siblingOptions = [];
            if (questionContainer && questionContainer !== document.body && !questionContainer.classList.contains('container') && !questionContainer.classList.contains('generated-exams-section') && !questionContainer.classList.contains('tab-content')) {
              siblingOptions = Array.from(questionContainer.querySelectorAll('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option'));
            }
            if (!siblingOptions || siblingOptions.length === 0 || siblingOptions.length > 8) {
              var directParent = optionEl.parentElement;
              if (directParent) {
                siblingOptions = Array.from(directParent.querySelectorAll('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option'));
              }
            }
            if (!siblingOptions || siblingOptions.length === 0) {
              siblingOptions = [optionEl];
            }

            // Find the correct answer box for THIS specific question
            var answerBox = null;
            if (questionContainer && questionContainer !== document.body && !questionContainer.classList.contains('container') && !questionContainer.classList.contains('generated-exams-section') && !questionContainer.classList.contains('tab-content')) {
              answerBox = questionContainer.querySelector('.correct-answer-box, .answer-box, .correct-answer, [class*="correct-answer"]');
            }
            if (!answerBox) {
              // Search upcoming sibling elements
              var nextNode = (optionEl.parentElement ? optionEl.parentElement.nextElementSibling : null) || optionEl.nextElementSibling;
              while (nextNode) {
                if (nextNode.matches && (nextNode.matches('.correct-answer-box, .answer-box, .correct-answer') || nextNode.querySelector('.correct-answer-box'))) {
                  answerBox = nextNode.matches('.correct-answer-box, .answer-box, .correct-answer') ? nextNode : nextNode.querySelector('.correct-answer-box');
                  break;
                }
                if (nextNode.matches && nextNode.matches('.question-block, .question-box, .exam-question-item')) break;
                nextNode = nextNode.nextElementSibling;
              }
            }

            // Extract the expected letter or text from answer box if available
            var answerBoxText = answerBox ? (answerBox.textContent || answerBox.innerText || '').trim() : '';
            var expectedLetter = '';
            var letterMatch = answerBoxText.match(/(?:Answer|Correct Answer|الإجابة|الجواب)\s*[:：\-]?\s*\(?([A-Ea-e1-5])\)?/i);
            if (letterMatch) {
              expectedLetter = letterMatch[1].toUpperCase();
            }

            // Determine if the clicked option is correct
            var dataCorrect = (optionEl.getAttribute('data-correct') || optionEl.getAttribute('data-is-correct') || '').toLowerCase().trim();
            var optionText = (optionEl.textContent || optionEl.innerText || '').trim();
            var optionLetterMatch = optionText.match(/^\s*\(?([A-Ea-e1-5])[\)\.\-:\s]/);
            var currentOptionLetter = optionLetterMatch ? optionLetterMatch[1].toUpperCase() : '';

            var isCorrect = (dataCorrect === 'true' || dataCorrect === '1');
            if (!isCorrect && expectedLetter && currentOptionLetter && currentOptionLetter === expectedLetter) {
              isCorrect = true;
            }
            if (!isCorrect && answerBoxText && optionText && optionText.length > 2) {
              var cleanOption = optionText.replace(/^\s*\(?[A-Ea-e1-5][\)\.\-:\s]\s*/, '').trim().toLowerCase();
              if (cleanOption.length > 3 && answerBoxText.toLowerCase().includes(cleanOption)) {
                isCorrect = true;
              }
            }

            // Apply styles to the clicked option
            if (isCorrect) {
              optionEl.style.setProperty('background-color', '#10b981', 'important');
              optionEl.style.setProperty('color', '#ffffff', 'important');
              optionEl.style.setProperty('border-color', '#059669', 'important');
              optionEl.setAttribute('data-state', 'correct');
            } else {
              optionEl.style.setProperty('background-color', '#ef4444', 'important');
              optionEl.style.setProperty('color', '#ffffff', 'important');
              optionEl.style.setProperty('border-color', '#dc2626', 'important');
              optionEl.setAttribute('data-state', 'incorrect');
              
              // Highlight the true correct option among siblings
              var foundCorrectSibling = false;
              siblingOptions.forEach(function(child) {
                var childDataCorrect = (child.getAttribute('data-correct') || child.getAttribute('data-is-correct') || '').toLowerCase().trim();
                var childText = (child.textContent || child.innerText || '').trim();
                var childLetterMatch = childText.match(/^\s*\(?([A-Ea-e1-5])[\)\.\-:\s]/);
                var childLetter = childLetterMatch ? childLetterMatch[1].toUpperCase() : '';
                
                var isChildCorrect = (childDataCorrect === 'true' || childDataCorrect === '1');
                if (!isChildCorrect && expectedLetter && childLetter && childLetter === expectedLetter) {
                  isChildCorrect = true;
                }
                if (isChildCorrect) {
                  child.style.setProperty('background-color', '#10b981', 'important');
                  child.style.setProperty('color', '#ffffff', 'important');
                  child.style.setProperty('border-color', '#059669', 'important');
                  child.setAttribute('data-state', 'correct');
                  foundCorrectSibling = true;
                }
              });

              if (!foundCorrectSibling && expectedLetter) {
                siblingOptions.forEach(function(child) {
                  var childText = (child.textContent || child.innerText || '').trim();
                  if (childText.toUpperCase().startsWith(expectedLetter + ')') || 
                      childText.toUpperCase().startsWith(expectedLetter + '.') || 
                      childText.toUpperCase().startsWith('(' + expectedLetter + ')')) {
                    child.style.setProperty('background-color', '#10b981', 'important');
                    child.style.setProperty('color', '#ffffff', 'important');
                    child.style.setProperty('border-color', '#059669', 'important');
                    child.setAttribute('data-state', 'correct');
                  }
                });
              }
            }

            // Disable further clicks on siblings
            siblingOptions.forEach(function(opt) {
              opt.setAttribute('data-disabled', 'true');
              opt.style.cursor = 'default';
            });

            // Reveal the correct answer box for this question
            if (answerBox) {
              answerBox.style.setProperty('display', 'block', 'important');
              answerBox.style.setProperty('visibility', 'visible', 'important');
            }
          }
          window.checkAnswer = checkAnswer;

          // Global Event Delegation for clicks (ensures clicking works even if inline onclick is missing or wrapped)
          document.addEventListener('click', function(event) {
            var target = event.target;
            if (!target) return;
            var option = target.closest ? target.closest('.mcq-option, [data-mcq-option], [data-correct], .question-option, .exam-option') : null;
            if (option) {
              checkAnswer(option);
            }
          });

          // Add floating actions
          const actionsDiv = document.createElement('div');
          actionsDiv.id = 'floating-actions';
          actionsDiv.style.cssText = 'position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px; z-index: 9999; font-family: sans-serif;';
          actionsDiv.dir = 'rtl';
          
          const printBtn = document.createElement('button');
          printBtn.innerHTML = '🖨️ طباعة (PDF)';
          printBtn.style.cssText = 'background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 16px;';
          printBtn.onclick = () => {
            renderMathFormulas();
            setTimeout(() => window.print(), 100);
          };
          
          const downloadBtn = document.createElement('button');
          downloadBtn.innerHTML = '💾 تحميل كملف HTML';
          downloadBtn.style.cssText = 'background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 16px;';
          downloadBtn.onclick = () => {
            renderMathFormulas();
            const htmlContent = document.documentElement.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (appMode === 'summary' && dailyOnlyImportantExamPoints) ? 'Daily_Summary_Important_Only_Exam_Review.html' : 'Golden_Summary.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          };
          
          actionsDiv.appendChild(printBtn);
          actionsDiv.appendChild(downloadBtn);
          
          const style = document.createElement('style');
          style.innerHTML = \`
            @media print { 
              #floating-actions { display: none !important; } 
              .correct-answer-box { display: block !important; } 
              .generated-exams-section { break-before: page; page-break-before: always; } 
            } 
            .generated-exams-section { break-before: auto; page-break-before: auto; }
            .katex { direction: ltr !important; unicode-bidi: isolate !important; text-align: left; font-size: 1.06em !important; }
            .katex-display { direction: ltr !important; text-align: center; margin: 18px 0 !important; overflow-x: auto; padding: 6px 0; }
            .math-block { direction: ltr !important; text-align: center; background: #faf8f5 !important; border: 1.5px solid #e7ded5 !important; border-radius: 10px !important; padding: 14px 20px !important; margin: 16px 0 !important; overflow-x: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important; }
            .mcq-option {
              margin-bottom: 12px !important;
              padding: 14px 18px !important;
              border: 1.5px solid #cbd5e1 !important;
              border-radius: 10px !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
              background: #ffffff !important;
              font-weight: 600 !important;
              font-size: 15px !important;
              color: #1e293b !important;
              display: block !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              user-select: none !important;
              box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
            }
            .mcq-option:hover:not([data-disabled="true"]) {
              background: #f1f5f9 !important;
              border-color: #6366f1 !important;
              transform: translateY(-1px) !important;
              box-shadow: 0 4px 10px rgba(99,102,241,0.1) !important;
            }
            .correct-answer-box {
              display: none;
              margin-top: 14px !important;
              padding: 14px 18px !important;
              background-color: #f0fdf4 !important;
              border-left: 5px solid #16a34a !important;
              border-right: 1px solid #bbf7d0 !important;
              border-top: 1px solid #bbf7d0 !important;
              border-bottom: 1px solid #bbf7d0 !important;
              color: #166534 !important;
              font-weight: 700 !important;
              font-size: 15px !important;
              border-radius: 8px !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              box-shadow: 0 2px 6px rgba(22,163,74,0.06) !important;
            }
            .question-block, .question-box, .exam-question-item {
              border: 1.5px solid #e2e8f0 !important;
              padding: 24px !important;
              margin-bottom: 24px !important;
              border-radius: 14px !important;
              background: #ffffff !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .question-text {
              font-weight: 800 !important;
              margin-bottom: 18px !important;
              font-size: 1.15rem !important;
              color: #0f172a !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              line-height: 1.6 !important;
            }
          \`;
          
          function initTemplate1Enhancements() {
            renderMathFormulas();
            if (!document.getElementById('floating-actions')) {
              document.body.appendChild(actionsDiv);
            }
            if (!document.querySelector('style[data-exams-style]')) {
              style.setAttribute('data-exams-style', 'true');
              document.head.appendChild(style);
            }

            // Ensure all mcq-options have pointer cursor and interactive attributes
            try {
              var opts = document.querySelectorAll('.mcq-option, [data-correct], [data-mcq-option]');
              for (var i = 0; i < opts.length; i++) {
                opts[i].style.cursor = 'pointer';
                if (!opts[i].getAttribute('tabindex')) opts[i].setAttribute('tabindex', '0');
              }
            } catch (err) {}

            // Move the generated exams section inside the main container to fix max-width and background issues
            const container = document.querySelector('.container') || document.querySelector('.summary-container') || document.body;
            const examsSection = document.querySelector('.generated-exams-section');
            if (container && examsSection && examsSection.parentElement !== container) {
              container.appendChild(examsSection);
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initTemplate1Enhancements);
          } else {
            initTemplate1Enhancements();
          }
          window.addEventListener('load', initTemplate1Enhancements);
        </script>
      `;
      
      let outputHtml = content;
      if (outputHtml.includes('</body>')) {
        outputHtml = outputHtml.replace('</body>', `${scriptToInject}</body>`);
      } else {
        outputHtml += scriptToInject;
      }

      setExportStatusText("جاري تنزيل الملف...");

      if (exportMode === 'download') {
        const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isImportantMode ? 'Daily_Summary_Important_Only_Exam_Review.html' : 'Daily_Summary.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        soundService.playSuccess();
        setShowHtmlExportModal(null);
      } else {
        // Print / Interactive Preview mode
        let windowOpened = false;
        try {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(outputHtml);
            printWindow.document.close();
            windowOpened = true;
          }
        } catch (pwErr) {
          console.warn("window.open blocked, using iframe printing", pwErr);
          windowOpened = false;
        }

        if (!windowOpened) {
          // Fallback for iframes and popup blockers: hidden iframe printing
          try {
            const printIframe = document.createElement('iframe');
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);
            const doc = printIframe.contentWindow?.document;
            if (doc) {
              doc.open();
              doc.write(outputHtml);
              doc.close();
              setTimeout(() => {
                try {
                  printIframe.contentWindow?.focus();
                  printIframe.contentWindow?.print();
                } catch(e) {}
                setTimeout(() => {
                  try { document.body.removeChild(printIframe); } catch(e) {}
                }, 4000);
              }, 400);
            }
          } catch(iframeErr) {
            console.warn("Iframe printing failed, downloading file directly:", iframeErr);
            // Safe fallback: direct download
            const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Daily_Summary_Printable.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }

        soundService.playSuccess();
        setShowHtmlExportModal(null);
      }
    } catch (e) {
      console.error("Error exporting PDF:", e);
      // Safe fallback: download raw text as HTML so user never gets stuck
      try {
        const fallbackHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>ملخص المحاضرة</title><style>body{font-family:system-ui,sans-serif;padding:30px;line-height:1.8;max-width:900px;margin:auto;}</style></head><body>${summaryText.replace(/\n/g, '<br/>')}</body></html>`;
        const blob = new Blob([fallbackHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Daily_Summary.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        soundService.playSuccess();
        setShowHtmlExportModal(null);
      } catch(fbErr) {
        console.error("Fallback export failed:", fbErr);
        alert("حدث خطأ أثناء تجهيز ملف HTML.");
      }
    } finally {
      setIsExportingPDF(false);
      setExportStatusText('');
    }
  };

  // EXAM-ONLY IMPORTANT POINTS DOWNLOAD & TOGGLE HANDLERS
  const handleDownloadExamOnlySummary = async () => {
    if (!textResult) return;
    soundService.playMagic();
    setIsDistillingImportant(true);
    try {
      let distilled = textResult;
      // If the summary wasn't already generated with dailyOnlyImportantExamPoints, distill it to only high-yield exam points
      if (!dailyOnlyImportantExamPoints) {
        distilled = await distillToExamImportantPoints(textResult);
      }

      await handleExportSummaryPDFTemplate2(distilled, {
        ...template2Options,
        onlyImportantExamPoints: true,
      }, 'html');
    } catch (err) {
      console.error("Failed to download important only summary", err);
      alert("حدث خطأ أثناء تنزيل ملخص الأمور المهمة.");
    } finally {
      setIsDistillingImportant(false);
    }
  };

  const handleToggleExamFilterOnScreen = async () => {
    if (!textResult) return;
    if (originalFullSummary) {
      // Switch back to full summary
      setTextResult(originalFullSummary);
      setOriginalFullSummary(null);
      soundService.playPop();
    } else {
      // Distill to exam only
      soundService.playMagic();
      setIsDistillingImportant(true);
      try {
        const distilled = await distillToExamImportantPoints(textResult);
        setOriginalFullSummary(textResult);
        setTextResult(distilled);
        soundService.playSuccess();
      } catch (e) {
        console.error("Failed to filter summary on screen", e);
        alert("حدث خطأ أثناء تصفية الملخص.");
      } finally {
        setIsDistillingImportant(false);
      }
    }
  };

  // DOCTOR AI STATE
  const [doctorState, setDoctorState] = useState<'idle' | 'menu' | 'topics_loading' | 'topics_list' | 'topic_source_select' | 'upload_prompt' | 'explaining'>('idle');
  const [doctorTopics, setDoctorTopics] = useState<string[]>([]);
  const [selectedDoctorTopic, setSelectedDoctorTopic] = useState<string | null>(null);

  const triggerDoctorAdvice = async () => {
    // Only collect snippets from favorites, strictly obeying the 'isIgnoredByDoctor' flag
    const favTexts = collectTextFromFavorites(folders);
    
    if (favTexts.length === 0) { 
        setDoctorMessage("أهلاً بك! أنا دكتور الذكاء الاصطناعي. قم بحفظ مقتطفات مهمة، وسأقوم بمراجعتها وشرحها لك بالتفصيل هنا!"); 
        setDoctorState('idle');
        return; 
    }
    
    setShowDoctorChat(true);
    setDoctorMessage("أهلاً بك! كيف يمكنني مساعدتك اليوم؟");
    setDoctorState('menu');
    soundService.playPop();
  };

  const handleDoctorOption = async (option: 'snippets' | 'topics') => {
    if (option === 'snippets') {
        setDoctorState('explaining');
        setIsDoctorThinking(true);
        const favTexts = collectTextFromFavorites(folders);
        const shuffled = favTexts.sort(() => 0.5 - Math.random()); 
        const selected = shuffled.slice(0, 10).join("\n\n"); 
        const advice = await generateDoctorAdvice(selected);
        setDoctorMessage(advice); 
        setIsDoctorThinking(false); 
        soundService.playSuccess();
    } else {
        setDoctorState('topics_loading');
        setIsDoctorThinking(true);
        const favTexts = collectTextFromFavorites(folders);
        const allText = favTexts.join("\n\n");
        // Import dynamically to avoid circular dependency issues if any, though here it's fine
        const { extractTopicsFromSnippets } = await import('./services/gemini');
        const topics = await extractTopicsFromSnippets(allText);
        setDoctorTopics(topics);
        setDoctorState('topics_list');
        setIsDoctorThinking(false);
        setDoctorMessage("لقد وجدت هذه المواضيع في مقتطفاتك. اختر موضوعاً لأشرحه لك:");
    }
  };

  const handleTopicSelect = (topic: string) => {
      setSelectedDoctorTopic(topic);
      setDoctorState('topic_source_select');
      setDoctorMessage(`تريد شرحاً عن "${topic}". هل تريد الشرح بناءً على المقتطفات المحفوظة أم من ملف خارجي؟`);
  };

  const handleTopicSource = async (source: 'snippets' | 'file') => {
      if (!selectedDoctorTopic) return;
      
      if (source === 'snippets') {
          setDoctorState('explaining');
          setIsDoctorThinking(true);
          const favTexts = collectTextFromFavorites(folders);
          const allText = favTexts.join("\n\n");
          const { explainTopic } = await import('./services/gemini');
          const explanation = await explainTopic(selectedDoctorTopic, 'snippets', allText);
          setDoctorMessage(explanation);
          setIsDoctorThinking(false);
          soundService.playSuccess();
      } else {
          setDoctorState('upload_prompt');
          setDoctorMessage(`الرجاء رفع ملف (TXT أو PDF) لأقوم بشرح "${selectedDoctorTopic}" منه.`);
      }
  };

  const handleDoctorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedDoctorTopic) return;

      setDoctorState('explaining');
      setIsDoctorThinking(true);
      setDoctorMessage(`جاري قراءة الملف وشرح "${selectedDoctorTopic}"...`);
      
      try {
          let contextData: string | string[] = "";
          if (file.name.endsWith('.txt') || file.type === 'text/plain') {
              contextData = await file.text();
          } else {
              // Convert PDF to images and pass them directly
              const images = await convertPdfToImages(file);
              contextData = images;
          }
          
          const { explainTopic } = await import('./services/gemini');
          // @ts-ignore - explainTopic now accepts string | string[]
          const explanation = await explainTopic(selectedDoctorTopic, 'file', contextData);
          setDoctorMessage(explanation);
      } catch (err) {
          console.error(err);
          setDoctorMessage("حدث خطأ أثناء قراءة الملف.");
      } finally {
          setIsDoctorThinking(false);
          soundService.playSuccess();
      }
  };

  const handleTranslate = async (textToTranslate?: string) => {
     const text = textToTranslate || selectionBox?.text;
     if (!text) return;
     
     soundService.playClick(); 
     setIsTranslating(true); 
     
     const x = selectionBox ? selectionBox.x : window.innerWidth / 2;
     const y = selectionBox ? selectionBox.y : window.innerHeight / 2;
     
     setSelectionBox(null);
     
     const translated = await getTranslation(text);
     setActiveTranslation({ x, y, text: translated }); 
     setIsTranslating(false); 
     soundService.playMagic();
  };

  const handleSpeak = (text: string) => {
    soundService.playClick();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Improved Voice Selection Logic for "Human-like" English
      const preferredVoices = voices.filter(v => v.lang.startsWith('en'));
      let selectedVoice = preferredVoices.find(v => v.name.includes("Google US English")) || 
                          preferredVoices.find(v => v.name.includes("Samantha")) || 
                          preferredVoices.find(v => v.name.includes("Daniel")) ||
                          preferredVoices.find(v => v.name.includes("Microsoft Zira"));
      
      if (!selectedVoice && preferredVoices.length > 0) {
        selectedVoice = preferredVoices[0];
      }

      if (selectedVoice) { 
          utterance.voice = selectedVoice; 
      }
      
      // Slight adjustments to make it sound less robotic if possible
      utterance.rate = 1.0; 
      utterance.pitch = 1.0;

      window.speechSynthesis.speak(utterance);
    } else { alert("عذراً، متصفحك لا يدعم القراءة الصوتية."); }
  };

  // SMART FORMATTING HANDLER
  const handleSmartFormat = async (text: string) => {
    if (!text || isFormatting) return;
    soundService.playMagic();
    setIsFormatting(true);
    const improved = await improveTextFormatting(text);
    setPendingFormat({ original: text, formatted: improved });
    setIsFormatting(false);
  };

  // CODE CORRECTION HANDLER
  const handleCodeCorrection = async (text: string) => {
    if (!text || isCorrectingCode) return;
    soundService.playMagic(); // Same or different sound
    setIsCorrectingCode(true);
    const corrected = await correctCodeSnippet(text);
    setPendingFormat({ original: text, formatted: corrected });
    setIsCorrectingCode(false);
  };

  const applyFormat = () => {
    if (!pendingFormat) return;
    soundService.playSuccess();
    
    if (selectedSnippet) {
       // Save to folder
       // We need to find the folder that contains this snippet to update it properly
       // The updateFolderInTree helper is generic, we can use it to scan
       setFolders(prev => {
          const updateRecursive = (list: any[]): any[] => list.map(f => {
              // Update if in snippets list
              const sIndex = f.snippets.findIndex((s:any) => s.id === selectedSnippet.id);
              if (sIndex !== -1) {
                  const updatedSnippets = [...f.snippets];
                  updatedSnippets[sIndex] = { ...updatedSnippets[sIndex], text: pendingFormat.formatted };
                  // Also update local selected snippet state
                  setSelectedSnippet({ ...selectedSnippet, text: pendingFormat.formatted });
                  return { ...f, snippets: updatedSnippets };
              }
              if (f.subFolders) return { ...f, subFolders: updateRecursive(f.subFolders) };
              return f;
          });
          return updateRecursive(prev);
       });
    } else if (editingNote) {
       setEditingNote({ ...editingNote, content: pendingFormat.formatted });
    }

    setPendingFormat(null);
  };

  const cancelFormat = () => {
    soundService.playError();
    setPendingFormat(null);
  };
  
  const handleMentorClick = async () => {
     soundService.playMagic(); setShowMentor(true);
     if (!mentorContent || mentorContent.startsWith("عذراً")) {
        try { const insight = await generateMentorInsight(lectureFiles, pastExamFiles, appMode, textResult); setMentorContent(insight); setIsMentorActive(true); } 
        catch(e) { console.error(e); setMentorContent("حدث خطأ أثناء الاتصال بالمرشد. يرجى المحاولة لاحقاً."); }
     }
  };

  const readImageAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (files: File[], type: 'past_exam' | 'lecture' | 'image' | 'doctor_notes' | 'additional_doctor_notes') => {
    soundService.playPop(); setStatus(AppStatus.PARSING_PDF); setErrorMsg(null);
    try {
      if (type === 'image') {
        const filePromises = files.map(async (file) => {
          const dataUrl = await readImageAsDataUrl(file);
          return { id: Math.random().toString(36).substr(2, 9), name: file.name, dataUrl, mimeType: file.type };
        });
        const newImages = await Promise.all(filePromises);
        setImageFiles(prev => [...prev, ...newImages]);
      } else {
        const filePromises = files.map(async (file) => { const isTxt = file.name.endsWith('.txt') || file.type === 'text/plain' || file.name.endsWith('.html') || file.type === 'text/html'; let images: string[] = []; let text: string | undefined = undefined; if (isTxt) text = await file.text(); else { ({ text, images } = await extractPdfForLocalAI(file)); if (readAllPdfImages) images = await convertPdfToImages(file); } return { id: Math.random().toString(36).substr(2, 9), name: file.name, images, text, type, uploadDate: new Date() }; });
        const newFiles = await Promise.all(filePromises); 
        if (type === 'past_exam') setPastExamFiles(prev => [...prev, ...newFiles]); 
        else if (type === 'doctor_notes') setDoctorNotesFiles(prev => [...prev, ...newFiles]);
        else if (type === 'additional_doctor_notes') setAdditionalDoctorNotesFiles(prev => [...prev, ...newFiles]);
        else setLectureFiles(prev => [...prev, ...newFiles]);
      }
      setStatus(AppStatus.IDLE); soundService.playSuccess();
    } catch (err: any) { setErrorMsg(err.message); setStatus(AppStatus.ERROR); soundService.playError(); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setSaveImage(reader.result as string); soundService.playClick(); }; reader.readAsDataURL(file); } };
  const handleManualSnippetImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setManualSnippetData(prev => ({...prev, image: reader.result as string})); soundService.playClick(); }; reader.readAsDataURL(file); } };

  const startAnalysis = async () => {
    soundService.playMagic();
    
    // BANK MODE: Allow analysis if ONLY past exams are present in 'extraction' mode
    if (appMode !== 'image_injection' && lectureFiles.length === 0 && pastExamFiles.length === 0) {
        setErrorMsg("يرجى رفع ملفات المحاضرة أو الامتحانات السابقة.");
        soundService.playError();
        return;
    }

    if (appMode === 'image_injection' && (lectureFiles.length === 0 || imageFiles.length === 0)) {
        setErrorMsg("يرجى رفع ملف القالب (HTML) والصور المراد إدراجها.");
        soundService.playError();
        return;
    }

    if (lectureFiles.length === 0 && appMode !== 'extraction' && appMode !== 'image_injection' && !(appMode === 'direct_export' && customExportAllPastExams)) {
         setErrorMsg("هذا الوضع (التوليد/التلخيص/التوقع) يتطلب ملف محاضرة.");
         soundService.playError();
         return;
    }

    // FIX 1: Explicitly reset all quiz states to prevent first question auto-solve
    setStatus(AppStatus.ANALYZING); 
    setErrorMsg(null); 
    setResults([]); 
    setTextResult(null); 
    setOriginalFullSummary(null); 
    setCurrentQuestionIndex(0); 
    setQuizFinished(false); 
    setIsHistorySaved(false); 
    setHistoryNameInput(""); 
    setMentorContent(null); 
    setIsMentorActive(false);
    setSelectedOption(null); // Explicit reset
    setIsAnswerRevealed(false); // Explicit reset
    setScore(0); // Explicit reset

    try {
      if (appMode === 'image_injection') {
        const text = lectureFiles.map(f => f.text || '').join('\n\n').trim();
        if (!text) {
            setErrorMsg("عذراً، الملف الذي رفعته لا يحتوي على نص مدعوم (ربما رفعت ملف PDF صورياً). يرجى رفع ملف القالب بصيغة HTML أو TXT.");
            setStatus(AppStatus.IDLE);
            soundService.playError();
            return;
        }
        const finalHtml = await injectImagesIntoHTML(text, imageFiles);
        
        // Export file directly
        const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Medical_Guide_Mega_With_Images.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setStatus(AppStatus.IDLE);
        soundService.playSuccess();
        return;
      }

      let data: MatchedQuestion[] | string;
      let shouldSkipMainText = false;
      if (appMode === 'summary' || appMode === 'custom' || appMode === 'summary_mega' || appMode === 'google_form' || appMode === 'direct_export' || appMode === 'template2_smart') { 
        if ((appMode === 'custom' || appMode === 'google_form') && !customPrompt.trim()) {
           alert(appMode === 'google_form' ? "يرجى كتابة تعليماتك لإنشاء النموذج أولاً" : "يرجى كتابة ما تود التركيز عليه في الملخص المخصص");
           setStatus(AppStatus.IDLE);
           return;
        }

        let localCachedQuestions = cachedPastQuestions;
        if (verifyPastQuestionsFirstEnabled && pastExamFiles.length > 0) {
           setStatus(AppStatus.ANALYZING);
           try {
              const extracted = await analyzeMatches(lectureFiles, pastExamFiles, 'extraction', 50, '', false, [], false, []) as MatchedQuestion[];
              localCachedQuestions = extracted;
              setCachedPastQuestions(extracted);
           } catch (err) {
              console.warn("Failed pre-extraction phase", err);
              throw err;
           }
        }
        
        let activeCustomPrompt = customPrompt;
        if (localCachedQuestions && localCachedQuestions.length > 0) {
           activeCustomPrompt = `[CRITICAL EXTRACTED PAST QUESTIONS MEMORY]\nI have explicitly pre-extracted the following relevant past exam questions for this lecture:\n\n${JSON.stringify(localCachedQuestions)}\n\nUse this information heavily to bias your summary and ensure no concept tested in these questions is skipped.\n\n--- USER INSTRUCTIONS ---\n${customPrompt}`;
        }

        let analysisResult, mentorResult = null;
        if (appMode === 'template2_smart') {
           analysisResult = await analyzeMatches(
             lectureFiles, 
             pastExamFiles, 
             appMode, 
             generationCount, 
             activeCustomPrompt, 
             false, 
             [], 
             doubleCheckEnabled, 
             [], 
             template2Options.separateLectures, 
             template2Options.lectureConfigs,
             true,
             template2CloseExamGaps
           );
           shouldSkipMainText = false;
        } else if (appMode === 'direct_export') {
           if (customExportAllPastExams) {
               analysisResult = "";
               shouldSkipMainText = true;
           } else if (activeCustomPrompt.trim()) {
               analysisResult = await analyzeMatches(lectureFiles, pastExamFiles, appMode, generationCount, activeCustomPrompt, megaConcise, [], doubleCheckEnabled, [], template2Options.separateLectures, template2Options.lectureConfigs, directExportComprehensive);
               shouldSkipMainText = !customIncludeMainSummary;
           } else {
               if (customIncludeMainSummary) {
                   analysisResult = await analyzeMatches(
                     lectureFiles, 
                     pastExamFiles, 
                     appMode, 
                     generationCount, 
                     directExportComprehensive 
                       ? "Generate a massively detailed, exhaustive, and comprehensive English summary covering every single concept, detail, definition, table, mechanism, and fact from the lecture without cutting or shortening anything." 
                       : "Make a balanced, highly detailed English summary.", 
                     megaConcise, 
                     [], 
                     doubleCheckEnabled, 
                     [], 
                     template2Options.separateLectures, 
                     template2Options.lectureConfigs,
                     directExportComprehensive
                   );
                   shouldSkipMainText = false;
               } else {
                   analysisResult = lectureFiles.map(f => `--- File: ${f.name} ---\n${f.text || ''}`).join('\n\n');
                   shouldSkipMainText = true;
               }
           }
        } else if (appMode === 'google_form') {
           analysisResult = await analyzeMatches(lectureFiles, pastExamFiles, appMode, generationCount, activeCustomPrompt, megaConcise, doctorNotesFiles, doubleCheckEnabled, additionalDoctorNotesFiles, false, {});
        } else {
           const [ar, mr] = await Promise.all([
             analyzeMatches(
               lectureFiles, 
               pastExamFiles, 
               appMode, 
               generationCount, 
               activeCustomPrompt, 
               megaConcise, 
               [], 
               doubleCheckEnabled, 
               [], 
               template2Options.separateLectures, 
               template2Options.lectureConfigs,
               false,
               true,
               appMode === 'summary' && dailyOnlyImportantExamPoints
             ), 
             generateMentorInsight(lectureFiles, pastExamFiles, appMode)
           ]);
           analysisResult = ar;
           mentorResult = mr;
        }
        data = analysisResult; 
        
        if (appMode === 'template2_smart') {
          setTextResult(data as string);
          const smartTemplate2Options = {
            ...template2Options,
            includeEnglishSummary: true,
            includeArabicGuide: false,
            includePastQuestions: pastExamFiles.length > 0,
            includeExpectedQuestions: false,
            includeDoctorNotes: false,
            includeAdditionalNotes: false,
            removeFakeInfoConfirm: template2AntiIntruder,
            enableMathSuperCheck: template2Options.enableMathSuperCheck,
            closePastExamGaps: template2CloseExamGaps,
          };
          await handleExportSummaryPDFTemplate2(data as string, smartTemplate2Options, template2SmartFormat);
          setStatus(AppStatus.COMPLETED);
          soundService.playSuccess();
          return;
        }

        if (appMode === 'direct_export') {
          const directExportOptions = {
            ...template2Options,
            includeEnglishSummary: customIncludeMainSummary && !customExportAllPastExams,
            includeArabicGuide: customIncludeGuide && !customExportAllPastExams,
            includePastQuestions: customIncludePastExams && !customExportAllPastExams,
            includeExpectedQuestions: customIncludePredictions && !customExportAllPastExams,
            includeDoctorNotes: doctorNotesFiles.length > 0 && !customExportAllPastExams,
            includeAdditionalNotes: additionalDoctorNotesFiles.length > 0 && !customExportAllPastExams,
          };
          await handleExportSummaryPDFTemplate2(data as string, directExportOptions, 'html');
          setStatus(AppStatus.IDLE);
          soundService.playSuccess();
          return;
        }
        
        if (mentorResult) {
          setMentorContent(mentorResult); 
          setIsMentorActive(true); 
        } else {
          setIsMentorActive(false);
        }
      } else { 
          // Pass generationCount to analyzeMatches
          data = await analyzeMatches(lectureFiles, pastExamFiles, appMode, generationCount, customPrompt, false, [], doubleCheckEnabled, []); 
      }
      if (typeof data === 'string') setTextResult(data); else setResults(data);
      setStatus(AppStatus.COMPLETED); soundService.playSuccess();
    } catch (err: any) { setErrorMsg(err.message); setStatus(AppStatus.ERROR); soundService.playError(); }
  };

  const saveToHistory = () => { if (!historyNameInput.trim()) { alert("يرجى إدخال اسم للاختبار لحفظه"); return; } const newEntry: HistoryEntry = { id: Math.random().toString(36).substr(2, 9), name: historyNameInput, date: new Date(), score: score, totalQuestions: results.length, questions: results }; setHistory(prev => [newEntry, ...prev]); setIsHistorySaved(true); soundService.playSuccess(); };
  const deleteHistoryEntry = (id: string) => { if(window.confirm("هل أنت متأكد من حذف هذا السجل؟")) { setHistory(prev => prev.filter(h => h.id !== id)); soundService.playError(); } };
  
  const retakeQuiz = (entry: HistoryEntry) => { 
    soundService.playClick(); 
    // FIX 1: Reset quiz states completely when retaking
    setResults(entry.questions); 
    setScore(0); 
    setCurrentQuestionIndex(0); 
    setQuizFinished(false); 
    setIsHistorySaved(false); 
    setHistoryNameInput(""); 
    setShowHistory(false); 
    setTextResult(null); 
    setStatus(AppStatus.COMPLETED); 
    setMentorContent(null); 
    setIsMentorActive(false);
    setSelectedOption(null); // Explicit reset
    setIsAnswerRevealed(false); // Explicit reset
  };

  const getCurrentFavoriteFolder = () => { if (!activeRootFolderId) return null; let current: any = folders.find(f => f.id === activeRootFolderId); if (!current) return null; for (const id of navigationPath) { if (current.subFolders) { const found = current.subFolders.find((f: any) => f.id === id); if (found) current = found; } } return current; };
  const createSubFolder = () => { if (!newFolderName.trim() || !activeRootFolderId) return; const newSub: SubFolder = { id: Math.random().toString(36).substr(2, 9), name: newFolderName, subFolders: [], questions: [], snippets: [], archives: [], createdAt: new Date() }; const targetId = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : activeRootFolderId; setFolders(prev => updateFolderInTree(prev, targetId!, (folder) => ({ ...folder, subFolders: [...(folder.subFolders || []), newSub] }))); setNewFolderName(""); setIsCreatingFolder(false); soundService.playSuccess(); };
  const navigateFavorites = (folderId: string) => { soundService.playClick(); setNavigationPath(prev => [...prev, folderId]); };
  const navigateBackFavorites = () => { soundService.playPop(); setNavigationPath(prev => prev.slice(0, -1)); };
  const getCurrentNoteFolder = () => { if (noteNavigationPath.length === 0) return { id: 'root', name: 'المجلد الرئيسي', subFolders: noteFolders, notes: [] }; const rootId = noteNavigationPath[0]; let current: any = noteFolders.find(f => f.id === rootId); for (let i = 1; i < noteNavigationPath.length; i++) { if(current && current.subFolders) current = current.subFolders.find((f: any) => f.id === noteNavigationPath[i]); } return current; };
  const createNoteFolder = () => { if (!newNoteFolderName.trim()) return; const newFolder: NoteFolder = { id: Math.random().toString(36), name: newNoteFolderName, notes: [], subFolders: [], createdAt: new Date() }; if (noteNavigationPath.length === 0) { setNoteFolders(prev => [...prev, newFolder]); } else { const targetId = noteNavigationPath[noteNavigationPath.length - 1]; setNoteFolders(prev => updateFolderInTree(prev, targetId, (folder) => ({ ...folder, subFolders: [...(folder.subFolders || []), newFolder] }))); } setNewNoteFolderName(""); setIsCreatingNoteFolder(false); soundService.playSuccess(); };
  const deleteNoteFolder = (id: string) => { if (window.confirm("حذف المجلد وكل الملاحظات بداخله؟")) { if (noteNavigationPath.length === 0) { setNoteFolders(prev => prev.filter(f => f.id !== id)); } else { const deleteRecursive = (list: any[]): any[] => { return list.filter(f => f.id !== id).map(f => ({ ...f, subFolders: f.subFolders ? deleteRecursive(f.subFolders) : [] })); }; setNoteFolders(prev => deleteRecursive(prev)); } soundService.playError(); } };
  const createNewNote = () => { if (noteNavigationPath.length === 0) { alert("يرجى الدخول لمجلد لإنشاء ملاحظة"); return; } setEditingNote({ id: Math.random().toString(36), title: '', content: '', updatedAt: new Date() }); setIsNotePreview(false); soundService.playClick(); };
  const saveNote = () => { if (!editingNote || noteNavigationPath.length === 0) return; const title = editingNote.title.trim() || "ملاحظة بدون عنوان"; const updatedNote = { ...editingNote, title, updatedAt: new Date() }; const targetId = noteNavigationPath[noteNavigationPath.length - 1]; setNoteFolders(prev => updateFolderInTree(prev, targetId, (folder) => { const exists = folder.notes.find((n: Note) => n.id === updatedNote.id); if (exists) return { ...folder, notes: folder.notes.map((n: Note) => n.id === updatedNote.id ? updatedNote : n) }; return { ...folder, notes: [updatedNote, ...folder.notes] }; })); setEditingNote(null); setIsNotePreview(false); soundService.playSuccess(); };
  const deleteNote = (noteId: string) => { if (!window.confirm("حذف هذه الملاحظة؟")) return; const targetId = noteNavigationPath[noteNavigationPath.length - 1]; if (!targetId) return; setNoteFolders(prev => updateFolderInTree(prev, targetId, (folder) => ({ ...folder, notes: folder.notes.filter((n: Note) => n.id !== noteId) }))); setEditingNote(null); soundService.playError(); };
  const handleNoteSelect = () => { const textarea = noteTextareaRef.current; if (!textarea) return; if (textarea.selectionStart !== textarea.selectionEnd) { setNoteSelection({ start: textarea.selectionStart, end: textarea.selectionEnd, top: 0, left: 0 }); } else { setNoteSelection(null); } };
  const applyNoteFormat = (type: 'bold' | 'underline') => { if (!editingNote || !noteTextareaRef.current) return; soundService.playClick(); const textarea = noteTextareaRef.current; const start = textarea.selectionStart; const end = textarea.selectionEnd; if (start === end) return; const fullText = editingNote.content; const selectedText = fullText.substring(start, end); let formattedText = selectedText; if (type === 'bold') formattedText = `**${selectedText}**`; if (type === 'underline') formattedText = `__${selectedText}__`; const newContent = fullText.substring(0, start) + formattedText + fullText.substring(end); setEditingNote({...editingNote, content: newContent}); setNoteSelection(null); setTimeout(() => { if (noteTextareaRef.current) { noteTextareaRef.current.focus(); const newCursorPos = start + formattedText.length; noteTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos); } }, 0); };
  
  const handleNoteAction = async (action: 'translate' | 'snippet') => {
      if (!editingNote || !noteTextareaRef.current || !noteSelection) return;
      const textarea = noteTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end) return;
      
      const selectedText = editingNote.content.substring(start, end);
      
      if (action === 'translate') {
          soundService.playClick();
          setIsTranslating(true);
          // Calculate mock position since we can't easily get precise X/Y inside textarea for global absolute div
          const textareaRect = textarea.getBoundingClientRect();
          // Position it near the top of the textarea or center
          setActiveTranslation({ x: textareaRect.left + textareaRect.width / 2, y: textareaRect.top + 100, text: "جاري الترجمة..." });
          
          const translated = await getTranslation(selectedText);
          setActiveTranslation(prev => prev ? { ...prev, text: translated } : null);
          setIsTranslating(false);
          soundService.playMagic();
      } else if (action === 'snippet') {
          initiateSave('snippet', selectedText);
          setSaveName("مقتطف من ملاحظة: " + editingNote.title);
      }
      
      setNoteSelection(null);
  };

  const [isConverting, setIsConverting] = useState(false);

  const saveToArchive = async () => { 
    if (!saveTarget) return;
    if (!saveName.trim() && saveTarget.type !== 'convert_to_snippets') return; 

    if (saveTarget.type === 'convert_to_snippets') {
        setIsConverting(true);
    }

    let targetRootId = ''; 
    if (saveTarget.type === 'question') targetRootId = 'f_q'; 
    else if (saveTarget.type === 'quiz') targetRootId = 'f_z'; 
    else if (saveTarget.type === 'snippet' || saveTarget.type === 'convert_to_snippets') targetRootId = 'f_s'; 
    else targetRootId = 'f_m'; 

    const date = new Date(); 
    
    if (saveTarget.type === 'convert_to_snippets') {
        try {
            const { extractSnippetsFromText } = await import('./services/gemini');
            const extractedSnippets = await extractSnippetsFromText(saveTarget.data);
            
            if (extractedSnippets.length === 0) {
                alert("لم يتم العثور على مقتطفات صالحة.");
                return;
            }

            const newSnippets: SavedSnippet[] = extractedSnippets.map(s => ({
                id: Math.random().toString(36).substr(2, 9),
                text: s.content,
                sourceTitle: s.title,
                createdAt: date
            }));

            if (saveFolderId === 'root') { 
              setFolders(prev => prev.map(f => { 
                if (f.id !== targetRootId) return f; 
                return { ...f, snippets: [...f.snippets, ...newSnippets] }; 
              })); 
            } else { 
              setFolders(prev => updateFolderInTree(prev, saveFolderId, (folder) => { 
                return { ...folder, snippets: [...folder.snippets, ...newSnippets] }; 
              })); 
            } 
            soundService.playSuccess();
            alert(`تم تحويل وحفظ ${newSnippets.length} مقتطف بنجاح!`);
        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء التحويل.");
            soundService.playError();
        } finally {
            setIsConverting(false);
            setSaveTarget(null); 
            setSaveName(""); 
            setSaveFolderId("root"); 
        }
        return;
    }

    const newItemId = Math.random().toString(36).substr(2, 9); 
    const createItem = () => { 
      if (saveTarget.type === 'snippet') return { id: newItemId, text: saveTarget.data, sourceTitle: saveName, createdAt: date, imageData: saveImage || undefined }; 
      if (saveTarget.type === 'question') return saveTarget.data; 
      return { id: newItemId, title: saveName, content: saveTarget.data, type: saveTarget.type === 'quiz' ? 'quiz_set' : 'summary_doc', createdAt: date }; 
    }; 
    
    const item = createItem(); 
    
    if (saveFolderId === 'root') { 
      setFolders(prev => prev.map(f => { 
        if (f.id !== targetRootId) return f; 
        if (saveTarget.type === 'snippet') return { ...f, snippets: [...f.snippets, item as SavedSnippet] }; 
        if (saveTarget.type === 'question') return { ...f, questions: [...f.questions, item as MatchedQuestion] }; 
        return { ...f, archives: [...f.archives, item as FullArchive] }; 
      })); 
    } else { 
      setFolders(prev => updateFolderInTree(prev, saveFolderId, (folder) => { 
        if (saveTarget.type === 'snippet') return { ...folder, snippets: [...folder.snippets, item as SavedSnippet] }; 
        if (saveTarget.type === 'question') return { ...folder, questions: [...folder.questions, item as MatchedQuestion] }; 
        return { ...folder, archives: [...folder.archives, item as FullArchive] }; 
      })); 
    } 
    
    setSaveTarget(null); 
    setSaveName(""); 
    setSaveFolderId("root"); 
    setSaveImage(null); 
    soundService.playSuccess(); 
  };

  const initiateSave = (type: 'quiz' | 'summary' | 'snippet' | 'question' | 'convert_to_snippets', data: any) => { soundService.playPop(); setSaveTarget({ type, data }); setSaveFolderId("root"); setSaveName(type === 'convert_to_snippets' ? "تحويل تلقائي" : ""); setSaveImage(null); };
  
  const handleManualSnippetSave = () => { 
    if (!manualSnippetData.text.trim()) return; 
    
    const newItemId = Math.random().toString(36).substr(2, 9); 
    const date = new Date(); 
    const snippet: SavedSnippet = { 
        id: newItemId, 
        text: manualSnippetData.text, 
        sourceTitle: manualSnippetData.sourceTitle, 
        createdAt: date, 
        imageData: manualSnippetData.image || undefined 
    }; 
    
    // Always use updateFolderInTree which handles finding the correct folder by ID recursively.
    // If the folderId is one of the root folders (like 'f_s'), updateFolderInTree will handle it correctly 
    // because it maps over the top-level array too.
    setFolders(prev => updateFolderInTree(prev, manualSnippetData.folderId, (folder) => { 
        return { ...folder, snippets: [...folder.snippets, snippet] }; 
    })); 
    
    setManualSnippetData({ text: "", sourceTitle: "مقتطف يدوي", folderId: "f_s", image: null }); 
    setShowManualSnippetModal(false); 
    soundService.playSuccess(); 
  };

  const removeElement = (idOrIndex: string | number, folderId: string, itemType: 'archive' | 'snippet' | 'question' | 'subfolder') => { setFolders(prev => updateFolderInTree(prev, folderId, (folder) => { if (itemType === 'subfolder') return { ...folder, subFolders: folder.subFolders?.filter((s:any) => s.id !== idOrIndex) }; if (itemType === 'archive') return { ...folder, archives: folder.archives.filter((a:any) => a.id !== idOrIndex) }; if (itemType === 'snippet') return { ...folder, snippets: folder.snippets.filter((s:any) => s.id !== idOrIndex) }; if (itemType === 'question') return { ...folder, questions: folder.questions.filter((_:any, idx:number) => idx !== (idOrIndex as number)) }; return folder; })); soundService.playError(); };
  const handleExport = () => { soundService.playSuccess(); const data = { folders, history, notes: noteFolders, tasks }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ExamMatcher_DataBackup_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); setShowSettings(false); };
  
  // --- RENAME LOGIC ---
  const initiateRename = (id: string, name: string, type: 'fav_folder' | 'note_folder') => {
      setRenamingTarget({ id, name, type });
  };
  
  const handleRenameSubmit = () => {
      if (!renamingTarget || !renamingTarget.name.trim()) return;
      
      if (renamingTarget.type === 'fav_folder') {
          setFolders(prev => updateFolderInTree(prev, renamingTarget.id, (f) => ({ ...f, name: renamingTarget.name })));
      } else {
          setNoteFolders(prev => updateFolderInTree(prev, renamingTarget.id, (f) => ({ ...f, name: renamingTarget.name })));
      }
      
      setRenamingTarget(null);
      soundService.playSuccess();
  };

  // --- IGNORE FOLDER LOGIC ---
  const toggleFolderIgnore = (id: string) => {
      setFolders(prev => updateFolderInTree(prev, id, (f) => ({ ...f, isIgnoredByDoctor: !f.isIgnoredByDoctor })));
      soundService.playToggle();
  };

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, type: 'fav_folder' | 'note_folder' | 'snippet' | 'question' | 'archive' | 'note', id: string | number, sourceFolderId: string, data?: any) => {
    e.dataTransfer.setData("text/plain", id.toString());
    setDraggedItem({ type, id, sourceFolderId, data });
    // Add a ghost image or effect if needed
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (dragOverFolderId !== folderId) setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Use a timeout or check if relatedTarget is NOT a child to prevent flickering
    // For simplicity, we just keep it or clear it on drop
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string, isNoteMode: boolean) => {
    e.preventDefault();
    setDragOverFolderId(null);
    if (!draggedItem) return;

    // Prevent dropping into itself or same folder
    if (draggedItem.id === targetFolderId || draggedItem.sourceFolderId === targetFolderId) return;

    soundService.playMechanical();

    if (isNoteMode) {
        // Handle Note Folders and Notes
        setNoteFolders(prev => {
            // 1. Remove from source
            let itemToMove: any = null;
            const removeFromSource = (list: any[]): any[] => {
                return list.map(f => {
                    if (f.id === draggedItem.sourceFolderId) {
                         if (draggedItem.type === 'note') {
                             itemToMove = f.notes.find((n:any) => n.id === draggedItem.id);
                             return { ...f, notes: f.notes.filter((n:any) => n.id !== draggedItem.id) };
                         } else if (draggedItem.type === 'note_folder') {
                             itemToMove = f.subFolders.find((s:any) => s.id === draggedItem.id);
                             return { ...f, subFolders: f.subFolders.filter((s:any) => s.id !== draggedItem.id) };
                         }
                    }
                    if (f.subFolders) return { ...f, subFolders: removeFromSource(f.subFolders) };
                    return f;
                });
            };
            
            // Special case for Root Note folder removal (if source is 'root')
            let newTree = prev;
            if (draggedItem.sourceFolderId === 'root') {
               if (draggedItem.type === 'note_folder') {
                   itemToMove = prev.find(f => f.id === draggedItem.id);
                   newTree = prev.filter(f => f.id !== draggedItem.id);
               }
            } else {
               newTree = removeFromSource(prev);
            }

            if (!itemToMove) return prev; // Failed to find item

            // 2. Add to target
            if (targetFolderId === 'root') {
                if (draggedItem.type === 'note_folder') return [...newTree, itemToMove];
                return newTree; // Can't drop notes in root (notes must be in a folder)
            }

            return updateFolderInTree(newTree, targetFolderId, (folder) => {
                if (draggedItem.type === 'note') return { ...folder, notes: [...folder.notes, itemToMove] };
                if (draggedItem.type === 'note_folder') return { ...folder, subFolders: [...(folder.subFolders || []), itemToMove] };
                return folder;
            });
        });
    } else {
        // Handle Favorite Items
        setFolders(prev => {
             // 1. Remove from source
             let itemToMove: any = null;
             const removeFromSource = (list: any[]): any[] => {
                 return list.map(f => {
                     if (f.id === draggedItem.sourceFolderId) {
                         if (draggedItem.type === 'fav_folder') {
                             itemToMove = f.subFolders?.find((s:any) => s.id === draggedItem.id);
                             return { ...f, subFolders: f.subFolders?.filter((s:any) => s.id !== draggedItem.id) };
                         }
                         if (draggedItem.type === 'snippet') {
                             itemToMove = f.snippets.find((s:any) => s.id === draggedItem.id);
                             return { ...f, snippets: f.snippets.filter((s:any) => s.id !== draggedItem.id) };
                         }
                         if (draggedItem.type === 'archive') {
                             itemToMove = f.archives.find((a:any) => a.id === draggedItem.id);
                             return { ...f, archives: f.archives.filter((a:any) => a.id !== draggedItem.id) };
                         }
                         if (draggedItem.type === 'question') {
                             // Questions use Index as ID usually, but let's assume we passed index
                             itemToMove = f.questions[draggedItem.id as number];
                             return { ...f, questions: f.questions.filter((_:any, idx:number) => idx !== (draggedItem.id as number)) };
                         }
                     }
                     if (f.subFolders) return { ...f, subFolders: removeFromSource(f.subFolders) };
                     return f;
                 });
             };

             const newTree = removeFromSource(prev);
             if (!itemToMove) return prev;

             // 2. Add to target
             return updateFolderInTree(newTree, targetFolderId, (folder) => {
                 if (draggedItem.type === 'fav_folder') return { ...folder, subFolders: [...(folder.subFolders || []), itemToMove] };
                 if (draggedItem.type === 'snippet') return { ...folder, snippets: [...folder.snippets, itemToMove] };
                 if (draggedItem.type === 'archive') return { ...folder, archives: [...folder.archives, itemToMove] };
                 if (draggedItem.type === 'question') return { ...folder, questions: [...folder.questions, itemToMove] };
                 return folder;
             });
        });
    }

    setDraggedItem(null);
  };

  // --- SMART IMPORT LOGIC ---
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; 
      if (!file) return;
      
      soundService.playMechanical();
      setImportStep('analyzing');
      setIsImporting(true);
      setImportStats(null);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target?.result as string;
              
              // Simulate "Smart Analysis" time for UX
              await new Promise(r => setTimeout(r, 1500));
              
              const result = storageService.smartParseAndValidate(text);
              
              if (!result.valid) {
                  throw new Error("تنسيق الملف غير صالح.");
              }
              
              setImportStats({
                  folders: result.stats?.foldersCount || 0,
                  history: result.stats?.historyCount || 0,
                  notes: result.stats?.notesCount || 0,
                  tasksCount: result.stats?.tasksCount || 0
              });
              
              // Store data temporarily in state/ref is unsafe for large files, 
              // but we need it for the next step. 
              // We'll attach it to the window object temporarily or just re-parse in next step.
              // Better: We keep it in a ref.
              (window as any).__TEMP_IMPORT_DATA = result.data;
              
              setImportStep('confirming');
              soundService.playMagic();
              
          } catch(err) {
              console.error(err);
              soundService.playError();
              alert("فشل التحليل الذكي: الملف تالف أو غير مدعوم.");
              setImportStep('idle');
              setIsImporting(false);
          } finally {
              e.target.value = '';
          }
      };
      reader.readAsText(file);
  };

  const confirmImport = async () => {
      const data = (window as any).__TEMP_IMPORT_DATA;
      if (!data) return;
      
      setImportStep('restoring');
      soundService.playMechanical();
      
      try {
          await storageService.restoreBackup(data.folders, data.history, data.notes, data.tasks);
          
          await new Promise(r => setTimeout(r, 1000)); // Success animation time
          
          soundService.playSuccess();
          alert("تم استعادة البيانات بنجاح!\nسيتم إعادة تحميل التطبيق الآن..."); 
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("حدث خطأ أثناء الكتابة في قاعدة البيانات.");
          setImportStep('idle');
          setIsImporting(false);
      } finally {
          delete (window as any).__TEMP_IMPORT_DATA;
      }
  };

  if (!isDataLoaded) { return ( <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4"> <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400" /> <p className="text-slate-600 dark:text-slate-400 font-bold text-lg">جاري تحميل بياناتك الآمنة...</p> </div> ); }
  const currentFolder = getCurrentFavoriteFolder();
  const currentNoteFolder = getCurrentNoteFolder();
  const goHome = () => { soundService.playPop(); setShowHistory(false); setShowFavorites(false); setStatus(AppStatus.IDLE); setResults([]); setTextResult(null); setSelectedArchive(null); setIsMentorActive(false); };

  const renderFavoritesView = () => {
    if (!activeRootFolderId) {
       return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
             {folders.map((f, idx) => (
                <div key={f.id} onClick={() => { soundService.playOptionSelect(idx); setActiveRootFolderId(f.id); }} className={`p-8 bg-white dark:bg-slate-900 border ${f.isIgnoredByDoctor ? 'border-red-200 dark:border-red-900/30' : 'border-slate-200 dark:border-slate-800'} rounded-[2rem] cursor-pointer hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group relative overflow-hidden`}>
                   <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                      {f.type === 'questions' && <CheckCircle className="w-32 h-32" />}
                      {f.type === 'quiz_sets' && <FileText className="w-32 h-32" />}
                      {f.type === 'snippets' && <Quote className="w-32 h-32" />}
                      {f.type === 'summaries' && <BookOpen className="w-32 h-32" />}
                   </div>
                   
                   <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleFolderIgnore(f.id); }} className={`absolute top-4 left-4 p-2 rounded-full z-20 ${f.isIgnoredByDoctor ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-300 hover:text-indigo-500'} dark:bg-slate-800`} title={f.isIgnoredByDoctor ? "مستبعد من شرح الطبيب" : "مشمول في شرح الطبيب"}>
                      {f.isIgnoredByDoctor ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                   </button>

                   <div className="flex items-center gap-4 mb-4 relative z-10">
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">
                         {f.type === 'questions' && <CheckCircle className="w-8 h-8" />}
                         {f.type === 'quiz_sets' && <FileText className="w-8 h-8" />}
                         {f.type === 'snippets' && <Quote className="w-8 h-8" />}
                         {f.type === 'summaries' && <BookOpen className="w-8 h-8" />}
                      </div>
                      <h3 className="font-black text-2xl text-slate-800 dark:text-white">{f.name}</h3>
                   </div>
                   <p className="text-slate-400 font-bold text-sm relative z-10 flex items-center gap-2">
                     <Folder className="w-4 h-4" /> {f.subFolders?.length || 0} مجلدات 
                     <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                     <LayoutGrid className="w-4 h-4" /> {f.questions?.length + f.snippets?.length + f.archives?.length} عناصر
                   </p>
                </div>
             ))}
          </div>
       );
    }
    return (
       <div className="animate-fade-in space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 gap-4"
               onDragOver={(e) => handleDragOver(e, activeRootFolderId)} 
               onDrop={(e) => handleDrop(e, activeRootFolderId, false)}
          >
             <div className="flex items-center gap-2 overflow-x-auto w-full"><button onClick={() => { soundService.playPop(); setActiveRootFolderId(null); }} className="flex items-center gap-1 font-bold text-slate-400 hover:text-indigo-600 text-sm whitespace-nowrap"><Home className="w-4 h-4" /> الرئيسية</button><ChevronLeft className="w-4 h-4 text-slate-300" /><span className="font-black text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{currentFolder?.name}</span></div>
             <div className="flex gap-2 w-full md:w-auto">
               {navigationPath.length > 0 && <button onClick={navigateBackFavorites} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5 text-slate-500" /></button>}
               <button onClick={() => { soundService.playClick(); setShowManualSnippetModal(true); setManualSnippetData(prev => ({...prev, folderId: activeRootFolderId || 'f_s'})); }} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 whitespace-nowrap"><PenTool className="w-4 h-4" /> كتابة مقتطف</button>
               <button onClick={() => { soundService.playClick(); setIsCreatingFolder(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 whitespace-nowrap"><FolderPlus className="w-4 h-4" /> مجلد جديد</button>
             </div>
          </div>
          {isCreatingFolder && <div className="flex gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 animate-fade-in"><input autoFocus type="text" placeholder="اسم المجلد الجديد..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="flex-1 p-3 bg-white dark:bg-slate-800 border rounded-xl dark:border-slate-700 dark:text-white focus:outline-none focus:border-indigo-500" /><button onClick={createSubFolder} className="bg-emerald-600 text-white px-6 rounded-xl font-bold">حفظ</button><button onClick={() => { soundService.playClick(); setIsCreatingFolder(false); }} className="text-slate-400 px-4 font-bold">إلغاء</button></div>}
          {currentFolder?.subFolders && currentFolder.subFolders.length > 0 && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{currentFolder.subFolders.map((sf: any) => (
               <div 
                 key={sf.id} 
                 onClick={() => navigateFavorites(sf.id)} 
                 draggable
                 onDragStart={(e) => handleDragStart(e, 'fav_folder', sf.id, currentFolder.id)}
                 onDragOver={(e) => handleDragOver(e, sf.id)}
                 onDrop={(e) => { e.stopPropagation(); handleDrop(e, sf.id, false); }}
                 className={`bg-slate-50 dark:bg-slate-900 border p-4 rounded-2xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group relative transition-all ${sf.isIgnoredByDoctor ? 'border-red-200 bg-red-50/10 dark:border-red-900/20' : 'border-slate-200 dark:border-slate-800'} ${dragOverFolderId === sf.id ? 'border-2 border-indigo-500 scale-105 bg-indigo-50' : ''}`}
               >
                 <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-50">
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); initiateRename(sf.id, sf.name, 'fav_folder'); }} className="p-1.5 text-slate-300 hover:text-indigo-500 bg-white/80 dark:bg-slate-800/80 rounded-full shadow-sm"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeElement(sf.id, currentFolder.id, 'subfolder'); }} className="p-1.5 text-slate-300 hover:text-red-500 bg-white/80 dark:bg-slate-800/80 rounded-full shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                 </div>
                 
                 <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleFolderIgnore(sf.id); }} className={`absolute top-2 right-2 p-1.5 rounded-full z-20 ${sf.isIgnoredByDoctor ? 'text-red-500 bg-red-100 dark:bg-red-900/50' : 'text-slate-300 hover:text-indigo-500'} opacity-0 group-hover:opacity-100 transition-all`}>
                      {sf.isIgnoredByDoctor ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                 </button>

                 <Folder className={`w-10 h-10 mb-2 ${sf.isIgnoredByDoctor ? 'text-red-300 dark:text-red-900' : 'text-indigo-300 dark:text-indigo-600'}`} />
                 <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{sf.name}</h4>
                 <p className="text-xs text-slate-400">{sf.subFolders?.length || 0} مجلد • {sf.questions?.length + sf.snippets?.length + sf.archives?.length} عنصر</p>
               </div>
             ))}</div>
          )}
          <div className="space-y-6">
            {currentFolder?.archives?.map((arc:any) => (
              <div 
                key={arc.id} 
                onClick={() => { soundService.playPop(); setSelectedArchive(arc); }} 
                draggable
                onDragStart={(e) => handleDragStart(e, 'archive', arc.id, currentFolder.id)}
                className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 relative group hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="absolute top-4 left-4 text-slate-300 opacity-20"><GripVertical className="w-5 h-5" /></div>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeElement(arc.id, currentFolder.id, 'archive'); }} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 z-50 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                <h4 className="font-black text-xl text-indigo-900 dark:text-indigo-100 mb-2">{arc.title}</h4><p className="text-xs text-indigo-400 dark:text-indigo-400 mb-6 font-black uppercase tracking-widest">{new Date(arc.createdAt).toLocaleDateString('ar-EG')}</p><div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">{typeof arc.content === 'string' ? <div className="line-clamp-3 text-slate-600 dark:text-slate-300"><MarkdownRenderer text={arc.content.substring(0, 300) + "..."} /></div> : <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold text-sm"><FileText className="w-4 h-4 text-indigo-500" /> اختبار كامل: {arc.content.length} سؤال</div>}</div>
              </div>
            ))}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentFolder?.snippets?.map((s:any) => (
                <div 
                  key={s.id} 
                  onClick={() => { soundService.playPop(); setSelectedSnippet(s); setPendingFormat(null); }} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'snippet', s.id, currentFolder.id)}
                  className="cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all group"
                >
                   <div className="absolute top-4 left-4 text-slate-300 opacity-20"><GripVertical className="w-5 h-5" /></div>
                   <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeElement(s.id, currentFolder.id, 'snippet'); }} className="absolute bottom-4 left-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 z-50 rounded-full"><Trash2 className="w-4 h-4" /></button>
                   <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-[4rem] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                   <Quote className="absolute top-4 right-4 text-indigo-100 dark:text-indigo-900/30 w-12 h-12 rotate-12" />
                   
                   <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                         <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                         <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate max-w-[200px]">{s.sourceTitle}</h4>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed line-clamp-4 text-lg">"{s.text}"</p>
                   </div>
                   
                   <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                      {s.imageData ? <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg"><ImageIcon className="w-3 h-3" /> مرفق صورة</div> : <div className="h-5"></div>}
                   </div>
                </div>
              ))}
            </div>

            {currentFolder?.questions?.map((q:any, i:number) => (
              <div 
                key={i} 
                draggable
                onDragStart={(e) => handleDragStart(e, 'question', i, currentFolder.id)}
                className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 relative group shadow-sm hover:shadow-md transition-all flex flex-col"
                dir={isArabicText(q.question) ? 'rtl' : 'ltr'}
              >
                <div className="absolute top-4 left-4 text-slate-300 opacity-20"><GripVertical className="w-5 h-5" /></div>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeElement(i, currentFolder.id, 'question'); }} className={`absolute top-6 ${isArabicText(q.question) ? 'left-6' : 'right-6'} p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 z-50 rounded-xl`}><Trash2 className="w-5 h-5" /></button>
                <h4 className={`font-bold text-lg mb-4 text-slate-900 dark:text-slate-100 leading-relaxed ${isArabicText(q.question) ? 'pr-8 text-right' : 'pl-8 text-left'}`}>{renderFormattedText(q.question)}</h4><div className={`bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-xl text-emerald-800 dark:text-emerald-300 font-black border border-emerald-100 dark:border-emerald-800 inline-block text-sm mb-3 self-start`}>Answer: {renderFormattedText(q.correctAnswer)}</div><p className={`text-slate-500 dark:text-slate-400 text-sm italic ${isArabicText(q.reason) ? 'text-right' : 'text-left'}`}>{renderFormattedText(q.reason)}</p>
              </div>
            ))}
          </div>
       </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 relative transition-colors duration-300">
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; } 
        ::-webkit-scrollbar-track { background: transparent; } 
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; } 
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; } 
        .dark ::-webkit-scrollbar-thumb { background: #334155; } 
        .dark ::-webkit-scrollbar-thumb:hover { background: #475569; }
        
        @keyframes fireAnim {
          0% { color: #d97706; text-shadow: 0 0 4px rgba(251, 191, 36, 0.5); }
          50% { color: #b45309; text-shadow: 0 0 10px rgba(245, 158, 11, 0.6), 0 0 20px rgba(251, 191, 36, 0.2); }
          100% { color: #d97706; text-shadow: 0 0 4px rgba(251, 191, 36, 0.5); }
        }
        .fire-text {
          font-weight: 900;
          animation: fireAnim 2.5s infinite alternate ease-in-out;
          border-bottom: 2px dashed rgba(245, 158, 11, 0.5);
          padding-bottom: 1px;
        }
      `}</style>
      
      {showTemplate2Modal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto w-full">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-lg w-full shadow-2xl relative text-right border-2 border-indigo-500/20 my-8">
            <button 
              onClick={() => setShowTemplate2Modal(null)} 
              className="absolute top-6 left-6 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
              <Download className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 font-cairo">خيارات التصدير (القالب الثاني)</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 font-cairo text-sm leading-relaxed">
              حدد المعلومات التي ترغب بتضمينها في ملف الـ PDF. لن يتم تصدير الخيارات غير المحددة.
            </p>

            <div className="space-y-4 mb-8">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  checked={template2Options.includeEnglishSummary} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, includeEnglishSummary: e.target.checked}))} 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">الملخص الأساسي (إنجليزي)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  checked={template2Options.includeDoctorNotes} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, includeDoctorNotes: e.target.checked}))} 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">ملاحظات الدكتور الأساسية</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  checked={template2Options.includeAdditionalNotes} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, includeAdditionalNotes: e.target.checked}))} 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">ملاحظات إضافية</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  checked={template2Options.includeArabicGuide} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, includeArabicGuide: e.target.checked}))} 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">المرشد العربي (شرح تفصيلي)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  checked={template2Options.includePastQuestions} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, includePastQuestions: e.target.checked}))} 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">أسئلة السنين السابقة</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  checked={template2Options.includeExpectedQuestions} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, includeExpectedQuestions: e.target.checked}))} 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">أسئلة وأفكار متوقعة</span>
              </label>

              {/* AI Math & Equation / Symbols Correction Option */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 bg-purple-50/40 dark:bg-purple-950/20 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-600" 
                  checked={template2Options.enableMathSuperCheck} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, enableMathSuperCheck: e.target.checked}))} 
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-700 dark:text-purple-300 text-lg">فحص وتصحيح المعادلات والرموز الرياضية بالذكاء الاصطناعي</span>
                    <span className="text-[10px] bg-purple-200 dark:bg-purple-800/70 text-purple-800 dark:text-purple-200 font-black px-2 py-0.5 rounded-full">AI Math & Symbols Fix</span>
                  </div>
                  <p className="text-xs text-purple-600/90 dark:text-purple-400 mt-0.5 font-medium leading-relaxed">
                    فحص وتصحيح جميع الرموز والمعادلات الرياضية والعلمية المشوهة أو الخاطئة (مثل $$ و %% والمعادلات المكسورة) وتحويلها إلى صيغ ورموز سليمة وواضحة.
                  </p>
                </div>
              </label>
              
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-4" />

              {lectureFiles.length > 1 && (
                <div className="mb-4">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/10 transition">
                    <input type="checkbox" className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-600" 
                      checked={template2Options.separateLectures} 
                      onChange={(e) => setTemplate2Options(prev => {
                         const separateLectures = e.target.checked;
                         const lectureConfigs = { ...prev.lectureConfigs };
                         if (separateLectures) {
                            lectureFiles.forEach(f => {
                               if (!lectureConfigs[f.id]) lectureConfigs[f.id] = { include: true, customName: f.name.replace(/\.[^/.]+$/, "") };
                            });
                         }
                         return {...prev, separateLectures, lectureConfigs};
                      })} 
                    />
                    <span className="font-bold text-amber-600 dark:text-amber-500 text-lg">إنشاء ملخص منفصل لكل محاضرة</span>
                  </label>
                  
                  {template2Options.separateLectures && (
                    <div className="mt-3 pr-8 space-y-3">
                      <p className="text-sm text-slate-500 font-bold mb-2">حدد المحاضرات التي تريد تضمينها، واكتب اسم الخانة ليظهر في الملف:</p>
                      {lectureFiles.map((f, i) => {
                         const config = template2Options.lectureConfigs[f.id] || { include: true, customName: f.name.replace(/\.[^/.]+$/, "") };
                         // Determine identifying "first" lecture that will get the arabic guide
                         const isFirstIncluded = lectureFiles.find(lf => (template2Options.lectureConfigs[lf.id] || { include: true }).include)?.id === f.id;
                         return (
                           <div key={f.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                                checked={config.include} 
                                onChange={(e) => setTemplate2Options(prev => ({
                                  ...prev, 
                                  lectureConfigs: { ...prev.lectureConfigs, [f.id]: { ...config, include: e.target.checked } }
                                }))}
                              />
                              <input type="text" className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                                value={config.customName}
                                placeholder="اسم الخانة (مثل: المحاضرة الأولى)"
                                onChange={(e) => setTemplate2Options(prev => ({
                                  ...prev, 
                                  lectureConfigs: { ...prev.lectureConfigs, [f.id]: { ...config, customName: e.target.value } }
                                }))}
                              />
                              {isFirstIncluded && config.include && template2Options.includeArabicGuide && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">المرشد سيشرحها</span>
                              )}
                           </div>
                         );
                      })}
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/10 transition border border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20">
                <input type="checkbox" className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-600" 
                  checked={template2Options.onlyImportantExamPoints} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, onlyImportantExamPoints: e.target.checked}))} 
                />
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-base block font-cairo">تصدير الأمور المهمة فقط (مراجعة ليلة الامتحان - High Yield)</span>
                    <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">Pre-Exam Review</span>
                  </div>
                  <span className="text-xs text-amber-700/80 dark:text-amber-400/80 block font-cairo">يركز التصدير على الركائز الامتحانية والمعايير الذهبية والأدوية الحتمية لسرعة المراجعة</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/20">
                <input type="checkbox" className="w-5 h-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600" 
                  checked={template2Options.closePastExamGaps} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, closePastExamGaps: e.target.checked}))} 
                />
                <div className="text-right">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 text-base block font-cairo">سد فجوات أسئلة السنين في الملخص (الشمولية الذهبية 100%)</span>
                  <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 block font-cairo">يدمج الأدوية بأسمائها الصريحة وسياقها السريري والسميات العضوية والمفاهيم المتقابلة</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition">
                <input type="checkbox" className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-600" 
                  checked={template2Options.removeFakeInfoConfirm} 
                  onChange={(e) => setTemplate2Options(prev => ({...prev, removeFakeInfoConfirm: e.target.checked}))} 
                />
                <span className="font-bold text-red-600 dark:text-red-400 text-lg">إزالة المعلومات الدخيلة (تنظيف الفايل)</span>
              </label>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => {
                  const data = showTemplate2Modal;
                  setShowTemplate2Modal(null);
                  handleExportSummaryPDFTemplate2(data.summaryText, template2Options, 'print');
                }} 
                className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black hover:bg-indigo-700 active:scale-95 transition-all text-lg shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 font-cairo"
              >
                <Printer className="w-5 h-5" />
                <span>تصدير / طباعة PDF</span>
              </button>
              <button 
                onClick={() => {
                  const data = showTemplate2Modal;
                  setShowTemplate2Modal(null);
                  handleExportSummaryPDFTemplate2(data.summaryText, template2Options, 'html');
                }} 
                className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-black hover:bg-emerald-700 active:scale-95 transition-all text-lg shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 font-cairo"
              >
                <Download className="w-5 h-5" />
                <span>تنزيل كملف HTML</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML EXPORT OPTIONS MODAL */}
      {showHtmlExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-lg w-full shadow-2xl relative text-right border-2 border-indigo-500/20 my-8">
            <button 
              onClick={() => setShowHtmlExportModal(null)} 
              className="absolute top-6 left-6 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400">
              <FileDown className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 font-cairo">خيارات تصدير ملف HTML التفاعلي (القالب 2 المطور)</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 font-cairo text-sm leading-relaxed">
              حدد ما تريد تضمينه في ملف الـ HTML التفاعلي بالقالب 2 المطور. ضع علامة صح على العناصر التي تريد تصديرها، وأزلها عن العناصر التي لا تريدها:
            </p>

            <div className="space-y-4 mb-8">
              {/* 1. English Summary */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition border border-slate-100 dark:border-slate-800 ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.includeEnglishSummary} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, includeEnglishSummary: e.target.checked}))} 
                />
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-base block font-cairo">الملخص الأساسي (إنجليزي)</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block font-cairo">المحتوى العلمي والطبي للمحاضرة باللغة الإنجليزية مع الجداول والمخططات</span>
                </div>
              </label>

              {/* 2. Arabic Guide */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.includeArabicGuide} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, includeArabicGuide: e.target.checked}))} 
                />
                <div className="text-right">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 text-base block font-cairo">كلام المرشد العربي (شرح تفصيلي)</span>
                  <span className="text-xs text-indigo-600/80 dark:text-indigo-400/80 block font-cairo">شرح تفصيلي للمحاضرة بالعربي يوضح المفاهيم والفخاخ الامتحانية والأمور الدقيقة</span>
                </div>
              </label>

              {/* 3. Past Exam Questions */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition border border-slate-100 dark:border-slate-800 ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.includePastQuestions} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, includePastQuestions: e.target.checked}))} 
                />
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-base block font-cairo">أسئلة السنوات السابقة (المتعلقة بالمحاضرة)</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block font-cairo">تضمين أسئلة السنين السابقة داخل ملف الـ HTML التفاعلي مع خياراتها وتفسيرها</span>
                </div>
              </label>

              {/* 4. Expected Questions */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition border border-slate-100 dark:border-slate-800 ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.includeExpectedQuestions} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, includeExpectedQuestions: e.target.checked}))} 
                />
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-base block font-cairo">أسئلة وأفكار متوقعة (توقعات جديدة)</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block font-cairo">أسئلة امتحانية ذكية جديدة متوقعة تم توليدها بالذكاء الاصطناعي للتدريب</span>
                </div>
              </label>

              {/* 5. Remove Extraneous / Non-Lecture Info (حذف الدخيل) */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition border border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-rose-50 dark:hover:bg-rose-950/20'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-rose-300 text-rose-600 focus:ring-rose-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.removeExtraneousInfo} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, removeExtraneousInfo: e.target.checked}))} 
                />
                <div className="text-right flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-900 dark:text-rose-200 text-base block font-cairo">تأكد من حذف الدخيل (إزالة أي معلومات من محاضرات ثانية)</span>
                    <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">تنقية المحاضرة</span>
                  </div>
                  <span className="text-xs text-rose-700/80 dark:text-rose-400/80 block font-cairo">فحص وتصفية الملخص والأسئلة لحذف أي معلومة أو موضوع يخص محاضرات ثانية مو ضمن هذه المحاضرة</span>
                </div>
              </label>

              {/* 6. Ensure All Past Exam Questions for this Lecture */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.ensureAllPastQuestions} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, ensureAllPastQuestions: e.target.checked}))} 
                />
                <div className="text-right flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 text-base block font-cairo">تأكد من تنزيل كل أسئلة السنين التي تخص هذه المحاضرة</span>
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">شامل 100%</span>
                  </div>
                  <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80 block font-cairo">استخراج وفحص كل أسئلة السنوات السابقة بدقة تامة وضمان عدم تفويت أو إهمال أي سؤال تابع لهذه المحاضرة</span>
                </div>
              </label>

              {/* 7. AI Math & Scientific Notation Correction */}
              <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/40 dark:bg-purple-950/20 transition ${isExportingPDF ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-50 dark:hover:bg-purple-900/10'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-600" 
                  disabled={isExportingPDF}
                  checked={htmlExportOptions.enableMathSuperCheck} 
                  onChange={(e) => setHtmlExportOptions(prev => ({...prev, enableMathSuperCheck: e.target.checked}))} 
                />
                <div className="flex-1 text-right">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-700 dark:text-purple-300 text-base block font-cairo">فحص وتصحيح المعادلات والرموز الرياضية بالذكاء الاصطناعي</span>
                  </div>
                  <span className="text-xs text-purple-600/90 dark:text-purple-400 block font-cairo">إصلاح الرموز المكسورة وصيغ LaTeX والمعادلات الكيميائية داخل ملف الـ HTML</span>
                </div>
              </label>
            </div>

            {/* LIVE EXPORT PROGRESS STATUS BANNER */}
            {isExportingPDF && (
              <div className="mb-6 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-400 dark:border-indigo-600 flex items-center gap-3 text-right animate-pulse">
                <Loader2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                <div className="flex-1">
                  <h4 className="font-black text-indigo-950 dark:text-indigo-100 text-sm font-cairo">
                    جاري التجهيز والتصدير بالقالب 2 المطور...
                  </h4>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 font-bold font-cairo mt-0.5">
                    {exportStatusText || "يرجى الانتظار ثوانٍ قليلة، جاري تحضير ملف الـ HTML التفاعلي بالقالب 2..."}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button 
                disabled={isExportingPDF}
                onClick={() => {
                  handleExportHtmlModalAction('html');
                }} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-4 font-black active:scale-95 transition-all text-lg shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 font-cairo disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExportingPDF ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري تجهيز وتنزيل قالب 2...</span></>
                ) : (
                  <><FileDown className="w-5 h-5" /><span>تنزيل ملف HTML (قالب 2)</span></>
                )}
              </button>
              <button 
                disabled={isExportingPDF}
                onClick={() => {
                  handleExportHtmlModalAction('print');
                }} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 font-black active:scale-95 transition-all text-lg shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 font-cairo disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExportingPDF ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري التحضير...</span></>
                ) : (
                  <><Printer className="w-5 h-5" /><span>معاينة تفاعلية / طباعة (قالب 2)</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECTION POPUP UI - NOW EXPLICITLY RENDERED IN MAIN RETURN */}
      {selectionBox && (
        <div 
          className="fixed z-[200] flex flex-col items-center gap-2 selection-bubble animate-scale-in" 
          style={{ left: selectionBox.x, top: selectionBox.y, transform: 'translate(-50%, -100%)' }}
        >
           <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-1.5 flex gap-1 items-center border border-slate-700/50">
              <button onMouseDown={(e) => { e.preventDefault(); handleTranslate(); }} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded-lg transition-colors text-xs font-bold whitespace-nowrap"><Languages className="w-3.5 h-3.5 text-indigo-400" /> ترجمة</button>
              <div className="w-[1px] h-4 bg-slate-700"></div>
              <button onMouseDown={(e) => { e.preventDefault(); initiateSave('snippet', selectionBox.text); setSaveName("مقتطف سريع"); setSelectionBox(null); }} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded-lg transition-colors text-xs font-bold whitespace-nowrap"><Quote className="w-3.5 h-3.5 text-emerald-400" /> حفظ مقتطف</button>
              <div className="w-[1px] h-4 bg-slate-700"></div>
              <button onMouseDown={(e) => { e.preventDefault(); navigator.clipboard.writeText(selectionBox.text); setSelectionBox(null); soundService.playClick(); }} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"><Copy className="w-3.5 h-3.5 text-slate-400" /></button>
           </div>
           <div className="w-3 h-3 bg-slate-900 rotate-45 border-b border-r border-slate-700/50 -mt-2"></div>
        </div>
      )}

      {/* TRANSLATION POPUP */}
      {activeTranslation && (
        <div 
          className="fixed z-[200] max-w-xs md:max-w-sm bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl translation-bubble animate-fade-in-up" 
          style={{ left: activeTranslation.x, top: activeTranslation.y + 20, transform: 'translate(-50%, 0)' }}
        >
           <div className="flex justify-between items-start mb-2">
              <h4 className="font-black text-xs text-indigo-200 uppercase tracking-widest flex items-center gap-1"><Languages className="w-3 h-3" /> الترجمة العربية</h4>
              <button onClick={() => setActiveTranslation(null)} className="text-indigo-300 hover:text-white"><X className="w-4 h-4" /></button>
           </div>
           <p className="text-sm font-bold leading-relaxed" dir="rtl">{activeTranslation.text}</p>
        </div>
      )}

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-2xl tracking-tight cursor-pointer" onClick={goHome}><BrainCircuit className="w-9 h-9" /><span>Exam Matcher AI</span></div>
        <div className="flex items-center gap-3">
          <div onClick={() => alert("معلومة: كل بياناتك محفوظة داخل هذا المتصفح فقط. إذا قمت بمسح بيانات المتصفح أو فتحته من مكان آخر ستجد التطبيق فارغاً. استخدم خيار التصدير في الإعدادات لنقل بياناتك.")} title="تنبيه التخزين" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 cursor-help active:scale-95 transition-transform"><CloudOff className="w-3.5 h-3.5 text-slate-400" /><span className="text-[10px] font-black text-slate-400">تخزين محلي</span></div>
          <button onClick={() => { soundService.playToggle(); setShowTasksSidebar(!showTasksSidebar); }} className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-95 flex items-center gap-1" title="قائمة المهام"><ListTodo className="w-5 h-5" /></button>
          <button onClick={() => { soundService.playMechanical(); setShowSettings(true); }} className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95"><Settings className="w-5 h-5" /></button>
          <button onClick={() => { soundService.playToggle(); setIsDarkMode(!isDarkMode); }} className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={handleMentorClick} disabled={lectureFiles.length === 0 && pastExamFiles.length === 0} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm transition-all active:scale-95 border ${lectureFiles.length > 0 || pastExamFiles.length > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700 hover:shadow-md cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-transparent cursor-not-allowed opacity-60'} ${isMentorActive ? 'shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-pulse' : ''}`}><Sparkles className={`w-5 h-5 ${isMentorActive ? 'fill-yellow-400 text-yellow-500' : ''}`} /> <span className="hidden sm:inline">المرشد</span></button>
          <button onClick={() => { soundService.playTabChange(); setShowHistory(true); setShowFavorites(false); setStatus(AppStatus.IDLE); }} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-black text-sm hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:shadow-md transition-all active:scale-95 border border-purple-100 dark:border-purple-900/50"><History className="w-5 h-5" /> <span className="hidden sm:inline">السجل</span></button>
          <button onClick={() => { soundService.playTabChange(); setShowFavorites(true); setShowHistory(false); setStatus(AppStatus.IDLE); }} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-black text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:shadow-md transition-all active:scale-95 border border-amber-100 dark:border-amber-900/50"><Bookmark className="w-5 h-5 fill-amber-400 text-amber-500" /> <span className="hidden sm:inline">المفضلة</span></button>
        </div>
      </header>

      {/* TASKS / PLANNER SIDEBAR (LEFT) */}
      <div className={`fixed inset-y-0 left-0 w-full md:w-[24rem] bg-white dark:bg-slate-900 shadow-2xl z-[150] border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showTasksSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="h-full flex flex-col pt-4">
             <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400"><ListTodo className="w-6 h-6" /></div>
                   <div>
                      <h3 className="font-black text-xl text-slate-900 dark:text-white">مهامي اليومية</h3>
                      <p className="text-xs text-slate-400 font-bold">{tasks.filter(t => t.status === 'completed').length} / {tasks.length} مكتملة</p>
                   </div>
                </div>
                <button onClick={() => setShowTasksSidebar(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
             </div>
             
             {/* Progress Bar */}
             {tasks.length > 0 && (
                 <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
                     <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(tasks.filter(t => t.status === 'completed').length / tasks.length) * 100}%` }}></div>
                 </div>
             )}

             <div className="p-6">
                <div className="flex gap-2">
                   <input type="text" placeholder="أضف مهمة جديدة..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700 dark:text-white" />
                   <button onClick={addTask} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors"><Plus className="w-5 h-5" /></button>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar space-y-3">
                {tasks.length === 0 && <div className="text-center py-10 text-slate-400"><ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="font-bold">لا توجد مهام اليوم</p></div>}
                
                {tasks.map(task => (
                   <div key={task.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between group ${task.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30' : task.status === 'failed' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                      <span className={`font-bold flex-1 ml-4 ${task.status === 'completed' ? 'text-emerald-700 dark:text-emerald-400 line-through decoration-2' : task.status === 'failed' ? 'text-red-700 dark:text-red-400 line-through decoration-2' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</span>
                      
                      <div className="flex items-center gap-1">
                         <button onClick={() => updateTaskStatus(task.id, 'completed')} className={`p-1.5 rounded-lg transition-colors ${task.status === 'completed' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`} title="تم الإنجاز"><CheckSquare className="w-5 h-5" /></button>
                         <button onClick={() => updateTaskStatus(task.id, 'failed')} className={`p-1.5 rounded-lg transition-colors ${task.status === 'failed' ? 'bg-red-500 text-white shadow-md' : 'text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`} title="لم يتم الإنجاز"><XSquare className="w-5 h-5" /></button>
                         <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                         <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                   </div>
                ))}
             </div>
         </div>
      </div>

      {/* SAVE CONFIRMATION MODAL (Handles saveTarget state) */}
      {saveTarget && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-white/10 relative flex flex-col gap-6">
              <div className="text-center">
                 <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                    <Save className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white">حفظ المحتوى</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                    {saveTarget.type === 'snippet' && 'مقتطف نصي'}
                    {saveTarget.type === 'question' && 'سؤال فردي'}
                    {saveTarget.type === 'quiz' && 'اختبار كامل'}
                    {saveTarget.type === 'summary' && 'ملخص ذهبي'}
                    {saveTarget.type === 'convert_to_snippets' && 'تحويل إلى مقتطفات متعددة'}
                 </p>
              </div>

              <div className="space-y-4">
                 {saveTarget.type !== 'convert_to_snippets' && (
                 <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">العنوان / المصدر</label>
                    <input 
                      type="text" 
                      placeholder="أدخل اسماً للحفظ..." 
                      value={saveName} 
                      onChange={(e) => setSaveName(e.target.value)} 
                      className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 rounded-2xl focus:border-indigo-500 outline-none font-bold text-slate-900 dark:text-white text-right" 
                      autoFocus 
                    />
                 </div>
                 )}

                 <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">المجلد الوجهة</label>
                    <select 
                      value={saveFolderId} 
                      onChange={(e) => setSaveFolderId(e.target.value)} 
                      className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 rounded-2xl focus:border-indigo-500 outline-none font-bold text-slate-700 dark:text-slate-300" 
                      dir="rtl"
                    >
                       <option value="root">📂 المجلد الرئيسي (الافتراضي)</option>
                       {(() => { 
                          const renderOptions = (list: any[], depth: number) => list.map(f => (
                             <React.Fragment key={f.id}>
                                <option value={f.id}>{"\u00A0".repeat(depth * 4) + "📂 " + f.name}</option>
                                {f.subFolders && f.subFolders.length > 0 && renderOptions(f.subFolders, depth + 1)}
                             </React.Fragment>
                          ));
                          return renderOptions(folders, 0);
                       })()}
                    </select>
                 </div>
                 
                 {saveTarget.type === 'snippet' && (
                    <div>
                       <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">صورة مرفقة (اختياري)</label>
                       {saveImage ? (
                          <div className="relative h-32 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                             <img src={saveImage} className="w-full h-full object-cover" alt="Preview" />
                             <button onClick={() => setSaveImage(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><X className="w-4 h-4" /></button>
                          </div>
                       ) : (
                          <label className="flex items-center justify-center h-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all gap-2 text-slate-400">
                             <ImageIcon className="w-5 h-5" />
                             <span className="text-xs font-bold">رفع صورة</span>
                             <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          </label>
                       )}
                    </div>
                 )}
              </div>

              <div className="flex gap-4 pt-2">
                 <button onClick={saveToArchive} disabled={isConverting} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                    {isConverting ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري التحويل...</> : 'حفظ'}
                 </button>
                 <button onClick={() => setSaveTarget(null)} disabled={isConverting} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">إلغاء</button>
              </div>
           </div>
        </div>
      )}

      {/* RENAMING MODAL */}
      {renamingTarget && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-white/10 relative">
              <h3 className="text-2xl font-black mb-4 text-center text-slate-900 dark:text-white">إعادة تسمية</h3>
              <input 
                type="text" 
                value={renamingTarget.name} 
                onChange={(e) => setRenamingTarget({...renamingTarget, name: e.target.value})} 
                className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 rounded-2xl text-right focus:border-indigo-500 outline-none transition-all font-bold text-lg text-slate-900 dark:text-white mb-6" 
                dir="auto" 
                autoFocus 
              />
              <div className="flex gap-4">
                 <button onClick={handleRenameSubmit} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all">حفظ</button>
                 <button onClick={() => setRenamingTarget(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">إلغاء</button>
              </div>
           </div>
        </div>
      )}

      {/* SNIPPET VIEWER MODAL - CENTERED POPUP */}
      {selectedSnippet && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                 <div className="flex items-center gap-3">
                    <Quote className="w-8 h-8 text-indigo-500" />
                    <div>
                       <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedSnippet.sourceTitle}</h2>
                       <p className="text-xs text-slate-400 font-bold">{new Date(selectedSnippet.createdAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => handleSpeak(pendingFormat ? pendingFormat.formatted : selectedSnippet.text)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 transition-all"><Volume2 className="w-5 h-5" /></button>
                    {!pendingFormat && (
                      <button onClick={() => handleSmartFormat(selectedSnippet.text)} className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 transition-all" title="تنسيق ذكي">
                        {isFormatting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                      </button>
                    )}
                    <button onClick={() => handleCodeCorrection(selectedSnippet.text)} className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-all" title="تصحيح الكود (للاختبارات وبرمجة التطبيقات)">
                       {isCorrectingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <BugOff className="w-5 h-5" />}
                    </button>
                    <button onClick={() => { setSelectedSnippet(null); setPendingFormat(null); }} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-100 hover:text-red-500 transition-all"><X className="w-5 h-5" /></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar relative">
                 {selectedSnippet.imageData && (
                    <div className="mb-8 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg max-w-2xl mx-auto">
                       <img src={selectedSnippet.imageData} alt="Snippet Attachment" className="w-full object-cover" />
                    </div>
                 )}
                 <div className="text-xl md:text-2xl leading-loose font-medium text-slate-800 dark:text-slate-200 max-w-4xl mx-auto font-cairo">
                    <MarkdownRenderer text={pendingFormat ? pendingFormat.formatted : selectedSnippet.text} />
                 </div>
              </div>
              
              {/* APPROVAL BAR FOR SMART FORMATTING AND CODE CORRECTION */}
              {pendingFormat && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-3 animate-fade-in-up">
                   <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-xs font-black text-slate-400 px-2 flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-500" /> اقتراح تعديل</span>
                      <button onClick={applyFormat} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">اعتماد التعديل</button>
                      <button onClick={cancelFormat} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold transition-colors">إلغاء</button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* ARCHIVE VIEWER MODAL - CENTERED POPUP */}
      {selectedArchive && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                 <div className="flex items-center gap-3">
                    {selectedArchive.type === 'summary_doc' ? <BookOpen className="w-8 h-8 text-emerald-500" /> : <FileText className="w-8 h-8 text-indigo-500" />}
                    <div>
                       <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedArchive.title}</h2>
                       <p className="text-xs text-slate-400 font-bold">{selectedArchive.type === 'summary_doc' ? 'وثيقة ملخصة' : 'مجموعة اختبار'} • {new Date(selectedArchive.createdAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedArchive(null)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-100 hover:text-red-500 transition-all"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                 {typeof selectedArchive.content === 'string' ? (
                    <div className="prose prose-xl dark:prose-invert max-w-none prose-headings:font-black font-cairo leading-loose">
                       <MarkdownRenderer text={selectedArchive.content} />
                    </div>
                 ) : (
                    <div className="grid gap-6 max-w-4xl mx-auto">
                       {selectedArchive.content.map((q: any, idx: number) => {
                          const isDirRtl = isArabicText(q.question);
                          return (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700" dir={isDirRtl ? 'rtl' : 'ltr'}>
                             <h4 className={`font-bold text-lg mb-4 text-slate-900 dark:text-white ${isDirRtl ? 'text-right' : 'text-left'}`}><span className={`text-indigo-500 ${isDirRtl ? 'ml-2' : 'mr-2'}`}>#{idx+1}</span> {renderFormattedText(q.question)}</h4>
                             <div className="space-y-2 mb-4">
                                {q.options.map((opt: string, oid: number) => (
                                   <div key={oid} className={`p-3 ${isDirRtl ? 'text-right' : 'text-left'} rounded-xl border ${opt === q.correctAnswer ? 'bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>{renderFormattedText(opt)}</div>
                                ))}
                             </div>
                             <p className={`text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl ${isArabicText(q.reason) ? 'text-right' : 'text-left'}`}>{renderFormattedText(q.reason)}</p>
                          </div>
                          );
                       })}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {showMentor && (
        <div className="fixed inset-0 bg-slate-900/80 dark:bg-slate-950/90 z-[80] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
           <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col border border-yellow-200/50 dark:border-yellow-700/30 relative">
              <button onClick={() => { soundService.playPop(); setShowMentor(false); }} className="absolute top-6 left-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 z-10 hover:rotate-90 transition-all"><X className="w-6 h-6" /></button>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-8 flex flex-col md:flex-row items-center gap-8 border-b border-yellow-100 dark:border-yellow-800/50">
                 <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full border-4 border-yellow-400 shadow-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden group"><div className="absolute inset-0 bg-yellow-400/20 animate-pulse"></div><GraduationCap className="w-12 h-12 text-yellow-600 dark:text-yellow-500 relative z-10" /></div>
                 <div className="text-center md:text-right flex-1"><h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">المرشد الأكاديمي</h2><p className="text-slate-600 dark:text-slate-300 font-medium">أقوم بتحليل المحتوى وربط المفاهيم بأسلوب علمي دقيق.</p></div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white dark:bg-slate-900 relative">
                 {!mentorContent ? (
                   <div className="flex flex-col items-center justify-center h-full gap-6 opacity-60"><div className="relative"><div className="w-20 h-20 border-8 border-yellow-100 dark:border-slate-800 border-t-yellow-500 rounded-full animate-spin"></div><Sparkles className="w-8 h-8 text-yellow-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" /></div><p className="text-xl font-bold text-slate-400 animate-pulse">جاري صياغة النصائح الذهبية...</p></div>
                 ) : (
                   <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-black prose-p:leading-loose font-cairo"><MarkdownRenderer text={mentorContent} /></div>
                 )}
              </div>
           </div>
        </div>
      )}

      {showDoctorChat && (
        <div className="fixed bottom-6 left-6 z-[70] flex flex-col items-start max-w-sm">
          {(doctorMessage || isDoctorThinking) ? (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-black/50 border border-indigo-100 dark:border-slate-700 w-full animate-scale-in origin-bottom-left relative">
              <div className="flex items-center justify-between mb-3 border-b border-indigo-50 dark:border-slate-700 pb-2">
                 <div className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-black text-indigo-900 dark:text-indigo-200 text-sm">طبيب الدراسة</span>
                 </div>
                 <button onClick={() => { setDoctorMessage(null); setDoctorState('idle'); }} className="p-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                 </button>
              </div>
              {isDoctorThinking ? (
                  <div className="flex gap-1.5 py-2"><div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div></div>
              ) : (
                  <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium max-h-[60vh] overflow-y-auto custom-scrollbar" dir="rtl">
                      <div className="text-right mb-4"><MarkdownRenderer text={doctorMessage || ""} /></div>
                      
                      {doctorState === 'menu' && (
                          <div className="flex flex-col gap-2 mt-4">
                              <button onClick={() => handleDoctorOption('snippets')} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 p-3 rounded-xl font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-right">شرح مقتطفات عشوائية</button>
                              <button onClick={() => handleDoctorOption('topics')} className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 p-3 rounded-xl font-bold text-xs hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-right">استكشاف المواضيع في المقتطفات</button>
                          </div>
                      )}

                      {doctorState === 'topics_list' && (
                          <div className="flex flex-wrap gap-2 mt-4">
                              {doctorTopics.map((topic, idx) => (
                                  <button key={idx} onClick={() => handleTopicSelect(topic)} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-500 hover:text-white transition-colors">{topic}</button>
                              ))}
                              <button onClick={() => setDoctorState('menu')} className="w-full mt-2 text-slate-400 text-xs hover:text-indigo-500">العودة للقائمة</button>
                          </div>
                      )}

                      {doctorState === 'topic_source_select' && (
                          <div className="flex flex-col gap-2 mt-4">
                              <button onClick={() => handleTopicSource('snippets')} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 p-3 rounded-xl font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-right">شرح من المقتطفات المحفوظة</button>
                              <button onClick={() => handleTopicSource('file')} className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 p-3 rounded-xl font-bold text-xs hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors text-right">شرح من ملف خارجي</button>
                              <button onClick={() => setDoctorState('topics_list')} className="text-slate-400 text-xs hover:text-indigo-500 text-right pr-2">رجوع</button>
                          </div>
                      )}

                      {doctorState === 'upload_prompt' && (
                          <div className="mt-4">
                              <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group">
                                  <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-indigo-500">
                                      <Upload className="w-6 h-6" />
                                      <span className="text-xs font-bold">اضغط لرفع الملف</span>
                                  </div>
                                  <input type="file" className="hidden" accept=".txt,.pdf" onChange={handleDoctorFileUpload} />
                              </label>
                              <button onClick={() => setDoctorState('topic_source_select')} className="w-full mt-2 text-slate-400 text-xs hover:text-indigo-500 text-right pr-2">رجوع</button>
                          </div>
                      )}
                      
                      {doctorState === 'explaining' && (
                          <button onClick={() => setDoctorState('menu')} className="w-full mt-4 py-2 border-t border-slate-100 dark:border-slate-700 text-slate-400 text-xs hover:text-indigo-500">القائمة الرئيسية</button>
                      )}
                  </div>
              )}
            </div>
          ) : (
            <div className="relative group cursor-pointer z-50" onClick={() => { soundService.playDoctorSignature(); triggerDoctorAdvice(); }}>
             <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 animate-pulse"></div>
             <div className="absolute -inset-1 border-2 border-dashed border-cyan-400/50 rounded-full animate-[spin_10s_linear_infinite] pointer-events-none"></div>
             <div className="w-16 h-16 bg-gradient-to-br from-slate-900 to-indigo-900 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:scale-110 transition-transform border border-cyan-500/30 relative z-10 overflow-hidden">{!isDoctorThinking && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-pulse"></div>}{isDoctorThinking ? <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /> : <Stethoscope className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />}</div>
             {!doctorMessage && !isDoctorThinking && <span className="absolute -top-1 -right-1 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span></span>}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-white/10 relative">
              <button onClick={() => { soundService.playClick(); setShowSettings(false); }} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-indigo-600 transition-colors"><X className="w-6 h-6" /></button>
              <div className="text-center mb-8"><div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-600 dark:text-slate-300"><Settings className="w-8 h-8" /></div><h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة البيانات</h3><p className="text-slate-500 text-sm font-bold mt-1">نسخ احتياطي / نقل لمتصفح آخر</p></div>
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex items-start gap-3"><Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" /><p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed">تنبيه: هذا التطبيق لا يستخدم سيرفرات سحابية. البيانات محفوظة في متصفحك الحالي فقط. لنقل البيانات لمتصفح آخر، استخدم خيار التصدير أدناه.</p></div>
              <div className="space-y-4">
                 <button onClick={handleExport} className="w-full flex items-center justify-between p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all group"><div className="flex items-center gap-3"><div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400"><FileDown className="w-5 h-5" /></div><div className="text-right"><h4 className="font-bold text-slate-900 dark:text-white">تصدير (نسخة كاملة)</h4><p className="text-xs text-slate-500 dark:text-slate-400">احفظ ملف JSON لنقله لجهاز آخر</p></div></div></button>
                 <div className="relative w-full overflow-hidden">
                   <button className="w-full flex items-center justify-between p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all group">
                     {isImporting ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400 mx-auto" /> : 
                     <div className="flex items-center gap-3"><div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-emerald-600 dark:text-emerald-400"><FileUp className="w-5 h-5" /></div><div className="text-right"><h4 className="font-bold text-slate-900 dark:text-white">استيراد بيانات</h4><p className="text-xs text-slate-500 dark:text-slate-400">استعادة نسخة من ملف محفوظ</p></div></div>
                     }
                   </button>
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".json" onChange={handleImportFileSelect} disabled={isImporting} />
                 </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center"><p className="text-xs text-slate-400 font-bold">Exam Matcher AI v1.5 (Ultimate Storage)</p></div>
           </div>
        </div>
      )}

      {/* SMART IMPORT ANALYSIS MODAL */}
      {isImporting && importStep !== 'idle' && (
        <div className="fixed inset-0 bg-slate-900/90 z-[150] flex items-center justify-center p-6 backdrop-blur-xl animate-fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
              {importStep === 'analyzing' && (
                 <>
                    <div className="w-24 h-24 mb-6 relative">
                       <div className="absolute inset-0 border-[6px] border-indigo-100 dark:border-slate-800 rounded-full"></div>
                       <div className="absolute inset-0 border-[6px] border-t-indigo-600 rounded-full animate-spin"></div>
                       <ScanLine className="absolute inset-0 m-auto text-indigo-600 dark:text-indigo-400 w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">جاري التحليل الذكي...</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">نقوم بفحص هيكل الملف وإصلاح الأخطاء تلقائياً.</p>
                 </>
              )}

              {importStep === 'confirming' && importStats && (
                 <>
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-scale-in">
                       <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">الملف صالح للاستعادة!</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">وجدنا البيانات التالية داخل ملف النسخة الاحتياطية:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8">
                       <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <Folder className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                          <div className="text-2xl font-black text-slate-900 dark:text-white">{importStats.folders}</div>
                          <div className="text-xs text-slate-400 font-bold">مجلدات</div>
                       </div>
                       <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <History className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                          <div className="text-2xl font-black text-slate-900 dark:text-white">{importStats.history}</div>
                          <div className="text-xs text-slate-400 font-bold">سجلات</div>
                       </div>
                       <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <NotebookPen className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                          <div className="text-2xl font-black text-slate-900 dark:text-white">{importStats.notes}</div>
                          <div className="text-xs text-slate-400 font-bold">ملاحظات</div>
                       </div>
                       <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <ListTodo className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                          <div className="text-2xl font-black text-slate-900 dark:text-white">{importStats.tasksCount}</div>
                          <div className="text-xs text-slate-400 font-bold">مهام</div>
                       </div>
                    </div>
                    <div className="w-full p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl mb-8 text-right">
                       <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                         <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                         تحذير: الاستعادة ستقوم بمسح جميع البيانات الحالية واستبدالها بهذه النسخة. العملية لا يمكن التراجع عنها.
                       </p>
                    </div>
                    <div className="flex w-full gap-4">
                       <button onClick={confirmImport} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-95">استعادة الآن</button>
                       <button onClick={() => { setIsImporting(false); setImportStep('idle'); }} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">إلغاء</button>
                    </div>
                 </>
              )}

              {importStep === 'restoring' && (
                 <>
                    <div className="w-24 h-24 mb-6 relative animate-pulse">
                       <Binary className="w-full h-full text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">جاري استعادة البيانات...</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">يرجى الانتظار، سيتم تحديث الصفحة تلقائياً.</p>
                 </>
              )}
           </div>
        </div>
      )}

      {/* NOTES SIDEBAR TOGGLE - HIDDEN WHEN EXPANDED */}
      {!isNotesExpanded && (
        <button onClick={() => { soundService.playToggle(); setShowNotesSidebar(prev => !prev); }} className={`fixed top-1/2 transform -translate-y-1/2 z-[60] py-3 px-1.5 shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center rounded-l-xl ${showNotesSidebar ? 'right-[calc(100vw-4rem)] md:right-[24rem] bg-indigo-600 text-white w-7 hover:w-9' : 'right-0 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-r-0 border-slate-200 dark:border-slate-700 w-6 hover:w-9 hover:text-indigo-600 dark:hover:text-indigo-400'}`}>{showNotesSidebar ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}</button>
      )}

      <div className={`fixed bg-white dark:bg-slate-900 shadow-2xl transform transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] border-l border-slate-200 dark:border-slate-800 
         ${isNotesExpanded 
            ? 'inset-0 w-full z-[100]' 
            : `inset-y-0 right-0 w-full md:w-[24rem] z-[55] ${showNotesSidebar ? 'translate-x-0' : 'translate-x-full'}`
         }`}>
         <div className="h-full flex flex-col pt-16">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 backdrop-blur"
               onDragOver={(e) => handleDragOver(e, currentNoteFolder.id)}
               onDrop={(e) => handleDrop(e, currentNoteFolder.id, true)}
            >
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <NotebookPen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-black text-xl text-slate-900 dark:text-white">ملاحظاتي</h3>
                 </div>
                 <button 
                   onClick={() => { soundService.playClick(); setIsNotesExpanded(!isNotesExpanded); if(!isNotesExpanded) setShowNotesSidebar(true); }} 
                   className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 transition-colors"
                   title={isNotesExpanded ? "تصغير" : "ملء الشاشة"}
                 >
                    {isNotesExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                 </button>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400 overflow-x-auto whitespace-nowrap pb-2"><button onClick={() => { soundService.playClick(); setNoteNavigationPath([]); }} className="hover:text-indigo-600 flex items-center gap-1"><Home className="w-3 h-3" /> الرئيسية</button>{noteNavigationPath.length > 0 && <ChevronLeft className="w-3 h-3" />}{noteNavigationPath.length > 0 && <span>...</span>}{noteNavigationPath.length > 0 && <ChevronLeft className="w-3 h-3" />}<span className="font-bold text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{currentNoteFolder?.name}</span></div></div>
            <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar relative transition-all duration-500 ${isNotesExpanded ? 'max-w-6xl mx-auto w-full px-8 md:px-12' : ''}`}>
               {!editingNote && (
                 <div className="space-y-4">
                    <button onClick={() => { soundService.playClick(); setIsCreatingNoteFolder(true); }} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all font-bold"><FolderPlus className="w-5 h-5" /> مجلد جديد</button>
                    {isCreatingNoteFolder && (<div className="flex gap-2 animate-fade-in"><input autoFocus type="text" placeholder="اسم المجلد..." className="flex-1 p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={newNoteFolderName} onChange={e => setNewNoteFolderName(e.target.value)} /><button onClick={createNoteFolder} className="bg-indigo-600 text-white px-3 rounded-xl font-bold">حفظ</button><button onClick={() => { soundService.playClick(); setIsCreatingNoteFolder(false); }} className="text-slate-400 text-sm">إلغاء</button></div>)}
                    {noteNavigationPath.length > 0 && (<button onClick={() => { soundService.playClick(); setNoteNavigationPath(prev => prev.slice(0, -1)); }} className="w-full text-right text-slate-400 hover:text-indigo-600 text-sm font-bold flex items-center gap-2 mb-2"><ArrowLeft className="w-4 h-4" /> العودة</button>)}
                    {currentNoteFolder?.subFolders?.map((folder:any) => (
                      <div 
                        key={folder.id} 
                        onClick={() => { soundService.playClick(); setNoteNavigationPath(prev => [...prev, folder.id]); }} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'note_folder', folder.id, currentNoteFolder.id)}
                        onDragOver={(e) => handleDragOver(e, folder.id)}
                        onDrop={(e) => { e.stopPropagation(); handleDrop(e, folder.id, true); }}
                        className={`bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border flex justify-between items-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group relative pl-12 transition-all ${dragOverFolderId === folder.id ? 'border-2 border-indigo-500 scale-105 bg-indigo-50' : 'border-slate-100 dark:border-slate-700'}`}
                      >
                        <div className="flex items-center gap-3"><Folder className="w-8 h-8 text-indigo-300 dark:text-indigo-500" /><div><h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{folder.name}</h4><p className="text-[10px] text-slate-400">{(folder.notes?.length || 0) + (folder.subFolders?.length || 0)} عنصر</p></div></div>
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 z-[100]">
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); initiateRename(folder.id, folder.name, 'note_folder'); }} className="p-2 text-slate-300 hover:text-indigo-500 bg-white/50 dark:bg-slate-800/50 rounded-full"><Pencil className="w-4 h-4" /></button>
                          <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNoteFolder(folder.id); }} className="p-2 text-slate-300 hover:text-red-500 bg-white/50 dark:bg-slate-800/50 rounded-full"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>
                    ))}
                    {noteNavigationPath.length > 0 && <div className="flex justify-between items-center mt-6 mb-2 border-t border-slate-100 dark:border-slate-800 pt-4"><h5 className="font-bold text-slate-400 text-xs uppercase">الملاحظات</h5><button onClick={createNewNote} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-3 h-3" /> ملاحظة</button></div>}
                    {currentNoteFolder?.notes?.length === 0 && noteNavigationPath.length > 0 && <p className="text-center text-slate-400 text-xs py-4">لا توجد ملاحظات</p>}
                    {currentNoteFolder?.notes?.map((note:any) => (
                      <div 
                        key={note.id} 
                        onClick={() => { soundService.playClick(); setEditingNote(note); setPendingFormat(null); }} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'note', note.id, currentNoteFolder.id)}
                        className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all group relative pl-10"
                      >
                        <div className="absolute top-2 left-2 text-slate-300 opacity-20"><GripVertical className="w-4 h-4" /></div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 truncate text-lg">{note.title}</h4><p className="text-sm text-slate-400 truncate">{note.content.substring(0, 50)}</p><div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-700"><span className="text-xs text-slate-300">{new Date(note.updatedAt).toLocaleDateString('ar-EG')}</span></div><button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNote(note.id); }} className="absolute left-2 top-2 p-2 text-slate-300 hover:text-red-500 z-[100] opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 rounded-full"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                 </div>
               )}
               {editingNote && (
                 <div className="flex flex-col h-full animate-fade-in relative">
                    <div className="flex justify-between items-center mb-4"><button onClick={() => { soundService.playClick(); setEditingNote(null); setPendingFormat(null); }} className="text-slate-400 text-sm font-bold hover:text-indigo-600">إلغاء</button><div className="flex gap-2"><button onClick={() => { soundService.playClick(); setIsNotePreview(!isNotePreview); }} className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-2 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-2 text-xs">{isNotePreview ? <><Edit3 className="w-3 h-3" /> تحرير</> : <><Eye className="w-3 h-3" /> معاينة</>}</button><button onClick={saveNote} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 shadow-md text-xs">حفظ</button></div></div>
                    <input type="text" placeholder="عنوان الملاحظة" className="w-full text-2xl font-black bg-transparent border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 focus:border-indigo-500 outline-none dark:text-white" value={editingNote.title} onChange={e => setEditingNote({...editingNote, title: e.target.value})} />
                    
                    {/* SMART FORMAT BUTTON FOR NOTES */}
                    {!pendingFormat && !isNotePreview && (
                      <div className="flex gap-2 mb-2 w-full">
                        <button onClick={() => handleSmartFormat(editingNote.content)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-sm font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors" disabled={isFormatting || isCorrectingCode}>
                          {isFormatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          تنسيق ذكي
                        </button>
                        <button onClick={() => handleCodeCorrection(editingNote.content)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" disabled={isFormatting || isCorrectingCode} title="مصحح تلقائي للكود">
                          {isCorrectingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <BugOff className="w-4 h-4" />}
                          مصحح برمجيات
                        </button>
                      </div>
                    )}

                    <div className="relative flex-1 w-full flex flex-col">
                       {!isNotePreview && noteSelection && (<div className="absolute top-0 left-0 right-0 z-50 flex justify-center pb-2 pointer-events-none transform -translate-y-full"><div className="bg-slate-900 text-white rounded-lg shadow-xl flex gap-1 p-1 pointer-events-auto mb-2"><button onMouseDown={(e) => { e.preventDefault(); applyNoteFormat('bold'); }} className="p-2 hover:bg-slate-700 rounded transition-colors" title="غامق (Bold)"><Bold className="w-4 h-4" /></button><div className="w-[1px] bg-slate-700 my-1"></div><button onMouseDown={(e) => { e.preventDefault(); applyNoteFormat('underline'); }} className="p-2 hover:bg-slate-700 rounded transition-colors" title="خط تحت الكلام (Underline)"><Underline className="w-4 h-4" /></button><div className="w-[1px] bg-slate-700 my-1"></div><button onMouseDown={(e) => { e.preventDefault(); handleNoteAction('translate'); }} className="p-2 hover:bg-slate-700 rounded transition-colors" title="ترجمة"><Languages className="w-4 h-4" /></button><div className="w-[1px] bg-slate-700 my-1"></div><button onMouseDown={(e) => { e.preventDefault(); handleNoteAction('snippet'); }} className="p-2 hover:bg-slate-700 rounded transition-colors" title="حفظ كمقتطف"><Quote className="w-4 h-4" /></button></div></div>)}
                       {isNotePreview ? (
                         <div className="flex flex-col h-full">
                            <div className="flex justify-end gap-2 mb-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                               <button onClick={() => handleSpeak(editingNote.content)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><Volume2 className="w-3.5 h-3.5" /> قراءة</button>
                               <button onClick={() => handleTranslate(editingNote.content)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><Languages className="w-3.5 h-3.5" /> ترجمة كاملة</button>
                               <button onClick={() => handleCodeCorrection(editingNote.content)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"><BugOff className="w-3.5 h-3.5" /> صحح كود</button>
                               <button onClick={() => handleSmartFormat(editingNote.content)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-xs font-bold text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"><Wand2 className="w-3.5 h-3.5" /> تنسيق</button>
                            </div>
                            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl overflow-y-auto custom-scrollbar leading-relaxed">
                               <MarkdownRenderer text={editingNote.content} />
                            </div>
                         </div>
                       ) : (<textarea id="note-editor-textarea" ref={noteTextareaRef} placeholder="اكتب ملاحظاتك هنا..." className="flex-1 w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl resize-none focus:outline-none dark:text-slate-200 leading-relaxed custom-scrollbar text-xl font-cairo" dir={isArabicText(editingNote.content) ? "rtl" : "ltr"} value={pendingFormat ? pendingFormat.formatted : editingNote.content} onChange={e => !pendingFormat && setEditingNote({...editingNote, content: e.target.value})} onSelect={handleNoteSelect} onKeyUp={handleNoteSelect} onClick={handleNoteSelect} readOnly={!!pendingFormat}></textarea>)}
                    </div>

                    {/* APPROVAL BAR FOR SMART FORMATTING IN NOTES */}
                    {pendingFormat && (
                      <div className="absolute bottom-4 left-4 right-4 p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between z-[100] animate-fade-in-up">
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 px-2"><Sparkles className="w-4 h-4" /> معاينة التنسيق</div>
                        <div className="flex gap-2">
                           <button onClick={applyFormat} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600">اعتماد</button>
                           <button onClick={() => handleSmartFormat(pendingFormat.original)} className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-600">إعادة</button>
                           <button onClick={cancelFormat} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-300">إلغاء</button>
                        </div>
                      </div>
                    )}
                 </div>
               )}
            </div>
         </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {showHistory ? (
           <div className="animate-fade-in space-y-8">
             <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl"><History className="w-8 h-8 text-purple-600 dark:text-purple-400" /></div><h2 className="text-4xl font-black text-slate-900 dark:text-white">سجل الاختبارات</h2></div><button onClick={goHome} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-black bg-slate-100 dark:bg-slate-900 px-5 py-3 rounded-2xl transition-all border border-slate-200 dark:border-slate-800"><ArrowLeft className="w-5 h-5" /> العودة للرئيسية</button></div>
             <div className="grid gap-4">
              {history.length === 0 && <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800"><History className="w-16 h-16 text-slate-300 mx-auto mb-4" /><p className="text-slate-400 font-bold text-xl">لا يوجد سجل سابق</p></div>}
              {history.map(h => (<div key={h.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all flex flex-col sm:flex-row justify-between items-center gap-6"><div className="flex items-center gap-6 w-full sm:w-auto"><div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black ${h.score / h.totalQuestions >= 0.5 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>{Math.round((h.score / h.totalQuestions) * 100)}%</div><div><h4 className="font-black text-xl text-slate-900 dark:text-white mb-1">{h.name}</h4><p className="text-sm font-bold text-slate-400 flex items-center gap-2"><Calendar className="w-4 h-4" /> {new Date(h.date).toLocaleDateString('ar-EG')} • {h.score}/{h.totalQuestions} درجة</p></div></div><div className="flex gap-3 w-full sm:w-auto"><button onClick={() => retakeQuiz(h)} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">مراجعة / إعادة</button><button onMouseDown={(e) => e.stopPropagation()} onClick={() => deleteHistoryEntry(h.id)} className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors z-20"><Trash2 className="w-5 h-5" /></button></div></div>))}
             </div>
           </div>
        ) : showFavorites ? (
           <div className="animate-fade-in space-y-8">
              <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl"><Bookmark className="w-8 h-8 text-amber-600 dark:text-amber-500" /></div><h2 className="text-4xl font-black text-slate-900 dark:text-white">المفضلة والأرشيف</h2></div><button onClick={goHome} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-black bg-slate-100 dark:bg-slate-900 px-5 py-3 rounded-2xl transition-all border border-slate-200 dark:border-slate-800"><ArrowLeft className="w-5 h-5" /> العودة للرئيسية</button></div>
              {renderFavoritesView()}
           </div>
        ) : (
          <>
            {status === AppStatus.IDLE && (<div className="text-center space-y-4 mb-12"><div className="inline-block px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest mb-2 border border-indigo-100 dark:border-indigo-800">Smart Study Assistant</div><h1 className="text-5xl font-black text-slate-900 dark:text-white leading-tight">حوّل محاضراتك إلى <span className="text-indigo-600 dark:text-indigo-400">تفوّق دراسي</span></h1><p className="text-slate-400 dark:text-slate-500 text-xl font-medium max-w-2xl mx-auto">ارفع ملفاتك، اختر الوضع، ودع الذكاء الاصطناعي يجهز لك كل ما تحتاجه للنجاح.</p></div>)}
            
            {status === AppStatus.IDLE && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[ 
                  { id: 'extraction', title: 'اختبار السنوات السابقة', desc: 'استخراج الأسئلة السابقة المتعلقة بمحتوى المحاضرة', icon: Filter }, 
                  { id: 'generation', title: 'توليد اختبار تدريبي', desc: 'إنشاء أسئلة متوقعة (لم ترد سابقاً) للمحاضرة', icon: Sparkles }, 
                  { id: 'summary', title: 'الملخص الذهبي (يومي)', desc: 'وثيقة ملخصة اعتيادية لأهم النقاط الامتحانية', icon: Trophy }, 
                  { id: 'summary_mega', title: 'الملخص الذهبي (الخارق)', desc: 'وضع العبقرية لضغط المحاضرات واستخراج زبدة الـ 90%+ للامتحان!', icon: Flame },
                  { id: 'custom', title: 'ملخص مخصص', desc: 'اكتب ما تود التركيز عليه، ليتم تخصيص الملخص', icon: FileText },
                  { id: 'google_form', title: 'صانع جوجل فورم', desc: 'يحول ملفاتك إلى اختبار Google Form بضغطة زر مع تعليماتك', icon: ClipboardList },
                  { id: 'direct_export', title: 'تصدير مباشر HTML', desc: 'تصدير الملخص كملف HTML مباشرة مع خيارات متعددة', icon: Download },
                  { id: 'template2_smart', title: 'قالب 2 المنقح (ملخص + أسئلة سنين فقط)', desc: 'تصدير مباشر كقالب 2 بملخص إنجليزي وأسئلة سنين المحاضرة حصراً مع حذف الدخيل', icon: ShieldCheck },
                  { id: 'image_injection', title: 'إدراج الصور بذكاء', desc: 'أضف صورك لملخص جاهز وسيقوم الذكاء بوضعها في مكانها الصحيح', icon: ImageIcon }
                ].map(mode => (
                  <div key={mode.id} className="relative group">
                    <button onClick={() => { soundService.playOptionSelect(['extraction', 'generation', 'summary', 'summary_mega', 'custom', 'google_form', 'direct_export', 'template2_smart', 'image_injection'].indexOf(mode.id)); setAppMode(mode.id as AppMode); }} className={`w-full p-6 h-full rounded-[2.5rem] border-2 text-right flex gap-5 transition-all relative overflow-hidden ${appMode === mode.id ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/30 shadow-2xl scale-[1.02]' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-xl'}`}>
                      {appMode === mode.id && <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600"></div>}
                      <div className={`p-4 h-16 w-16 flex items-center justify-center shrink-0 rounded-2xl transition-all shadow-md ${appMode === mode.id ? 'bg-indigo-600 text-white scale-110 shadow-indigo-200 dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                        <mode.icon className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-2">{mode.title}</h3>
                        <p className="text-xs text-slate-400 font-bold leading-relaxed">{mode.desc}</p>
                      </div>
                    </button>
                    
                    {/* QUANTITY SELECTOR FOR GENERATION MODE */}
                    {mode.id === 'generation' && appMode === 'generation' && (
                      <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-2 animate-fade-in-up z-20">
                         <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-900 flex gap-1">
                            {[15, 25, 35].map(count => (
                               <button 
                                 key={count} 
                                 onClick={(e) => { e.stopPropagation(); soundService.playClick(); setGenerationCount(count); }}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${generationCount === count ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                               >
                                 {count} سؤال
                               </button>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {status === AppStatus.IDLE && (
              <>
                {(appMode === 'custom' || appMode === 'summary_mega' || appMode === 'google_form' || appMode === 'generation' || appMode === 'direct_export' || appMode === 'template2_smart' || appMode === 'summary') && (
                  <div className="mt-8 animate-fade-in-up">
                    {appMode === 'summary' && (
                      <div className="space-y-6">
                        <div className={`p-6 rounded-2xl border-2 transition-all shadow-sm ${dailyOnlyImportantExamPoints ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40 border-amber-400 dark:border-amber-600 shadow-amber-500/10' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-90'}`}>
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5 text-right flex-1">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${dailyOnlyImportantExamPoints ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-4 ring-amber-100 dark:ring-amber-900/50' : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                <Flame className="w-6 h-6" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <span className="font-black text-lg text-slate-900 dark:text-slate-100 font-cairo">
                                    خيار استخراج وتلخيص الأمور المهمة فقط (تركيز أسئلة السنين - مراجعة الامتحان)
                                  </span>
                                  <span className="bg-amber-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                    قبل بدء التحليل الشامل
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed font-cairo">
                                  <strong>قبل الضغط على «ابدأ التحليل الشامل»:</strong> فعّل هذا الخيار ليقوم الذكاء الاصطناعي بدراسة ملفات أسئلة السنين السابقة بدقة، واستخراج وتلخيص الأمور والمعلومات المهمة التي ركّز عليها الأساتذة عبر السنين وربطها بالمحاضرة، مع استبعاد الحشو الإنشائي والسرد العام تماماً لتكون المراجعة مركّزة وسريعة قبل الامتحان.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                soundService.playToggle();
                                setDailyOnlyImportantExamPoints(!dailyOnlyImportantExamPoints);
                              }}
                              className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 shadow-md ${dailyOnlyImportantExamPoints ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25 ring-2 ring-amber-500' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}
                            >
                              {dailyOnlyImportantExamPoints ? <Check className="w-4 h-4" /> : null}
                              <span>{dailyOnlyImportantExamPoints ? 'مفعّل (تركيز أسئلة السنين والمهم فقط)' : 'تفعيل الميزة قبل التحليل'}</span>
                            </button>
                          </div>
                          {dailyOnlyImportantExamPoints && (
                            <div className="mt-3.5 pt-3.5 border-t border-amber-200/70 dark:border-amber-800/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                              <div className="flex items-center gap-2 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>دراسة وتركيز أسئلة السنين السابقة</span>
                              </div>
                              <div className="flex items-center gap-2 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>المعايير الذهبية والخط الأول للعلاج</span>
                              </div>
                              <div className="flex items-center gap-2 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>الأدوية الحتمية والتشخيصات الفارقة</span>
                              </div>
                              <div className="flex items-center gap-2 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>حذف الحشو الإنشائي والتاريخي</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 font-cairo">
                            توجيهات أو استثناءات إضافية للملخص اليومي (اختياري)
                          </label>
                          <textarea 
                            className="w-full text-right p-4 rounded-2xl border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-amber-900 transition-all font-cairo text-base resize-none min-h-[90px]"
                            placeholder="اكتب أي ملاحظة أو استثناء تريد من الذكاء الاصطناعي مراعاته في الملخص اليومي..."
                            value={customPrompt}
                            onChange={e => setCustomPrompt(e.target.value)}
                          ></textarea>
                        </div>
                      </div>
                    )}
                    {appMode === 'template2_smart' && (
                      <div className="space-y-6">
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 border-2 p-6 rounded-2xl text-emerald-900 dark:text-emerald-100 shadow-sm">
                          <h4 className="font-black text-xl mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                            قالب 2 المنقح الذكي (ميزة حذف الدخيل نشطة بنسبة 100%)
                          </h4>
                          <p className="font-medium text-sm leading-relaxed">
                            يصدر ملفاً مباشراً كقالب ثانٍ يحتوي <strong>فقط</strong> على ملخص إنجليزي أكاديمي مكثف وشامل وأسئلة السنوات السابقة التابعة لهذه المحاضرة تحديداً بدون أي معلومات أو أسئلة خارجية.
                          </p>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-emerald-100/70 dark:bg-emerald-900/40 p-3 rounded-xl font-bold">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" /> <span>المحاضرة هي المصدر الوحيد (لا معلومات من محاضرات أخرى)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" /> <span>حذف الأسئلة الدخيلة التي لم يرد جوابها في المحاضرة</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" /> <span>هيكلية 3 أقسام: ملخص شامل + أسئلة سنين + مراجعة الامتحان</span>
                            </div>
                          </div>
                        </div>

                        {/* NEW DEDICATED BUTTON & ENGINE: Exam-to-Summary Gap Closer */}
                        <div className={`p-5 rounded-2xl border-2 transition-all shadow-sm ${template2CloseExamGaps ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-emerald-500/10' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80'}`}>
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5 text-right">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${template2CloseExamGaps ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-emerald-100 dark:ring-emerald-900/50' : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                <Sparkles className="w-6 h-6" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <span className="font-black text-base text-slate-900 dark:text-slate-100 font-cairo">
                                    زر سد فجوات أسئلة السنين في الملخص الإنجليزي (الشمولية الذهبية 100%)
                                  </span>
                                  <span className="bg-emerald-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                                    خاص بقالب 2 المنقح
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed font-cairo">
                                  يمنع أي نقص علمي في الملخص الإنجليزي عبر فحص أسئلة السنوات السابقة بدقة ودمج الأدوية بأسمائها الصريحة وسياقها السريري (مثل Statins، و Phenylephrine، و Methylphenidate / Amphetamine لعلاج ADHD)، والسميات العضوية الخطيرة (مثل Hepatotoxicity للنياسين)، وتوفيق المفاهيم المتقابلة (مثل Downregulation vs Upregulation).
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTemplate2CloseExamGaps(!template2CloseExamGaps)}
                              className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 shadow-md ${template2CloseExamGaps ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 ring-2 ring-emerald-500' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}
                            >
                              {template2CloseExamGaps ? <Check className="w-4 h-4" /> : null}
                              <span>{template2CloseExamGaps ? 'مفعّل (سد الفجوات نشط)' : 'تفعيل الميزة'}</span>
                            </button>
                          </div>
                          {template2CloseExamGaps && (
                            <div className="mt-3.5 pt-3.5 border-t border-emerald-200/70 dark:border-emerald-800/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                              <div className="flex items-center gap-2 bg-emerald-100/60 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>ذكر الأدوية بأسمائها وسياقها السريري</span>
                              </div>
                              <div className="flex items-center gap-2 bg-emerald-100/60 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>تغطية عائلة الستاتين (Statins) وأدوية الدهون</span>
                              </div>
                              <div className="flex items-center gap-2 bg-emerald-100/60 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>السمية الكبدية (Hepatotoxicity) والسميات</span>
                              </div>
                              <div className="flex items-center gap-2 bg-emerald-100/60 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>توفيق Downregulation ضد Upregulation</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm font-cairo">صيغة التصدير المباشر:</span>
                            <div className="flex bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                              <button 
                                type="button" 
                                onClick={() => setTemplate2SmartFormat('html')}
                                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${template2SmartFormat === 'html' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'}`}
                              >
                                ملف HTML تفاعلي جاهز
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setTemplate2SmartFormat('print')}
                                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${template2SmartFormat === 'print' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'}`}
                              >
                                فتح نافذة الطباعة / PDF
                              </button>
                            </div>
                          </div>

                          <label className="flex items-center gap-3 cursor-pointer bg-emerald-50/70 dark:bg-emerald-950/40 px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 flex-row-reverse shadow-sm">
                            <div className="text-right">
                              <span className="font-bold text-emerald-900 dark:text-emerald-100 font-cairo text-sm block">ميزة حذف الدخيل الصارمة</span>
                              <span className="text-emerald-700 dark:text-emerald-300 text-[11px] block">فحص صارم لمنع تداخل المحاضرات وحذف الأسئلة الشاذة</span>
                            </div>
                            <div className="relative flex items-center justify-center shrink-0">
                              <input 
                                type="checkbox" 
                                checked={template2AntiIntruder} 
                                onChange={e => setTemplate2AntiIntruder(e.target.checked)} 
                                className="peer appearance-none w-5 h-5 rounded border-2 border-emerald-400 checked:bg-emerald-600 checked:border-emerald-600 focus:ring-emerald-500" 
                              />
                              <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                          </label>
                        </div>

                        <div>
                          <label className="block text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 font-cairo">
                            توجيهات إضافية على التلخيص (اختياري)
                          </label>
                          <textarea 
                            className="w-full text-right p-4 rounded-2xl border-2 border-emerald-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-emerald-900 transition-all font-cairo text-base resize-none min-h-[90px]"
                            placeholder="مثال: ركز على الجداول السريرية والأدوية، أو ضع علامات تنبيهية مكثفة على نقاط أسئلة السنوات السابقة..."
                            value={customPrompt}
                            onChange={e => setCustomPrompt(e.target.value)}
                          ></textarea>
                        </div>
                      </div>
                    )}
                    {(appMode === 'custom' || appMode === 'google_form' || appMode === 'generation' || appMode === 'direct_export') && (
                      <>
                        <label className="block text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 font-cairo">
                          {appMode === 'google_form' ? 'ما هي تعليماتك لإنشاء النموذج (Google Form)؟' : appMode === 'generation' ? 'إعدادات وتوجيهات إضافية للاختبار المولد (اختياري)' : 'ما هو المحتوى المخصص الذي تريده؟'}
                        </label>
                        <textarea 
                          className="w-full text-right p-5 rounded-2xl border-2 border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-indigo-900 transition-all font-cairo text-lg resize-none min-h-[120px]"
                          placeholder={appMode === 'generation' ? 'مثال: ركز على أسئلة التشخيص والعلاج، تجنب التواريخ، أو 5 أسئلة من كل محاضرة...' : appMode === 'google_form' ? 'مثال: اجعل الاختبار من 15 سؤال، وركز على القسم الثاني ولا تسأل عن التواريخ...' : 'أخبرني كيف تريد تلخيص الملفات؟ (مثلاً: ركز على الأدوية وتأثيراتها الجانبية، أو لخص فقط القسم الثالث...)'}
                          value={customPrompt}
                          onChange={e => setCustomPrompt(e.target.value)}
                        ></textarea>
                      </>
                    )}
                    {appMode === 'summary_mega' && (
                       <div className="space-y-6">
                         <div className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50 border-2 p-6 rounded-2xl text-amber-900 dark:text-amber-100">
                           <h4 className="font-black text-xl mb-2 flex items-center gap-2"><Flame className="w-6 h-6 text-amber-500"/> وضع العبقرية (الملخص المكثف الذكي - ضمان 90%+)</h4>
                           <p className="font-medium text-sm">يقوم هذا الوضع بتصفية ذكية واستخلاص زبدة الامتحان الذهبية (High-Yield 90%+) بتركيز خارق على الأدوية، المعايير الذهبية، التشخيصات، والفروقات الجوهرية مع حذف الحشو الإنشائي لضمان أعلى علامة بأقل وقت.</p>
                         </div>
                         <div className="animate-fade-in-up">
                           <label className="block text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 font-cairo">
                             ملاحظات إضافية أو استثناءات (اختياري)
                           </label>
                           <textarea 
                             className="w-full text-right p-5 rounded-2xl border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:ring-amber-900 transition-all font-cairo text-lg resize-none min-h-[100px]"
                             placeholder="هل هناك معلومات تريد استبعادها؟ أو ملاحظات معينة تود التركيز عليها في الملخص الخارق؟"
                             value={customPrompt}
                             onChange={e => setCustomPrompt(e.target.value)}
                           ></textarea>
                         </div>
                       </div>
                    )}
                    
                    {(appMode === 'custom' || appMode === 'summary_mega' || appMode === 'direct_export') && (
                      <div className="flex flex-wrap gap-4 mt-6 justify-end">
                         {appMode === 'direct_export' && !customExportAllPastExams && customIncludeMainSummary && (
                           <label className="flex items-center gap-3 cursor-pointer bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all flex-row-reverse shadow-sm w-full md:w-auto">
                             <div className="text-right">
                               <span className="font-bold text-emerald-900 dark:text-emerald-100 select-none font-cairo text-lg block">ملخص إنجليزي فائق الشمولية (غير مختصر)</span>
                               <span className="text-emerald-700 dark:text-emerald-300 text-xs mt-1 block">يمنع الاختصار الشديد ويستخرج كافة المفاهيم والتفاصيل السريرية والأدوية بشكل موسع وشامل</span>
                             </div>
                             <div className="relative flex items-center justify-center shrink-0">
                               <input type="checkbox" checked={directExportComprehensive} onChange={e => setDirectExportComprehensive(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-emerald-400 dark:border-emerald-600 checked:bg-emerald-600 checked:border-emerald-600 focus:ring-emerald-500 transition-colors" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
                         )}
                         {appMode === 'direct_export' && (
                           <label className="flex items-center gap-3 cursor-pointer bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex-row-reverse shadow-sm w-full md:w-auto">
                             <div className="text-right">
                               <span className="font-bold text-indigo-900 dark:text-indigo-100 select-none font-cairo text-lg block">تصدير جميع أسئلة السنين المرفقة فقط</span>
                               <span className="text-indigo-700 dark:text-indigo-300 text-xs mt-1 block">تفريغ كل الأسئلة في ملف HTML تفاعلي بدون الحاجة لمحاضرة</span>
                             </div>
                             <div className="relative flex items-center justify-center shrink-0">
                               <input type="checkbox" checked={customExportAllPastExams} onChange={e => { setCustomExportAllPastExams(e.target.checked); if (e.target.checked) { setCustomIncludePastExams(false); setCustomIncludePredictions(false); setCustomIncludeMainSummary(false); setCustomIncludeGuide(false); } }} className="peer appearance-none w-6 h-6 rounded-md border-2 border-indigo-400 dark:border-indigo-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500 transition-colors" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
                         )}
                         {appMode === 'summary_mega' && (
                           <label className="flex items-center gap-3 cursor-pointer bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-600 transition-all flex-row-reverse shadow-sm">
                             <div className="text-right">
                               <span className="font-bold text-amber-900 dark:text-amber-100 select-none font-cairo text-lg block">ملخص فائق التركيز (زبدة الـ 90% الامتحانية)</span>
                               <span className="text-amber-700 dark:text-amber-300 text-xs mt-1 block">يستبعد الحشو والسرد بالكامل ويركز فقط على ما يأتي في الاختبار</span>
                             </div>
                             <div className="relative flex items-center justify-center shrink-0">
                               <input type="checkbox" checked={megaConcise} onChange={e => setMegaConcise(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-amber-400 dark:border-amber-600 checked:bg-amber-600 checked:border-amber-600 focus:ring-amber-500 transition-colors" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
                         )}
                         {!customExportAllPastExams && (
                           <>
                             <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex-row-reverse shadow-sm">
                               <span className="font-bold text-slate-700 dark:text-slate-300 select-none font-cairo text-lg">شرح المرشد بالعربي</span>
                             <div className="relative flex items-center justify-center">
                               <input type="checkbox" checked={customIncludeGuide} onChange={e => setCustomIncludeGuide(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
                           
                           <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex-row-reverse shadow-sm">
                             <span className="font-bold text-slate-700 dark:text-slate-300 select-none font-cairo text-lg">أسئلة السنين</span>
                             <div className="relative flex items-center justify-center">
                               <input type="checkbox" checked={customIncludePastExams} onChange={e => setCustomIncludePastExams(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
                           
                           <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex-row-reverse shadow-sm">
                             <span className="font-bold text-slate-700 dark:text-slate-300 select-none font-cairo text-lg">أسئلة توقعات</span>
                             <div className="relative flex items-center justify-center">
                               <input type="checkbox" checked={customIncludePredictions} onChange={e => setCustomIncludePredictions(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
    
                           <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all flex-row-reverse shadow-sm">
                             <span className="font-bold text-slate-700 dark:text-slate-300 select-none font-cairo text-lg">الملخص الإنجليزي الرئيسي</span>
                             <div className="relative flex items-center justify-center">
                               <input type="checkbox" checked={customIncludeMainSummary} onChange={e => setCustomIncludeMainSummary(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500" />
                               <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             </div>
                           </label>
                           </>
                         )}
                    </div>
                  )}
                  </div>
                )}
                {appMode !== 'image_injection' && <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" dir="rtl">
                  <p className="font-bold">{aiStatus ? aiStatus.message : 'جاري التحقق من النموذج المحلي...'}</p>
                  <p>ملفات PDF النصية تُقرأ كنص؛ الرسومات داخل الصفحات النصية لا تُحلّل تلقائياً. للرسومات فعّل الخيار قبل رفع الملفات، ثم أعد رفع أي ملف سابق.</p>
                  <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={readAllPdfImages} onChange={e => setReadAllPdfImages(e.target.checked)} /> تحليل صور كل صفحات PDF أيضاً (أبطأ ويحتاج نموذجاً يدعم الصور وقد يتطلب تقسيم الملفات)</label>
                </div>}
                <div className={`grid gap-10 mt-8 ${appMode === 'image_injection' || appMode === 'template2_smart' ? 'md:grid-cols-2' : (appMode === 'direct_export' && customExportAllPastExams ? 'md:grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4')}`}>
                  {!(appMode === 'direct_export' && customExportAllPastExams) && (
                    <FileDropzone label={appMode === 'image_injection' ? 'قالب HTML/TXT' : appMode === 'template2_smart' ? 'المحاضرة الأساسية (TXT/PDF) [المصدر الوحيد]' : 'المحاضرة الأساسية (TXT/PDF)'} description={appMode === 'image_injection' ? 'الملف الجاهز (HTML) الذي تريد إدراج الصور فيه' : appMode === 'template2_smart' ? 'المصدر الأساسي والوحيد للمعلومات - لن يُعتمد أي مصدر آخر' : 'هذا هو المصدر الذي سيتم استخراج الأسئلة له أو تلخيصه'} files={lectureFiles} onFilesAdded={f => handleFileUpload(f, 'lecture')} onRemoveFile={id => setLectureFiles(l => l.filter(x => x.id !== id))} acceptMultiple />
                  )}
                  {appMode === 'image_injection' ? (
                    <FileDropzone label="الصور المراد إدراجها (JPG/PNG)" description="سيتم قراءة محتوى الصور ووضعها في الأماكن المناسبة داخل القالب" files={imageFiles as any} onFilesAdded={f => handleFileUpload(f, 'image')} onRemoveFile={id => setImageFiles(l => l.filter(x => x.id !== id))} acceptMultiple acceptImages />
                  ) : (
                    <>
                      <FileDropzone label={appMode === 'direct_export' && customExportAllPastExams ? "ملفات الأسئلة (TXT/PDF)" : appMode === 'template2_smart' ? "ملفات السنوات السابقة (سيتم حذف أي سؤال دخيل)" : "ملفات السنوات السابقة (TXT/PDF)"} description={appMode === 'direct_export' && customExportAllPastExams ? "ارفع ملفات الأسئلة ليتم تصديرها كملف تفاعلي" : appMode === 'template2_smart' ? "سنستخرج حصراً الأسئلة التابعة لهذه المحاضرة ونحذف أي سؤال لا يخصها" : "سنبحث في هذه الملفات عن الأسئلة التي تناسب محاضرتك"} files={pastExamFiles} onFilesAdded={f => handleFileUpload(f, 'past_exam')} onRemoveFile={id => setPastExamFiles(l => l.filter(x => x.id !== id))} acceptMultiple />
                      {!(appMode === 'direct_export' && customExportAllPastExams) && appMode !== 'template2_smart' && (
                        <>
                          <FileDropzone label="ملاحظات أساسية (اختياري)" description="ارفع الملاحظات الأساسية لاستخراج جميع المعلومات منها بدقة عالية بدون نقص" files={doctorNotesFiles} onFilesAdded={f => handleFileUpload(f, 'doctor_notes')} onRemoveFile={id => setDoctorNotesFiles(l => l.filter(x => x.id !== id))} acceptMultiple />
                          <FileDropzone label="ملاحظات إضافية (اختياري)" description="ارفع ملفات الملاحظات الإضافية ليتم معالجتها أيضاً" files={additionalDoctorNotesFiles} onFilesAdded={f => handleFileUpload(f, 'additional_doctor_notes')} onRemoveFile={id => setAdditionalDoctorNotesFiles(l => l.filter(x => x.id !== id))} acceptMultiple />
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {status === AppStatus.IDLE && (
              <div className="flex flex-col items-center pt-8 gap-4">
                {(appMode === 'summary' || appMode === 'summary_mega' || appMode === 'custom' || appMode === 'template2_smart') && (
                  <div className="flex flex-col gap-3 w-full max-w-2xl">
                    {lectureFiles.length > 1 && (
                      <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-900/50 shadow-sm transition-all mb-2">
                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 rounded-lg transition-colors">
                          <div className="relative flex items-center justify-center">
                            <input type="checkbox" className="w-6 h-6 rounded-md border-2 border-amber-300 dark:border-amber-600 checked:bg-amber-600 checked:border-amber-600 focus:ring-amber-500 peer appearance-none transition-colors" 
                              checked={template2Options.separateLectures} 
                              onChange={(e) => setTemplate2Options(prev => {
                                 const separateLectures = e.target.checked;
                                 const lectureConfigs = { ...prev.lectureConfigs };
                                 if (separateLectures) {
                                    lectureFiles.forEach(f => {
                                       if (!lectureConfigs[f.id]) lectureConfigs[f.id] = { include: true, customName: f.name.replace(/\.[^/.]+$/, "") };
                                    });
                                 }
                                 return {...prev, separateLectures, lectureConfigs};
                              })} 
                            />
                            <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-amber-700 dark:text-amber-500 block text-lg font-cairo">إنشاء ملخص منفصل لكل محاضرة</span>
                            <span className="text-amber-600/80 dark:text-amber-400/80 text-xs mt-1 block">بدلاً من دمجها بملخص واحد، سيتم تخصيص قسم كبير ومفصل لكل محاضرة على حدة</span>
                          </div>
                        </label>
                        
                        {template2Options.separateLectures && (
                          <div className="mt-4 p-4 bg-white/60 dark:bg-slate-900/40 rounded-xl space-y-3">
                            <p className="text-sm text-amber-800 dark:text-amber-300 font-bold mb-2 text-right">حدد المحاضرات التي تريد تضمينها، واكتب اسم الخانة ليظهر في الملف:</p>
                            {lectureFiles.map((f, i) => {
                               const config = template2Options.lectureConfigs[f.id] || { include: true, customName: f.name.replace(/\.[^/.]+$/, "") };
                               const isFirstIncluded = lectureFiles.find(lf => (template2Options.lectureConfigs[lf.id] || { include: true }).include)?.id === f.id;
                               return (
                                 <div key={f.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-amber-100 dark:border-amber-900/30 flex-row-reverse" dir="rtl">
                                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" 
                                      checked={config.include} 
                                      onChange={(e) => setTemplate2Options(prev => ({
                                        ...prev, 
                                        lectureConfigs: { ...prev.lectureConfigs, [f.id]: { ...config, include: e.target.checked } }
                                      }))}
                                    />
                                    <input type="text" className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                      value={config.customName}
                                      placeholder="اسم الخانة (مثل: المحاضرة الأولى)"
                                      onChange={(e) => setTemplate2Options(prev => ({
                                        ...prev, 
                                        lectureConfigs: { ...prev.lectureConfigs, [f.id]: { ...config, customName: e.target.value } }
                                      }))}
                                    />
                                    {isFirstIncluded && config.include && customIncludeGuide && (
                                      <span className="text-[11px] bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold whitespace-nowrap">المرشد سيشرحها</span>
                                    )}
                                 </div>
                               );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-400 dark:hover:border-indigo-700 transition-all shadow-sm">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" checked={doubleCheckEnabled} onChange={e => setDoubleCheckEnabled(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500" />
                        <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-lg font-cairo">تدقيق ثنائي (تأكيد الشمولية)</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">يفحص جميع المحاضرات مرة أخرى لضمان عدم نسيان أي معلومة مهمة</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-400 dark:hover:border-indigo-700 transition-all shadow-sm">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" checked={verifyPastQuestionsFirstEnabled} onChange={e => setVerifyPastQuestionsFirstEnabled(e.target.checked)} className="peer appearance-none w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500" />
                        <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-lg font-cairo">تحليل مسبق لأسئلة السنين (حفظ وفهم)</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">يستخرج الأسئلة أولاً ويحفظها بذاكرته ليركز عليها داخل الملخص (ثم يعيد الفحص لاحقاً)</span>
                      </div>
                    </label>
                  </div>
                )}
                <button onClick={startAnalysis} className={`text-white px-20 py-6 rounded-3xl font-black text-2xl shadow-[0_20px_50px_rgba(79,70,229,0.4)] dark:shadow-[0_20px_50px_rgba(79,70,229,0.2)] hover:scale-105 transition-all flex items-center gap-5 group disabled:opacity-50 disabled:cursor-not-allowed ${appMode === 'template2_smart' ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-[0_20px_50px_rgba(16,185,129,0.4)]' : (appMode === 'summary' && dailyOnlyImportantExamPoints) ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 shadow-[0_20px_50px_rgba(245,158,11,0.4)]' : appMode === 'summary_mega' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-[0_20px_50px_rgba(245,158,11,0.4)]' : 'bg-indigo-600 hover:bg-indigo-700'}`} disabled={appMode === 'image_injection' ? (lectureFiles.length === 0 || imageFiles.length === 0) : ((appMode === 'extraction' || (appMode === 'direct_export' && customExportAllPastExams)) ? pastExamFiles.length === 0 && lectureFiles.length === 0 : lectureFiles.length === 0)}>
                  {(appMode === 'summary' && dailyOnlyImportantExamPoints) ? <Flame className="w-10 h-10 group-hover:scale-110 transition-transform text-yellow-200 animate-pulse" /> : appMode === 'template2_smart' ? <ShieldCheck className="w-10 h-10 group-hover:scale-110 transition-transform text-emerald-200" /> : <Sparkles className="w-10 h-10 group-hover:rotate-12 transition-transform" />} {appMode === 'image_injection' ? 'إدراج الصور في القالب' : appMode === 'template2_smart' ? 'توليد وتصدير قالب 2 المنقح مباشرة' : (appMode === 'summary' && dailyOnlyImportantExamPoints) ? 'ابدأ تلخيص الأمور المهمة (تركيز أسئلة السنين)' : 'ابدأ التحليل الشامل'}
                </button>
              </div>
            )}
            {status === AppStatus.ANALYZING && (<div className="text-center py-32 flex flex-col items-center gap-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800"><div className="relative"><div className="w-32 h-32 border-[10px] border-slate-50 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin"></div><BrainCircuit className="w-16 h-16 text-indigo-600 dark:text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" /></div><div className="space-y-3"><h2 className="text-3xl font-black text-indigo-950 dark:text-indigo-100">جاري قراءة الملفات وتحليل المحتوى...</h2><p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm animate-pulse">Deep Learning Analysis</p></div></div>)}
            {status === AppStatus.COMPLETED && textResult && (<div className="space-y-8 animate-fade-in-up"><div className="flex flex-wrap justify-between items-center gap-4 px-4"><button onClick={() => { soundService.playPop(); setOriginalFullSummary(null); setStatus(AppStatus.IDLE); }} className="flex items-center gap-2 text-slate-400 font-black hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><ArrowLeft className="w-6 h-6" /> العودة</button><div className="flex flex-wrap gap-3">
              {appMode === 'google_form' ? (
                <>
                  <button onClick={async () => {
                    if (isCorrectingCode) return;
                    soundService.playMagic();
                    setIsCorrectingCode(true);
                    const corrected = await correctCodeSnippet(textResult);
                    setTextResult(corrected); // Update textResult in place
                    setIsCorrectingCode(false);
                  }} disabled={isCorrectingCode} className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-emerald-600 active:scale-95 transition-all text-lg">
                    {isCorrectingCode ? <><Loader2 className="w-6 h-6 animate-spin" /> جاري التصحيح...</> : <><BugOff className="w-6 h-6" /> مصحح الكود</>}
                  </button>
                  <button onClick={() => { 
                    const codeMatch = textResult.match(new RegExp('```(?:javascript|js)?([\\s\\S]*?)```')); 
                    const codeToCopy = codeMatch ? codeMatch[1].trim() : textResult; 
                    navigator.clipboard.writeText(codeToCopy); 
                    alert('تم نسخ الكود بنجاح!'); 
                  }} className="bg-amber-500 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-amber-600 active:scale-95 transition-all text-lg"><Copy className="w-6 h-6" /> نسخ الكود بالكامل</button>
                </>
              ) : (
                <>
                  {/* DIRECT HIGH-YIELD EXAM REVIEW DOWNLOAD BUTTON */}
                  <button 
                    onClick={handleDownloadExamOnlySummary} 
                    disabled={isDistillingImportant || isExportingPDF} 
                    className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white px-7 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed group" 
                    title="تنزيل وتصدير ملخص الأمور المهمة فقط لسرعة المراجعة قبل الامتحان"
                  >
                    {isDistillingImportant ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> جاري تجهيز المهم فقط...</>
                    ) : (
                      <><Flame className="w-6 h-6 text-yellow-200 group-hover:scale-110 transition-transform animate-pulse" /> تنزيل الأمور المهمة فقط (مراجعة الامتحان)</>
                    )}
                  </button>

                  {/* TOGGLE ON-SCREEN HIGH-YIELD FILTER */}
                  <button
                    onClick={handleToggleExamFilterOnScreen}
                    disabled={isDistillingImportant}
                    className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-5 py-4 rounded-2xl font-black flex items-center gap-2.5 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-all text-base disabled:opacity-50"
                    title={originalFullSummary ? "الرجوع للملخص الشامل الكامل" : "تصفية العرض الحالي للأمور المهمة فقط"}
                  >
                    {originalFullSummary ? (
                      <><Undo2 className="w-5 h-5 text-amber-600 dark:text-amber-400" /> عرض الملخص الكامل</>
                    ) : (
                      <><Filter className="w-5 h-5 text-amber-600 dark:text-amber-400" /> تصفية الشاشة للمهم فقط</>
                    )}
                  </button>

                  <button 
                    onClick={() => {
                      soundService.playClick();
                      setShowHtmlExportModal(textResult as string);
                    }} 
                    disabled={isExportingPDF} 
                    className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed" 
                    title="تصدير كملف HTML تفاعلي بالقالب 2 المطور مع تحديد الخيارات (المرشد، أسئلة السنين، التوقعات)"
                  >
                    {isExportingPDF ? <><Loader2 className="w-6 h-6 animate-spin" /> جاري التجهيز...</> : <><FileDown className="w-6 h-6" /> تصدير HTML (قالب 2 المطور)</>}
                  </button>
                  <button onClick={() => setShowTemplate2Modal({summaryText: textResult as string, skipMainText: false})} disabled={isExportingPDF} className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed" title="تصدير كملف PDF">{isExportingPDF ? <><Loader2 className="w-6 h-6 animate-spin" /> جاري التجهيز...</> : <><Download className="w-6 h-6" /> قالب 2 (PDF مباشر)</>}</button>
                  <button onClick={() => initiateSave('convert_to_snippets', textResult)} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all text-lg" title="تحويل كل معلومة إلى مقتطف منفصل"><Quote className="w-6 h-6" /> تحويل لمقتطفات</button>
                  <button onClick={() => initiateSave('summary', textResult)} className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-emerald-700 active:scale-95 transition-all text-lg"><Save className="w-6 h-6" /> حفظ الملخص الذهبي</button>
                </>
              )}
            </div></div><div className="bg-white dark:bg-slate-900 p-12 md:p-20 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-white leading-relaxed">
              {(dailyOnlyImportantExamPoints || originalFullSummary) && (
                <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40 border-2 border-amber-400 dark:border-amber-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-right">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Flame className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-900 dark:text-amber-100 text-base font-cairo">
                        ⚡ ملخص الأمور المهمة فقط (مراجعة ليلة الامتحان - High-Yield Review)
                      </h4>
                      <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium leading-relaxed">
                        يحتوي هذا الملخص حصراً على الركائز الامتحانية الحتمية والمعايير الذهبية والأدوية وتصحيح المفاهيم، مع حذف الحشو الإنشائي كاملاً.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-amber-600 text-white font-black px-3.5 py-1.5 rounded-full shadow-sm whitespace-nowrap self-end sm:self-center">
                    Pre-Exam Review
                  </span>
                </div>
              )}
              <MarkdownRenderer text={textResult} />
            </div></div>)}
            {status === AppStatus.COMPLETED && results.length > 0 && !textResult && (
              <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
                <div className="flex justify-between items-center px-2"><button onClick={() => { soundService.playPop(); setStatus(AppStatus.IDLE); }} className="text-slate-400 font-black flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><ArrowLeft className="w-6 h-6" /> خروج</button>
                <div className="flex gap-2">
                  <button onClick={() => handleExportQuizToGoogleForm()} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all text-lg" title="تصدير كنموذج Google Form"><Globe className="w-6 h-6" /> نموذج Google</button>
                  <button onClick={() => handleExportPDF(results)} className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-6 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all text-lg" title="عرض وتصدير (HTML/PDF)"><Printer className="w-6 h-6" /> عرض وتصدير</button>
                  <button onClick={() => initiateSave('quiz', results)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all text-lg"><Save className="w-6 h-6" /> حفظ الاختبار</button>
                </div>
                </div>
                {!quizFinished ? (
                  <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.08)] dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                    <button onClick={() => initiateSave('question', results[currentQuestionIndex])} className="absolute top-10 left-10 p-4 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-900/30 group transition-all border border-transparent hover:border-amber-100 dark:hover:border-amber-800" title="حفظ هذا السؤال فقط"><Bookmark className="w-8 h-8 text-slate-100 dark:text-slate-800 group-hover:text-amber-500 fill-transparent group-hover:fill-amber-100 dark:group-hover:fill-amber-900/50 transition-all" /></button>
                    <div className="h-4 bg-slate-50 dark:bg-slate-800"><div className="h-full bg-indigo-600 transition-all duration-700 shadow-[0_0_20px_rgba(79,70,229,0.5)]" style={{ width: `${((currentQuestionIndex + 1) / results.length) * 100}%` }}></div></div>
                    <div className="p-12 md:p-16">
                      <div className="text-indigo-600 dark:text-indigo-400 font-black text-sm uppercase tracking-widest mb-4">Question {currentQuestionIndex + 1} of {results.length}</div>
                      {(() => {
                         const currentQ = results[currentQuestionIndex];
                         const isDirRtl = isArabicText(currentQ.question);
                         return (
                           <div dir={isDirRtl ? 'rtl' : 'ltr'}>
                             <h3 className={`text-3xl font-black mb-12 text-slate-900 dark:text-white leading-[1.4] ${isDirRtl ? 'pr-12 text-right' : 'pl-12 text-left'}`}>{renderFormattedText(currentQ.question)}</h3>
                             <div className="space-y-5">{currentQ.options.map((opt, i) => { const isCorrect = opt === currentQ.correctAnswer; const isSelected = selectedOption === opt; let bg = "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/20"; if (isAnswerRevealed) { if (isCorrect) bg = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-md ring-2 ring-emerald-500/20"; else if (isSelected) bg = "bg-red-50 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-300 shadow-md ring-2 ring-red-500/20"; else bg = "opacity-30 grayscale pointer-events-none scale-95"; } else if (isSelected) bg = "bg-indigo-50 dark:bg-indigo-900/50 border-indigo-600 dark:border-indigo-500 text-indigo-900 dark:text-indigo-100 ring-[6px] ring-indigo-600/10 dark:ring-indigo-500/10 shadow-xl"; return (<button key={i} onClick={() => { if (!isAnswerRevealed) { soundService.playClick(); setSelectedOption(opt); } }} className={`w-full ${isDirRtl ? 'text-right' : 'text-left'} p-6 rounded-3xl border-2 transition-all font-black text-xl flex items-center gap-5 text-slate-800 dark:text-slate-200 ${bg}`}><span className="flex-1 leading-relaxed">{renderFormattedText(opt)}</span>{isAnswerRevealed && isCorrect && <div className="bg-emerald-600 p-1.5 rounded-full"><Check className="w-5 h-5 text-white" /></div>}{isAnswerRevealed && isSelected && !isCorrect && <div className="bg-red-500 p-1.5 rounded-full"><X className="w-5 h-5 text-white" /></div>}</button>); })}</div>
                           </div>
                         );
                      })()}
                    </div>
                    {isAnswerRevealed ? (
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-8 flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800">
                         <div className="bg-indigo-50 dark:bg-indigo-900/20 px-6 py-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <p className="text-xs font-black text-indigo-500 dark:text-indigo-400 mb-2 uppercase tracking-widest flex items-center gap-1"><Sparkles className="w-3 h-3" /> تحليل الإجابة (Detailed Rationale)</p>
                            <div dir={isArabicText(results[currentQuestionIndex].reason) ? 'rtl' : 'ltr'}>
                               <p className={`text-slate-700 dark:text-slate-300 text-base font-medium leading-loose ${isArabicText(results[currentQuestionIndex].reason) ? 'text-right' : 'text-left'}`}>{renderFormattedText(results[currentQuestionIndex].reason)}</p>
                            </div>
                         </div>
                         <div className="flex justify-end mt-2">
                            <button onClick={() => { soundService.playMechanical(); if (currentQuestionIndex < results.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setSelectedOption(null); setIsAnswerRevealed(false); } else { setQuizFinished(true); } }} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-black hover:scale-105 transition-transform flex items-center gap-3 shadow-xl">{currentQuestionIndex < results.length - 1 ? <>السؤال التالي <ArrowLeft className="w-5 h-5" /></> : <>إنهاء الاختبار <CheckCircle className="w-5 h-5" /></>}</button>
                         </div>
                      </div>
                    ) : (
                      <div className="p-8 flex justify-end border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <button disabled={!selectedOption || isAnswerRevealed} onClick={() => { if (isAnswerRevealed) return; if (selectedOption) { setIsAnswerRevealed(true); if (selectedOption === results[currentQuestionIndex].correctAnswer) { setScore(prev => prev + 1); soundService.playSuccess(); } else { soundService.playError(); } } else { alert("الرجاء اختيار إجابة"); } }} className={`px-10 py-4 rounded-2xl font-black text-lg transition-all shadow-xl ${selectedOption && !isAnswerRevealed ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 cursor-pointer' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}>تحقق من الإجابة</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl p-12 md:p-20 text-center border border-slate-200 dark:border-slate-800 animate-scale-in">
                     <div className="w-32 h-32 bg-yellow-400 rounded-full mx-auto mb-8 flex items-center justify-center shadow-[0_20px_60px_rgba(250,204,21,0.5)] animate-bounce"><Trophy className="w-16 h-16 text-white" /></div>
                     <h2 className="text-5xl font-black text-slate-900 dark:text-white mb-4">أحسنت يا بطل!</h2>
                     <p className="text-2xl text-slate-500 dark:text-slate-400 font-bold mb-12">لقد أكملت الاختبار بنجاح</p>
                     <div className="flex justify-center items-center gap-12 mb-12">
                        <div className="text-center"><div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mb-2">{score}</div><div className="text-sm text-slate-400 font-bold uppercase tracking-widest">إجابة صحيحة</div></div>
                        <div className="w-px h-24 bg-slate-200 dark:bg-slate-800"></div>
                        <div className="text-center"><div className="text-6xl font-black text-slate-300 dark:text-slate-600 mb-2">{results.length}</div><div className="text-sm text-slate-400 font-bold uppercase tracking-widest">إجمالي الأسئلة</div></div>
                     </div>
                     <div className="max-w-md mx-auto space-y-4">
                        {!isHistorySaved ? (
                          <div className="flex gap-2">
                             <input type="text" placeholder="اسم لهذا الاختبار (مثلاً: قلبية 2023)" className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-6 font-bold focus:border-indigo-500 outline-none dark:text-white" value={historyNameInput} onChange={(e) => setHistoryNameInput(e.target.value)} />
                             <button onClick={saveToHistory} className="bg-indigo-600 text-white px-6 rounded-2xl font-black hover:bg-indigo-700 transition-colors">حفظ</button>
                          </div>
                        ) : (
                          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl font-black flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> تم الحفظ في السجل</div>
                        )}
                        <div className="flex gap-2">
                           <button onClick={() => handleExportQuizToGoogleForm()} className="flex-1 py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2"><Globe className="w-5 h-5" /> نموذج Google</button>
                           <button onClick={() => handleExportPDF(results)} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center gap-2"><Printer className="w-5 h-5" /> تصدير PDF</button>
                           <button onClick={() => { soundService.playMechanical(); setStatus(AppStatus.IDLE); }} className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">الرئيسية</button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
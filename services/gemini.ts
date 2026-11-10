import { MatchedQuestion, AppMode, ParsedFile } from "../types";

async function postToApi<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export const generateMentorInsight = async (
  lectureFiles: ParsedFile[],
  pastExamFiles: ParsedFile[] = [],
  mode: AppMode = 'extraction',
  generatedText: string | null = null
): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/mentor-insight', {
      lectureFiles,
      pastExamFiles,
      mode,
      generatedText
    });
  } catch (e) {
    console.error("Mentor generation failed", e);
    return "عذراً، لم يتمكن المرشد من قراءة الملفات حالياً.";
  }
};

export const extractTopicsFromSnippets = async (snippets: string): Promise<string[]> => {
  try {
    return await postToApi<string[]>('/api/gemini/extract-topics', { snippets });
  } catch (e) {
    console.error("Topic extraction failed", e);
    return [];
  }
};

export const extractSnippetsFromText = async (text: string): Promise<{ title: string; content: string }[]> => {
  try {
    return await postToApi<{ title: string; content: string }[]>('/api/gemini/extract-snippets', { text });
  } catch (e) {
    console.error("Snippet extraction failed", e);
    return [];
  }
};

export const explainTopic = async (
  topic: string, 
  source: 'snippets' | 'file', 
  contextData: string | string[]
): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/explain-topic', {
      topic,
      source,
      contextData
    });
  } catch (e) {
    console.error("Topic explanation failed", e);
    return "حدث خطأ أثناء الشرح. قد يكون الملف كبيراً جداً.";
  }
};

export const generateDoctorAdvice = async (contextData: string): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/doctor-advice', { contextData });
  } catch (e) {
    console.error("Doctor generation failed", e);
    return "حدث خطأ بسيط أثناء محاولة قراءة مقتطفاتك.";
  }
};

export const getTranslation = async (text: string): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/translate', { text });
  } catch (e) {
    console.error("Translation failed", e);
    return "خطأ في الترجمة";
  }
};

export const improveTextFormatting = async (text: string): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/improve-formatting', { text });
  } catch (e) {
    console.error("Smart Format failed", e);
    return text;
  }
};

export const correctCodeSnippet = async (text: string): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/correct-code', { text });
  } catch (e) {
    console.error("Code correction failed", e);
    return text;
  }
};

export const correctMathAndScientificNotation = async (text: string): Promise<string> => {
  if (!text || !text.trim()) return text;
  try {
    return await postToApi<string>('/api/gemini/correct-math', { text });
  } catch (e) {
    console.error("AI Math correction failed", e);
    throw e;
  }
};

export const correctMathSymbols = correctMathAndScientificNotation;

export const searchGoogleInfo = async (query: string) => {
  try {
    return await postToApi<{ text: string; groundingChunks: any[] }>('/api/gemini/search-google-info', { query });
  } catch (e) {
    console.error("Google Search failed", e);
    return { text: "عذراً، حدث خطأ أثناء البحث في جوجل.", groundingChunks: [] };
  }
};

export const distillToExamImportantPoints = async (summaryText: string): Promise<string> => {
  if (!summaryText || !summaryText.trim()) return summaryText;
  try {
    return await postToApi<string>('/api/gemini/distill-important-points', { summaryText });
  } catch (e) {
    console.error("Distillation failed", e);
    throw e;
  }
};

export const analyzeMatches = async (
  lectureFiles: ParsedFile[],
  examFiles: ParsedFile[],
  mode: AppMode = 'extraction',
  questionCount: number = 15,
  customPrompt: string = "",
  isMegaConcise: boolean = false,
  doctorNotesFiles: ParsedFile[] = [],
  isDoubleCheckEnabled: boolean = false,
  additionalDoctorNotesFiles: ParsedFile[] = [],
  separateLectures: boolean = false,
  lectureConfigs: Record<string, { include: boolean, customName: string }> = {},
  isComprehensive: boolean = false,
  closeExamGaps: boolean = true,
  onlyImportantExamPoints: boolean = false
): Promise<MatchedQuestion[] | string> => {
  try {
    return await postToApi<MatchedQuestion[] | string>('/api/gemini/analyze-matches', {
      lectureFiles,
      examFiles,
      mode,
      questionCount,
      customPrompt,
      isMegaConcise,
      doctorNotesFiles,
      isDoubleCheckEnabled,
      additionalDoctorNotesFiles,
      separateLectures,
      lectureConfigs,
      isComprehensive,
      closeExamGaps,
      onlyImportantExamPoints
    });
  } catch (e) {
    console.error("Analyze matches failed", e);
    throw e;
  }
};

export const formatSummaryForPDFTemplate2 = async (
  text: string, 
  includeGuide: boolean = true, 
  skipMainText: boolean = false, 
  doctorNotesFiles: ParsedFile[] = [], 
  doubleCheckNotes: boolean = false, 
  removeFakeInfoConfirm: boolean = false, 
  lectureFiles: ParsedFile[] = [],
  additionalDoctorNotesFiles: ParsedFile[] = [],
  separateLectures: boolean = false,
  lectureConfigs: Record<string, { include: boolean, customName: string }> = {},
  enableMathSuperCheck: boolean = false
): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/format-summary-pdf-template2', {
      text,
      includeGuide,
      skipMainText,
      doctorNotesFiles,
      doubleCheckNotes,
      removeFakeInfoConfirm,
      lectureFiles,
      additionalDoctorNotesFiles,
      separateLectures,
      lectureConfigs,
      enableMathSuperCheck
    });
  } catch (e) {
    console.error("PDF Template 2 formatting failed", e);
    throw e;
  }
};

export const formatSummaryForPDF = async (
  text: string, 
  includeGuide: boolean = true,
  removeFakeInfoConfirm: boolean = false,
  lectureFiles: ParsedFile[] = []
): Promise<string> => {
  try {
    return await postToApi<string>('/api/gemini/format-summary-pdf', {
      text,
      includeGuide,
      removeFakeInfoConfirm,
      lectureFiles
    });
  } catch (e) {
    console.error("PDF formatting failed", e);
    throw e;
  }
};

export const generateExamsForPDF = async (
  text: string, 
  questionFilesText: string = "", 
  includePast: boolean = true, 
  includePredictions: boolean = true, 
  strictPastExtraction: boolean = false, 
  exportAllPastExamsMode: boolean = false, 
  pastExamFiles: ParsedFile[] = [], 
  removeFakeInfoConfirm: boolean = false, 
  cachedPastQuestionsInfo: string = ""
): Promise<string> => {
  if (!includePast && !includePredictions && !exportAllPastExamsMode) return "";
  try {
    return await postToApi<string>('/api/gemini/generate-exams-pdf', {
      text,
      questionFilesText,
      includePast,
      includePredictions,
      strictPastExtraction,
      exportAllPastExamsMode,
      pastExamFiles,
      removeFakeInfoConfirm,
      cachedPastQuestionsInfo
    });
  } catch (e) {
    console.error("Exams generation failed", e);
    throw e;
  }
};

export const injectImagesIntoHTML = async (
  documentContent: string,
  images: { name: string; mimeType: string; dataUrl: string }[]
): Promise<string> => {
  let gridHtml = `
  <div style="margin: 30px auto; padding: 20px; text-align: center; background: #fafaf9; border: 1px dashed #d6d3d1; border-radius: 12px; max-width: 95%;">
    <h3 style="margin-top: 0; margin-bottom: 15px; color: #44403c; font-family: 'Cairo', 'Inter', sans-serif;">المرفقات الصورية</h3>
    <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; align-items: flex-start;">
  `;
  
  for (const img of images) {
    gridHtml += `
      <div style="border: 2px solid #e7e5e4; border-radius: 8px; padding: 4px; background: white; width: 250px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <img src="${img.dataUrl}" alt="${img.name}" style="max-width: 100%; height: auto; border-radius: 4px;" />
        <span style="font-size: 11px; color: #a8a29e; margin-top: 6px; font-family: monospace; word-break: break-all;">${img.name}</span>
      </div>
    `;
  }
  
  gridHtml += `</div></div>`;

  let finalHtml = documentContent;
  
  const h1Match = finalHtml.match(/<\/h1>/i);
  if (h1Match && h1Match.index !== undefined) {
      const splitIndex = h1Match.index + 5;
      finalHtml = finalHtml.substring(0, splitIndex) + gridHtml + finalHtml.substring(splitIndex);
  } else {
      const bodyMatch = finalHtml.match(/<body[^>]*>/i);
      if (bodyMatch && bodyMatch.index !== undefined) {
          const splitIndex = bodyMatch.index + bodyMatch[0].length;
          finalHtml = finalHtml.substring(0, splitIndex) + gridHtml + finalHtml.substring(splitIndex);
      } else {
          finalHtml = gridHtml + finalHtml;
      }
  }

  return finalHtml;
};

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as geminiService from './server/geminiService.ts';
import { getAIStatus } from './server/localAI.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Support large file uploads (PDF slides, parsed images, long text)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // The legacy /api/gemini paths are kept for the frontend; all requests use Ollama.
  app.get('/api/ai/status', async (_req, res) => res.json(await getAIStatus()));

  app.post('/api/gemini/mentor-insight', async (req: Request, res: Response) => {
    try {
      const { lectureFiles, pastExamFiles, mode, generatedText } = req.body;
      const result = await geminiService.generateMentorInsight(
        lectureFiles || [],
        pastExamFiles || [],
        mode,
        generatedText
      );
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/mentor-insight:', err);
      res.status(500).json({ error: err.message || 'Mentor insight generation failed' });
    }
  });

  app.post('/api/gemini/extract-topics', async (req: Request, res: Response) => {
    try {
      const { snippets } = req.body;
      const result = await geminiService.extractTopicsFromSnippets(snippets || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/extract-topics:', err);
      res.status(500).json({ error: err.message || 'Topic extraction failed', result: [] });
    }
  });

  app.post('/api/gemini/extract-snippets', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const result = await geminiService.extractSnippetsFromText(text || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/extract-snippets:', err);
      res.status(500).json({ error: err.message || 'Snippet extraction failed', result: [] });
    }
  });

  app.post('/api/gemini/explain-topic', async (req: Request, res: Response) => {
    try {
      const { topic, source, contextData } = req.body;
      const result = await geminiService.explainTopic(topic, source, contextData);
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/explain-topic:', err);
      res.status(500).json({ error: err.message || 'Topic explanation failed' });
    }
  });

  app.post('/api/gemini/doctor-advice', async (req: Request, res: Response) => {
    try {
      const { contextData } = req.body;
      const result = await geminiService.generateDoctorAdvice(contextData || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/doctor-advice:', err);
      res.status(500).json({ error: err.message || 'Doctor advice failed' });
    }
  });

  app.post('/api/gemini/translate', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const result = await geminiService.getTranslation(text || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/translate:', err);
      res.status(500).json({ error: err.message || 'Translation failed' });
    }
  });

  app.post('/api/gemini/improve-formatting', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const result = await geminiService.improveTextFormatting(text || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/improve-formatting:', err);
      res.status(500).json({ error: err.message || 'Formatting failed' });
    }
  });

  app.post('/api/gemini/correct-code', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const result = await geminiService.correctCodeSnippet(text || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/correct-code:', err);
      res.status(500).json({ error: err.message || 'Code correction failed' });
    }
  });

  app.post('/api/gemini/correct-math', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const result = await geminiService.correctMathAndScientificNotation(text || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/correct-math:', err);
      res.status(500).json({ error: err.message || 'Math correction failed' });
    }
  });

  app.post('/api/gemini/search-google-info', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      const result = await geminiService.searchGoogleInfo(query || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/search-google-info:', err);
      res.status(500).json({ error: err.message || 'Google search failed' });
    }
  });

  app.post('/api/gemini/distill-important-points', async (req: Request, res: Response) => {
    try {
      const { summaryText } = req.body;
      const result = await geminiService.distillToExamImportantPoints(summaryText || '');
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/distill-important-points:', err);
      res.status(500).json({ error: err.message || 'Distillation failed' });
    }
  });

  app.post('/api/gemini/analyze-matches', async (req: Request, res: Response) => {
    try {
      const {
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
      } = req.body;

      const result = await geminiService.analyzeMatches(
        lectureFiles || [],
        examFiles || [],
        mode,
        questionCount,
        customPrompt,
        isMegaConcise,
        doctorNotesFiles || [],
        isDoubleCheckEnabled,
        additionalDoctorNotesFiles || [],
        separateLectures,
        lectureConfigs || {},
        isComprehensive,
        closeExamGaps,
        onlyImportantExamPoints
      );

      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/analyze-matches:', err);
      res.status(500).json({ error: err.message || 'Analysis failed' });
    }
  });

  app.post('/api/gemini/format-summary-pdf-template2', async (req: Request, res: Response) => {
    try {
      const {
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
      } = req.body;

      const result = await geminiService.formatSummaryForPDFTemplate2(
        text || '',
        includeGuide,
        skipMainText,
        doctorNotesFiles || [],
        doubleCheckNotes,
        removeFakeInfoConfirm,
        lectureFiles || [],
        additionalDoctorNotesFiles || [],
        separateLectures,
        lectureConfigs || {},
        enableMathSuperCheck
      );

      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/format-summary-pdf-template2:', err);
      res.status(500).json({ error: err.message || 'Template 2 formatting failed' });
    }
  });

  app.post('/api/gemini/format-summary-pdf', async (req: Request, res: Response) => {
    try {
      const { text, includeGuide, removeFakeInfoConfirm, lectureFiles } = req.body;
      const result = await geminiService.formatSummaryForPDF(
        text || '',
        includeGuide,
        removeFakeInfoConfirm,
        lectureFiles || []
      );
      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/format-summary-pdf:', err);
      res.status(500).json({ error: err.message || 'PDF formatting failed' });
    }
  });

  app.post('/api/gemini/generate-exams-pdf', async (req: Request, res: Response) => {
    try {
      const {
        text,
        questionFilesText,
        includePast,
        includePredictions,
        strictPastExtraction,
        exportAllPastExamsMode,
        pastExamFiles,
        removeFakeInfoConfirm,
        cachedPastQuestionsInfo
      } = req.body;

      const result = await geminiService.generateExamsForPDF(
        text || '',
        questionFilesText || '',
        includePast,
        includePredictions,
        strictPastExtraction,
        exportAllPastExamsMode,
        pastExamFiles || [],
        removeFakeInfoConfirm,
        cachedPastQuestionsInfo || ''
      );

      res.json({ result });
    } catch (err: any) {
      console.error('Error in /api/gemini/generate-exams-pdf:', err);
      res.status(500).json({ error: err.message || 'Exams generation failed' });
    }
  });

  // --- STATIC ASSETS & VITE MIDDLEWARE ---

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('/{*splat}', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

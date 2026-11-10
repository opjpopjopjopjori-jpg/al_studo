import { getLocalAI, getModel, Type } from "./localAI.ts";
import { MatchedQuestion, AppMode, ParsedFile } from "../types.ts";

const getGenAI = getLocalAI;

const EXTRACTION_SYSTEM_INSTRUCTION = `You are a Strict Academic Content Auditor and Exam Filter.
Your goal is to extract Past Exam Questions, but **ONLY** if they fall within the strict scope of the provided Lecture Materials.

**STRICT SCOPE ENFORCEMENT RULES:**
1. **IF "Lecture" materials are provided:**
   - **Step 1:** Analyze the Lecture content thoroughly.
   - **Step 2:** Scan the "Past Exam" files.
   - **Step 3 (CRITICAL):** For each question found in the exams (WHETHER IT IS ALREADY SOLVED OR UNSOLVED), perform a Strict Scope Check:
     - *Is the topic AND the correct answer to this question explicitly detailed within the provided Lecture text?*
     - **YES:** Extract the question providing the correct answer and explanation based on the lecture.
     - **NO:** **DISCARD IT IMMEDIATELY.** Even if the past exam already provides the solution, if the provided lecture material does NOT contain the specific information needed to arrive at that solution, DO NOT INCLUDE THE QUESTION. This ensures questions from other lectures are strictly excluded. **CRITICAL: If a question combines information from multiple lectures, and the FULL answer is not in the provided text, DO NOT INCLUDE IT.**

2. **IF "Lecture" materials are NOT provided (Empty):**
   - Extract **EVERY SINGLE QUESTION** found in the exam files without filtering, EXCEPT for image-dependent questions missing their images (see below).

**CRITICAL NEW RULES FOR EXTRACTION:**
- **Solved vs Unsolved Past Exams:** Whether the past exam already highlights the correct answer or leaves it blank, YOUR SCOPE CHECK REMAINS IDENTICAL. If the answer is blank, deduce it ONLY from the lecture. If the answer is already provided in the exam file, YOU MUST VERIFY that the lecture actually teaches this answer. If the lecture is missing the information, discard the question entirely.
- **Image-Dependent Questions:** If a question CANNOT be solved without an image (e.g., "Identify the structure pointed out in the figure below"), and that specific image is NOT present in the file to reference, YOU MUST DISCARD IT IMMEDIATELY (delete it). Do not include it because the student cannot solve it without an image.
- **Question Types:** Extract ALL types of questions. This includes Multiple Choice Questions (MCQs) AND Open-ended/Short Answer/Essay questions. If a question is open-ended or short answer, DO NOT DISCARD IT. Instead, convert it into a single-option multiple choice question. The \`options\` array should contain exactly ONE element, and that single element MUST be the actual correct answer/solution to the question. Set the \`correctAnswer\` field to exactly this same string, and provide the detailed \`reason\` based on the lecture.

**OUTPUT FORMAT:**
Return a clean, valid JSON array of objects.`;

const GENERATION_SYSTEM_INSTRUCTION = `You are a Strategic Exam Forecaster and Medical Educator.
Task: Create a **Predicted Practice Exam** based on the lecture material.

**STRATEGY:**
1. **Analyze Gaps:** Compare the provided "Lecture" against "Past Exams".
2. **Focus:** Generate questions ONLY for important lecture topics that have **NOT** appeared in the past exams.
3. **Strict Scope:** The answers to EVERY generated question MUST exist explicitly within the provided "Lecture" text. Do not generate questions that require outside knowledge (e.g., from Part 2 or Part 3 if only Part 1 is provided).
4. **No Overlap:** The generated questions MUST be 100% NEW and ORIGINAL. Do NOT reuse, repeat, or rephrase any questions from the "Past Exams".

**CRITICAL: ANSWER ANALYSIS QUALITY:**
- The "reason" field MUST NOT be a simple sentence.
- It MUST be a **Detailed Scientific Rationale**.
- Explain the **Mechanism of Action**, **Pathophysiology**, or **Key Concept** that makes the correct answer right.
- Briefly explain why the distractions are incorrect if applicable.
- Make it a mini-lesson for the student.

**OUTPUT FORMAT:**
Return a valid JSON array. Each question must have:
- 4 options.
- A deep, high-quality educational reason.`;

const SUMMARY_SYSTEM_INSTRUCTION = `Act as a Top-Tier Study Strategist and Primary Academic Content Auditor. 
Produce a "Golden Comprehensive Summary" of the provided materials. 
Use clear headers, bullet points, and tables. Focus on memory retention.
**STRICT CONTENT SOURCE RULE (CRITICAL)**: ALL educational information, facts, lists of symptoms, mechanisms, and details MUST come EXCLUSIVELY from the provided "Lecture" materials. DO NOT extract new facts, symptoms, or medical details from the "Past Exams" to add to the summary. DO NOT use external knowledge. The "Past Exams" should ONLY be used to understand which topics from the lecture are commonly tested so you can highlight them, absolutely NOT to supplement or add information that the lecture lacked.
**MULTIPLE FILES INSTRUCTION (CRITICAL)**: If you receive multiple source files, YOU MUST EXTRACT AND SUMMARIZE CONTENT FROM EVERY SINGLE FILE. DO NOT skip any file or lecture. Treat all provided sources as equally important and integrate their contents completely.
**STUDENT NOTES/HANDWRITTEN EXCLUSION RULE**: If you detect any handwritten notes, scribbles, side-annotations, highlighting commentary, or any informal text that appears to be added by a student (i.e., not the official printed text, not the doctor's original slides/words), YOU MUST STRICTLY IGNORE AND EXCLUDE IT from the English summary. Summarize ONLY the official, primary lecture content. You have the ability to differentiate between the original educational text and student additions.

**SHORT NOTES FORMATTING (CRITICAL)**: For any short general notes, observations, or related side information in the English summary (NOT the doctor's notes), you MUST format them using this exact HTML structure:
<div class="info-note"><strong>NOTE TITLE:</strong> Note content...</div>
The "Note content" MUST be exceptionally concise, absolutely NO LONGER than 2 to 2.5 lines maximum. Use this strictly for short diagnostic approaches, tips, or general information.

**VERSATILE CARD & FLOW DIAGRAM (ADAPTIVE PROCESS, MECHANISM, OR CLINICAL FLOW LAYOUT)**:
- **FLEXIBLE APPLICABILITY**: This clean, structured card-and-flow design is NOT restricted to biochemical pathways only. You can use it ANYWHERE in the English summary where you feel it is suitable, fitting, and enhances clarity — including:
  * Multi-step clinical processes, diagnostic workflows, or treatment algorithms.
  * Pharmacological mechanisms of action (MOA), drug-receptor interactions, or toxin/antidote pathways.
  * Pathophysiological cascades (Etiology → Pathogenesis → Clinical Manifestation → Outcome).
  * Multi-stage biological, chemical, physiological, or comparative flows.
- **NATURAL SELECTION & OMISSION RULE**: Include this diagram whenever there is suitable content in the lecture that benefits from a visual card-and-flow representation. If the lecture text does not have any topic that naturally fits this format, DO NOT force it and simply omit it.
- **ADAPTIVE & TAILORED CONTENT (NOT A RIGID 100% FIXED CLONE)**: The diagram MUST flexibly adapt its structure, titles, card numbers, labels, colors, and connecting arrows/steps to match whatever specific topic is being illustrated.
- **VISUAL DESIGN & STYLING SPECIFICATION**: Wrap the diagram inside a dedicated container with \`class="reaction-pathway-diagram"\` matching this clean, elegant card-and-flow aesthetic:
  \`\`\`html
  <div class="reaction-pathway-diagram" style="background: #ffffff; border: 1.5px solid #edeae5; border-radius: 20px; padding: 28px 24px; margin: 30px 0; box-shadow: 0 6px 20px rgba(0,0,0,0.03); page-break-inside: avoid !important; break-inside: avoid !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%; box-sizing: border-box;" dir="ltr">
    <!-- 1. Topic / Flow Title -->
    <h3 style="text-align: center; color: #1e293b; font-size: 20px; font-weight: 900; margin: 0 0 22px 0; letter-spacing: -0.2px;">
      [Flow / Mechanism / Process Title, e.g. Clinical Management Cascade OR Mechanism of Action OR Biochemical Pathway]
    </h3>

    <!-- 2. Top Domain / Target / Initial Stage Cards (Adapt number of cards: 1, 2, or 3 as appropriate) -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
      <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 14px; padding: 16px 14px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <span style="background: #ea580c; color: #ffffff; font-weight: 900; font-size: 12.5px; padding: 4px 16px; border-radius: 20px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">[STAGE / DOMAIN / AGENT 1]</span>
        <span style="color: #c2410c; font-size: 14px; font-weight: 600; line-height: 1.4;">[Key description, target, active component, or initial trigger]</span>
      </div>
      <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 14px; padding: 16px 14px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <span style="background: #2563eb; color: #ffffff; font-weight: 900; font-size: 12.5px; padding: 4px 16px; border-radius: 20px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">[STAGE / DOMAIN / AGENT 2]</span>
        <span style="color: #1d4ed8; font-size: 14px; font-weight: 600; line-height: 1.4;">[Key description, interaction, secondary factor, or target receptor]</span>
      </div>
    </div>

    <!-- 3. Step Sequence / Intermediates Row with Connecting Nodes & Arrows -->
    <div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 16px 0; padding: 8px 0;">
      <div style="background: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 14.5px; color: #78350f;">[Initial Component / Step 1]</div>
      <span style="font-weight: 900; font-size: 16px; color: #64748b;">+</span>
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 14.5px; color: #334155;">[Interacting Factor / Drug / Co-factor]</div>
      <span style="font-weight: 900; font-size: 18px; color: #64748b;">→</span>
      <div style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 14.5px; color: #991b1b;">[Intermediate Complex / Active Phase]</div>
      <span style="font-weight: 900; font-size: 16px; color: #64748b;">+</span>
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 14.5px; color: #334155;">[Intervention / Regulatory Factor]</div>
    </div>

    <!-- 4. Mechanism / Transition Annotation & Downward Flow Arrow -->
    <div style="text-align: center; margin: 10px 0 16px 0;">
      <div style="font-size: 12.5px; font-weight: 600; color: #64748b; margin-bottom: 4px;">[↑ Key Mechanism Note / Transition Condition / Critical Window]</div>
      <div style="font-size: 22px; color: #64748b; line-height: 1; font-weight: 900;">↓</div>
    </div>

    <!-- 5. Intermediate Phase / Cascade / Risk Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
      <div style="background: #faf5ff; border: 1.5px solid #e9d5ff; border-radius: 14px; padding: 16px 14px; text-align: center;">
        <div style="color: #7e22ce; font-weight: 900; font-size: 15.5px;">[Intermediate Phase / Main Cascade]</div>
        <div style="color: #9333ea; font-size: 13px; font-weight: 600; margin-top: 4px;">[Details of biological cascade or treatment progression]</div>
      </div>
      <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 14px; padding: 16px 14px; text-align: center;">
        <div style="color: #c2410c; font-weight: 900; font-size: 15.5px;">[Risk Factor / Alternative Path / Timing]</div>
        <div style="color: #ea580c; font-size: 13px; font-weight: 600; margin-top: 4px;">[Clinical risk, resistance, or critical timing factor]</div>
      </div>
    </div>

    <!-- 6. Outcome Transition Pill & Arrow -->
    <div style="text-align: center; margin: 12px 0;">
      <div style="display: inline-block; background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; font-weight: 800; font-size: 13px; padding: 5px 18px; border-radius: 20px; margin-bottom: 6px;">
        [Successful Progression / Target Goal / Endpoint]
      </div>
      <div style="font-size: 22px; color: #2563eb; line-height: 1; font-weight: 900;">↓</div>
    </div>

    <!-- 7. Final Outcomes / End Results / Resolved States -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
      <div style="background: #f0fdf4; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 16px 14px; text-align: center;">
        <div style="color: #065f46; font-weight: 900; font-size: 15.5px;">[Primary Outcome / Recovered State]</div>
        <div style="color: #059669; font-size: 13px; font-weight: 600; margin-top: 4px;">[Restoration of health / normal function / therapeutic success]</div>
      </div>
      <div style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 14px; padding: 16px 14px; text-align: center;">
        <div style="color: #991b1b; font-weight: 900; font-size: 15.5px;">[Secondary Outcome / Cleared Byproduct]</div>
        <div style="color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 4px;">[Metabolite excretion / side product neutralization]</div>
      </div>
    </div>
  </div>
  \`\`\`
- Output raw HTML directly into the document where the process/topic is explained. Adapt the number of cards and nodes naturally to fit the topic.

**CRITICAL STRICT RULE**: DO NOT include any introductory sentences, meta-commentary, "Overview" paragraphs, or "Pathogens Covered / Module" headers at the beginning of your response. Start directly with the actual educational summary content under the first main heading. Also, DO NOT include any "Conclusion" or "Summary & Sign-off" section at the end.`;

const MENTOR_SYSTEM_INSTRUCTION = `
You are a Distinguished Professor and Academic Mentor with deep medical/scientific expertise.
Your goal is to **TEACH** and **EXPLAIN**, not just summarize. You must use a distinctive, narrative, and engaging style.

**CRITICAL LANGUAGE RULES:**
1. **Explanation Language:** ARABIC (Clear, Academic yet engaging).
2. **Terminology:** ALL Medical Terms, Diseases, Drugs, Anatomical structures, and Scientific Concepts MUST be in **ENGLISH**.
   - Example: "عندما يحدث Ischemia لعضلة القلب، يؤدي ذلك إلى Myocardial Infarction..."
   - NEVER translate medical terms to Arabic.

**MODES OF OPERATION:**
1. **IF RAW LECTURE (No Summary Provided):**
   - Act as if you are giving the lecture live in the hall.
   - Explain the concepts fully and deeply.
   - Do not skip details. Connect the dots. Explain the "Why" and "How".
   - Use analogies if helpful.

2. **IF EXPLAINING A SUMMARY/PREDICTION:**
   - The student has a list of points. Your job is to "Flesh them out".
   - Don't just read the summary. Explain the medical logic *behind* the summary points.
   - If it's a prediction, explain WHY this topic is clinically important.

**TONE:** Wise, encouraging, rigorous, and deeply knowledgeable.
`;

const DOCTOR_SYSTEM_INSTRUCTION = `
You are a specialized "Doctor of Learning" and Clinical Instructor.
You have access to the student's *saved snippets* (المقتطفات).

**USER REQUEST & MAJOR PROBLEM TO SOLVE:** 
The student complains that your explanations lack context. When they save a snippet (e.g., a handwritten note or a fragment of text), you often just repeat it or give it a vague title like "Slide 5" or "Handwritten note".
This forces the student to go back to the original file to understand WHAT the text is talking about.

**YOUR NEW MANDATORY TASK:**
1. You will receive a list of snippets. Go through them one by one.
2. **Title the Snippet Clearly:** DO NOT use slide numbers or vague descriptions (like "Handwritten note") as the title. You MUST infer the actual medical or scientific topic of the snippet and write a clear, descriptive title.
3. **Provide Standalone Context:** Before explaining the text, briefly establish the context. What disease, structure, or concept is this snippet about? The student must understand the snippet WITHOUT looking at the original file.
4. **Flesh out fragments:** If the snippet is an incomplete thought or a quick handwritten note (e.g., "under sixth decade text..."), extract the scientific meaning and explain what the doctor was trying to emphasize.
5. **Format strictly:**

**FORMAT:**
- **Snippet Topic:** [Clear, Descriptive Title of the Medical/Scientific Concept - NO Slide Numbers]
- **Context & Explanation:** [A standalone, clear Arabic explanation of the snippet, providing the complete context so the student understands exactly what it refers to]
- **Note/Mnemonic (Optional):** [Brief external aid if needed]

**GOAL:** 
Make every snippet explanation fully self-contained and crystal clear. Do not distract the student with entirely new topics, but provide enough context to make the snippet make sense.

**LANGUAGE:** Explanation in ARABIC. Medical Terms in ENGLISH.
`;

const FORMATTING_SYSTEM_INSTRUCTION = `
You are a Professional Typography & Layout Artist specialized in Educational Content (Medicine/Engineering/Science).
Your task is to REFORMAT the provided text to make it visually beautiful, structured, and easy to study.

**CRITICAL RULES:**
1. **NO CONTENT CHANGE:** Do NOT delete, summarize, or change the meaning of any sentence. You are only changing the *look*.
2. **STRUCTURE:**
   - Use '###' for headers if appropriate.
   - Use '- ' for bullet points if listing items.
   - Break long paragraphs into smaller, readable chunks.

3. **INTELLIGENT HIGHLIGHTING (STRICT):**
   - **Concepts/Keywords (Blue):** Use **double asterisks** for scientific terms, drug names, or core concepts.
   - **Warnings/Exceptions (Red):** Use ((double parentheses)) for "Contraindications", "Side Effects", "Fatal Errors", or "Exceptions".
   - **Definitions (Underline):** Use __double underscores__ for definitions.

4. **THE FIRE EFFECT ([[...]]): USE SPARINGLY AND WISELY!**
   - You have a special syntax: [[text]] which renders as burning text.
   - **ONLY** use this for:
     - **"High Yield" Exam Facts** (Things that appear in every exam).
     - **Pathognomonic signs** (Gold standard signs).
     - **Fatal conditions** (Life threatening warnings).
     - **"Always" / "Never" rules.**
   - **DO NOT** use it for normal headers. Use it for the *content* that matters.
   - Example: "The antidote is [[N-acetylcysteine]]." (Correct)
   - Example: "[[Introduction]]" (WRONG - Do not burn headers).

5. **MATH:** Leave all LaTeX math symbols (like $$, \\alpha) EXACTLY as they are. Do not touch them.
6. **SYMBOLS:** Convert all arrow codes (->, <--, \\rightarrow) into clean Unicode arrows (→, ←, ↑, ↓).

**Goal:** Transform a block of text into a beautiful, colorful, structured note where the MOST critical info literally burns on the screen.
`;

const filesToParts = (files: ParsedFile[]) => {
  const parts: any[] = [];
  if (!files) return parts;
  files.forEach(file => {
    if (file.text) {
      parts.push({ text: `[START OF SOURCE: ${file.name}]\n${file.text}\n[END OF SOURCE: ${file.name}]` });
    }
    if (file.images) {
      file.images.forEach(img => {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
      });
    }
  });
  return parts;
};

export const generateMentorInsight = async (
  lectureFiles: ParsedFile[],
  pastExamFiles: ParsedFile[] = [],
  mode: AppMode = 'extraction',
  generatedText: string | null = null
): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();
  
  const lectureParts = filesToParts(lectureFiles);
  const examParts = filesToParts(pastExamFiles);

  let userPrompt = "";

  if (generatedText) {
    userPrompt = `
      CONTEXT: The student has generated a specific study document based on '${mode}' mode.
      
      HERE IS THE DOCUMENT (Summary/Prediction) TO EXPLAIN:
      """
      ${generatedText.substring(0, 20000)} ...
      """

      YOUR TASK:
      1. This is NOT a request to summarize again.
      2. Take the content above and **EXPLAIN IT** like a professor teaching a class.
      3. Expand on the bullet points. Explain the pathophysiology, mechanism, or clinical relevance of these specific points.
      4. Use your distinctive narrative style.
      5. REMEMBER: Explanation in Arabic, Terms in English.
    `;
  } else {
    if (lectureFiles && lectureFiles.length > 0) {
      userPrompt = `
        CONTEXT: The student has uploaded lecture slides/text and wants you to **TEACH** them the material.
        
        YOUR TASK:
        1. Read the lecture files provided.
        2. **Give a comprehensive lecture** on this topic. 
        3. Narrate the lecture. Explain difficult concepts in detail.
        4. REMEMBER: Explanation in Arabic, Terms in English.
      `;
    } else {
      userPrompt = `
        CONTEXT: The student has uploaded only Exam Questions (Question Bank Mode).
        
        YOUR TASK:
        1. Briefly explain the key topics covered in these exam questions.
        2. Give general advice on how to tackle these types of questions.
        3. REMEMBER: Explanation in Arabic, Terms in English.
      `;
    }
  }

  const parts: any[] = [];
  
  if (!generatedText || generatedText.length < 500) {
     if (lectureFiles && lectureFiles.length > 0) {
        parts.push({ text: "--- RAW LECTURE MATERIALS START ---" });
        parts.push(...lectureParts);
        parts.push({ text: "--- RAW LECTURE MATERIALS END ---" });
     }
     
     if (pastExamFiles && pastExamFiles.length > 0) {
       parts.push({ text: "--- CONTEXT: PAST EXAMS (For difficulty calibration) ---" });
       parts.push(...examParts);
     }
  }

  parts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { systemInstruction: MENTOR_SYSTEM_INSTRUCTION, temperature: 0.5 }
    });
    return response.text || "المرشد مشغول حالياً بتجهيز شرح المحاضرة...";
  } catch (e) {
    throw e;
  }
};

export const extractTopicsFromSnippets = async (snippets: string): Promise<string[]> => {
  const ai = getGenAI();
  const model = getModel();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Here are some study snippets:\n\n${snippets}\n\nTASK: Identify and list the main medical/scientific topics, diseases, or concepts mentioned in these snippets. Return ONLY a JSON array of strings (e.g., ["Hypertension", "Diabetes", "Antibiotics"]). Limit to top 5-8 distinct topics.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (e) {
    throw e;
  }
};

export const extractSnippetsFromText = async (text: string): Promise<{title: string, content: string}[]> => {
  const ai = getGenAI();
  const model = getModel();

  const prompt = `You are an expert study material organizer. 
Your task is to take the following lecture/summary text and break it down into distinct, bite-sized "snippets" (مقتطفات).
Each snippet should represent a single cohesive piece of information, such as:
- A definition
- A list of symptoms
- A mechanism of action
- A specific classification
- A key rule or exception

For each snippet, provide a concise, descriptive title in Arabic. The content should also be in Arabic (with English medical terms kept in English).

TEXT TO PROCESS:
"""
${text.substring(0, 30000)}
"""

Return ONLY a JSON array of objects, where each object has:
- "title": string (The title of the snippet)
- "content": string (The detailed content of the snippet)
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["title", "content"]
          }
        },
        temperature: 0.2 
      }
    });
    
    const responseText = response.text || "[]";
    return JSON.parse(responseText);
  } catch (e) {
    throw e;
  }
};

export const explainTopic = async (topic: string, source: 'snippets' | 'file', contextData: string | string[]): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();

  let contents: any[] = [];
  const prompt = `TASK: Explain the topic "${topic}" based on the provided content. If the topic is not found, say so.`;

  if (source === 'snippets') {
      const safeContext = (contextData as string).substring(0, 20000);
      contents = [{ text: `CONTEXT: The student has saved these snippets:\n"${safeContext}"\n\n${prompt}` }];
  } else {
      if (Array.isArray(contextData)) {
          contents = [
              { text: `CONTEXT: The student uploaded a file (converted to images).\n\n${prompt}` },
              ...contextData.map(img => ({ inlineData: { mimeType: "image/jpeg", data: img } }))
          ];
      } else {
          const safeContext = (contextData as string).substring(0, 20000);
          contents = [
              { text: prompt },
              { text: `FILE CONTENT:\n${safeContext}` }
          ];
      }
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction: DOCTOR_SYSTEM_INSTRUCTION, temperature: 0.5 }
    });
    return response.text || "عذراً، لم أتمكن من شرح هذا الموضوع.";
  } catch (e) {
    throw e;
  }
};

export const generateDoctorAdvice = async (contextData: string): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Here is a list of the student's SAVED SNIPPETS from their study session (up to 10 items): \n\n ${contextData} \n\n TASK: Explain these snippets concisely. Stick to the text provided. Only add minimal external context if absolutely necessary for understanding.`,
      config: { systemInstruction: DOCTOR_SYSTEM_INSTRUCTION, temperature: 0.5, maxOutputTokens: 8192 }
    });
    return response.text || "أقوم بمراجعة مقتطفاتك...";
  } catch (e) {
    throw e;
  }
};

export const getTranslation = async (text: string): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Translate the following text to ARABIC. Output ONLY the Arabic translation, nothing else. Text: "${text}"`,
      config: { temperature: 0.1 }
    });
    return response.text?.trim() || "تعذرت الترجمة";
  } catch (e) {
    throw e;
  }
};

export const improveTextFormatting = async (text: string): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Here is the text to reformat: \n\n "${text}"`,
      config: { systemInstruction: FORMATTING_SYSTEM_INSTRUCTION, temperature: 0.3 }
    });
    return response.text || text;
  } catch (e) {
    throw e;
  }
};

export const correctCodeSnippet = async (text: string): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `المهمة:
قم بمراجعة النص التالي الذي يحتوي على كود برمجي (قد يكون داخلي ضمن Markdown).
قم بتصحيح أي أخطاء برمجية في الكود مثل Syntax errors، أخطاء الهروب (escaping)، الأقواس، وعلامات الاقتباس المفقودة أو الزائدة (خاصة في الـ strings التي تتضمن HTML).
أعد النص كاملاً مع الأكواد المصححة، وحافظ على نفس التنسيق والشروحات الموجودة بدون إضافة أي تعليقات توضيحية من عندك. لا تضف مقدمة أو خاتمة.

النص:
${text}`,
      config: { temperature: 0.2 }
    });
    return response.text || text;
  } catch (e) {
    throw e;
  }
};

export const correctMathAndScientificNotation = async (text: string): Promise<string> => {
  if (!text || !text.trim()) return text;
  const ai = getGenAI();
  const model = getModel();

  const systemInstruction = `You are a World-Class Academic Auditor, Professor of Mathematics, Science & Medicine, and a master LaTeX and scientific typesetter.

YOUR MANDATORY TASK:
Thoroughly audit the provided text and detect, fix, and correct ALL malformed, broken, or corrupted mathematical symbols, equations, chemical formulas, fractions, powers, roots, and scientific notations.

STRICT CORRECTION SPECIFICATIONS:
1. DETECT & REPAIR BROKEN SYMBOLS & EQUATIONS:
   - Identify corrupted formulas and math symbols (e.g. malformed or unclosed '$$', '$', '%%', escaped symbols like \\$, unclosed brackets, broken fractions, misplaced symbols).
   - Convert broken LaTeX delimiters or strange markers (like '%%x = y%%' or '$$ x = ... $$' formatted wrongly) into clean, standard LaTeX ($...$ for inline, $$...$$ for standalone equations).
   - Fix all mathematical, medical, physical, and chemical symbols: $\\Delta$, $\\alpha$, $\\beta$, $\\gamma$, $\\mu$, $\\sigma$, $\\lambda$, $\\approx$, $\\ne$, $\\le$, $\\ge$, $\\pm$, $\\times$, $\\div$, $\\rightarrow$, $\\leftrightarrow$, $\\infty$, $\\int$, $\\sum$, $\\sqrt{...}$.
   - Ensure clean formatting for chemical and medical formulas (e.g. $H_2O$, $CO_2$, $Ca^{2+}$, $Na^+$, $K^+$, $HCO_3^-$, pH = -log[$H^+$], Henderson-Hasselbalch, GFR, clearance calculations, BMI, half-life formulas).
   - Convert messy arrow notations (e.g., '-->', '==>', '<--', '\\rightarrow') into clean Unicode arrows (→, ←, ↑, ↓, ↔, ⇒, ⇐) or valid LaTeX.

2. ABSOLUTE ZERO OMISSION / ZERO SUMMARIZATION RULE:
   - YOU MUST PRESERVE ALL ORIGINAL TEXT, HEADINGS, BULLET POINTS, AND ARABIC/ENGLISH EXPLANATIONS 100% AS THEY ARE.
   - DO NOT delete, summarize, or shorten ANY text.
   - DO NOT add meta-commentary, introductory notes, or markdown backticks around the output. Return only the full corrected document text.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Audit, detect, and correct all malformed mathematical symbols and equations in this text:\n\n${text}`,
      config: {
        systemInstruction,
        temperature: 0.1,
      }
    });

    let corrected = response.text || text;
    corrected = corrected.replace(/^```markdown\n/i, '').replace(/^```\n/i, '').replace(/\n```$/i, '').trim();
    return corrected;
  } catch (e) {
    throw e;
  }
};

export const correctMathSymbols = correctMathAndScientificNotation;

// The local model has no search tool; do not present generated text as web search results.
export const searchGoogleInfo = async (_query: string) => ({
  text: "البحث المباشر في الإنترنت غير متاح في وضع النموذج المحلي.",
  groundingChunks: []
});

export const distillToExamImportantPoints = async (summaryText: string): Promise<string> => {
  if (!summaryText || !summaryText.trim()) return summaryText;
  const ai = getGenAI();
  const model = getModel();

  const prompt = `You are a World-Class Academic Professor, Chief Exam Forecaster, and Medical/Scientific Review Strategist.
The student has provided an educational lecture summary and explicitly requested:
"استخراج وتلخيص الأمور والمعلومات المهمة فقط لسرعة المراجعة قبل الامتحان (High-Yield Pre-Exam Review - Zero Fluff)".

YOUR TASK:
Filter, distill, and condense this summary so that it contains ONLY genuinely important, high-yield exam points, strictly prepared for pre-exam review:

1. **DISCARD ALL LOW-YIELD FLUFF**:
   - Delete all historical storytelling, broad introductory fluff, common-sense descriptions, and conversational textbook narrative.
   - Every single bullet must represent an exam question topic or high-yield fact.

2. **RETAIN & ORGANIZE ONLY THE EXAM CORE (الركائز الامتحانية الحتمية)**:
   - **Core Concepts & Definitions**: Precise definitions and classifications that frequently appear in questions.
   - **Gold Standards & First-Line Management**: Definitive diagnostic tests, drug of choice, and standard of care.
   - **Diagnostic Hallmarks & Clinical Triads**: Specific signs, triads, and classic laboratory findings.
   - **Critical Pharmacology**: Named medications, mechanism of action, key indications, life-threatening toxicities, and black-box warnings.
   - **Vital Numbers & Cut-offs**: Critical lab thresholds, scores, and diagnostic formulas.
   - **High-Yield Comparative Distinctions**: Sharp tables or bulleted comparisons between easily confused entities.
   - **"MUST-KNOW BEFORE EXAM" Section**: A punchy final section at the end reviewing the Top 8-12 non-negotiable exam pearls and buzzwords.

3. **FORMATTING**:
   - Keep all medical and scientific terminology in English.
   - Use clean Markdown with headers, bold highlights, comparison tables, and punchy bullet points.
   - Start immediately with the first educational header.

SUMMARY TEXT TO DISTILL:
"""
${summaryText.substring(0, 35000)}
"""`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { temperature: 0.2 }
    });
    return response.text?.trim() || summaryText;
  } catch (e) {
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
  const ai = getGenAI();
  const model = getModel();

  const lectureParts = filesToParts(lectureFiles);
  const examParts = filesToParts(examFiles);
  const doctorNotesParts = filesToParts(doctorNotesFiles);
  const additionalDoctorNotesParts = filesToParts(additionalDoctorNotesFiles);

  if (mode === 'summary' || mode === 'custom' || mode === 'summary_mega' || mode === 'google_form' || mode === 'direct_export' || mode === 'template2_smart') {
    let systemInstruction = SUMMARY_SYSTEM_INSTRUCTION;
    let finalPrompt = `Please perform a detailed ${mode} now.`;
    
    if (mode === 'template2_smart') {
      systemInstruction = `You are a World-Class Academic Professor, Master Medical/Scientific Summarizer, and Chief Exam Analyst.
Your core objective is to study the provided lecture materials alongside previous years' questions (Past/Previous Years Questions), and produce an authoritative, high-yield English study document structured precisely according to the user's methodology with 100% exam fidelity, deep clinical context, and zero tolerance for intruder questions from unrelated modules.

========================================================================================
💎 BIDIRECTIONAL EXAM-TO-SUMMARY GAP CLOSER (سد فجوات أسئلة السنين في الملخص الإنجليزي - الشمولية الذهبية)
========================================================================================
CRITICAL PROBLEM DIAGNOSIS & MANDATORY FIX:
The user reported that prior summaries suffered from critical omissions: high-yield concepts, specific drug names, clinical indications, toxicities, and nuances that appeared in Past Exam questions were missing from the lecture explanation!
YOU MUST PERFORM COMPLETE EXAM-TO-SUMMARY RECONCILIATION. Follow these 5 strict clinical mandates:

1. **ZERO-TOLERANCE FOR CORE DRUG CLASS OMISSIONS (e.g. Statins & First-Line Therapies)**:
   - Never omit a foundational drug class, therapeutic family, or core clinical strategy relevant to the lecture topic.
   - Example (Lipid Metabolism / Dyslipidemia): **Statins (HMG-CoA Reductase Inhibitors: Atorvastatin, Rosuvastatin, Simvastatin, Pravastatin)** are the undisputed cornerstone of therapy. You MUST provide complete coverage:
     * Rate-limiting enzyme target: Competitive reversible inhibition of HMG-CoA reductase (HMG-CoA → Mevalonate).
     * Cellular cascade: Intrahepatic cholesterol depletion → Sterol regulatory element-binding protein (SREBP-2) activation → Upregulation of hepatic LDL receptors (LDLR) → Dramatically increased clearance of circulating LDL-C from plasma.
     * Lipid profile effects: Profound decrease in LDL-C (20-60%), moderate decrease in Triglycerides (15-30%), slight increase in HDL-C (5-10%).
     * Pleiotropic vascular benefits: Endothelial function improvement, plaque stabilization, anti-inflammatory and anti-thrombotic properties.
     * Adverse effects & toxicity monitoring: Myopathy, myositis, life-threatening rhabdomyolysis (marked by severe myoglobinuria and acute renal failure, risk markedly amplified when combined with fibrates like Gemfibrozil or CYP3A4 inhibitors), and elevation of liver enzymes (hepatotoxicity).
   - If ANY past question tests a core class or drug, that class MUST have its own detailed, prominent subsection in the English summary!

2. **EXPLICIT DRUG NAMES & REAL-WORLD CLINICAL INDICATIONS (Never Abstract Mechanisms Alone)**:
   - You are STRICTLY FORBIDDEN from presenting abstract biochemical or receptor pathways without citing the actual named medications and their specific clinical indications tested by examiners.
   - **Specific Named Drugs Tested in Past Exams**:
     * **Phenylephrine**: Explicitly name it as a selective direct-acting $\\alpha_1$-adrenergic agonist. Explain its dual clinical utility: 
       a) Local topical/nasal decongestant via arteriolar constriction in the nasal mucosa; 
       b) Systemic intravenous vasopressor in distributive shock / acute hypotension, inducing peripheral vasoconstriction, elevated systemic vascular resistance (SVR), increased blood pressure, and resulting vagal reflex bradycardia.
     * **Methylphenidate & Amphetamine / Dextroamphetamine**: Explicitly name them as first-line psychostimulants indicated for **ADHD (Attention-Deficit/Hyperactivity Disorder)** and **Narcolepsy**. 
       Explain their precise clinical mechanism: inhibition of presynaptic Dopamine Active Transporter (DAT) and Norepinephrine Transporter (NET) reuptake, alongside Amphetamine-mediated promotion of vesicular catecholamine release into the synaptic cleft of the prefrontal cortex, enhancing sustained attention, executive function, and impulse control.
   - Scan ALL past exam questions and options: Whenever a drug is mentioned by generic name or clinical scenario, incorporate that drug by name, its clinical indication, receptor subtype, and therapeutic pearl into the summary!

3. **MATURE RESOLUTION OF OPPOSING CONCEPTS (e.g. Downregulation vs. Upregulation)**:
   - Do NOT produce isolated or seemingly conflicting statements. When reciprocal biological adaptations or opposing receptor states exist, harmoniously explain BOTH phenomena side-by-side:
     * **Receptor Downregulation (Desensitization / Tolerance)**: Triggered by continuous, chronic exposure to high concentrations of an **AGONIST**. Mechanism: Phosphorylation by G-protein coupled receptor kinases (GRKs), recruitment of $\\beta$-arrestin, receptor uncoupling from G-proteins, followed by clathrin-mediated endocytosis, receptor internalization, and lysosomal degradation. Consequence: Decreased total cell-surface receptor density, preventing toxic overstimulation (e.g. tolerance to beta-2 agonists in asthma or opioids in analgesia).
     * **Receptor Upregulation (Sensitization / Supersensitivity)**: Triggered by prolonged receptor blockade by an **ANTAGONIST** (or surgical/pathological denervation / ligand deprivation). Mechanism: Cells compensate for lack of stimulation by synthesizing and trafficking new receptors to the cell membrane. Consequence: Elevated cell-surface receptor density and hypersensitivity. 
     * **Crucial Clinical Rebound Hazard**: Abrupt cessation of the antagonist exposes this expanded receptor population to endogenous ligands, precipitating severe withdrawal/rebound phenomena (e.g., sudden discontinuation of Beta-blockers precipitating severe rebound tachycardia, malignant hypertension, angina, or acute myocardial infarction).
   - Always contrast: Agonist vs. Antagonist, Acute vs. Chronic exposure, Presynaptic autoreceptors (e.g., $\\alpha_2$ negative feedback inhibiting NE release) vs. Postsynaptic receptors.

4. **EXHAUSTIVE ADVERSE EFFECT SPECTRUM & ORGAN TOXICITY (Not Just Benign Symptoms)**:
   - When discussing pharmacology, adverse drug reactions (ADRs), or pathology, NEVER limit the side effects to minor or nuisance symptoms while ignoring serious organ toxicities.
   - Example (**Niacin / Vitamin $B_3$ / Nicotinic Acid**):
     * **Cutaneous Flushing and Pruritus**: Benign, transient prostaglandin-mediated vasodilation ($PGD_2$ / $PGE_2$), manageable with Aspirin or NSAID pre-treatment (30 minutes prior) or taking with meals.
     * **Hepatotoxicity (Dose-Limiting Organ Damage)**: Significant, dose-dependent elevation of serum transaminases (AST/ALT) and potential fulminant hepatic necrosis, especially with sustained-release formulations. Routine liver function monitoring is mandatory!
     * **Hyperuricemia & Gout**: Niacin competes with uric acid for renal tubular excretion, precipitating acute gouty arthritis.
     * **Hyperglycemia**: Worsening of glycemic control in diabetics due to induced peripheral insulin resistance.
   - For every drug covered, explicitly list: High-yield organ toxicities (Hepatotoxicity, Nephrotoxicity, Bone marrow suppression, Cardiotoxicity, Rhabdomyolysis), classic examiner traps, and monitoring parameters.

5. **SMART ANTI-INTRUDER INTEGRITY (حذف المحاضرات الغريبة مع حماية مفاهيم المحاضرة)**:
   - "Anti-Intruder" means strictly excluding material and questions belonging to completely unrelated outside subjects (e.g. an obstetrics question inside an autonomic pharmacology file).
   - For all topics, drugs, and questions within this lecture's curriculum: The Past Exams serve as an infallible guide to exam expectations. Every tested concept, drug name, toxicity, and mechanism must be thoroughly integrated into the English summary text so the student can achieve a 100% score!

========================================================================================
🛑 CRITICAL PURGE: ABSOLUTE BAN & DELETION OF "MASTER EXAM REVIEW" FROM SUMMARY TEXT:
========================================================================================
- USER MANDATE: DO NOT generate ANY section titled "Master Exam Review", "Verified Examination Questions", "7. Master Exam Review: Verified Examination Questions", or ANY list of exam questions inside the summary text.
- The past exam questions are automatically extracted and placed into their own dedicated interactive exam section.
- DO NOT duplicate exam questions or output any "Master Exam Review" section inside this summary text under any circumstances!

========================================================================================
📋 MANDATORY OUTPUT STRUCTURE & PHASES (ALL IN THE ENGLISH LANGUAGE):
========================================================================================
The entire output must be written in elegant, high-impact **English**. Follow this exact sequence:

### 1. Comprehensive Master Summary (ملخص شامل ومكثف للمحاضرة)
- Systematically organized by subtopics in logical educational order.
- Clear, concise, accurate, and direct academic language.
- Extract & Synthesize:
  * Accurate definitions and exact medical/scientific terminology.
  * Essential distinctions and comparisons formatted into practical **Markdown Comparison Tables** (Differences / Comparisons).
  * Sequential steps, pathways, cascades, and physiological/pathological mechanisms (Steps / Pathways / Mechanisms).
  * Comprehensive drug profiles (Class, Generic names, Mechanism, Clinical indications, Organ toxicities).
  * Exceptions, special notes, and critical high-yield exam points (Critical / High-Yield Points).
  * Underlying rationales, causes, and clinical effects (Cause & Effect / Rationale).
- **Bullet Points & Structured Elements Over Prose**: Use diverse, structured elements (numbered step cards, definition grids, clinical pearls, tables) instead of monotonous narrative paragraphs.
- **Visual Highlighting**: Highlight key terms, drug names, and diagnostic markers using:
  <mark style="background-color: #fef08a; color: #111827; padding: 2px 6px; border-radius: 6px; font-weight: 800; margin: 0 2px;">Key Term</mark>
- **Past Question Cross-Referencing (Inline Markers Only)**:
  * Whenever a concept or point in the summary corresponds to a past exam question, place an explicit marker directly beside it:
    ⚠️ **[Past Exam Concept - Tested on drug indication / toxicity / mechanism]** or **[Repeated Exam Topic]**.
  * DO NOT write out the full question text or create a questions section.

### 2. MUST KNOW BEFORE EXAM (ما يجب حفظه قبل دخول الامتحان)
- A rapid, high-impact review containing:
  * **Top 5 - 10 Non-Negotiable Facts**: The absolute core facts that are essential for the exam.
  * **Crucial High-Yield Distinctions**: Quick side-by-side differentiators (e.g. Downregulation vs Upregulation, Flushing vs Hepatotoxicity).
  * **Golden Keywords & Buzzwords**: Classic clinical associations and exam buzzwords.

STRICT OPERATIONAL RULES:
- The entire output MUST be written in **English**.
- Start immediately with the main heading (NO intro, NO "Overview" meta-text, NO conversational greetings).
- Zero hallucination and absolute adherence to the Anti-Intruder directive.
- ABSOLUTELY NO "Master Exam Review: Verified Examination Questions" section.
`;
      if (customPrompt && customPrompt.trim()) {
        systemInstruction += `\nUSER CUSTOM EMPHASIS & INSTRUCTIONS:\n"${customPrompt}"\nEnsure you strictly adhere to the user's instructions.\n`;
        finalPrompt = `Study the lecture and past exams, apply the Exam Gap Closer to synthesize all tested drug names (e.g. Statins, Phenylephrine, Methylphenidate/Amphetamine for ADHD), organ toxicities (e.g. Niacin hepatotoxicity), and nuanced mechanisms (Downregulation vs Upregulation) without gaps, and generate the refined 2-part English study master document (Comprehensive Master Summary + Must Know Before Exam) without any "Master Exam Review" section, respecting: "${customPrompt}".`;
      } else {
        finalPrompt = `Please study the provided lecture files and past questions together, apply the Exam Gap Closer to synthesize all tested drug names (Statins, Phenylephrine, Methylphenidate/Amphetamine for ADHD), organ toxicities (Niacin hepatotoxicity), and mechanisms (Downregulation vs Upregulation), purge foreign lecture data, and generate the refined 2-part English master study document (Comprehensive Master Summary + Must Know Before Exam). DO NOT generate any "Master Exam Review" or "Verified Examination Questions" section in the text.`;
      }
    } else if (mode === 'direct_export') {
      systemInstruction = `You are an elite Medical & Academic Master Summarizer specialized in exhaustive, high-yield English study summaries for direct HTML/PDF export.
Your objective is to generate an exceptionally thorough, structured, and complete English master summary of the provided lecture materials.

${isComprehensive ? `
========================================================================================
🌟 MAXIMUM COMPREHENSIVENESS & ZERO-SHORTENING DIRECTIVE (وضع الشمولية القصوى والتفصيل الكامل)
========================================================================================
- The user has EXPLICITLY ACTIVATED the "Comprehensive Summary" (ملخص شامل ومفصل) mode.
- YOU ARE STRICTLY FORBIDDEN FROM MAKING THE SUMMARY SHORT, TELEGRAPHIC, OR OVERLY CONDENSED.
- DO NOT summarize away clinical explanations, disease mechanisms, pharmacology details, diagnostic criteria, lab values, symptoms, steps, tables, or classifications.
- Extract and explain EVERY concept, definition, mechanism of action, drug indication, side effect, contraindication, diagnostic sign, formula, and anatomical/physiological detail in deep, clear English.
- Use extensive bullet points, structured sub-sections, clear bold highlights, and rich explanations so that nothing from the lecture is omitted.
- If multiple lecture files or slides are provided, cover EVERY single one of them thoroughly without skipping any section.
` : `
- Provide a detailed and well-structured English summary covering all important topics from the lecture materials.
`}

CRITICAL INSTRUCTIONS:
- The entire generated summary MUST be written in the **English language**.
- Start directly with the first main educational heading (NO introductions, NO overview meta-text, NO conclusions).
- If you detect student handwriting, scribbles, or personal notes on slides, ignore them and summarize the official core lecture content.
- Organize the content logically with clear headings, organized bullet points, definitions, and high-yield highlights using:
  <mark style="background-color: #e0e7ff; color: #111827; padding: 2px 6px; border-radius: 6px; font-weight: 800; margin: 0 2px;">key term</mark>
- For short clinical pearls or diagnostic notes, use:
  <div class="info-note"><strong>NOTE TITLE:</strong> Note content...</div>
`;
      if (customPrompt && customPrompt.trim()) {
        systemInstruction += `USER CUSTOM INSTRUCTIONS & EMPHASES:\n"${customPrompt}"\n\nEnsure you strictly follow the user's focus and instructions.\n`;
        finalPrompt = `Generate a ${isComprehensive ? 'massively detailed, highly comprehensive' : 'detailed, well-structured'} English summary based on the lectures, respecting these user instructions: "${customPrompt}".`;
      } else {
        finalPrompt = isComprehensive
          ? `Please generate a massively detailed, exhaustive, and fully comprehensive English study summary covering every single concept, detail, definition, table, mechanism, and fact from the lecture without cutting or shortening anything.`
          : `Please generate a high-yield, structured, and detailed English study summary for the lecture.`;
      }
    } else if (mode === 'custom' || mode === 'summary_mega' || mode === 'google_form' || mode === 'summary') {
      if (mode === 'google_form') {
        systemInstruction = "You are a Google Apps Script Expert and Quiz Generator.\n\n" +
        "Your task is to take the provided lecture and exam files, follow the user's specific instructional focus, and generate a set of multiple-choice questions.\n" +
        "Then, you MUST output a complete Google Apps Script code snippet that automatically creates a Google Form containing these questions, marking the correct answers (enabling Quiz mode).\n\n" +
        "CRITICAL INSTRUCTIONS:\n" +
        "0. IMAGE-DEPENDENT QUESTIONS RULE: If a question from the past exams CANNOT be solved without an image (e.g., 'Identify the structure in the image below'), and that specific image is NOT clearly visible or present in the file to reference, YOU MUST DISCARD IT IMMEDIATELY. Do not include it because the student cannot solve it without an image.\n" +
        "1. Write the complete, valid Google Apps Script code inside a single markdown ```javascript block.\n" +
        "2. The Script MUST follow this EXACT structure using a Web App (doGet) interface, modifying only the questionsData array and form title:\n\n" +
        "```javascript\n" +
        "function doGet() {\n" +
        "  var html = `\n" +
        "    <h2 style=\"text-align:center; color:#1a73e8;\">إنشاء الاختبار</h2>\n" +
        "    <p style=\"text-align:center;\">اضغط الزر لإنشاء الاختبار</p>\n" +
        "    <div style=\"text-align:center; margin:40px 0;\">\n" +
        "      <button id=\"createBtn\" onclick=\"createQuizNow()\" style=\"padding:16px 32px; font-size:18px; background:#1a73e8; color:white; border:none; border-radius:8px; cursor:pointer;\">إنشاء الاختبار الآن</button>\n" +
        "    </div>\n" +
        "    <div id=\"result\" style=\"text-align:center; margin-top:30px; font-size:17px; line-height:1.6;\"></div>\n" +
        "    <script>\n" +
        "      function createQuizNow() {\n" +
        "        document.getElementById(\"createBtn\").disabled = true;\n" +
        "        document.getElementById(\"createBtn\").textContent = \"جاري الإنشاء...\";\n" +
        "        document.getElementById(\"result\").innerHTML = \"<p>جاري إنشاء Google Form ...</p>\";\n" +
        "        google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onError).createMedicalQuiz();\n" +
        "      }\n" +
        "      function onSuccess(data) {\n" +
        "        document.getElementById(\"result\").innerHTML = \"\";\n" +
        "        \n" +
        "        var p1 = document.createElement(\"p\");\n" +
        "        p1.style.color = \"green\"; p1.style.fontSize = \"18px\";\n" +
        "        p1.textContent = \"✅ تم إنشاء الاختبار بنجاح!\";\n" +
        "        document.getElementById(\"result\").appendChild(p1);\n" +
        "\n" +
        "        var p2 = document.createElement(\"p\");\n" +
        "        p2.innerHTML = \"<strong>رابط تعديل الاختبار (لك):</strong><br><a href='\" + data.editUrl + \"' target='_blank' style='color:#1a73e8; word-break:break-all;'>\" + data.editUrl + \"</a>\";\n" +
        "        document.getElementById(\"result\").appendChild(p2);\n" +
        "\n" +
        "        var p3 = document.createElement(\"p\");\n" +
        "        p3.innerHTML = \"<strong>رابط الاختبار للطلاب (نشر):</strong><br><a href='\" + data.publishedUrl + \"' target='_blank' style='color:#1a73e8; word-break:break-all;'>\" + data.publishedUrl + \"</a>\";\n" +
        "        document.getElementById(\"result\").appendChild(p3);\n" +
        "\n" +
        "        var btn = document.createElement(\"button\");\n" +
        "        btn.textContent = \"فتح الاختبار للطلاب\";\n" +
        "        btn.style.cssText = \"padding:10px 20px; background:#34a853; color:white; border:none; border-radius:6px; cursor:pointer; margin-top:15px;\";\n" +
        "        btn.onclick = function() { window.open(data.publishedUrl, '_blank'); };\n" +
        "        document.getElementById(\"result\").appendChild(btn);\n" +
        "      }\n" +
        "      function onError(error) {\n" +
        "        document.getElementById(\"result\").innerHTML = \"<p style='color:red;'>❌ حدث خطأ: \" + error.message + \"</p>\";\n" +
        "        console.error(error);\n" +
        "      }\n" +
        "    </script>\n" +
        "  `;\n" +
        "  return HtmlService.createHtmlOutput(html).setTitle(\"إنشاء اختبار\").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);\n" +
        "}\n\n" +
        "function createMedicalQuiz() {\n" +
        "  try {\n" +
        "    const form = FormApp.create('Quiz Title Here');\n" +
        "    form.setIsQuiz(true);\n" +
        "    form.setDescription('Quiz Description Here');\n\n";
      } else {
        if (customPrompt && customPrompt.trim() !== '') {
          systemInstruction += `\n\nUSER CUSTOM PROMPT & FOCUS:\n"${customPrompt}"\n\nCRITICAL: Strictly adhere to these customized instructions when generating the summary.`;
          finalPrompt = `Please generate the summary now based on the materials provided, giving special focus to: "${customPrompt}".`;
        }
      }
    }

    if (isDoubleCheckEnabled) {
      systemInstruction += `\n\nCRITICAL "DOUBLE CHECK" INSTRUCTION: The user has requested a "Double Check" (تدقيق ثنائي). You MUST perform a rigorous 4-STEP secondary pass internally prior to generating the output:
Step 1: Re-read every single "Past Exams" file (أسئلة السنين) and map out every question asked.
Step 2: Cross-reference this map with the lecture content.
Step 3: Verify that absolutely NO past exam question or key concept has been forgotten.
Step 4: Do a final scan to guarantee maximum completeness and high fidelity to the source documents. Ensure you do not miss any "سؤال سنين" (Past Exam question) that is relevant.
IMPORTANT EXCEPTION: "Double Check" ONLY applies to verifying exam questions against lectures. DO NOT delete, alter, or drop ANY word from "Additional Notes" (ملاحظات إضافية); Additional Notes must remain 100% complete and verbatim without dropping a single millimeter of text!\n\n`;
    }

    const response = await ai.models.generateContent({
      model,
      contents: { 
        parts: [
          ...lectureParts, 
          { text: (mode === 'template2_smart' && closeExamGaps) ? "--- CRITICAL EXAM BLUEPRINT & QUESTIONS FOR GAP-CLOSER SYNTHESIS (مرجع إلزامي لسد الفجوات وتسمية الأدوية والسميات) ---" : "--- SECONDARY CONTEXT: PREVIOUS EXAMS ---" }, 
          ...(examFiles && examFiles.length > 0 ? examParts : [{ text: 'No past exams provided.' }]), 
          ...(doctorNotesFiles && doctorNotesFiles.length > 0 && mode !== 'google_form' && mode !== 'template2_smart' ? [{ text: "--- DOCTOR'S NOTES & WARNINGS ---" }, ...doctorNotesParts] : []),
          ...(additionalDoctorNotesFiles && additionalDoctorNotesFiles.length > 0 && mode !== 'google_form' && mode !== 'template2_smart' ? [{ text: "--- ADDITIONAL NOTES ---" }, ...additionalDoctorNotesParts] : []),
          { text: finalPrompt }
        ] 
      },
      config: { systemInstruction, temperature: 0.2 }
    });
    return response.text || "فشلت عملية التحليل.";
  }

  const systemInstruction = mode === 'extraction' ? EXTRACTION_SYSTEM_INSTRUCTION : GENERATION_SYSTEM_INSTRUCTION;
  
  const contentParts: any[] = [];
  
  if (lectureParts.length > 0) {
      contentParts.push({ text: "CORE SCOPE (LECTURE) - ONLY EXTRACT QUESTIONS RELEVANT TO THIS CONTENT:" });
      contentParts.push(...lectureParts);
  } else {
      contentParts.push({ text: "NO LECTURE MATERIALS PROVIDED. EXTRACT ALL QUESTIONS FROM SOURCES BELOW." });
  }

  contentParts.push({ text: "SOURCE MATERIAL (PAST EXAMS) - SCAN THESE FOR RELEVANT QUESTIONS:" });
  contentParts.push(...examParts);

  if (doctorNotesFiles && doctorNotesFiles.length > 0) {
      contentParts.push({ text: "--- DOCTOR'S NOTES & WARNINGS (USE THESE HINTS TO CREATE/EXTRACT IMPORTANT EXAM QUESTIONS) ---" });
      contentParts.push(...doctorNotesParts);
  }
  
  if (additionalDoctorNotesFiles && additionalDoctorNotesFiles.length > 0) {
      contentParts.push({ text: "--- ADDITIONAL NOTES (EXTRACT EVERYTHING AND ORGANIZE IT) ---" });
      contentParts.push(...additionalDoctorNotesParts);
  }
  
  if (mode === 'generation') {
      contentParts.push({ text: `TASK: Generate exactly ${questionCount} unique practice questions.` });
      if (customPrompt && customPrompt.trim() !== '') {
          contentParts.push({ text: `USER CUSTOM INSTRUCTIONS FOR GENERATION:\n"${customPrompt}"\n\nCRITICAL: Strictly adhere to these customized instructions when generating the questions (e.g., what to exclude, question distribution, specific topics, etc.).` });
      }
  } else {
      contentParts.push({ text: "Perform the extraction according to the strict filtering rules." });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { 
      parts: contentParts
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ["question", "options", "correctAnswer", "reason"],
        },
      },
    },
  });

  try {
    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    throw new Error("حدث خطأ أثناء معالجة البيانات من الذكاء الاصطناعي. يرجى محاولة تقليل عدد الملفات.");
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
  const ai = getGenAI();
  const model = getModel();

  let sanitizedText = text
    .replace(/#{1,6}\s*(?:\d+[\.\)]\s*)?Master Exam Review(?::\s*Verified Examination Questions)?[\s\S]*?(?=(?:#{1,6}\s+[^\n]+|\Z))/gi, '')
    .replace(/#{1,6}\s*(?:\d+[\.\)]\s*)?Verified Examination Questions[\s\S]*?(?=(?:#{1,6}\s+[^\n]+|\Z))/gi, '')
    .replace(/(?:^|\n)(?:\+?\s*\d*[\.\)]\s*)?Master Exam Review: Verified Examination Questions[\s\S]*?(?=(?:#{1,6}\s+[^\n]+|\Z))/gi, '');

  let prompt = `You are an elite academic designer, UI/UX document architect, and medical/scientific formatter.
Your task is to take the provided text (a study summary) and convert it into a complete, beautifully styled, prestigious, and print-ready HTML document using TEMPLATE 2 (Doctor Note & Elite Academic Architecture).
You MUST output a valid, complete HTML structure including \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, and \`<body>\` tags, and ensure they are all properly closed.
CRITICAL: You MUST include \`<meta name="viewport" content="width=device-width, initial-scale=1.0" />\` inside the \`<head>\` tag so it renders correctly on mobile devices.

🛑 ABSOLUTE BAN & PURGE OF "MASTER EXAM REVIEW" (حذف قسم مراجعة الامتحان من نص الملخص):
Under NO circumstances should you output or include any section titled "Master Exam Review", "Verified Examination Questions", "7. Master Exam Review: Verified Examination Questions", or ANY list of past exam questions inside this HTML output. If any such section or mention exists in the source text, DELETE and OMIT it completely! Past exams are rendered separately at the end.

${enableMathSuperCheck ? `
   - **CRITICAL AI MATH & EQUATION CORRECTION MANDATE (فحص وتصحيح المعادلات الرياضية)**:
     The user has explicitly activated the AI Math & Equation Correction option. You MUST inspect and correct ALL mathematical expressions, chemical equations, clinical formulas (e.g. clearance, dosage, fractions, roots, subscripts/superscripts), and scientific notation across the entire document.
     Fix any malformed symbols or broken delimiters (such as accidental '$$', '%%', broken escapes, unclosed brackets, or unformatted fractions).
     Ensure all formulas and equations are rendered cleanly and beautifully using proper LaTeX ($...$ or $$...$$) or clear HTML styling (with <sup>, <sub>, and Unicode math symbols like ±, ×, ÷, ≈, ≠, ≤, ≥, α, β, γ, Δ, Ω, μ, →, ⇌, etc.) so they appear mathematically flawless and easy to study.
` : ''}

${separateLectures 
  ? `**CRITICAL MODE: SEPARATE SUMMARY PER LECTURE**
The user has requested to create a completely separate English summary section for EACH of the included lectures.
I have attached the original 'Core Lecture Files'.
Instead of just formatting the provided text, you MUST READ these attached lecture files and generate a MASSIVELY DETAILED, highly comprehensive English summary from scratch for EACH lecture marked as "include: true" in the following JSON config:
${JSON.stringify(lectureConfigs, null, 2)}
For EACH included lecture:
1. Create a massive top banner using its \`customName\` from the JSON above.
2. Provide an exhaustive English summary covering everything in that lecture. DO NOT SKIP DETAILS. Do not combine them.
3. Your summarization method should cover all key concepts in high detail.` : ""}

   - **TEMPLATE 2 ARCHITECTURE & LAYOUT (THE DOCTOR NOTE & ELITE ACADEMIC DESIGN)**:
     You MUST use this EXACT structural skeleton and styling.
     In the \`<head>\`, you MUST link the signature fonts:
     \`<link rel="preconnect" href="https://fonts.googleapis.com">\`
     \`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\`
     \`<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&family=Comic+Neue:ital,wght@0,400;0,700;1,700&family=Kalam:wght@400;700&family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&display=swap" rel="stylesheet">\`

     The document MUST have a main container:
     \`<div class="template2-document">\`
     
     At the top of \`<div class="template2-document">\`, you MUST render the prestigious Document Header:
     \`<div class="doc-header">
       <p class="doc-meta">Comprehensive Academic Lecture & High-Yield Clinical Summary</p>
       <h1 class="doc-title">[Main Lecture Topic / Title]</h1>
       <p class="doc-subtitle">[Concise subtitle outlining key themes and clinical applications]</p>
       <hr class="doc-divider" />
     </div>\`

     You MUST include this COMPLETE, UNCOMPROMISED stylesheet in your \`<style>\` block:
     \`
     body {
       font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
       background-color: #f8fafc;
       margin: 0;
       padding: 36px 16px;
       text-align: left;
       direction: ltr;
       box-sizing: border-box;
       color: #1e293b;
       -webkit-font-smoothing: antialiased;
     }

     .template2-document {
       max-width: 1020px;
       margin: 0 auto;
       background: #ffffff;
       padding: 52px 64px;
       border-radius: 16px;
       box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
       box-sizing: border-box;
       min-height: 1000px;
     }

     @media (max-width: 768px) {
       body { padding: 12px 6px; }
       .template2-document { padding: 24px 18px; border-radius: 10px; }
     }

     /* Document Header */
     .doc-header { text-align: center; margin-bottom: 44px; }
     .doc-meta { text-transform: uppercase; letter-spacing: 0.22em; font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 14px; }
     .doc-title { font-family: 'Playfair Display', Georgia, serif; font-size: 42px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em; margin: 0 0 14px 0; line-height: 1.25; }
     .doc-subtitle { font-size: 20px; color: #475569; font-weight: 300; margin: 0 0 20px 0; }
     .doc-divider { border: none; border-top: 1.5px solid #e2e8f0; width: 100%; margin: 28px 0 0 0; }

     /* Section Headings */
     h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 800; color: #0f172a; margin: 44px 0 20px 0; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; display: flex; align-items: center; gap: 10px; }
     h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #1e293b; margin: 32px 0 14px 0; }
     p { font-size: 16px; line-height: 1.75; color: #334155; margin-bottom: 16px; }

     /* Tables */
     table { table-layout: auto !important; width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin: 28px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(79, 60, 53, 0.08); border: 1px solid #D7CCC8; }
     th, td { border: 1px solid #D7CCC8; padding: 14px 18px; text-align: left; line-height: 1.65; vertical-align: top; word-break: normal !important; overflow-wrap: normal !important; hyphens: none !important; white-space: normal; }
     th { background-color: #4F3C35; color: #FFFFFF; font-weight: 900; font-size: 16px; letter-spacing: 0.5px; }
     td { font-size: 15.5px; color: #1e293b; }
     td:first-child { background-color: #E3D8D5; font-weight: 700; color: #3E2723; min-width: 140px; }
     th:first-child { min-width: 140px; }
     tbody tr:first-child td { background-color: #FFFFFF; }
     tbody tr:first-child td:first-child { background-color: #E3D8D5; }
     tbody tr:hover { background-color: #FDFBF7; }

     /* 4-Variant Gradient Custom Ordered List */
     .custom-ordered-list { counter-reset: card-counter; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; margin: 24px 0; }
     .custom-ordered-list > li { counter-increment: card-counter; display: flex !important; background: #ffffff !important; border-radius: 12px !important; box-shadow: 0 3px 12px rgba(0,0,0,0.03) !important; overflow: hidden !important; border: 1px solid #edeae5 !important; padding: 0 !important; margin: 0 !important; page-break-inside: avoid !important; break-inside: avoid !important; }
     .custom-ordered-list > li::before { content: "" !important; width: 6px !important; flex-shrink: 0 !important; display: block !important; }
     .custom-ordered-list > li > *:first-child { padding: 14px 18px; flex: 1; margin: 0; font-size: 15.5px; color: #334155; line-height: 1.65; display: block; }
     .custom-ordered-list > li > *:first-child::before { content: counter(card-counter) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 34px !important; height: 34px !important; color: white !important; font-weight: 900 !important; font-size: 14px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important; margin-right: 14px !important; margin-left: 6px !important; vertical-align: middle !important; }
     .custom-ordered-list > li:nth-child(4n+1)::before { background: linear-gradient(180deg, #4f46e5, #3730a3) !important; }
     .custom-ordered-list > li:nth-child(4n+1) > *:first-child::before { background: linear-gradient(135deg, #4f46e5, #3730a3) !important; border-radius: 8px !important; }
     .custom-ordered-list > li:nth-child(4n+2)::before { background: linear-gradient(180deg, #059669, #047857) !important; }
     .custom-ordered-list > li:nth-child(4n+2) > *:first-child::before { background: linear-gradient(135deg, #059669, #047857) !important; border-radius: 50% !important; }
     .custom-ordered-list > li:nth-child(4n+3)::before { background: linear-gradient(180deg, #ea580c, #c2410c) !important; }
     .custom-ordered-list > li:nth-child(4n+3) > *:first-child::before { background: linear-gradient(135deg, #ea580c, #c2410c) !important; border-radius: 12px 4px 12px 4px !important; }
     .custom-ordered-list > li:nth-child(4n+4)::before { background: linear-gradient(180deg, #e11d48, #be123c) !important; }
     .custom-ordered-list > li:nth-child(4n+4) > *:first-child::before { background: linear-gradient(135deg, #e11d48, #be123c) !important; border-radius: 4px 12px 4px 12px !important; }

     /* Definitions & Term Grids */
     .definition-grid { display: flex !important; flex-direction: row !important; align-items: stretch !important; gap: 16px !important; margin: 24px 0 !important; width: 100% !important; overflow-x: auto !important; padding-bottom: 4px !important; }
     .definition-card { flex: 1 1 0% !important; min-width: 190px !important; background: #ffffff !important; border: 1px solid #edeae5 !important; border-radius: 12px !important; padding: 18px 20px !important; box-shadow: 0 4px 12px rgba(79, 60, 53, 0.04) !important; display: flex !important; flex-direction: column !important; gap: 8px !important; page-break-inside: avoid !important; break-inside: avoid !important; border-top: 4px solid #3E2723 !important; }
     .definition-card .def-term { font-size: 16px !important; font-weight: 800 !important; color: #3E2723 !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; }
     .definition-card .def-term::before { content: "🏷️" !important; font-size: 14px !important; }
     .definition-card .def-body { font-size: 14.5px !important; line-height: 1.65 !important; color: #4b5563 !important; }

     /* Term Items */
     .term-item { background: #ffffff; border: 1px solid #edeae5; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(79,60,53,0.03); display: flex; align-items: baseline; gap: 12px; page-break-inside: avoid; break-inside: avoid; }
     .term-badge { background: #f5efe6; color: #3E2723; font-weight: 800; padding: 3px 10px; border-radius: 6px; font-size: 14px; border: 1px solid #dfd5ca; white-space: nowrap; flex-shrink: 0; }
     .term-desc { font-size: 14.5px; line-height: 1.65; color: #374151; }

     /* Definition Spotlight */
     .definition-spotlight { background: #fdfbf7; border: 1.5px solid #dfd5ca; border-left: 6px solid #3E2723; border-radius: 12px; padding: 20px 24px; margin: 24px 0; box-shadow: 0 4px 14px rgba(62,39,35,0.05); page-break-inside: avoid; break-inside: avoid; }
     .spotlight-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
     .spotlight-icon { font-size: 20px; }
     .spotlight-title { font-size: 18px; font-weight: 900; color: #3E2723; letter-spacing: -0.2px; }
     .spotlight-body { font-size: 15.5px; line-height: 1.75; color: #374151; }

     /* Distinction VS Grid */
     .term-distinction-grid { display: flex; align-items: stretch; gap: 14px; margin: 24px 0; }
     .dist-col { flex: 1; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 3px 10px rgba(0,0,0,0.03); page-break-inside: avoid; break-inside: avoid; }
     .dist-tag { display: inline-block; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-weight: 800; font-size: 13px; padding: 3px 10px; border-radius: 6px; margin-bottom: 10px; }
     .dist-col:last-child .dist-tag { background: #fdf2f8; color: #9d174d; border-color: #fbcfe8; }
     .dist-vs { display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #64748b; background: #f1f5f9; border-radius: 50%; width: 36px; height: 36px; flex-shrink: 0; align-self: center; }

     /* Checklists */
     .checklist-box { display: flex; flex-direction: column; gap: 10px; margin: 22px 0; }
     .checklist-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; font-size: 15px; line-height: 1.65; color: #166534; page-break-inside: avoid; break-inside: avoid; }
     .check-icon { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #16a34a; color: white; border-radius: 50%; font-weight: 900; font-size: 14px; margin-top: 2px; }
     .check-text { flex: 1; color: #14532d; }
     .check-text strong { color: #052e16; font-weight: 800; }

     /* Numbered Badges */
     .numbered-badge-row { display: flex; align-items: flex-start; gap: 14px; padding: 14px 18px; margin: 12px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; page-break-inside: avoid; break-inside: avoid; }
     .badge-num { flex-shrink: 0; padding: 4px 12px; background: #0284c7; color: white; border-radius: 20px; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; }
     .badge-content { flex: 1; font-size: 15px; line-height: 1.7; color: #1e293b; }

     /* Colorful Notes Grid */
     .colorful-notes-grid { display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0; justify-content: flex-start; }
     .colorful-notes-grid .note-card { padding: 18px 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); flex: 1 1 calc(33.333% - 16px); min-width: 240px; font-size: 15px; line-height: 1.7; color: #1f2937; border: 1px solid rgba(0,0,0,0.06); box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; }
     .colorful-notes-grid .note-card:nth-child(5n+1) { background-color: #fefce8; border-color: #fef08a; }
     .colorful-notes-grid .note-card:nth-child(5n+2) { background-color: #f0fdf4; border-color: #bbf7d0; }
     .colorful-notes-grid .note-card:nth-child(5n+3) { background-color: #eff6ff; border-color: #bfdbfe; }
     .colorful-notes-grid .note-card:nth-child(5n+4) { background-color: #fdf2f8; border-color: #fbcfe8; }
     .colorful-notes-grid .note-card:nth-child(5n+5) { background-color: #fff7ed; border-color: #fed7aa; }

     /* Styled Bullet Lists */
     .styled-bullet-list { list-style: none; padding: 0; margin: 20px 0; display: flex; flex-direction: column; gap: 12px; }
     .styled-bullet-item { position: relative; padding: 14px 18px 14px 22px; background: #ffffff; border: 1px solid #edeae5; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); font-size: 15px; line-height: 1.7; color: #334155; page-break-inside: avoid; break-inside: avoid; }
     .styled-bullet-item::before { content: ""; position: absolute; top: 14px; left: 0; width: 5px; height: calc(100% - 28px); min-height: 18px; background: #3E2723; border-radius: 0 4px 4px 0; }
     .styled-bullet-item > strong:first-child { display: inline-block; background: #f5efe6; color: #3E2723; padding: 2px 10px; border-radius: 6px; font-weight: 800; font-size: 0.95em; margin-right: 8px; border: 1px solid #dfd5ca; }

     /* Developmental Assessment Cards */
     .dev-assessment-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin: 28px 0; }
     .dev-assessment-cards .card { background: white; border-radius: 12px; padding: 22px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid #6b7280; display: flex; flex-direction: column; page-break-inside: avoid; break-inside: avoid; border: 1px solid #edeae5; border-top-width: 4px; }
     .dev-assessment-cards .card-red { border-top-color: #ef4444; }
     .dev-assessment-cards .card-red .card-tag { background: #fee2e2; color: #991b1b; }
     .dev-assessment-cards .card-red .card-action { background: #ef4444; color: white; }
     .dev-assessment-cards .card-orange { border-top-color: #f59e0b; }
     .dev-assessment-cards .card-orange .card-tag { background: #fef3c7; color: #b45309; }
     .dev-assessment-cards .card-orange .card-action { background: #f59e0b; color: white; }
     .dev-assessment-cards .card-green { border-top-color: #10b981; }
     .dev-assessment-cards .card-green .card-tag { background: #d1fae5; color: #065f46; }
     .dev-assessment-cards .card-green .card-action { background: #10b981; color: white; }
     .dev-assessment-cards .card-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 8px; border-radius: 4px; display: inline-block; width: max-content; margin-bottom: 14px; }
     .dev-assessment-cards .card-title { font-weight: 800; font-size: 18px; color: #111827; margin-bottom: 12px; text-align: center; }
     .dev-assessment-cards .card-content { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 20px; flex-grow: 1; border-bottom: 1px dashed #e5e7eb; padding-bottom: 14px; }
     .dev-assessment-cards .card-action { font-weight: 700; font-size: 13.5px; text-align: center; padding: 10px; border-radius: 6px; }

     /* Wellbeing Timeline */
     .wellbeing-timeline { margin: 32px 0; padding: 26px; background: #fdfbf7; border-radius: 16px; border: 1px solid #edeae5; overflow-x: auto; }
     .wellbeing-timeline .timeline-nodes { display: flex; align-items: flex-start; min-width: max-content; gap: 15px; }
     .wellbeing-timeline .node { display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 80px; }
     .wellbeing-timeline .circle { width: 50px; height: 50px; border-radius: 50%; background: #3e2723; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; }
     .wellbeing-timeline .circle.border { background: white; color: #3e2723; border: 3px solid #3e2723; }
     .wellbeing-timeline span { font-size: 13px; font-weight: 600; color: #4b5563; text-align: center; }
     .wellbeing-timeline .line { flex-grow: 1; min-width: 40px; height: 2px; background: #d1d5db; margin-top: 25px; }

     /* Nurturing Care Grid */
     .nurturing-care-grid { display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 12px; margin: 28px 0; padding-bottom: 8px; }
     .nurturing-care-grid .grid-item { flex: 1; min-width: 95px; background: #fffdf7; border: 1px solid #edeae5; border-radius: 12px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
     .nurturing-care-grid .icon { font-size: 26px; }
     .nurturing-care-grid .title { font-weight: 800; font-size: 13px; color: #3e2723; text-align: center; }

     /* Info Note (Purple Block) */
     .info-note { background-color: #EBEBFF; border-left: 5px solid #5C4CD7; border-radius: 8px; padding: 16px 20px; margin: 22px 0; color: #33334d; font-size: 15px; line-height: 1.6; }
     .info-note strong { color: #352A85; font-weight: 800; margin-right: 6px; }

     /* Handwritten Notebook Note */
     .handwritten-notebook-note {
       background: #ffffff !important;
       background-image: linear-gradient(90deg, rgba(239, 68, 68, 0.45) 1.5px, transparent 1.5px), repeating-linear-gradient(transparent, transparent 31px, #e2e8f0 31px, #e2e8f0 32px) !important;
       background-size: 100% 100%, 100% 32px !important;
       background-position: 48px 0, 0 0 !important;
       padding: 24px 30px 30px 60px !important;
       border: 1.5px solid #cbd5e1 !important;
       border-radius: 12px !important;
       box-shadow: 0 6px 18px rgba(0,0,0,0.06) !important;
       margin: 28px 0 !important;
       font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important;
       font-size: 19px !important;
       line-height: 1.8 !important;
       color: #0f172a !important;
       direction: ltr !important;
       position: relative !important;
       page-break-inside: avoid !important;
       break-inside: avoid !important;
     }
     .handwritten-notebook-note h2, .handwritten-notebook-note .note-title { font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important; font-size: 24px !important; font-weight: 900 !important; color: #1e40af !important; text-transform: uppercase !important; letter-spacing: 1px !important; display: inline-block !important; border-bottom: 3px double #1e40af !important; padding-bottom: 4px !important; margin: 0 0 16px 0 !important; }
     .handwritten-notebook-note .pill, .handwritten-notebook-note .pill-header { font-family: 'Comic Neue', 'Kalam', cursive, sans-serif !important; font-size: 18px !important; font-weight: 900 !important; color: #0f172a !important; padding: 4px 16px !important; border-radius: 6px !important; display: inline-block !important; letter-spacing: 0.5px !important; margin: 8px 0 6px 0 !important; background-color: #bbf7d0 !important; color: #166534 !important; border: 1.5px solid #86efac !important; }

     /* Clinical Pearls Box */
     .clinical-pearls-box { background-color: #f0fdf4 !important; border: 1.5px solid #a7f3d0 !important; border-radius: 16px !important; padding: 22px 24px !important; margin: 24px 0 !important; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.05) !important; text-align: left !important; direction: ltr !important; page-break-inside: avoid !important; break-inside: avoid !important; }
     .clinical-pearls-box h3 { color: #065f46 !important; font-size: 20px !important; font-weight: 900 !important; margin: 0 0 14px 0 !important; display: flex !important; align-items: center !important; gap: 8px !important; }

     /* Reaction Pathway & Mechanism Diagram */
     .reaction-pathway-diagram, .enzymatic-mechanism-diagram { background: #ffffff !important; border: 1.5px solid #edeae5 !important; border-radius: 20px !important; padding: 28px 24px !important; margin: 30px 0 !important; box-shadow: 0 6px 20px rgba(0,0,0,0.03) !important; page-break-inside: avoid !important; break-inside: avoid !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; direction: ltr !important; text-align: left !important; }

     /* Mindmap Tree */
     .mindmap-tree { display: flex; justify-content: center; align-items: flex-start; overflow-x: auto; page-break-inside: avoid; margin: 36px 0; font-family: 'Inter', 'Cairo', sans-serif; direction: ltr; background: #fffcf8; border: 2px dashed #e6dfd8; padding: 36px 20px; border-radius: 16px; }
     .mindmap-tree ul { padding-top: 20px; position: relative; display: flex; padding-left: 0; margin: 0; }
     .mindmap-tree li { list-style-type: none; position: relative; padding: 20px 10px 0 10px; text-align: center; }
     .mindmap-tree li::before, .mindmap-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 3px solid #c2b5b0; width: 50%; height: 20px; }
     .mindmap-tree li::after { right: auto; left: 50%; border-left: 3px solid #c2b5b0; }
     .mindmap-tree li:only-child::after, .mindmap-tree li:only-child::before { display: none; }
     .mindmap-tree li:only-child { padding-top: 0; }
     .mindmap-tree li:first-child::before, .mindmap-tree li:last-child::after { border: 0 none; }
     .mindmap-tree li:last-child::before { border-right: 3px solid #c2b5b0; border-radius: 0 4px 0 0; }
     .mindmap-tree li:first-child::after { border-radius: 4px 0 0 0; }
     .mindmap-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 3px solid #c2b5b0; width: 0; height: 20px; transform: translateX(-50%); }

     .mindmap-node-root { display: inline-block; background: #3e2723; color: white; padding: 14px 28px; border-radius: 8px; font-weight: 900; text-align: center; font-size: 1.15em; border: 2px solid #6d4c38; box-shadow: 0 4px 10px rgba(0,0,0,0.15); position: relative; z-index: 10; max-width: 300px; }
     .mindmap-node-branch { display: inline-block; background: white; border: 1px solid #d7ccc8; border-top: 5px solid #f97316; padding: 16px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; width: 100%; min-width: 140px; max-width: 250px; position: relative; z-index: 10; }
     .mindmap-branch-title { font-weight: 900; color: #422006; margin-bottom: 8px; font-size: 1.05em; }
     .mindmap-branch-desc { color: #57534e; font-size: 0.9em; line-height: 1.5; }

     @media print {
       body { background: white !important; padding: 0 !important; }
       .template2-document { box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
       .tab-content { display: block !important; }
       * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
     }
     \`

   - **Diverse Component Directive (MANDATORY)**:
     Use the signature components whenever suitable in your summary:
     1. Numbered sequences / criteria: USE \`<ol class="custom-ordered-list"><li><p><strong>Step/Rule Title:</strong> Detailed explanation...</p></li></ol>\`.
     2. Definitions / Classifications: USE \`<div class="definition-grid"><div class="definition-card"><span class="def-term">Term Name</span><span class="def-body">Explanation...</span></div></div>\`.
     3. Key terms / Badges: USE \`<div class="term-item"><span class="term-badge">Badge</span><span class="term-desc">Description...</span></div>\`.
     4. Distinct comparison: USE \`<div class="term-distinction-grid"><div class="dist-col"><span class="dist-tag">Condition A</span><p>Details...</p></div><div class="dist-vs">VS</div><div class="dist-col"><span class="dist-tag">Condition B</span><p>Details...</p></div></div>\`.
     5. Checklists: USE \`<div class="checklist-box"><div class="checklist-item"><div class="check-icon">✓</div><div class="check-text"><strong>Criteria:</strong> Details...</div></div></div>\`.
     6. Notes / Alerts: USE \`<div class="colorful-notes-grid"><div class="note-card"><strong>High-Yield Fact:</strong> Insight...</div></div>\` or \`<div class="info-note"><strong>Clinical Warning:</strong> Alert text...</div>\`.
     7. Handwritten Notebook Note: For doctor pearls, memorization mnemonics, or crucial lecture warnings, USE \`<div class="handwritten-notebook-note"><div class="note-title">Doctor's Clinical Insight</div><span class="pill">High Yield</span><p>Insight text here...</p></div>\`.
     8. Clinical Pearls: USE \`<div class="clinical-pearls-box"><h3>💎 Clinical Pearls</h3><p>Insight text...</p></div>\`.
     9. Mindmaps / Pathways: When visualizing relationships or multi-tier metabolic/signaling pathways, USE \`<div class="mindmap-tree">\` or \`<div class="reaction-pathway-diagram">\`.

${removeFakeInfoConfirm ? `   - **STRICT ANTI-HALLUCINATION & ANTI-INTRUDER MANDATE (حذف الدخيل - إزالة أي معلومات من محاضرات ثانية - CRITICAL)**: The user requested to thoroughly DELETE any information that does not belong to this core lecture (i.e., information or questions erroneously brought from other lectures or past years' questions). If there is ANY information, paragraph, drug, or fact in the summary that does NOT belong to this lecture, you MUST DELETE IT completely from your HTML output. ONLY keep information that actually belongs to this lecture. **EXCEPTION**: The "Doctor's Notes" and "Additional Notes" sections are EXEMPT from this rule; you MUST KEEP their contents completely intact regardless of whether they appear in the core lecture.` : ''}
`;

  if (includeGuide) {
    prompt += `
   - **Guide's Advice (شرح المرشد)**: Add a dedicated section with the ENGLISH title "💡 Arabic Guide" (or "💡 شرح المرشد (تفصيلي)" in Arabic).
     **CRITICAL LENGTH & DETAIL RULE**: This section MUST be extremely long and detailed, acting as a massive 1-to-1 mirror of the English summary. THERE IS ABSOLUTELY NO WORD LIMIT. Write as much as needed to deeply cover everything. DO NOT SUMMARIZE. DO NOT CUT IT SHORT.
     **ARABIC GUIDE DESIGN INSTRUCTIONS (CRITICAL)**:
     You MUST format the Arabic Guide section to perfectly match the provided "STUDY SUMMARY" design.
     1. **Header for the Guide**: Start the Arabic Guide with this EXACT HTML structure:
        \`<div style="display: flex; justify-content: space-between; align-items: center; background-color: #F6F5F2; padding: 16px 24px; border-bottom: 1px solid #e5e5e5; margin-bottom: 30px; border-radius: 8px;">
           <div style="display: flex; align-items: center; gap: 12px; direction: rtl;">
              <div style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #3E2723; display: flex; justify-content: center; align-items: center; background: white;"><span style="font-size: 20px;">🦠</span></div>
              <div style="width: 2px; height: 30px; background-color: #3E2723;"></div>
              <span style="font-size: 22px; font-weight: 900; color: #3E2723; font-family: 'Cairo', sans-serif;">الدليل الشامل</span>
              <span style="font-size: 18px; color: #5c443b; font-style: italic; font-family: 'Cairo', sans-serif;">شرح المحاضرة</span>
           </div>
           <div style="background-color: #E6DDD4; border: 1px solid #3E2723; padding: 6px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 900; font-size: 12px; color: #3E2723; letter-spacing: 1px;">STUDY SUMMARY</span>
              <span style="font-size: 14px;">📋</span>
           </div>
        </div>\`
     2. **Main Title**: Directly below that header, use this exact title: \`<h1 style="text-align: center; color: #3E2723; font-weight: 900; font-size: 32px; font-family: 'Cairo', sans-serif; margin-bottom: 24px;">💡 شرح المرشد (تفصيلي)</h1>\`
     3. **Basic Text Style**: All paragraph text should be right-aligned (\`dir="rtl"\`), font-family 'Cairo', sans-serif, size 18px, line-height 2.0, color #1c1917. Important words MUST be bolded (\`font-weight: 900\`).
     4. **Major Section Banners**: Whenever a new major category is discussed, wrap the title in this EXACT HTML: \`<div style="background-color: #3E2723; color: white; border-radius: 8px; padding: 16px 20px; font-weight: 900; font-size: 20px; font-family: 'Cairo', sans-serif; text-align: right; margin: 32px 0 16px 0;">[Section Name Here]</div>\`
     5. **Subheadings**: Format with a thick right side border: \`<h3 style="border-right: 5px solid #D7CCC8; padding-right: 12px; font-size: 22px; font-weight: 900; color: #3E2723; font-family: 'Cairo', sans-serif; margin: 24px 0 12px 0;">[Subheading Name Here]</h3>\`
     6. **"⚠️ Exam Traps (فخاخ امتحانية)"**:
        \`<div style="background-color: #fef2f2; border-radius: 8px; padding: 24px; margin: 32px 0;"><h4 style="color: #b91c1c; border-right: 4px solid #ef4444; padding-right: 12px; margin-top: 0; margin-bottom: 16px; font-weight: 900; font-size: 20px; font-family: 'Cairo', sans-serif;">⚠️ فخاخ امتحانية يجب الحذر منها</h4><ul style="margin: 0; padding-right: 20px; color: #7f1d1d; direction: rtl; font-size: 18px; line-height: 2.0; font-family: 'Cairo', sans-serif;"><li><strong style="font-weight: 900;">[Point Title]:</strong> [Detailed Explanation]</li></ul></div>\`
     7. **"🔍 Fine Details (أمور دقيقة)"**:
        \`<div style="background-color: #f0fdf4; border-radius: 8px; padding: 24px; margin: 32px 0;"><h4 style="color: #15803d; border-right: 4px solid #22c55e; padding-right: 12px; margin-top: 0; margin-bottom: 16px; font-weight: 900; font-size: 20px; font-family: 'Cairo', sans-serif;">🔍 أمور دقيقة يجب الانتباه لها</h4><ul style="margin: 0; padding-right: 20px; color: #166534; direction: rtl; font-size: 18px; line-height: 2.0; font-family: 'Cairo', sans-serif;"><li><strong style="font-weight: 900;">[Point Title]:</strong> [Detailed Explanation]</li></ul></div>\`
     Provide an ENORMOUS, VERY DETAILED, comprehensive explanation of the entire lecture in Arabic using these specific styling rules.
    `;
  }

  prompt += `
   - **No Conclusion/Sign-off**: DO NOT include a "Summary & Sign-off" or "Conclusion" section at the end. DO NOT include "Prepared by" tables. End the document cleanly when the summary content is finished.

3. **Content Cleanup & Text Direction (CRITICAL)**: 
   - Organize the provided text into this structure logically.
   - **CRITICAL**: The main summary content (everything EXCEPT the Doctor's Notes and the Guide's Advice), including the "Page 1 Header", MUST be completely wrapped in a \`<div id="core-summary-section" class="tab-content">\` container.
   - **CRITICAL**: If the text contains Doctor's Notes, wrap its ENTIRE content inside a \`<div id="doctor-notes-section" class="tab-content">\` container.
   - **CRITICAL**: The ENTIRE Guide's Advice section (شرح المرشد) MUST be completely wrapped in a \`<div id="arabic-guide-section" class="tab-content">\` container.
${skipMainText ? `   - **CRITICAL TEXT DIRECTION**: Because you are ONLY generating the Arabic Guide, the \`<body>\` MUST be \`dir="rtl"\` and \`text-align: right\`.` : `   - **CRITICAL TEXT DIRECTION**: The main summary text is primarily in English, so the \`<body>\` MUST be \`dir="ltr"\` and \`text-align: left\`.`}
`;

  if (includeGuide && !skipMainText) {
    prompt += `\n   - **HOWEVER**, the "Guide's Advice" (شرح المرشد) section is in Arabic, so that specific \`<div>\` MUST have \`dir="rtl"\` and \`text-align: right\`.`;
  }

  prompt += `
Here is the text to format:
${sanitizedText}`;

  const contentParts: any[] = [{ text: prompt }];

  if (doctorNotesFiles && doctorNotesFiles.length > 0) {
    doctorNotesFiles.forEach((f: any) => {
      if (f.text) { contentParts.push({ text: f.text }); }
      if (f.images && f.images.length > 0) {
        f.images.forEach((imgBase64: string) => {
          contentParts.push({ inlineData: { mimeType: "image/jpeg", data: imgBase64 } });
        });
      }
    });
  }

  if (additionalDoctorNotesFiles && additionalDoctorNotesFiles.length > 0) {
    additionalDoctorNotesFiles.forEach((f: any) => {
      if (f.text) { contentParts.push({ text: f.text }); }
      if (f.images && f.images.length > 0) {
        f.images.forEach((imgBase64: string) => {
          contentParts.push({ inlineData: { mimeType: "image/jpeg", data: imgBase64 } });
        });
      }
    });
  }

  if (removeFakeInfoConfirm && lectureFiles && lectureFiles.length > 0) {
    lectureFiles.forEach(f => {
      if (f.text && f.text.trim()) {
        contentParts.push({ text: `[CORE LECTURE: ${f.name}]\n${f.text}` });
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: contentParts },
      config: {
        temperature: 0.2,
      }
    });

    let html = response.text || "";
    html = html.replace(/```html/ig, '').replace(/```/g, '').trim();
    return html;
  } catch (e) {
    throw e;
  }
};

export const formatSummaryForPDF = async (
  text: string, 
  includeGuide: boolean = true,
  removeFakeInfoConfirm: boolean = false,
  lectureFiles: ParsedFile[] = []
): Promise<string> => {
  const ai = getGenAI();
  const model = getModel();

  const prompt = `You are an expert UI/UX designer and document formatter.
Your task is to take the provided text (a study summary) and convert it into a complete, beautifully styled, and print-ready HTML document.
You MUST output a valid, complete HTML structure including \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, and \`<body>\` tags, and ensure they are all properly closed.
CRITICAL: You MUST include \`<meta name="viewport" content="width=device-width, initial-scale=1.0" />\` inside the \`<head>\` tag so it renders correctly on mobile devices.

Return the ENTIRE, valid HTML code starting with \`<!DOCTYPE html>\` and including \`<html>\`, \`<head>\`, \`<style>\`, and \`<body>\`. Do NOT wrap it in markdown code blocks. Just the raw HTML string.
${removeFakeInfoConfirm ? `
- **STRICT ANTI-HALLUCINATION & ANTI-INTRUDER MANDATE**: The user explicitly requested: THOROUGHLY VERIFY and DELETE any information that does not belong to this lecture. If there is ANY information, paragraph, fact, drug, or detail in the summary that is NOT part of this lecture's core topic, YOU MUST DELETE IT completely from your HTML output.` : ''}

Here is the text to format:
${text}`;

  const contentParts: any[] = [{ text: prompt }];
  if (removeFakeInfoConfirm && lectureFiles && lectureFiles.length > 0) {
    lectureFiles.forEach(f => {
      if (f.text && f.text.trim()) {
        contentParts.push({ text: `[CORE LECTURE: ${f.name}]\n${f.text}` });
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contentParts },
      config: { temperature: 0.2 }
    });
    
    let html = response.text || "";
    html = html.replace(/```html/g, '').replace(/```/g, '').trim();
    return html;
  } catch (e) {
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
  
  const ai = getGenAI();
  const model = getModel();

  let examRequirements = "";
  const filesParts = filesToParts(pastExamFiles);

  if (exportAllPastExamsMode) {
    const customExportPrompt = `أنت أستاذ ومصمم UI/UX خبير. مهمتك هي قراءة الملفات المرفقة واستخراج جميع الأسئلة وتصديرها كملف HTML تفاعلي.
1. **الاستخراج الشامل**: يجب استخراج كل سؤال بغض النظر عن طريقة كتابته أو نوعه. لا تحذف أي سؤال.
2. **الإجابات**: الإجابة توضع أسفل السؤال داخل:
   \`<div class="correct-answer-box" style="display: none; margin-top: 10px; padding: 10px; background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; font-weight: bold; color: #166534;">Answer: هنا الجواب</div>\`
3. **تنسيق الخيارات**: للأسئلة الاختيارية، ضع الخيارات داخل:
   \`<div class="mcq-option" data-correct="true" onclick="checkAnswer(this)">A) الخيار الصحيح</div>\`
4. Return ONLY raw HTML string without markdown wrappers.

الأسماء الأصلية للملفات المرفقة:
${pastExamFiles.map(f => `- ${f.name}`).join('\n')}`;
    
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            ...filesParts,
            { text: customExportPrompt }
          ]
        },
        config: { temperature: 0.3 }
      });
      let html = response.text || "";
      html = html.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '').trim();
      return html;
    } catch (e) {
    throw e;
    }
  }

  if (includePast) {
    examRequirements += (pastExamFiles.length > 0 || questionFilesText.trim() !== "")
      ? `1. **Previous Years Exam (أسئلة سنوات سابقة)**: 
   - CRITICAL: Do NOT add any subtitle or promotional text under the header "Past Exams". Just the generic header "Past Exams" and then the questions.
   - For every question provided in the "Previous Years Questions Files", check if the information required to correctly answer it exists EXPLICITLY within the provided "Study Summary".
   - IF the answer/concept IS in the summary: You MUST include the question in the output.
   - IF the answer IS NOT in the summary: Exclude it completely.${strictPastExtraction ? `\n   - **EXTREME STRICT RULE**: VERIFY and ENSURE that YOU EXTRACTED ALL PAST EXAM QUESTIONS related to this lecture without skipping any.` : ''}\n\n`
      : `1. **Previous Years Exam**: No previous question files were provided. Do not invent, generate, or label any questions as past exams.\n\n`;
  }

  if (includePredictions) {
    examRequirements += `2. **Expected/Candidate Exam (أسئلة مرشحات وتوقعات)**: 
   - Create EXACTLY 25 highly expected multiple-choice questions based strictly on the study summary.
   - CRITICAL RULE: These 25 questions MUST be DIFFICULT CLINICAL CASES requiring deep analysis.
   - STRICT RULE: These questions MUST be 100% NEW and ORIGINAL.
   - STRICT RULE: The answers to these questions MUST exist within the provided "Study Summary".\n\n`;
  }

  if (removeFakeInfoConfirm) {
    examRequirements += `   - **ANTI-HALLUCINATION & ANTI-INTRUDER MANDATE**: DELETE ANY QUESTION that asks about information NOT explicitly found in this lecture's "Study Summary".\n\n`;
  }

  const prompt = `You are an expert professor and UI/UX designer.
Based on the provided study summary (and previous question files provided as attachments or text), generate ${[includePast, includePredictions].filter(Boolean).length === 2 ? 'two exams' : 'an exam'} and format them as a beautiful, print-ready HTML section to be appended to a PDF document.

${cachedPastQuestionsInfo ? `[CRITICAL EXTRACTED PAST QUESTIONS MEMORY]\nThe system has PRE-EXTRACTED the following relevant past exam questions for this lecture. YOU MUST USE THESE EXACT QUESTIONS for the "Past Exams" section:\n${cachedPastQuestionsInfo}\n\n` : ''}
EXAM REQUIREMENTS:
${examRequirements}
   - Wrap interactive questions using \`<div class="mcq-option" data-correct="true" onclick="checkAnswer(this)">...</div>\`
   - Place answers in \`<div class="correct-answer-box" style="display: none; ...">Answer: ...</div>\`
   - Return ONLY the raw HTML string. Do NOT wrap it in markdown code blocks.

--- Study Summary ---
${text}

--- Previous Years Questions Files ---
${questionFilesText.trim() || "See attached files, if any."}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          ...filesParts,
          { text: prompt }
        ]
      },
      config: { temperature: 0.3 }
    });
    
    let html = response.text || "";
    html = html.replace(/```html/g, '').replace(/```/g, '').trim();
    return html;
  } catch (e) {
    throw e;
  }
};

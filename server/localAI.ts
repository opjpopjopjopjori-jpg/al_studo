// Ollama runs on a trusted private interface on the server. No provider API key is used.
export const Type = { ARRAY: 'array', OBJECT: 'object', STRING: 'string' } as const;
export const getModel = () => process.env.OLLAMA_MODEL || 'qwen2.5vl:7b';

const baseUrl = () => (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const unavailable = 'خدمة الذكاء الاصطناعي غير متاحة. يجب تشغيل Ollama وتنزيل النموذج على السيرفر أولاً.';

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Request = {
  model: string;
  contents: string | Part[] | { parts: Part[] };
  config?: { systemInstruction?: string; temperature?: number; maxOutputTokens?: number; responseMimeType?: string; responseSchema?: object; tools?: unknown[] };
};

export async function generateContent(request: Request): Promise<{ text: string }> {
  const { contents, config = {} } = request;
  if (config.tools?.length) throw new Error('البحث المباشر في الإنترنت غير متاح بالنموذج المحلي.');
  const parts: Part[] = typeof contents === 'string' ? [{ text: contents }] : Array.isArray(contents) ? contents : contents.parts;
  const images: string[] = [];
  const content = parts.map(part => {
    if (part.text !== undefined) return part.text;
    if (part.inlineData?.data) {
      if (!part.inlineData.mimeType.startsWith('image/')) throw new Error('نوع المرفق غير مدعوم من النموذج المحلي.');
      images.push(part.inlineData.data.replace(/^data:image\/[^;]+;base64,/, ''));
      return `[Image ${images.length}]`;
    }
    throw new Error('نوع المرفق غير مدعوم من النموذج المحلي.');
  }).join('\n\n');
  const maxImages = Number(process.env.OLLAMA_MAX_IMAGES || 16);
  if (images.length > maxImages) throw new Error(`عدد الصفحات المصوّرة أكبر من حد السيرفر (${maxImages}). قسّم الملفات وحاول مرة أخرى.`);
  const context = Number(process.env.OLLAMA_CONTEXT || 65536);
  // A conservative character limit avoids sending extremely long inputs that Ollama may truncate silently.
  if ((content.length + (config.systemInstruction?.length || 0)) > context * 2) {
    throw new Error('المحتوى أكبر من سعة النموذج المحلي. قسّم الملفات إلى مجموعات أصغر وحاول مرة أخرى.');
  }
  const messages: any[] = [];
  if (config.systemInstruction) messages.push({ role: 'system', content: config.systemInstruction });
  messages.push({ role: 'user', content, ...(images.length ? { images } : {}) });
  const payload = {
    model: request.model,
    messages,
    stream: false,
    options: { num_ctx: context, num_predict: config.maxOutputTokens || 8192, ...(config.temperature === undefined ? {} : { temperature: config.temperature }) },
    ...(config.responseMimeType === 'application/json' ? { format: config.responseSchema || 'json' } : {}),
  };
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS || 900000)),
    });
  } catch (err) {
    console.error('Ollama connection failed:', err);
    throw new Error(unavailable);
  }
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    console.error('Ollama error:', response.status, data.error);
    if (response.status === 404) throw new Error(`نموذج الذكاء الاصطناعي ${request.model} غير موجود على السيرفر. يجب تنزيله أولاً.`);
    throw new Error('تعذّر تشغيل النموذج المحلي. تأكد من توافق النموذج مع الصور وتوفر ذاكرة كافية على السيرفر.');
  }
  if (data.done_reason === 'length') throw new Error('توقف النموذج قبل إكمال الإجابة. قلّل حجم الملفات أو زد حد الإخراج.');
  if (typeof data.message?.content !== 'string' || !data.message.content.trim()) throw new Error('لم يُرجع النموذج المحلي إجابة. حاول مرة أخرى.');
  return { text: data.message.content };
}

export function getLocalAI() { return { models: { generateContent } }; }

export async function getAIStatus() {
  try {
    const response = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Ollama unavailable');
    const data = await response.json() as { models?: { name?: string; model?: string }[] };
    const model = getModel();
    const available = (data.models || []).some(m => [m.name, m.model].includes(model));
    return { ready: available, model, message: available ? 'النموذج المحلي جاهز.' : `النموذج ${model} غير موجود على السيرفر.` };
  } catch {
    return { ready: false, model: getModel(), message: unavailable };
  }
}

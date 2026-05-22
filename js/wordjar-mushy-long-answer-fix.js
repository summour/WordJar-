// WordJar Mushy Long Answer Fix
// Final late-loaded override so Mushy does not self-limit or ask for continuation.

(function installWordJarMushyLongAnswerFix() {
  const INSTALL_KEY = '__wordjarMushyLongAnswerFixV2Installed';
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  const API_VERSION = 'v1beta';
  const MAX_OUTPUT_TOKENS = 8192;
  const MAX_CONTEXT_CHARS = 22000;
  const MAX_QUESTION_CHARS = 6000;
  const MODELS = [
    'gemini-2.5-pro',
    'gemini-pro-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest'
  ];

  function getUserLevel() {
    return String(
      window.D?.profile?.userLevel ||
      window.D?.profile?.englishLevel ||
      window.D?.profile?.cefrLevel ||
      window.D?.reader?.userLevel ||
      'B1'
    ).trim().toUpperCase() || 'B1';
  }

  function normalizeText(value, maxLength) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, maxLength);
  }

  async function ensureApiKey() {
    if (typeof window.initAppConfig === 'function') await window.initAppConfig();
    const key = String(
      window.globalApiKey || window.getApiKeyFromMemory?.() || ''
    ).trim();
    if (!key) throw new Error('NO_API_KEY');
    return key;
  }

  function buildPrompt(input = {}) {
    const level = getUserLevel();
    const task = String(input.task || 'chat');
    const question = normalizeText(
      input.question || input.message || '',
      MAX_QUESTION_CHARS
    );
    const context = normalizeText(
      input.contextText || input.context || '',
      MAX_CONTEXT_CHARS
    );

    return `You are Mushy, a serious English-learning assistant inside WordJar.\n\nLanguage and role:\n- Main language: Thai.\n- Use English for quoted source text, example sentences, grammar labels, vocabulary, and IPA only when useful.\n- Be direct, accurate, context-aware, and useful for serious study.\n- Avoid cat roleplay unless the user explicitly asks.\n\nLearner level: ${level}\nTask: ${task}\n\nContext from WordJar / Reader / deck / previous chat:\n${context || '(no extra context)'}\n\nUser message:\n${question || '(no question provided)'}\n\nHard rules:\n- Produce one complete response in this single answer.\n- Never ask the user to press continue.\n- Never write continuation markers such as กดต่อ, ต่อ, continue, to be continued, วิเคราะห์ต่อ, or similar.\n- Do not end mid-sentence. If the answer would be very long, compress and prioritize instead of splitting.\n- Do not summarize aggressively unless the user asks for a short answer.\n- Preserve readable paragraph spacing.\n\nFor English analysis, include as relevant:\n- การแปล\n- ความหมายในบริบท\n- คำศัพท์และวลีสำคัญ\n- Grammar / sentence structure\n- Nuance\n- Extra examples\n\nFor long source text:\n- Give the most complete useful analysis possible in one response.\n- Prioritize the most important details.\n- Finish with a natural conclusion, not a continuation request.\n\nOutput style:\n- Thai paragraphs.\n- Headings are allowed when they make the answer easier to read.\n- Use bullets only when they improve clarity.`;
  }

  function endpoint(model, apiKey) {
    return `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  function shouldTryNextModel(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.status === 400 ||
      error?.status === 404 ||
      message.includes('not found') ||
      message.includes('unsupported') ||
      message.includes('model');
  }

  async function callModel({ apiKey, model, prompt, input }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs || 90000);

    try {
      const response = await fetch(endpoint(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: input.temperature ?? 0.32,
            topP: input.topP ?? 0.95,
            maxOutputTokens: input.maxOutputTokens || MAX_OUTPUT_TOKENS
          }
        })
      });

      const raw = await response.text();
      let payload = null;
      try { payload = JSON.parse(raw); } catch (err) {}

      if (!response.ok) {
        const apiMessage = payload?.error?.message || raw || `HTTP ${response.status}`;
        const error = new Error(`AI_${response.status}: ${apiMessage}`);
        error.status = response.status;
        error.model = model;
        error.apiMessage = apiMessage;
        throw error;
      }

      const candidate = payload?.candidates?.[0] || {};
      const text = candidate.content?.parts
        ?.map(part => part.text || '')
        .join('\n')
        .trim() || '';
      if (!text) throw new Error(`EMPTY_AI_RESPONSE from ${model}`);

      return {
        text,
        model,
        finishReason: candidate.finishReason || ''
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function stripContinuationText(value) {
    return String(value || '')
      .replace(/\n?\s*\[?\s*กดต่อ[^\]\n.。!?]*\]?\s*$/i, '')
      .replace(/\n?\s*\[?\s*ต่อ[^\]\n.。!?]*\]?\s*$/i, '')
      .replace(/\n?\s*\[?\s*continue[^\]\n.。!?]*\]?\s*$/i, '')
      .replace(/\n?\s*\[?\s*to be continued[^\]\n.。!?]*\]?\s*$/i, '')
      .trim();
  }

  function userFacingError(error) {
    const message = String(error?.message || '');
    const apiMessage = String(error?.apiMessage || '');
    if (message.includes('NO_API_KEY')) return 'ยังไม่มี Private API Key ใน Settings';
    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) return 'API Key ไม่ถูกต้อง ตรวจใน Settings อีกครั้ง';
    if (message.includes('403') || message.includes('PERMISSION_DENIED')) return 'API Key ยังไม่มีสิทธิ์ใช้โมเดลนี้ หรือถูกจำกัด referrer';
    if (message.includes('429')) return 'Gemini quota หรือ rate limit เต็มชั่วคราว';
    if (message.includes('Failed to fetch') || message.includes('aborted')) return 'เชื่อมต่อ Gemini ไม่สำเร็จ หรือคำตอบใช้เวลานานเกินไป';
    return `Mushy ตอบไม่สำเร็จ: ${apiMessage || message || 'unknown error'}`;
  }

  async function askLong(input = {}) {
    const apiKey = await ensureApiKey();
    const prompt = buildPrompt(input);
    const models = input.models || MODELS;
    let lastError = null;

    for (const model of models) {
      try {
        const result = await callModel({ apiKey, model, prompt, input });
        const text = stripContinuationText(result.text);
        window.WordJarMushyAI.lastModel = result.model;
        return {
          text,
          model: result.model,
          cached: false,
          finishReason: result.finishReason
        };
      } catch (err) {
        lastError = err;
        console.warn('Mushy long-answer model failed', model, err);
        if (!shouldTryNextModel(err)) break;
      }
    }

    throw lastError || new Error('MUSHY_LONG_ANSWER_FAILED');
  }

  function patch() {
    if (!window.WordJarMushyAI) return false;

    window.WordJarMushyAI.ask = askLong;
    window.WordJarMushyAI.userFacingError = userFacingError;
    window.WordJarMushyAI.smartModels = MODELS;
    window.WordJarMushyAI.maxOutputTokens = MAX_OUTPUT_TOKENS;
    window.WordJarMushyAI.longAnswerFix = 'v2';
    return true;
  }

  function boot() {
    patch();
    setTimeout(patch, 0);
    setTimeout(patch, 400);
    setTimeout(patch, 1200);
  }

  boot();
  document.addEventListener('click', () => setTimeout(patch, 0), true);
})();

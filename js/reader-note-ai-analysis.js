// WordJar Reader Note AI Analysis V4
// Stable first pass: sentence translations + IPA only.

(function installReaderNoteAIAnalysis() {
  if (window.__wordjarReaderNoteAIAnalysisInstalledV4) return;
  window.__wordjarReaderNoteAIAnalysisInstalledV4 = true;
  window.__wordjarReaderNoteAIAnalysisInstalled = true;

  const API_VERSION = 'v1beta';
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  const MAX_NOTE_CHARS = 9000;
  let isRunning = false;

  function ensureData() {
    window.D = window.D || {};
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    D.readerNoteAnalyses = D.readerNoteAnalyses || {};
    D.reader.noteCustom = D.reader.noteCustom || {};
  }

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  function esc(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function notePlain(note) {
    return String(note?.text || plainFromHTML(note?.html || '') || '').trim();
  }

  function currentNoteId() {
    const page = document.getElementById('readerNotesPage');
    return page?.dataset?.learningNoteId ||
      page?.querySelector('.rn-learning-core')?.dataset?.noteId || '';
  }

  function noteById(id) {
    ensureData();
    return D.readerNotes.find(note => String(note.id) === String(id));
  }

  function hashText(text) {
    let hash = 2166136261;
    const source = String(text || '');
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) +
        (hash << 8) + (hash << 24);
    }
    return `fnv1a_${(hash >>> 0).toString(16)}`;
  }

  function analysisKey(note) {
    return `${note.id}:${hashText(notePlain(note))}`;
  }

  function getCustom() {
    ensureData();
    return {
      ipaStandard: 'en-US',
      translationStyle: 'natural',
      ...D.reader.noteCustom
    };
  }

  async function ensureApiKey() {
    if (typeof window.initAppConfig === 'function') await window.initAppConfig();
    const memoryKey = window.getApiKeyFromMemory?.() || '';
    const privateKey = window.WordJarPrivateConfig?.apiKey || '';
    const localKey = localStorage.getItem('wordjar_api_key') || '';
    const key = String(window.globalApiKey || memoryKey || privateKey || localKey).trim();
    if (!key) throw new Error('NO_API_KEY');
    return key;
  }

  function extractJSON(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('EMPTY_AI_RESPONSE');

    try { return JSON.parse(raw); } catch (err) {}

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));

    throw new Error('INVALID_AI_JSON');
  }

  function cleanArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function splitSentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=["'“”‘’A-Z0-9])/)
      .map(value => value.trim())
      .filter(Boolean);
  }

  function buildSentencePayload(note) {
    const source = notePlain(note).slice(0, MAX_NOTE_CHARS);
    return splitSentences(source).slice(0, 80).map((text, index) => ({
      id: `s${index + 1}`,
      text
    }));
  }

  function buildPrompt(note, custom) {
    const sentences = buildSentencePayload(note);
    return [
      'You are an English learning assistant for Thai learners.',
      'Return ONLY valid minified JSON. No markdown. No comments.',
      'Do not add keys outside the schema.',
      `IPA standard: ${custom.ipaStandard}.`,
      'Task: translate each sentence into natural Thai and provide IPA only for useful English words.',
      'Do not analyze grammar yet. Do not create flashcards yet.',
      'Limit IPA words to important/content words only. Skip easy function words unless useful.',
      'Schema:',
      '{"schemaVersion":2,"sentences":[{"id":"s1","text":"original sentence","translationThai":"natural Thai translation"}],"ipa":[{"word":"feel","ipa":"/fiːl/"}]}',
      'Sentences JSON:',
      JSON.stringify(sentences)
    ].join('\n');
  }

  function normalizeAnalysis(note, raw, model) {
    const sentenceFallback = buildSentencePayload(note).map(item => ({
      ...item,
      translationThai: ''
    }));
    const sentences = cleanArray(raw?.sentences).length
      ? cleanArray(raw.sentences)
      : sentenceFallback;
    const ipaItems = cleanArray(raw?.ipa)
      .filter(item => item && (item.word || item.lemma) && item.ipa)
      .map((item, index) => ({
        id: `ipa_${index + 1}_${String(item.word || item.lemma).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        lemma: String(item.word || item.lemma || '').trim(),
        display: String(item.word || item.lemma || '').trim(),
        ipa: String(item.ipa || '').trim(),
        ipaStandard: getCustom().ipaStandard,
        translationThai: '',
        meaningInContextThai: '',
        showByDefault: true,
        isLearningTarget: true
      }));

    return {
      status: 'completed',
      noteId: note.id,
      contentHash: hashText(notePlain(note)),
      model: model || window.WordJarAIConfig?.lastModel || 'Gemini',
      analyzedAt: new Date().toISOString(),
      config: { ...getCustom(), scope: 'sentences_and_ipa' },
      document: {},
      baseAnalysis: {
        sentences: sentences.map((item, index) => ({
          id: String(item.id || `s${index + 1}`),
          text: String(item.text || '').trim(),
          translationThai: String(item.translationThai || item.thai || '').trim(),
          naturalThai: String(item.naturalThai || item.translationThai || item.thai || '').trim(),
          grammarPointIds: []
        })),
        vocabulary: ipaItems,
        grammarPoints: [],
        phrases: [],
        learningTargets: [],
        cardCandidates: []
      },
      pronunciationLayers: {
        [getCustom().ipaStandard]: {
          status: 'completed',
          items: Object.fromEntries(ipaItems.map(item => [item.id, item.ipa || '']))
        }
      }
    };
  }

  function shouldTryNextModel(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.status === 404 ||
      error?.status === 400 ||
      message.includes('not found') ||
      message.includes('unsupported') ||
      message.includes('model') ||
      message.includes('responsemimetype');
  }

  function buildGeminiBody(prompt, maxOutputTokens, forceJson) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens
      }
    };
    if (forceJson) body.generationConfig.responseMimeType = 'application/json';
    return body;
  }

  async function callGeminiModel({ apiKey, model, prompt, maxOutputTokens, forceJson }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(buildGeminiBody(prompt, maxOutputTokens, forceJson))
        }
      );
      const raw = await response.text();
      let payload = null;
      try { payload = JSON.parse(raw); } catch (err) {}
      if (!response.ok) {
        const message = payload?.error?.message || raw || `HTTP ${response.status}`;
        const error = new Error(`AI_${response.status}: ${message}`);
        error.status = response.status;
        error.model = model;
        throw error;
      }
      const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
      if (!text.trim()) throw new Error(`EMPTY_AI_RESPONSE from ${model}`);
      return { text, model };
    } finally {
      clearTimeout(timer);
    }
  }

  async function callAI(prompt, maxOutputTokens = 6000) {
    if (window.WordJarAIConfig?.callHighEndGemini) {
      try {
        const text = await WordJarAIConfig.callHighEndGemini(prompt, {
          maxTokens: maxOutputTokens,
          forceJson: true,
          models: MODELS
        });
        return { text, model: window.WordJarAIConfig.lastModel || 'Gemini' };
      } catch (err) {
        if (!shouldTryNextModel(err) && !String(err.message || '').includes('INVALID')) throw err;
      }
    }

    const apiKey = await ensureApiKey();
    let lastError = null;
    for (const model of MODELS) {
      try {
        return await callGeminiModel({ apiKey, model, prompt, maxOutputTokens, forceJson: true });
      } catch (err) {
        lastError = err;
        console.warn(`Reader Note AI failed with ${model}`, err);
        if (shouldTryNextModel(err)) {
          try {
            return await callGeminiModel({ apiKey, model, prompt, maxOutputTokens, forceJson: false });
          } catch (retryErr) {
            lastError = retryErr;
            console.warn(`Reader Note AI retry failed with ${model}`, retryErr);
          }
        }
        if (!shouldTryNextModel(lastError)) break;
      }
    }
    throw lastError || new Error('AI_CALL_FAILED');
  }

  function setBanner(html) {
    const core = document.getElementById('rnCoreLearningBanner');
    if (core) core.innerHTML = html;
  }

  function loadingBanner(message) {
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">${esc(message)}</div><div class="rn-learning-banner-sub">Gemini is creating sentence translations and IPA.</div></div></div>`;
  }

  function readyBanner(result) {
    const base = result?.baseAnalysis || {};
    return `<div class="rn-learning-chipline"><span class="rn-learning-chip">AI ready</span><span class="rn-learning-chip">${cleanArray(base.sentences).length} sentences</span><span class="rn-learning-chip">${cleanArray(base.vocabulary).length} IPA</span><span class="rn-learning-chip">${esc(result.model || 'Gemini')}</span></div>`;
  }

  function failedBanner(message, noteId) {
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">AI analysis failed</div><div class="rn-learning-banner-sub">${esc(message)}</div></div><button class="rn-btn primary" type="button" data-rn-analyze="${esc(noteId)}">Retry</button></div>`;
  }

  function refreshDetail(noteId) {
    if (typeof window.renderReaderNoteLearningDetail === 'function') {
      window.renderReaderNoteLearningDetail(noteId);
    }
  }

  async function analyzeNote(note) {
    const { text, model } = await callAI(buildPrompt(note, getCustom()), 6000);
    return normalizeAnalysis(note, extractJSON(text), model);
  }

  window.analyzeReaderNoteLearning = async function analyzeReaderNoteLearning(noteId = '') {
    if (isRunning) return;
    ensureData();
    const note = noteById(noteId || currentNoteId());
    if (!note) {
      toastSafe('Note not found');
      return;
    }

    isRunning = true;
    setBanner(loadingBanner('Analyzing note...'));

    try {
      const result = await analyzeNote(note);
      D.readerNoteAnalyses[analysisKey(note)] = result;
      if (typeof save === 'function') save();
      setBanner(readyBanner(result));
      toastSafe('Note analysis ready');
      setTimeout(() => refreshDetail(note.id), 0);
    } catch (err) {
      const message = String(err.message || '').includes('NO_API_KEY')
        ? 'Add Private API Key in Settings first.'
        : `Analyze Note failed: ${String(err.message || 'unknown error')}`;
      D.readerNoteAnalyses[analysisKey(note)] = { status: 'failed', error: message, failedAt: new Date().toISOString() };
      if (typeof save === 'function') save();
      setBanner(failedBanner(message, note.id));
      toastSafe(message);
    } finally {
      isRunning = false;
    }
  };

  window.reanalyzeReaderNoteLearning = function reanalyzeReaderNoteLearning(noteId = '') {
    const note = noteById(noteId || currentNoteId());
    if (!note) return;
    delete D.readerNoteAnalyses[analysisKey(note)];
    if (typeof save === 'function') save();
    window.analyzeReaderNoteLearning(note.id);
  };

  window.updateReaderNoteIPAOnly = function updateReaderNoteIPAOnly() {
    toastSafe('IPA is included in the base sentence analysis.');
  };
})();
// WordJar Reader Note AI Analysis V5
// Stable first pass: sentence translations only, using a plain text protocol.

(function installReaderNoteAIAnalysis() {
  if (window.__wordjarReaderNoteAIAnalysisInstalledV5) return;
  window.__wordjarReaderNoteAIAnalysisInstalledV5 = true;
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
    const lines = sentences.map(item => `${item.id}\t${item.text}`).join('\n');
    return [
      'Translate English sentences into natural Thai for a Thai learner.',
      'Return ONLY lines in this exact format:',
      's1<TAB>Thai translation',
      's2<TAB>Thai translation',
      'Do not return JSON. Do not return markdown. Do not add bullets.',
      'Keep each id exactly the same. One output line per input line.',
      `Translation style: ${custom.translationStyle}.`,
      '',
      'INPUT:',
      lines
    ].join('\n');
  }

  function parseTranslationLines(output, sentencePayload) {
    const map = new Map();
    String(output || '').split(/\n+/).forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) return;

      const tabParts = line.split('\t');
      if (tabParts.length >= 2 && /^s\d+$/i.test(tabParts[0].trim())) {
        map.set(tabParts[0].trim().toLowerCase(), tabParts.slice(1).join('\t').trim());
        return;
      }

      const match = line.match(/^(s\d+)\s*[:：\-–—|]\s*(.+)$/i);
      if (match) map.set(match[1].toLowerCase(), match[2].trim());
    });

    return sentencePayload.map(item => ({
      id: item.id,
      text: item.text,
      translationThai: map.get(item.id.toLowerCase()) || '',
      naturalThai: map.get(item.id.toLowerCase()) || '',
      grammarPointIds: []
    }));
  }

  function normalizeAnalysis(note, output, model) {
    const sentencePayload = buildSentencePayload(note);
    const sentences = parseTranslationLines(output, sentencePayload);

    return {
      status: 'completed',
      noteId: note.id,
      contentHash: hashText(notePlain(note)),
      model: model || window.WordJarAIConfig?.lastModel || 'Gemini',
      analyzedAt: new Date().toISOString(),
      config: { ...getCustom(), scope: 'sentence_translation' },
      document: {},
      baseAnalysis: {
        sentences,
        vocabulary: [],
        grammarPoints: [],
        phrases: [],
        learningTargets: [],
        cardCandidates: []
      },
      pronunciationLayers: {}
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

  function buildGeminiBody(prompt, maxOutputTokens) {
    return {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens
      }
    };
  }

  async function callGeminiModel({ apiKey, model, prompt, maxOutputTokens }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(buildGeminiBody(prompt, maxOutputTokens))
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

  async function callAI(prompt, maxOutputTokens = 5000) {
    const apiKey = await ensureApiKey();
    let lastError = null;
    for (const model of MODELS) {
      try {
        return await callGeminiModel({ apiKey, model, prompt, maxOutputTokens });
      } catch (err) {
        lastError = err;
        console.warn(`Reader Note translation failed with ${model}`, err);
        if (!shouldTryNextModel(err)) break;
      }
    }
    throw lastError || new Error('AI_CALL_FAILED');
  }

  function setBanner(html) {
    const core = document.getElementById('rnCoreLearningBanner');
    if (core) core.innerHTML = html;
  }

  function loadingBanner(message) {
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">${esc(message)}</div><div class="rn-learning-banner-sub">Gemini is creating sentence translations.</div></div></div>`;
  }

  function readyBanner(result) {
    const sentences = cleanArray(result?.baseAnalysis?.sentences);
    const translated = sentences.filter(item => item.translationThai || item.naturalThai).length;
    return `<div class="rn-learning-chipline"><span class="rn-learning-chip">Translation ready</span><span class="rn-learning-chip">${translated}/${sentences.length} sentences</span><span class="rn-learning-chip">${esc(result.model || 'Gemini')}</span></div>`;
  }

  function failedBanner(message, noteId) {
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">Translation failed</div><div class="rn-learning-banner-sub">${esc(message)}</div></div><button class="rn-btn primary" type="button" data-rn-analyze="${esc(noteId)}">Retry</button></div>`;
  }

  function refreshDetail(noteId) {
    if (typeof window.renderReaderNoteLearningDetail === 'function') {
      window.renderReaderNoteLearningDetail(noteId);
    }
  }

  async function analyzeNote(note) {
    const { text, model } = await callAI(buildPrompt(note, getCustom()), 5000);
    return normalizeAnalysis(note, text, model);
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
    setBanner(loadingBanner('Translating note...'));

    try {
      const result = await analyzeNote(note);
      D.readerNoteAnalyses[analysisKey(note)] = result;
      if (typeof save === 'function') save();
      setBanner(readyBanner(result));
      toastSafe('Translation ready');
      setTimeout(() => refreshDetail(note.id), 0);
    } catch (err) {
      const message = String(err.message || '').includes('NO_API_KEY')
        ? 'Add Private API Key in Settings first.'
        : `Translation failed: ${String(err.message || 'unknown error')}`;
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
    toastSafe('IPA will be added after sentence translation is stable.');
  };
})();
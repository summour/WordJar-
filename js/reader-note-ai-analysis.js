// WordJar Reader Note AI Analysis V1
// Adds real Gemini batch analysis to the Note Detail learning surface.

(function installReaderNoteAIAnalysis() {
  if (window.__wordjarReaderNoteAIAnalysisInstalled) return;
  window.__wordjarReaderNoteAIAnalysisInstalled = true;

  const MODEL = 'gemini-1.5-flash';
  const MAX_NOTE_CHARS = 12000;
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
    const key = String(window.globalApiKey || memoryKey).trim();
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

  function buildBatchPrompt(note, custom) {
    const text = notePlain(note).slice(0, MAX_NOTE_CHARS);
    return [
      'You are an English learning analyzer for Thai learners.',
      'Return valid JSON only. Do not use markdown.',
      `Pronunciation standard: ${custom.ipaStandard}.`,
      `Translation style: ${custom.translationStyle}.`,
      'Target language: Thai.',
      '',
      'Analyze the note once for a language-learning reader.',
      'Include IPA and translations based on meaning in context.',
      'Deduplicate vocabulary by lemma, part of speech, and meaning sense.',
      'If one lemma has multiple meanings, create separate vocabulary records.',
      'Choose useful learning targets; skip easy stop words by default.',
      '',
      'JSON schema:',
      '{',
      '  "schemaVersion": 1,',
      '  "document": {',
      '    "summaryThai": "",',
      '    "summarySimple": "",',
      '    "tone": "",',
      '    "detectedLevel": "A1|A2|B1|B2|C1|C2",',
      '    "mainIdeas": [""]',
      '  },',
      '  "baseAnalysis": {',
      '    "sentences": [',
      '      {',
      '        "id": "s1",',
      '        "text": "",',
      '        "translationThai": "",',
      '        "naturalThai": "",',
      '        "level": "",',
      '        "grammarPointIds": ["g1"]',
      '      }',
      '    ],',
      '    "vocabulary": [',
      '      {',
      '        "id": "v_word_sense",',
      '        "lemma": "",',
      '        "display": "",',
      '        "ipa": "",',
      `        "ipaStandard": "${custom.ipaStandard}",`,
      '        "pos": "",',
      '        "cefr": "",',
      '        "translationThai": "",',
      '        "meaningInContextThai": "",',
      '        "exampleFromText": "",',
      '        "showByDefault": true,',
      '        "isLearningTarget": true',
      '      }',
      '    ],',
      '    "grammarPoints": [',
      '      {',
      '        "id": "g1",',
      '        "title": "",',
      '        "pattern": "",',
      '        "level": "",',
      '        "explanationThai": "",',
      '        "examplesFromText": [""]',
      '      }',
      '    ],',
      '    "phrases": [',
      '      { "text": "", "translationThai": "", "meaningThai": "", "exampleFromText": "" }',
      '    ],',
      '    "learningTargets": [',
      '      { "type": "vocabulary|grammar|phrase", "id": "", "priority": 90, "reasonThai": "" }',
      '    ],',
      '    "cardCandidates": [',
      '      {',
      '        "type": "vocabulary|phrase|grammar",',
      '        "front": "",',
      '        "back": "",',
      '        "ipa": "",',
      '        "pos": "",',
      '        "cefr": "",',
      '        "example": "",',
      '        "note": ""',
      '      }',
      '    ]',
      '  }',
      '}',
      '',
      'Note text:',
      text
    ].join('\n');
  }

  function cleanArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeAnalysis(note, raw) {
    const base = raw?.baseAnalysis || {};
    const vocabulary = cleanArray(base.vocabulary)
      .filter(item => item && (item.lemma || item.display || item.translationThai))
      .map((item, index) => ({
        id: String(item.id || item.lemma || item.display || `v_${index + 1}`),
        lemma: String(item.lemma || item.display || '').trim(),
        display: String(item.display || item.lemma || '').trim(),
        ipa: String(item.ipa || '').trim(),
        ipaStandard: String(item.ipaStandard || getCustom().ipaStandard),
        pos: String(item.pos || '').trim(),
        cefr: String(item.cefr || '').trim(),
        translationThai: String(item.translationThai || '').trim(),
        meaningInContextThai: String(item.meaningInContextThai || '').trim(),
        exampleFromText: String(item.exampleFromText || '').trim(),
        showByDefault: item.showByDefault !== false,
        isLearningTarget: item.isLearningTarget !== false
      }));

    return {
      status: 'completed',
      noteId: note.id,
      contentHash: hashText(notePlain(note)),
      model: MODEL,
      analyzedAt: new Date().toISOString(),
      config: { ...getCustom() },
      document: raw?.document || {},
      baseAnalysis: {
        sentences: cleanArray(base.sentences),
        vocabulary,
        grammarPoints: cleanArray(base.grammarPoints),
        phrases: cleanArray(base.phrases),
        learningTargets: cleanArray(base.learningTargets),
        cardCandidates: cleanArray(base.cardCandidates)
      },
      pronunciationLayers: {
        [getCustom().ipaStandard]: {
          status: 'completed',
          items: Object.fromEntries(vocabulary.map(item => [item.id, item.ipa || '']))
        }
      }
    };
  }

  async function requestGemini(prompt, maxOutputTokens = 8192) {
    const apiKey = await ensureApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              topP: 0.8,
              maxOutputTokens,
              responseMimeType: 'application/json'
            }
          })
        }
      );
      if (!response.ok) throw new Error(`AI_${response.status}`);
      const payload = await response.json();
      return payload?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('\n') || '';
    } finally {
      clearTimeout(timer);
    }
  }

  function setBanner(html) {
    const banner = document.getElementById('rnLearningBanner');
    if (banner) banner.innerHTML = html;
  }

  function readyBanner(result) {
    const base = result?.baseAnalysis || {};
    return [
      '<div class="rn-learning-chipline">',
      '<span class="rn-learning-chip">AI analysis ready</span>',
      `<span class="rn-learning-chip">${cleanArray(base.vocabulary).length} words</span>`,
      `<span class="rn-learning-chip">${cleanArray(base.grammarPoints).length} grammar</span>`,
      `<span class="rn-learning-chip">${esc(result?.config?.ipaStandard || getCustom().ipaStandard)}</span>`,
      '</div>'
    ].join('');
  }

  function loadingBanner(message) {
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">${esc(message)}</div><div class="rn-learning-banner-sub">Keep this sheet open until the cache is saved.</div></div></div>`;
  }

  function failedBanner(message, noteId) {
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">AI analysis failed</div><div class="rn-learning-banner-sub">${esc(message)}</div></div><button class="rn-text-btn primary" type="button" onclick="analyzeReaderNoteLearning('${esc(noteId)}')">Retry</button></div>`;
  }

  async function analyzeNote(note) {
    const output = await requestGemini(buildBatchPrompt(note, getCustom()));
    return normalizeAnalysis(note, extractJSON(output));
  }

  function buildIPAPrompt(vocabulary, standard) {
    const items = vocabulary.map(item => ({
      id: item.id,
      lemma: item.lemma,
      display: item.display,
      pos: item.pos,
      meaningThai: item.meaningInContextThai || item.translationThai,
      example: item.exampleFromText
    }));
    return [
      'Return valid JSON only. Do not use markdown.',
      `Generate IPA pronunciations using this standard: ${standard}.`,
      'Choose the pronunciation that matches each context.',
      'Schema: { "items": { "vocabularyId": "IPA" } }',
      JSON.stringify({ vocabulary: items })
    ].join('\n');
  }

  window.analyzeReaderNoteLearning = async function analyzeReaderNoteLearning(noteId = '') {
    if (isRunning) return;
    ensureData();
    const note = noteById(noteId || document.querySelector('.rn-learning-root')?.dataset.noteId || '');
    if (!note) return;
    isRunning = true;
    setBanner(loadingBanner('Analyzing note...'));
    try {
      const result = await analyzeNote(note);
      D.readerNoteAnalyses[analysisKey(note)] = result;
      if (typeof save === 'function') save();
      setBanner(readyBanner(result));
      toastSafe('Note analysis ready');
    } catch (err) {
      const message = String(err.message || '').includes('NO_API_KEY')
        ? 'Add Private API Key in Settings first.'
        : 'Analyze Note failed. Check the API key or retry.';
      D.readerNoteAnalyses[analysisKey(note)] = {
        status: 'failed',
        error: message,
        failedAt: new Date().toISOString()
      };
      if (typeof save === 'function') save();
      setBanner(failedBanner(message, note.id));
      toastSafe(message);
    } finally {
      isRunning = false;
    }
  };

  window.reanalyzeReaderNoteLearning = function reanalyzeReaderNoteLearning(noteId = '') {
    const note = noteById(noteId || document.querySelector('.rn-learning-root')?.dataset.noteId || '');
    if (!note) return;
    delete D.readerNoteAnalyses[analysisKey(note)];
    if (typeof save === 'function') save();
    window.analyzeReaderNoteLearning(note.id);
  };

  window.updateReaderNoteIPAOnly = async function updateReaderNoteIPAOnly(noteId = '') {
    if (isRunning) return;
    ensureData();
    const note = noteById(noteId || document.querySelector('.rn-learning-root')?.dataset.noteId || '');
    const analysis = note ? D.readerNoteAnalyses[analysisKey(note)] : null;
    const vocabulary = analysis?.baseAnalysis?.vocabulary || [];
    const standard = getCustom().ipaStandard;
    if (!note || !analysis?.status || !vocabulary.length) {
      toastSafe('Analyze the note first');
      return;
    }
    if (analysis.pronunciationLayers?.[standard]?.status === 'completed') {
      toastSafe('IPA for this standard already exists');
      return;
    }
    isRunning = true;
    setBanner(loadingBanner(`Updating IPA · ${standard}`));
    try {
      const output = await requestGemini(buildIPAPrompt(vocabulary, standard), 4096);
      const data = extractJSON(output);
      analysis.pronunciationLayers = analysis.pronunciationLayers || {};
      analysis.pronunciationLayers[standard] = {
        status: 'completed',
        items: data?.items || {},
        updatedAt: new Date().toISOString()
      };
      analysis.config = { ...analysis.config, ipaStandard: standard };
      if (typeof save === 'function') save();
      setBanner(readyBanner(analysis));
      toastSafe('IPA updated');
    } catch (err) {
      setBanner(failedBanner('IPA update failed. Retry later.', note.id));
      toastSafe('IPA update failed');
    } finally {
      isRunning = false;
    }
  };
})();
// WordJar Reader Quality V1
// Stops low-quality machine translation from becoming the main meaning.
// Uses reliable EN definitions first and keeps EN-TH as AI-ready / needs-review until a contextual AI provider is added.

(function installWordJarReaderQuality() {
  if (window.__wordjarReaderQualityInstalled) return;
  window.__wordjarReaderQualityInstalled = true;

  const CACHE_KEY = 'wordjar_reader_quality_cache_v1';

  function ensureData() {
    D.reader = D.reader || {};
    if (!D.reader.mode) D.reader.mode = 'en-th';
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
  }

  function safeText(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeWord(word) {
    return String(word || '').toLowerCase().replace(/^'+|'+$/g, '').trim();
  }

  function currentReaderText() {
    return document.getElementById('readerInput')?.value || '';
  }

  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
  }

  function setCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
    catch {}
  }

  function parseSynonyms(value) {
    if (Array.isArray(value)) return value.filter(Boolean).slice(0, 10);
    return String(value || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean).slice(0, 10);
  }

  function estimateLevel(word, definition = '') {
    const w = normalizeWord(word);
    const commonA1 = new Set('be have do say get make go know take see come think look want give use find tell ask work seem feel try leave call good new first last long great little own other old right big high different small large next early young important few public bad same able'.split(' '));
    const commonA2 = new Set('improve consider include continue provide create allow learn change support receive decide explain describe develop return require suggest compare choose'.split(' '));
    const b2PlusSuffix = /(tion|sion|ment|ence|ance|ity|ous|ive|ize|ise|ary|ory|phobia|ology)$/;
    if (commonA1.has(w)) return 'A1';
    if (commonA2.has(w)) return 'A2';
    if (w.length <= 5) return 'A2';
    if (w.length <= 8 && !b2PlusSuffix.test(w)) return 'B1';
    if (w.length >= 12) return 'C1';
    if (b2PlusSuffix.test(w) || String(definition).length > 90) return 'B2';
    return 'B1';
  }

  async function fetchJSON(url, timeoutMs = 6500) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Request failed');
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function localEntry(word) {
    const key = normalizeWord(word);
    const card = D.words.find(w => normalizeWord(w.word) === key);
    if (!card) return null;
    return {
      word: card.word,
      type: card.type || 'N',
      ipa: card.pronunciation || '',
      definition: card.meaning || '',
      synonyms: parseSynonyms(card.synonyms || card.synonym || ''),
      level: card.level || estimateLevel(card.word, card.meaning),
      source: 'cards'
    };
  }

  async function fetchDefinition(word) {
    const key = normalizeWord(word);
    const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    const entry = Array.isArray(data) ? data[0] : null;
    const meaning = entry?.meanings?.[0];
    const definition = meaning?.definitions?.[0];
    if (!entry || !definition?.definition) return null;

    const synonyms = [
      ...(meaning?.synonyms || []),
      ...(definition?.synonyms || [])
    ].filter(Boolean);

    return {
      word: entry.word || key,
      type: meaning?.partOfSpeech ? meaning.partOfSpeech.toUpperCase().slice(0, 3) : 'N',
      ipa: entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '',
      definition: definition.definition || '',
      example: definition.example || '',
      synonyms: [...new Set(synonyms)].slice(0, 10),
      source: 'dictionaryapi.dev'
    };
  }

  async function fetchSynonyms(word) {
    try {
      const data = await fetchJSON(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(normalizeWord(word))}&max=10`, 5000);
      return Array.isArray(data) ? data.map(x => x.word).filter(Boolean).slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  async function lookupReliable(word, forceRefresh = false) {
    const key = normalizeWord(word);
    const cache = getCache();
    if (!forceRefresh && cache[key]) return cache[key];

    let info = localEntry(key) || { word: key, type: 'N', ipa: '', definition: '', synonyms: [], source: 'none' };
    try {
      const online = await fetchDefinition(key);
      if (online) info = { ...info, ...online, synonyms: online.synonyms?.length ? online.synonyms : info.synonyms };
    } catch {}

    if (!info.synonyms?.length) info.synonyms = await fetchSynonyms(key);
    info.level = info.level || estimateLevel(key, info.definition);
    info.needsThaiAI = D.reader?.mode === 'en-th';
    info.meaning = info.definition || 'No reliable definition found yet.';
    cache[key] = info;
    setCache(cache);
    return info;
  }

  function getSentenceContext(text, clickedWord, indexHint) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const key = normalizeWord(clickedWord);
    const lower = raw.toLowerCase();
    let pos = typeof indexHint === 'number' ? indexHint : lower.indexOf(key);
    if (pos < 0) pos = lower.indexOf(key);
    if (pos < 0) return raw.slice(0, 320);
    let start = Math.max(raw.lastIndexOf('.', pos), raw.lastIndexOf('!', pos), raw.lastIndexOf('?', pos));
    start = start < 0 ? 0 : start + 1;
    const ends = ['.', '!', '?'].map(ch => raw.indexOf(ch, pos)).filter(n => n >= 0);
    const end = ends.length ? Math.min(...ends) + 1 : raw.length;
    return raw.slice(start, end).trim().slice(0, 420);
  }

  function injectStyles() {
    if (document.getElementById('readerQualityStyle')) return;
    const style = document.createElement('style');
    style.id = 'readerQualityStyle';
    style.textContent = `
      .reader-quality-note { margin-top:10px; border:1px solid var(--bdr); background:var(--sur2); border-radius:14px; padding:10px; color:var(--ink2); font-size:12px; font-weight:750; line-height:1.4; }
      .reader-ai-pill { display:inline-flex; align-items:center; padding:5px 8px; border-radius:999px; border:1px solid var(--bdr); color:var(--ink2); font-size:11px; font-weight:900; margin-left:6px; }
      .reader-panel .reader-actions.three { grid-template-columns: 1fr 1fr 1fr; }
    `;
    document.head.appendChild(style);
  }

  function selectedDeckId() {
    return D.reader?.deckId || D.decks[0]?.id || '';
  }

  async function openReliablePanel(word, offset, forceRefresh = false) {
    injectStyles();
    const panel = document.getElementById('readerPanel');
    if (!panel) return;

    const modeLabel = D.reader?.mode === 'en-en' ? 'EN → EN' : 'EN → TH';
    panel.innerHTML = `
      <div class="reader-panel-top">
        <div><div class="reader-word">${safeText(word)}</div><div class="reader-pron">Looking up · ${modeLabel}</div></div>
        <button class="btn-close" type="button" onclick="closeReaderPanel()" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="reader-loading-line">Checking reliable definition, synonyms, and level...</div>
    `;
    panel.classList.add('open');

    const info = await lookupReliable(word, forceRefresh);
    const context = getSentenceContext(currentReaderText(), word, offset);
    const existsInDeck = D.words.some(w => normalizeWord(w.word) === normalizeWord(word) && String(w.deckId || '') === String(selectedDeckId()));
    const synonyms = info.synonyms?.length
      ? `<div class="reader-synonyms">${info.synonyms.map(s => `<span class="reader-synonym-chip">${safeText(s)}</span>`).join('')}</div>`
      : '<div class="reader-note">No synonyms found yet.</div>';
    const qualityNote = D.reader?.mode === 'en-th'
      ? '<div class="reader-quality-note">Thai translation is not auto-filled because word-by-word machine translation was inaccurate. Save this card as EN definition + needs Thai review, or add contextual AI later.</div>'
      : '';

    panel.innerHTML = `
      <div class="reader-panel-top">
        <div>
          <div class="reader-word">${safeText(word)}<span class="reader-level-pill">${safeText(info.level || 'B1')}</span>${D.reader?.mode === 'en-th' ? '<span class="reader-ai-pill">AI needed</span>' : ''}</div>
          <div class="reader-pron">${safeText(info.ipa || info.type || '')} · ${modeLabel} · ${safeText(info.source || 'local')}</div>
        </div>
        <button class="btn-close" type="button" onclick="closeReaderPanel()" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="reader-meaning">${safeText(info.meaning)}</div>
      ${qualityNote}
      ${synonyms}
      <div class="reader-context">${safeText(context || 'No context sentence found.')}</div>
      <div class="reader-actions three">
        <button class="btn btn-s" type="button" onclick="speak('${safeText(word)}')">Listen</button>
        <button class="btn btn-s" type="button" onclick="refreshReaderWord('${safeText(word)}', ${Number(offset) || 0})">Refresh</button>
        <button class="btn btn-p" type="button" onclick="addReaderWordToDeck('${safeText(word)}')">${existsInDeck ? 'Add Again' : 'Add to Deck'}</button>
      </div>
      <div class="reader-note">Example uses the surrounding sentence. Synonyms and level are saved with the card.</div>
    `;
  }

  window.selectReaderWord = function selectReaderWordReliable(el) {
    const word = el.dataset.word || el.textContent || '';
    const offset = Number(el.dataset.offset || -1);
    document.querySelectorAll('.reader-token.active').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    openReliablePanel(word, offset, false);
  };

  window.refreshReaderWord = async function refreshReaderWordReliable(word, offset) {
    const key = normalizeWord(word);
    const cache = getCache();
    delete cache[key];
    setCache(cache);
    toast('Refreshing word...');
    await openReliablePanel(word, offset, true);
  };

  window.addReaderWordToDeck = async function addReaderWordToDeckReliable(word) {
    ensureData();
    const deckId = selectedDeckId();
    if (!deckId) return toast('Create a deck first');

    const info = await lookupReliable(word, false);
    const context = getSentenceContext(currentReaderText(), word);
    const sameDeckExists = D.words.some(w => normalizeWord(w.word) === normalizeWord(word) && String(w.deckId || '') === String(deckId));
    if (sameDeckExists && !confirm('This word already exists in this deck. Add it again?')) return;

    const needsThaiReview = D.reader.mode === 'en-th';
    const notes = [
      `Reader: ${D.reader.mode || 'en-th'}`,
      `Level: ${info.level || 'B1'}`,
      info.synonyms?.length ? `Synonyms: ${info.synonyms.join(', ')}` : 'Synonyms: none',
      needsThaiReview ? 'Thai: needs contextual AI/human review' : '',
      `Source: ${info.source || 'none'}`
    ].filter(Boolean).join('\n');

    D.words.push({
      id: 'w' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      word: normalizeWord(word),
      type: info.type || 'N',
      pronunciation: info.ipa || '',
      meaning: info.meaning || '',
      example: context || info.example || '',
      notes,
      synonyms: info.synonyms || [],
      level: info.level || 'B1',
      needsThaiReview,
      deckId,
      lang: 'en',
      starred: false,
      addedDate: typeof today === 'function' ? today() : new Date().toISOString().split('T')[0],
      srsState: 'new', interval: 0, reps: 0, ef: 2.5, nextReview: null, dueAt: null,
      stability: 0, difficulty: 0, scheduledDays: 0, elapsedDays: 0, lapses: 0
    });

    save();
    if (window.WordJarFSRS?.migrateAllCards) WordJarFSRS.migrateAllCards();
    if (typeof renderWords === 'function') renderWords();
    if (typeof renderDecks === 'function') renderDecks();
    if (typeof updateHome === 'function') updateHome();
    toast(needsThaiReview ? 'Added with Thai review flag' : 'Added from Reader');
    if (typeof renderReader === 'function') renderReader();
  };

  injectStyles();
})();

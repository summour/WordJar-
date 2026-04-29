// WordJar Reader Enhancements V2
// Adds online dictionary lookup, synonyms, vocabulary level, and an iOS Notes-like saved notes list.

(function installWordJarReaderEnhancements() {
  if (window.__wordjarReaderEnhancementsInstalled) return;
  window.__wordjarReaderEnhancementsInstalled = true;

  const CACHE_KEY = 'wordjar_reader_lookup_cache_v1';

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
    if (Array.isArray(value)) return value.filter(Boolean).slice(0, 8);
    return String(value || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
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
    if (b2PlusSuffix.test(w) || String(definition).length > 90) return 'B2';
    if (w.length >= 12) return 'C1';
    return 'B1';
  }

  function localEntry(word) {
    const key = normalizeWord(word);
    const card = D.words.find(w => String(w.word || '').toLowerCase().trim() === key);
    if (!card) return null;
    return {
      word: card.word,
      type: card.type || 'N',
      ipa: card.pronunciation || '',
      en: card.meaning || '',
      th: '',
      synonyms: parseSynonyms(card.synonyms || card.synonym || ''),
      level: card.level || estimateLevel(card.word, card.meaning),
      source: 'cards'
    };
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

  async function fetchEnglishDictionary(word) {
    const key = normalizeWord(word);
    const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return null;

    const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
    const meaning = entry.meanings?.[0];
    const definition = meaning?.definitions?.[0];
    const type = meaning?.partOfSpeech ? meaning.partOfSpeech.toUpperCase().slice(0, 3) : 'N';
    const synonyms = [ ...(meaning?.synonyms || []), ...(definition?.synonyms || []) ].filter(Boolean);

    return {
      word: entry.word || key,
      type,
      ipa: phonetic,
      en: definition?.definition || '',
      example: definition?.example || '',
      synonyms: [...new Set(synonyms)].slice(0, 8),
      source: 'dictionaryapi.dev'
    };
  }

  async function fetchSynonyms(word) {
    try {
      const data = await fetchJSON(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(normalizeWord(word))}&max=8`, 5000);
      return Array.isArray(data) ? data.map(x => x.word).filter(Boolean).slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  async function fetchThai(word, fallbackText) {
    const q = fallbackText || word;
    try {
      const data = await fetchJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|th`, 6500);
      return data?.responseData?.translatedText || '';
    } catch {
      return '';
    }
  }

  async function lookupWordRich(word, forceRefresh = false) {
    ensureData();
    const key = normalizeWord(word);
    const mode = D.reader.mode || 'en-th';
    const cache = getCache();
    const cacheKey = `${key}:${mode}`;

    if (!forceRefresh && cache[cacheKey]) return cache[cacheKey];

    const local = localEntry(key);
    let info = local || { word: key, type: 'N', ipa: '', en: '', th: '', synonyms: [], source: 'none' };

    try {
      const online = await fetchEnglishDictionary(key);
      if (online) info = { ...info, ...online, synonyms: online.synonyms?.length ? online.synonyms : info.synonyms };
    } catch {}

    if (!info.synonyms?.length) info.synonyms = await fetchSynonyms(key);
    if (mode === 'en-th' && !info.th) info.th = await fetchThai(key, info.en || key);

    info.level = info.level || estimateLevel(key, info.en || info.th);
    info.meaning = mode === 'en-th'
      ? (info.th || info.en || 'ยังไม่มีคำแปลในฐานข้อมูล')
      : (info.en || info.th || 'No definition found yet.');

    info.synonyms = [...new Set(info.synonyms || [])].slice(0, 8);
    cache[cacheKey] = info;
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
    if (pos < 0) return raw.slice(0, 260);
    let start = Math.max(raw.lastIndexOf('.', pos), raw.lastIndexOf('!', pos), raw.lastIndexOf('?', pos));
    start = start < 0 ? 0 : start + 1;
    const ends = ['.', '!', '?'].map(ch => raw.indexOf(ch, pos)).filter(n => n >= 0);
    const end = ends.length ? Math.min(...ends) + 1 : raw.length;
    return raw.slice(start, end).trim().slice(0, 320);
  }

  function injectStyles() {
    if (document.getElementById('readerEnhancementStyle')) return;
    const style = document.createElement('style');
    style.id = 'readerEnhancementStyle';
    style.textContent = `
      .reader-level-pill { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:24px; padding:0 8px; border-radius:999px; background:var(--ink); color:white; font-size:11px; font-weight:900; margin-left:8px; }
      .reader-synonyms { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
      .reader-synonym-chip { border:1px solid var(--bdr); background:var(--sur2); color:var(--ink2); border-radius:999px; padding:6px 8px; font-size:11px; font-weight:800; }
      .reader-panel .reader-actions.three { grid-template-columns: 1fr 1fr 1fr; }
      .reader-loading-line { color:var(--ink2); font-size:13px; font-weight:800; margin-top:10px; }
      .reader-top-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .reader-top-actions .btn { width:auto !important; padding:9px 11px !important; font-size:12px !important; border-radius:12px !important; }
      .reader-notes-modal .modal-card { max-height:min(82vh, 760px); overflow:auto; }
      .reader-note-list { display:flex; flex-direction:column; gap:9px; margin-top:12px; }
      .reader-note-row { border:1px solid var(--bdr); background:var(--sur); border-radius:16px; padding:12px; cursor:pointer; }
      .reader-note-row:active { background:var(--sur2); }
      .reader-note-row-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      .reader-note-row-title { color:var(--ink); font-size:14px; font-weight:900; line-height:1.25; }
      .reader-note-row-date { color:var(--ink2); font-size:11px; font-weight:800; white-space:nowrap; }
      .reader-note-row-text { color:var(--ink2); font-size:12px; line-height:1.42; margin-top:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .reader-note-row-meta { color:var(--ink2); font-size:11px; font-weight:800; margin-top:8px; }
      .reader-note-editor-title { width:100%; height:42px; border:1px solid var(--bdr); border-radius:14px; background:var(--sur); color:var(--ink); font-size:15px; font-weight:850; padding:0 12px; outline:none; margin-bottom:10px; }
      .reader-note-editor-text { width:100%; min-height:240px; resize:vertical; border:1px solid var(--bdr); border-radius:16px; background:var(--sur); color:var(--ink); font:inherit; font-size:15px; line-height:1.55; padding:12px; outline:none; }
      .reader-note-editor-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
      .reader-note-editor-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
      .reader-note-editor-actions.three { grid-template-columns:1fr 1fr 1fr; }
      .reader-inline-notes-card { display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function getSelectedDeckId() {
    return D.reader?.deckId || D.decks[0]?.id || '';
  }

  function noteTitleFromText(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.slice(0, 48) || 'Untitled note';
  }

  function deckOptionsHtml(selectedDeckId) {
    return D.decks.map(d => `<option value="${safeText(d.id)}" ${String(selectedDeckId) === String(d.id) ? 'selected' : ''}>${safeText(d.name)}</option>`).join('');
  }

  function removeInlineNotesCard() {
    document.getElementById('readerNotesCard')?.remove();
  }

  function injectReaderTopActions() {
    const head = document.querySelector('#pg-reader .reader-head');
    if (!head || document.getElementById('readerTopActions')) return;

    const clearBtn = head.querySelector('button[onclick="clearReaderText()"]');
    const actions = document.createElement('div');
    actions.id = 'readerTopActions';
    actions.className = 'reader-top-actions';
    actions.innerHTML = `
      <button class="btn btn-s" type="button" onclick="saveReaderNote()">Save</button>
      <button class="btn btn-s" type="button" onclick="openReaderNotesModal()">Notes</button>
    `;

    if (clearBtn) {
      clearBtn.insertAdjacentElement('beforebegin', actions);
      actions.appendChild(clearBtn);
    } else {
      head.appendChild(actions);
    }
  }

  window.saveReaderNote = function saveReaderNote() {
    ensureData();
    const text = currentReaderText().trim();
    if (!text) return toast('No reader text to save');

    const existingId = D.reader.currentNoteId;
    const now = new Date().toISOString();
    const note = existingId ? D.readerNotes.find(n => n.id === existingId) : null;

    if (note) {
      note.text = text;
      note.title = note.title || noteTitleFromText(text);
      note.updatedAt = now;
      note.mode = D.reader.mode || 'en-th';
      note.deckId = getSelectedDeckId();
      toast('Reader note updated');
    } else {
      const created = {
        id: 'rn' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        title: noteTitleFromText(text),
        text,
        mode: D.reader.mode || 'en-th',
        deckId: getSelectedDeckId(),
        createdAt: now,
        updatedAt: now
      };
      D.readerNotes.unshift(created);
      D.reader.currentNoteId = created.id;
      toast('Reader note saved');
    }

    save();
    renderReaderNotesList();
  };

  window.loadReaderNote = function loadReaderNote(id) {
    ensureData();
    const note = D.readerNotes.find(n => n.id === id);
    if (!note) return;

    D.reader.currentNoteId = note.id;
    D.reader.mode = note.mode || D.reader.mode || 'en-th';
    D.reader.deckId = note.deckId || D.reader.deckId || D.decks[0]?.id || '';
    D.reader.text = note.text || '';
    save();

    const input = document.getElementById('readerInput');
    if (input) {
      input.value = note.text || '';
      localStorage.setItem('wordjar_reader_note_v1', input.value);
    }

    closeO('readerNotesModal');
    closeO('readerNoteEditorModal');
    if (typeof nav === 'function') nav('reader');
    if (typeof renderReader === 'function') renderReader();
    toast('Reader note opened');
  };

  window.deleteReaderNote = function deleteReaderNote(id) {
    ensureData();
    const note = D.readerNotes.find(n => n.id === id);
    if (!note) return;
    if (!confirm(`Delete "${note.title || 'this note'}"?`)) return;
    D.readerNotes = D.readerNotes.filter(n => n.id !== id);
    if (D.reader.currentNoteId === id) D.reader.currentNoteId = '';
    save();
    closeO('readerNoteEditorModal');
    renderReaderNotesList();
    toast('Reader note deleted');
  };

  function ensureReaderNotesModal() {
    let modal = document.getElementById('readerNotesModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'readerNotesModal';
    modal.className = 'overlay reader-notes-modal';
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('readerNotesModal');
    });
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">Reader Notes</div>
            <div class="modal-subtitle" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;">Saved texts. Open, edit, or send back to Reader.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('readerNotesModal')" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <button class="btn btn-p" type="button" onclick="saveReaderNote()" style="margin-bottom:4px;">Save Current Reader Text</button>
        <div id="readerNotesList" class="reader-note-list"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function ensureReaderNoteEditorModal() {
    let modal = document.getElementById('readerNoteEditorModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'readerNoteEditorModal';
    modal.className = 'overlay reader-notes-modal';
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('readerNoteEditorModal');
    });
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">Edit Reader Note</div>
            <div class="modal-subtitle" id="readerNoteEditorSub" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;"></div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('readerNoteEditorModal')" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <input id="readerNoteTitleInput" class="reader-note-editor-title" placeholder="Title">
        <div class="reader-note-editor-grid">
          <select class="reader-select" id="readerNoteModeInput"><option value="en-th">EN → TH</option><option value="en-en">EN → EN</option></select>
          <select class="reader-select" id="readerNoteDeckInput"></select>
        </div>
        <textarea id="readerNoteTextInput" class="reader-note-editor-text" placeholder="Note text"></textarea>
        <div class="reader-note-editor-actions three">
          <button class="btn btn-s" type="button" id="readerNoteDeleteBtn">Delete</button>
          <button class="btn btn-s" type="button" id="readerNoteOpenBtn">Open in Reader</button>
          <button class="btn btn-p" type="button" id="readerNoteSaveBtn">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderReaderNotesList() {
    ensureData();
    ensureReaderNotesModal();
    const list = document.getElementById('readerNotesList');
    if (!list) return;

    if (!D.readerNotes.length) {
      list.innerHTML = '<div class="reader-empty">No saved notes yet. Save current Reader text first.</div>';
      return;
    }

    list.innerHTML = D.readerNotes.map(note => {
      const date = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : '';
      const words = (note.text.match(/[A-Za-z]+(?:[\'’-][A-Za-z]+)?/g) || []).length;
      return `
        <div class="reader-note-row" onclick="openReaderNoteEditor('${safeText(note.id)}')">
          <div class="reader-note-row-head">
            <div class="reader-note-row-title">${safeText(note.title || noteTitleFromText(note.text))}</div>
            <div class="reader-note-row-date">${safeText(date)}</div>
          </div>
          <div class="reader-note-row-text">${safeText(note.text || '')}</div>
          <div class="reader-note-row-meta">${safeText(note.mode || 'en-th')} · ${words} words</div>
        </div>
      `;
    }).join('');
  }

  window.openReaderNotesModal = function openReaderNotesModal() {
    ensureData();
    injectStyles();
    renderReaderNotesList();
    openO('readerNotesModal');
  };

  window.openReaderNoteEditor = function openReaderNoteEditor(id) {
    ensureData();
    const note = D.readerNotes.find(n => n.id === id);
    if (!note) return;

    ensureReaderNoteEditorModal();
    const title = document.getElementById('readerNoteTitleInput');
    const text = document.getElementById('readerNoteTextInput');
    const mode = document.getElementById('readerNoteModeInput');
    const deck = document.getElementById('readerNoteDeckInput');
    const sub = document.getElementById('readerNoteEditorSub');

    title.value = note.title || noteTitleFromText(note.text);
    text.value = note.text || '';
    mode.value = note.mode || 'en-th';
    deck.innerHTML = deckOptionsHtml(note.deckId || getSelectedDeckId());
    deck.value = note.deckId || getSelectedDeckId();
    sub.textContent = note.updatedAt ? `Updated ${new Date(note.updatedAt).toLocaleString()}` : '';

    document.getElementById('readerNoteDeleteBtn').onclick = () => deleteReaderNote(note.id);
    document.getElementById('readerNoteOpenBtn').onclick = () => {
      saveReaderNoteEditor(note.id, false);
      loadReaderNote(note.id);
    };
    document.getElementById('readerNoteSaveBtn').onclick = () => saveReaderNoteEditor(note.id, true);

    openO('readerNoteEditorModal');
  };

  function saveReaderNoteEditor(id, stayOpen) {
    ensureData();
    const note = D.readerNotes.find(n => n.id === id);
    if (!note) return;

    note.title = document.getElementById('readerNoteTitleInput').value.trim() || noteTitleFromText(document.getElementById('readerNoteTextInput').value);
    note.text = document.getElementById('readerNoteTextInput').value;
    note.mode = document.getElementById('readerNoteModeInput').value;
    note.deckId = document.getElementById('readerNoteDeckInput').value;
    note.updatedAt = new Date().toISOString();
    save();
    renderReaderNotesList();
    toast('Reader note saved');
    if (!stayOpen) closeO('readerNoteEditorModal');
  }

  async function openRichPanel(word, offset) {
    const panel = document.getElementById('readerPanel');
    if (!panel) return;

    const modeLabel = D.reader?.mode === 'en-en' ? 'EN → EN' : 'EN → TH';
    panel.innerHTML = `
      <div class="reader-panel-top">
        <div><div class="reader-word">${safeText(word)}</div><div class="reader-pron">Looking up · ${modeLabel}</div></div>
        <button class="btn-close" type="button" onclick="closeReaderPanel()" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="reader-loading-line">Checking dictionary, synonyms, and level...</div>
    `;
    panel.classList.add('open');

    const info = await lookupWordRich(word, false);
    const context = getSentenceContext(currentReaderText(), word, offset);
    const existsInDeck = D.words.some(w => normalizeWord(w.word) === normalizeWord(word) && String(w.deckId || '') === String(getSelectedDeckId()));
    const synonyms = info.synonyms?.length
      ? `<div class="reader-synonyms">${info.synonyms.map(s => `<span class="reader-synonym-chip">${safeText(s)}</span>`).join('')}</div>`
      : '<div class="reader-note">No synonyms found yet.</div>';

    panel.innerHTML = `
      <div class="reader-panel-top">
        <div>
          <div class="reader-word">${safeText(word)}<span class="reader-level-pill">${safeText(info.level || 'B1')}</span></div>
          <div class="reader-pron">${safeText(info.ipa || info.type || '')} · ${modeLabel} · ${safeText(info.source || 'local')}</div>
        </div>
        <button class="btn-close" type="button" onclick="closeReaderPanel()" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="reader-meaning">${safeText(info.meaning)}</div>
      ${synonyms}
      <div class="reader-context">${safeText(context || 'No context sentence found.')}</div>
      <div class="reader-actions three">
        <button class="btn btn-s" type="button" onclick="speak('${safeText(word)}')">Listen</button>
        <button class="btn btn-s" type="button" onclick="refreshReaderWord('${safeText(word)}', ${Number(offset) || 0})">Refresh</button>
        <button class="btn btn-p" type="button" onclick="addReaderWordToDeck('${safeText(word)}')">${existsInDeck ? 'Add Again' : 'Add to Deck'}</button>
      </div>
      <div class="reader-note">Example uses the surrounding sentence. Synonyms and level are saved in Notes.</div>
    `;
  }

  window.refreshReaderWord = async function refreshReaderWord(word, offset) {
    const key = normalizeWord(word);
    const cache = getCache();
    Object.keys(cache).forEach(k => { if (k.startsWith(`${key}:`)) delete cache[k]; });
    setCache(cache);
    toast('Refreshing word...');
    await openRichPanel(word, offset);
  };

  window.selectReaderWord = function selectReaderWordEnhanced(el) {
    const word = el.dataset.word || el.textContent || '';
    const offset = Number(el.dataset.offset || -1);
    document.querySelectorAll('.reader-token.active').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    openRichPanel(word, offset);
  };

  window.addReaderWordToDeck = async function addReaderWordToDeckEnhanced(word) {
    ensureData();
    const deckId = getSelectedDeckId();
    if (!deckId) return toast('Create a deck first');

    const info = await lookupWordRich(word, false);
    const context = getSentenceContext(currentReaderText(), word);
    const sameDeckExists = D.words.some(w => normalizeWord(w.word) === normalizeWord(word) && String(w.deckId || '') === String(deckId));
    if (sameDeckExists && !confirm('This word already exists in this deck. Add it again?')) return;

    const notes = [
      `Reader: ${D.reader.mode || 'en-th'}`,
      `Level: ${info.level || 'B1'}`,
      info.synonyms?.length ? `Synonyms: ${info.synonyms.join(', ')}` : 'Synonyms: none',
      info.source === 'none' ? 'Definition needs review' : `Source: ${info.source}`
    ].join('\n');

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
      deckId,
      lang: 'en',
      starred: false,
      addedDate: typeof today === 'function' ? today() : new Date().toISOString().split('T')[0],
      srsState: 'new',
      interval: 0,
      reps: 0,
      ef: 2.5,
      nextReview: null,
      dueAt: null,
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      elapsedDays: 0,
      lapses: 0
    });

    save();
    if (window.WordJarFSRS?.migrateAllCards) WordJarFSRS.migrateAllCards();
    if (typeof renderWords === 'function') renderWords();
    if (typeof renderDecks === 'function') renderDecks();
    if (typeof updateHome === 'function') updateHome();
    toast('Added from Reader');
    if (typeof renderReader === 'function') renderReader();
  };

  const originalRenderReader = window.renderReader;
  window.renderReader = function renderReaderWithNotesList() {
    if (typeof originalRenderReader === 'function') originalRenderReader();
    ensureData();
    injectStyles();
    removeInlineNotesCard();
    injectReaderTopActions();
  };

  ensureData();
  injectStyles();
  setTimeout(() => {
    removeInlineNotesCard();
    injectReaderTopActions();
  }, 0);
})();

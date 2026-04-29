// WordJar Reader V2
// Copy-Paste Reader inspired by Readlang / Language Reactor.
// Local-first: uses existing dictionary cards + a small built-in starter dictionary.
// V2 fixes Reader freezes by avoiding per-token D.words scans and exposing renderReaderTokens
// for the performance module.

(function installWordJarReader() {
  if (window.__wordjarReaderInstalled) return;
  window.__wordjarReaderInstalled = true;

  const READER_STORAGE_KEY = 'wordjar_reader_note_v1';
  const STARTER_DICT = {
    aggravate: { type: 'V', en: 'to make a situation worse; to annoy someone', th: 'ทำให้แย่ลง; ทำให้รำคาญ', ipa: '/ˈæɡ.rə.veɪt/' },
    wary: { type: 'ADJ', en: 'careful because something may be dangerous or cause problems', th: 'ระมัดระวัง เพราะอาจมีอันตรายหรือปัญหา', ipa: '/ˈweə.ri/' },
    ephemeral: { type: 'ADJ', en: 'lasting for only a short time', th: 'อยู่เพียงช่วงเวลาสั้น ๆ', ipa: '/ɪˈfem.ər.əl/' },
    consider: { type: 'V', en: 'to think carefully about something', th: 'พิจารณา; คิดอย่างรอบคอบ', ipa: '/kənˈsɪd.ər/' },
    improve: { type: 'V', en: 'to become better or make something better', th: 'ปรับปรุง; ทำให้ดีขึ้น', ipa: '/ɪmˈpruːv/' },
    context: { type: 'N', en: 'the situation or words around something that help explain it', th: 'บริบท; ข้อความหรือสถานการณ์แวดล้อม', ipa: '/ˈkɑːn.tekst/' },
    translate: { type: 'V', en: 'to change words from one language into another', th: 'แปลภาษา', ipa: '/trænzˈleɪt/' },
    sentence: { type: 'N', en: 'a group of words that expresses a complete thought', th: 'ประโยค', ipa: '/ˈsen.təns/' },
    meaning: { type: 'N', en: 'the idea or sense of a word or sentence', th: 'ความหมาย', ipa: '/ˈmiː.nɪŋ/' },
    note: { type: 'N', en: 'a short piece of writing to help remember something', th: 'บันทึกย่อ', ipa: '/noʊt/' },
    reader: { type: 'N', en: 'a tool or person that reads text', th: 'เครื่องมืออ่าน; ผู้อ่าน', ipa: '/ˈriː.dɚ/' },
    language: { type: 'N', en: 'a system of words used for communication', th: 'ภาษา', ipa: '/ˈlæŋ.ɡwɪdʒ/' },
    reactor: { type: 'N', en: 'a system that responds to input or activity', th: 'ระบบที่ตอบสนองต่อสิ่งที่เกิดขึ้น', ipa: '/riˈæk.tɚ/' },
    save: { type: 'V', en: 'to keep something for future use', th: 'บันทึก; เก็บไว้ใช้ภายหลัง', ipa: '/seɪv/' },
    deck: { type: 'N', en: 'a group of flashcards for study', th: 'ชุดแฟลชการ์ด', ipa: '/dek/' },
    flashcard: { type: 'N', en: 'a card used for memorizing information', th: 'แฟลชการ์ด; บัตรช่วยจำ', ipa: '/ˈflæʃ.kɑːrd/' }
  };

  let saveTimer = null;
  let knownWordCache = { size: -1, set: new Set(), map: new Map() };

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

  function ensureReaderData() {
    D.reader = D.reader || {};
    if (!D.reader.mode) D.reader.mode = 'en-th';
    if (!D.reader.deckId) D.reader.deckId = D.decks?.[0]?.id || '';
  }

  function injectStyles() {
    if (document.getElementById('readerStyle')) return;
    const style = document.createElement('style');
    style.id = 'readerStyle';
    style.textContent = `
      .reader-page { padding: 0 20px 24px; overflow-y:auto; }
      .reader-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 8px 0 12px; }
      .reader-title { font-size: 24px; font-weight: 900; color:var(--ink); letter-spacing:-.04em; }
      .reader-sub { color:var(--ink2); font-size:12px; font-weight:700; line-height:1.35; margin-top:2px; }
      .reader-card { background:var(--sur); border:1px solid var(--bdr); border-radius:20px; box-shadow:0 10px 24px rgba(0,0,0,.04); padding:14px; }
      .reader-toolbar { display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:10px; margin-bottom:10px; }
      .reader-select { width:100%; height:42px; border:1px solid var(--bdr); border-radius:14px; background:var(--sur); color:var(--ink); font-size:13px; font-weight:800; padding:0 11px; outline:none; }
      .reader-input { width:100%; min-height:180px; resize:vertical; border:0; outline:none; background:transparent; color:var(--ink); font: inherit; font-size:16px; line-height:1.62; padding:4px 0; }
      .reader-input::placeholder { color:var(--ink3); }
      .reader-meta { display:flex; justify-content:space-between; align-items:center; gap:10px; border-top:1px solid var(--bdr); padding-top:10px; color:var(--ink2); font-size:12px; font-weight:800; }
      .reader-view-card { margin-top:12px; }
      .reader-view-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
      .reader-view-title b { color:var(--ink); font-size:14px; }
      .reader-view-title span { color:var(--ink2); font-size:12px; font-weight:800; }
      .reader-tokens { font-size:17px; line-height:1.85; color:var(--ink); word-break:break-word; }
      .reader-token { display:inline; border-radius:8px; padding:1px 2px; cursor:pointer; }
      .reader-token:hover, .reader-token.active { background:var(--sur2); box-shadow:0 0 0 1px var(--bdr) inset; }
      .reader-token.known { text-decoration: underline; text-decoration-style:dotted; text-decoration-thickness:1px; text-underline-offset:3px; }
      .reader-panel { position:sticky; bottom:12px; margin-top:12px; background:rgba(255,255,255,.96); border:1px solid var(--bdr); border-radius:20px; box-shadow:0 14px 34px rgba(0,0,0,.12); padding:14px; backdrop-filter: blur(12px); display:none; z-index:5; }
      .reader-panel.open { display:block; }
      .reader-panel-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .reader-word { font-size:22px; font-weight:900; color:var(--ink); letter-spacing:-.03em; }
      .reader-pron { color:var(--ink2); font-size:13px; font-weight:750; margin-top:2px; }
      .reader-meaning { color:var(--ink); font-size:15px; line-height:1.45; margin-top:10px; font-weight:650; }
      .reader-context { color:var(--ink2); font-size:13px; line-height:1.45; margin-top:10px; border-left:3px solid var(--bdr); padding-left:10px; }
      .reader-actions { display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:13px; }
      .reader-actions .btn { min-width:0; padding:11px 10px; font-size:13px; border-radius:14px; }
      .reader-note { color:var(--ink2); font-size:12px; line-height:1.35; margin-top:10px; }
      .reader-empty { color:var(--ink2); font-size:13px; line-height:1.45; font-weight:700; }
      #tb-reader svg { width:22px; height:22px; }
    `;
    document.head.appendChild(style);
  }

  function injectNavButton() {
    if (document.getElementById('tb-reader')) return;
    const wordsBtn = document.getElementById('tb-words');
    if (!wordsBtn) return;

    const btn = document.createElement('button');
    btn.className = 'top-btn';
    btn.id = 'tb-reader';
    btn.type = 'button';
    btn.onclick = () => nav('reader');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`;
    wordsBtn.insertAdjacentElement('afterend', btn);
  }

  function injectPage() {
    if (document.getElementById('pg-reader')) return;
    const app = document.querySelector('.app');
    if (!app) return;

    const page = document.createElement('div');
    page.className = 'page reader-page';
    page.id = 'pg-reader';
    page.innerHTML = `
      <div class="reader-head">
        <div>
          <div class="reader-title">Reader</div>
          <div class="reader-sub">Paste text, tap words, save cards with context.</div>
        </div>
        <button class="btn btn-s" type="button" style="width:auto; padding:9px 13px; font-size:13px; border-radius:12px;" onclick="clearReaderText()">Clear</button>
      </div>
      <div class="reader-card">
        <div class="reader-toolbar">
          <select class="reader-select" id="readerMode" onchange="setReaderMode(this.value)">
            <option value="en-th">EN → TH</option>
            <option value="en-en">EN → EN</option>
          </select>
          <select class="reader-select" id="readerDeck" onchange="setReaderDeck(this.value)"></select>
        </div>
        <textarea id="readerInput" class="reader-input" placeholder="Paste or type English text here...\n\nTap words in Reader View below to translate and save them."></textarea>
        <div class="reader-meta">
          <span id="readerCount">0 words</span>
          <span>Local dictionary + your cards</span>
        </div>
      </div>
      <div class="reader-card reader-view-card">
        <div class="reader-view-title"><b>Reader View</b><span>Tap a word</span></div>
        <div id="readerTokens" class="reader-tokens"><div class="reader-empty">Your interactive text will appear here.</div></div>
      </div>
      <div id="readerPanel" class="reader-panel"></div>
    `;

    const account = document.getElementById('pg-account');
    if (account) account.insertAdjacentElement('beforebegin', page);
    else app.appendChild(page);
  }

  function patchNav() {
    if (window.__wordjarReaderNavPatched) return;
    window.__wordjarReaderNavPatched = true;
    const originalNav = window.nav;
    window.nav = function navWithReader(page) {
      const reader = document.getElementById('pg-reader');
      if (reader) reader.classList.remove('active');
      document.querySelectorAll('.top-btn').forEach(n => n.classList.remove('active'));

      if (page === 'reader') {
        document.querySelectorAll('.page, .study-page').forEach(el => el.classList.remove('active'));
        if (reader) reader.classList.add('active');
        const tb = document.getElementById('tb-reader');
        if (tb) tb.classList.add('active');
        const header = document.getElementById('mainHeader');
        if (header) header.style.display = 'flex';
        curPage = 'reader';
        renderReader();
        return;
      }

      if (typeof originalNav === 'function') originalNav(page);
    };
  }

  function normalizeWord(word) {
    return String(word || '').toLowerCase().replace(/^'+|'+$/g, '').trim();
  }

  function tokenize(text) {
    return String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|\d+|[^A-Za-z\d]+/g) || [];
  }

  function isWordToken(token) {
    return /^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(token);
  }

  function rebuildKnownWordCache() {
    const words = Array.isArray(D.words) ? D.words : [];
    if (knownWordCache.size === words.length) return knownWordCache;

    const set = new Set(Object.keys(STARTER_DICT));
    const map = new Map();
    words.forEach(card => {
      const key = normalizeWord(card?.word);
      if (!key) return;
      set.add(key);
      if (!map.has(key)) map.set(key, card);
    });
    knownWordCache = { size: words.length, set, map };
    return knownWordCache;
  }

  function localWordEntry(word) {
    const key = normalizeWord(word);
    const cache = rebuildKnownWordCache();
    const card = cache.map.get(key);
    if (card) {
      return {
        source: 'cards',
        word: card.word,
        type: card.type || 'N',
        ipa: card.pronunciation || '',
        en: card.meaning || '',
        th: card.notes?.startsWith('TH:') ? card.notes.replace(/^TH:\s*/i, '') : '',
        card
      };
    }
    const base = STARTER_DICT[key];
    if (base) return { source: 'starter', word: key, ...base };
    return null;
  }

  function deckOptionsHtml() {
    const selected = D.reader?.deckId || D.decks?.[0]?.id || '';
    return (D.decks || []).map(d => `<option value="${safeText(d.id)}" ${String(selected) === String(d.id) ? 'selected' : ''}>${safeText(d.name)}</option>`).join('');
  }

  function renderDeckSelect() {
    ensureReaderData();
    const select = document.getElementById('readerDeck');
    if (!select) return;
    select.innerHTML = deckOptionsHtml();
    if (D.reader.deckId && (D.decks || []).some(d => String(d.id) === String(D.reader.deckId))) select.value = D.reader.deckId;
    else if (D.decks?.[0]) {
      D.reader.deckId = D.decks[0].id;
      select.value = D.reader.deckId;
    }
  }

  function getSentenceContext(text, clickedWord, indexHint) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const key = normalizeWord(clickedWord);
    const lower = raw.toLowerCase();
    let pos = typeof indexHint === 'number' ? indexHint : lower.indexOf(key);
    if (pos < 0) pos = lower.indexOf(key);
    if (pos < 0) return raw.slice(0, 220);
    let start = Math.max(raw.lastIndexOf('.', pos), raw.lastIndexOf('!', pos), raw.lastIndexOf('?', pos));
    start = start < 0 ? 0 : start + 1;
    const endCandidates = ['.', '!', '?'].map(ch => raw.indexOf(ch, pos)).filter(n => n >= 0);
    const end = endCandidates.length ? Math.min(...endCandidates) + 1 : raw.length;
    return raw.slice(start, end).trim().slice(0, 260);
  }

  function currentReaderText() {
    return document.getElementById('readerInput')?.value || '';
  }

  function renderReaderTokens() {
    const text = currentReaderText();
    const tokensEl = document.getElementById('readerTokens');
    const countEl = document.getElementById('readerCount');
    if (!tokensEl) return;

    const tokens = tokenize(text);
    const known = rebuildKnownWordCache().set;
    let wordCount = 0;
    let offset = 0;

    if (!text.trim()) {
      if (countEl) countEl.textContent = '0 words';
      tokensEl.innerHTML = '<div class="reader-empty">Your interactive text will appear here.</div>';
      if (typeof closeReaderPanel === 'function') closeReaderPanel();
      return;
    }

    const html = tokens.map(token => {
      const start = offset;
      offset += token.length;
      if (!isWordToken(token)) return safeText(token);
      wordCount += 1;
      const key = normalizeWord(token);
      return `<span class="reader-token ${known.has(key) ? 'known' : ''}" data-word="${safeText(token)}" data-offset="${start}" onclick="selectReaderWord(this)">${safeText(token)}</span>`;
    }).join('');

    if (countEl) countEl.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'}`;
    tokensEl.innerHTML = html;
  }

  function lookupMeaning(word) {
    const entry = localWordEntry(word);
    const mode = D.reader?.mode || 'en-th';
    if (!entry) {
      return { word, type: 'N', ipa: '', meaning: mode === 'en-th' ? 'ยังไม่มีคำแปลในฐานข้อมูล local' : 'No local definition yet.', source: 'none' };
    }
    return {
      word: entry.word || word,
      type: entry.type || 'N',
      ipa: entry.ipa || '',
      meaning: mode === 'en-th' ? (entry.th || entry.en || 'ยังไม่มีคำแปลไทย') : (entry.en || entry.th || 'No local definition yet.'),
      source: entry.source || 'local',
      card: entry.card || null
    };
  }

  window.selectReaderWord = function selectReaderWord(el) {
    const word = el.dataset.word || el.textContent || '';
    const offset = Number(el.dataset.offset || -1);
    document.querySelectorAll('.reader-token.active').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    openReaderPanel(word, offset);
  };

  function openReaderPanel(word, offset) {
    const panel = document.getElementById('readerPanel');
    if (!panel) return;

    const text = currentReaderText();
    const context = getSentenceContext(text, word, offset);
    const info = lookupMeaning(word);
    const modeLabel = D.reader?.mode === 'en-en' ? 'EN → EN' : 'EN → TH';
    const key = normalizeWord(word);
    const deckId = String(D.reader?.deckId || '');
    const existsInDeck = (D.words || []).some(w => normalizeWord(w.word) === key && String(w.deckId || '') === deckId);

    panel.innerHTML = `
      <div class="reader-panel-top">
        <div>
          <div class="reader-word">${safeText(word)}</div>
          <div class="reader-pron">${safeText(info.ipa || info.type || '')} · ${modeLabel}</div>
        </div>
        <button class="btn-close" type="button" onclick="closeReaderPanel()" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="reader-meaning">${safeText(info.meaning)}</div>
      <div class="reader-context">${safeText(context || 'No context sentence found.')}</div>
      <div class="reader-actions">
        <button class="btn btn-s" type="button" onclick="speak('${safeText(word)}')">Listen</button>
        <button class="btn btn-p" type="button" onclick="addReaderWordToDeck('${safeText(word)}')">${existsInDeck ? 'Add Again' : 'Add to Deck'}</button>
      </div>
      <div class="reader-note">Example will use the surrounding sentence from your pasted text.</div>
    `;
    panel.classList.add('open');
  }

  window.closeReaderPanel = function closeReaderPanel() {
    const panel = document.getElementById('readerPanel');
    if (panel) panel.classList.remove('open');
    document.querySelectorAll('.reader-token.active').forEach(x => x.classList.remove('active'));
  };

  window.setReaderMode = function setReaderMode(mode) {
    ensureReaderData();
    D.reader.mode = mode === 'en-en' ? 'en-en' : 'en-th';
    save();
    const active = document.querySelector('.reader-token.active');
    if (active) openReaderPanel(active.dataset.word || active.textContent, Number(active.dataset.offset || -1));
  };

  window.setReaderDeck = function setReaderDeck(deckId) {
    ensureReaderData();
    D.reader.deckId = deckId;
    save();
    const active = document.querySelector('.reader-token.active');
    if (active) openReaderPanel(active.dataset.word || active.textContent, Number(active.dataset.offset || -1));
  };

  window.clearReaderText = function clearReaderText() {
    const input = document.getElementById('readerInput');
    if (!input) return;
    if (input.value.trim() && !confirm('Clear reader text?')) return;
    input.value = '';
    D.reader = D.reader || {};
    D.reader.text = '';
    localStorage.removeItem(READER_STORAGE_KEY);
    save();
    renderReaderTokens();
  };

  window.addReaderWordToDeck = function addReaderWordToDeck(word) {
    ensureReaderData();
    const deckId = D.reader.deckId || D.decks?.[0]?.id || '';
    if (!deckId) return toast('Create a deck first');

    const info = lookupMeaning(word);
    const context = getSentenceContext(currentReaderText(), word);
    const key = normalizeWord(word);
    const sameDeckExists = (D.words || []).some(w => normalizeWord(w.word) === key && String(w.deckId || '') === String(deckId));
    if (sameDeckExists && !confirm('This word already exists in this deck. Add it again?')) return;

    D.words.push({
      id: 'w' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      word: key,
      type: info.type || 'N',
      pronunciation: info.ipa || '',
      meaning: info.meaning || '',
      example: context || '',
      notes: [`Reader: ${D.reader.mode || 'en-th'}`, info.source === 'none' ? 'Definition needs review' : `Source: ${info.source}`].join('\n'),
      deckId,
      lang: 'en',
      starred: false,
      addedDate: typeof today === 'function' ? today() : new Date().toISOString().split('T')[0],
      srsState: 'new', interval: 0, reps: 0, ef: 2.5, nextReview: null, dueAt: null,
      stability: 0, difficulty: 0, scheduledDays: 0, elapsedDays: 0, lapses: 0
    });

    knownWordCache.size = -1;
    save();
    if (window.WordJarFSRS?.migrateAllCards) WordJarFSRS.migrateAllCards();
    if (typeof renderWords === 'function') renderWords();
    if (typeof renderDecks === 'function') renderDecks();
    if (typeof updateHome === 'function') updateHome();
    toast('Added from Reader');
    renderReaderTokens();
    const active = document.querySelector('.reader-token.active');
    if (active) openReaderPanel(active.dataset.word || active.textContent, Number(active.dataset.offset || -1));
  };

  function bindReaderInput(input) {
    if (!input || input.__wordjarReaderBound) return;
    input.value = localStorage.getItem(READER_STORAGE_KEY) || D.reader.text || '';
    input.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        D.reader.text = input.value;
        localStorage.setItem(READER_STORAGE_KEY, input.value);
        save();
        renderReaderTokens();
      }, 250);
    });
    input.__wordjarReaderBound = true;
  }

  function renderReader() {
    ensureReaderData();
    injectStyles();
    renderDeckSelect();

    const mode = document.getElementById('readerMode');
    if (mode) mode.value = D.reader.mode || 'en-th';

    const input = document.getElementById('readerInput');
    bindReaderInput(input);
    renderReaderTokens();
  }

  window.renderReaderTokens = renderReaderTokens;
  window.renderReader = renderReader;

  injectStyles();
  injectPage();
  injectNavButton();
  patchNav();
  setTimeout(renderReader, 0);
})();

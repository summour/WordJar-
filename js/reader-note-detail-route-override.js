// WordJar Reader Note Detail Route Override V2
// Renders the new Learning Note Detail directly and avoids the old detail route.

(function installReaderNoteDetailRouteOverride() {
  if (window.__wordjarReaderNoteDetailRouteOverrideInstalledV2) return;
  window.__wordjarReaderNoteDetailRouteOverrideInstalledV2 = true;
  window.__wordjarReaderNoteDetailRouteOverrideInstalled = true;

  const DEFAULT_FOLDER = 'uncategorized';
  const CUSTOM_SHEET_ID = 'rnCoreCustomSheet';
  const STYLE_ID = 'rnLearningDetailRouteStyle';
  let aiLoadPromise = null;
  let originalHandleRow = null;

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

  function ensureData() {
    window.D = window.D || {};
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    if (!Array.isArray(D.readerNoteFolders)) D.readerNoteFolders = [];
    D.readerNoteAnalyses = D.readerNoteAnalyses || {};
    D.reader.noteCustom = {
      mode: 'learning',
      fontSize: 'regular',
      lineHeight: 'comfortable',
      paragraphGap: 'regular',
      theme: 'light',
      showIPA: true,
      ipaPosition: 'above',
      ipaStandard: 'en-US',
      showTranslation: true,
      translationPosition: 'popup',
      translationStyle: 'natural',
      showGrammar: false,
      showCEFR: false,
      showPOS: false,
      showPhrases: true,
      focusMode: false,
      hideEasyWords: true,
      targetsOnly: false,
      delayedReveal: false,
      ...D.reader.noteCustom
    };
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function noteText(note) {
    return String(note?.text || plainFromHTML(note?.html || '') || '').trim();
  }

  function safeHTML(note) {
    if (note?.html) return String(note.html || '');
    return esc(noteText(note)).replace(/\n/g, '<br>');
  }

  function noteById(id) {
    ensureData();
    return D.readerNotes.find(note => String(note.id) === String(id));
  }

  function folderName(id) {
    if (!id || id === DEFAULT_FOLDER) return 'Notes';
    return D.readerNoteFolders.find(folder => String(folder.id) === String(id))?.name || 'Folder';
  }

  function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function dateObj(value) {
    const date = new Date(String(value || '').replace(' ', 'T'));
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function sameDay(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function shortDate(value) {
    const date = dateObj(value);
    if (!date) return '';
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(date, today)) return `Today · ${time}`;
    if (sameDay(date, yesterday)) return `Yesterday · ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
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
    return `${note.id}:${hashText(noteText(note))}`;
  }

  function analysisFor(note) {
    ensureData();
    return D.readerNoteAnalyses[analysisKey(note)] || null;
  }

  function custom() {
    ensureData();
    return D.reader.noteCustom;
  }

  function readerNotesPage() {
    let page = document.getElementById('readerNotesPage');
    if (!page) {
      page = document.createElement('div');
      page.id = 'readerNotesPage';
      page.className = 'rn-page';
      document.body.appendChild(page);
    }
    page.classList.add('active');
    document.body.style.overflow = 'hidden';
    return page;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #readerNotesPage .rn-learning-banner{margin:0 0 14px;border:1px solid var(--bdr);border-radius:18px;background:var(--sur2);padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      #readerNotesPage .rn-learning-banner-title{font-size:13px;font-weight:950;color:var(--ink)}
      #readerNotesPage .rn-learning-banner-sub{margin-top:3px;font-size:12px;line-height:1.35;font-weight:750;color:var(--ink2)}
      #readerNotesPage .rn-learning-chipline{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
      #readerNotesPage .rn-learning-chip{border:1px solid var(--bdr);border-radius:999px;background:var(--sur);color:var(--ink2);padding:6px 9px;font-size:11px;font-weight:900}
      #readerNotesPage .rn-core-custom-backdrop{position:absolute;inset:0;z-index:100020;background:rgba(0,0,0,.34);display:flex;align-items:flex-end}
      #readerNotesPage .rn-core-custom-sheet{width:100%;max-height:min(82vh,680px);overflow:auto;border-radius:26px 26px 0 0;border:1px solid var(--bdr);border-bottom:0;background:var(--bg);padding:12px 18px 22px;box-shadow:0 -18px 48px rgba(0,0,0,.18)}
      #readerNotesPage .rn-core-grabber{width:42px;height:5px;border-radius:999px;background:var(--ink2);opacity:.55;margin:2px auto 16px}
      #readerNotesPage .rn-core-title{font-size:24px;line-height:1.08;font-weight:950;letter-spacing:-.04em;margin-bottom:14px}
      #readerNotesPage .rn-core-section{margin:18px 0 0}
      #readerNotesPage .rn-core-section-title{color:var(--ink2);font-size:13px;font-weight:950;margin-bottom:8px}
      #readerNotesPage .rn-core-segment{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--bdr);border-radius:16px;overflow:hidden;background:var(--sur)}
      #readerNotesPage .rn-core-segment button{min-height:40px;border:0;border-right:1px solid var(--bdr);background:transparent;color:var(--ink);font-size:13px;font-weight:900}
      #readerNotesPage .rn-core-segment button:last-child{border-right:0}
      #readerNotesPage .rn-core-segment button.active{background:var(--brand,#2f7cf6);color:white}
      #readerNotesPage .rn-core-row{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid var(--bdr);background:transparent;color:var(--ink);width:100%;text-align:left}
      #readerNotesPage .rn-core-row:last-child{border-bottom:0}
      #readerNotesPage .rn-core-label{color:var(--ink);font-size:15px;font-weight:900}
      #readerNotesPage .rn-core-sub{display:block;color:var(--ink2);font-size:12px;font-weight:750;margin-top:2px}
      #readerNotesPage .rn-core-select{min-width:138px;min-height:36px;border:1px solid var(--bdr);border-radius:12px;background:var(--sur);color:var(--ink);padding:0 10px;font-size:13px;font-weight:850}
      #readerNotesPage .rn-core-toggle{width:52px;height:32px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur2);padding:3px;display:flex;align-items:center;justify-content:flex-start}
      #readerNotesPage .rn-core-toggle.on{justify-content:flex-end;background:var(--brand,#2f7cf6)}
      #readerNotesPage .rn-core-toggle span{width:24px;height:24px;border-radius:999px;background:white;box-shadow:0 2px 8px rgba(0,0,0,.16)}
    `;
    document.head.appendChild(style);
  }

  function banner(note) {
    const analysis = analysisFor(note);
    if (analysis?.status === 'completed') {
      const base = analysis.baseAnalysis || {};
      const words = Array.isArray(base.vocabulary) ? base.vocabulary.length : 0;
      const grammar = Array.isArray(base.grammarPoints) ? base.grammarPoints.length : 0;
      return `<div class="rn-learning-chipline"><span class="rn-learning-chip">AI ready</span><span class="rn-learning-chip">${words} words</span><span class="rn-learning-chip">${grammar} grammar</span><span class="rn-learning-chip">${esc(custom().ipaStandard)}</span></div>`;
    }
    if (analysis?.status === 'failed') {
      return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">AI analysis failed</div><div class="rn-learning-banner-sub">${esc(analysis.error || 'Retry analysis.')}</div></div><button class="rn-btn primary" type="button" data-rn-analyze="${esc(note.id)}">Retry</button></div>`;
    }
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">Analyze this note once.</div><div class="rn-learning-banner-sub">Cache IPA, translation, grammar, CEFR, phrases, and card candidates for this note.</div></div><button class="rn-btn primary" type="button" data-rn-analyze="${esc(note.id)}">Analyze</button></div>`;
  }

  function bodyHTML(note) {
    return safeHTML(note);
  }

  function renderLearningDetail(noteId) {
    ensureData();
    injectStyles();
    const note = noteById(noteId);
    if (!note) {
      window.renderReaderNotesListIOS?.();
      return;
    }

    const page = readerNotesPage();
    page.dataset.learningNoteId = note.id;
    page.innerHTML = `
      <div class="rn-top">
        <button class="rn-icon" type="button" onclick="renderReaderNotesListIOS()">‹</button>
        <div class="rn-right">
          <button id="rnCoreCustomBtn" class="rn-btn rn-aa-btn" type="button" data-rn-custom-open="1">Aa</button>
          <button class="rn-icon" type="button" onclick="showReaderNoteManageMenu('${esc(note.id)}')">⋯</button>
        </div>
      </div>
      <div class="rn-content rn-learning-core" data-note-id="${esc(note.id)}">
        <div class="rn-detail-title">${esc(note.title || 'Untitled note')}</div>
        <div class="rn-meta">${esc(shortDate(note.updatedAt || note.createdAt))} · ${wordCount(noteText(note))} words</div>
        <div class="rn-meta">Folder: ${esc(folderName(note.folderId || DEFAULT_FOLDER))}</div>
        <div id="rnCoreLearningBanner">${banner(note)}</div>
        <div class="rn-body">${bodyHTML(note)}</div>
      </div>
      <div class="rn-toolbar">
        <button class="rn-btn primary" type="button" onclick="editReaderNoteIOS('${esc(note.id)}')">Edit Note</button>
      </div>
    `;
  }

  function optionRow(key, title, options) {
    const c = custom();
    return `<div class="rn-core-row"><span class="rn-core-label">${esc(title)}</span><select class="rn-core-select" data-rn-custom-key="${esc(key)}">${options.map(opt => `<option value="${esc(opt.value)}" ${String(c[key]) === String(opt.value) ? 'selected' : ''}>${esc(opt.label)}</option>`).join('')}</select></div>`;
  }

  function toggleRow(key, title) {
    const on = !!custom()[key];
    return `<button class="rn-core-row" type="button" data-rn-toggle="${esc(key)}"><span class="rn-core-label">${esc(title)}</span><span class="rn-core-toggle ${on ? 'on' : ''}"><span></span></span></button>`;
  }

  function customSheetHTML() {
    const c = custom();
    return `<div id="${CUSTOM_SHEET_ID}" class="rn-core-custom-backdrop"><div class="rn-core-custom-sheet"><div class="rn-core-grabber"></div><div class="rn-core-title">Custom</div>
      <div class="rn-core-section"><div class="rn-core-section-title">Display Mode</div><div class="rn-core-segment">${['clean','learning','detailed'].map(mode => `<button type="button" class="${String(c.mode) === mode ? 'active' : ''}" data-rn-mode="${mode}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}</div></div>
      <div class="rn-core-section"><div class="rn-core-section-title">Text</div>${optionRow('fontSize','Font Size',[{value:'small',label:'Small'},{value:'regular',label:'Regular'},{value:'large',label:'Large'},{value:'xlarge',label:'Extra Large'}])}${optionRow('lineHeight','Line Height',[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'comfortable',label:'Comfortable'}])}${optionRow('paragraphGap','Paragraph Spacing',[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'wide',label:'Wide'}])}${optionRow('theme','Theme',[{value:'light',label:'Light'},{value:'warm',label:'Warm'},{value:'dark',label:'Dark'}])}</div>
      <div class="rn-core-section"><div class="rn-core-section-title">Learning Layer</div>${toggleRow('showIPA','IPA')}${toggleRow('showTranslation','Translation')}${toggleRow('showGrammar','Grammar Hints')}${toggleRow('showCEFR','CEFR Level')}${toggleRow('showPOS','Part of Speech')}${toggleRow('showPhrases','Phrase Highlights')}</div>
      <div class="rn-core-section"><div class="rn-core-section-title">Pronunciation</div>${optionRow('ipaStandard','Standard',[{value:'en-US',label:'American English'},{value:'en-GB',label:'British English'},{value:'en-RP',label:'Received Pronunciation'}])}${optionRow('ipaPosition','IPA Position',[{value:'above',label:'Above word'},{value:'below',label:'Below word'},{value:'inline',label:'Inline'},{value:'popup',label:'Popup only'}])}</div>
      <div class="rn-core-section"><div class="rn-core-section-title">Translation</div>${optionRow('translationPosition','Position',[{value:'popup',label:'Popup only'},{value:'sentence',label:'Under sentence'},{value:'paragraph',label:'Under paragraph'},{value:'inline',label:'Inline hint'}])}${optionRow('translationStyle','Style',[{value:'natural',label:'Natural'},{value:'literal',label:'Literal'},{value:'learning',label:'Learning-friendly'}])}</div>
    </div></div>`;
  }

  function openCustomSheet() {
    const page = document.getElementById('readerNotesPage');
    if (!page) return;
    document.getElementById(CUSTOM_SHEET_ID)?.remove();
    page.insertAdjacentHTML('beforeend', customSheetHTML());
  }

  function closeCustomSheet() {
    document.getElementById(CUSTOM_SHEET_ID)?.remove();
  }

  function setCustom(key, value) {
    ensureData();
    D.reader.noteCustom[key] = value;
    if (typeof save === 'function') save();
    const noteId = document.getElementById('readerNotesPage')?.dataset?.learningNoteId || '';
    if (noteId) renderLearningDetail(noteId);
    openCustomSheet();
  }

  function toggleCustom(key) {
    ensureData();
    D.reader.noteCustom[key] = !D.reader.noteCustom[key];
    if (typeof save === 'function') save();
    const noteId = document.getElementById('readerNotesPage')?.dataset?.learningNoteId || '';
    if (noteId) renderLearningDetail(noteId);
    openCustomSheet();
  }

  function loadAI() {
    if (window.__wordjarReaderNoteAIAnalysisInstalled) return Promise.resolve();
    if (aiLoadPromise) return aiLoadPromise;
    if (typeof loadWordJarModule !== 'function') return Promise.resolve();
    aiLoadPromise = loadWordJarModule('js/reader-note-ai-analysis.js').catch(err => {
      console.warn('Reader note AI module failed to load', err);
    });
    return aiLoadPromise;
  }

  function handleClick(event) {
    const customBtn = event.target.closest('[data-rn-custom-open]');
    if (customBtn) {
      event.preventDefault();
      openCustomSheet();
      return;
    }

    const analyzeBtn = event.target.closest('[data-rn-analyze]');
    if (analyzeBtn) {
      event.preventDefault();
      const noteId = analyzeBtn.dataset.rnAnalyze || document.getElementById('readerNotesPage')?.dataset?.learningNoteId || '';
      loadAI().then(() => window.analyzeReaderNoteLearning?.(noteId));
      return;
    }

    const sheet = document.getElementById(CUSTOM_SHEET_ID);
    if (sheet && event.target === sheet) {
      closeCustomSheet();
      return;
    }

    const mode = event.target.closest('[data-rn-mode]')?.dataset.rnMode;
    if (mode) {
      event.preventDefault();
      setCustom('mode', mode);
      return;
    }

    const toggle = event.target.closest('[data-rn-toggle]')?.dataset.rnToggle;
    if (toggle) {
      event.preventDefault();
      toggleCustom(toggle);
    }
  }

  function handleChange(event) {
    const key = event.target?.dataset?.rnCustomKey;
    if (key) setCustom(key, event.target.value);
  }

  function overrideHandleRow() {
    if (typeof window.handleReaderNoteRow !== 'function') return;
    if (window.handleReaderNoteRow.__learningRouteV2) return;

    originalHandleRow = originalHandleRow || window.handleReaderNoteRow;
    const next = function handleReaderNoteRowLearningRoute(id) {
      const isSelecting = !!document.querySelector('#readerNotesPage .rn-list.rn-selecting');
      if (isSelecting && originalHandleRow) return originalHandleRow.apply(this, arguments);
      renderLearningDetail(id);
    };
    next.__learningRouteV2 = true;
    window.handleReaderNoteRow = next;
  }

  function removeDuplicates() {
    const actions = document.querySelector('#readerNotesPage .rn-right');
    if (!actions) return;
    const aa = [...actions.querySelectorAll('button')].filter(button => (button.textContent || '').trim() === 'Aa');
    aa.forEach((button, index) => index > 0 && button.remove());
    [...actions.querySelectorAll('button')]
      .filter(button => /open in reader|open legacy reader/i.test(button.textContent || ''))
      .forEach(button => button.remove());
  }

  function boot() {
    ensureData();
    injectStyles();
    overrideHandleRow();
    removeDuplicates();
    loadAI();
  }

  window.renderReaderNoteLearningDetail = renderLearningDetail;
  window.openReaderNoteCustomSheet = openCustomSheet;
  window.closeReaderNoteCustomSheet = closeCustomSheet;
  window.setReaderNoteCustom = setCustom;
  window.toggleReaderNoteCustom = toggleCustom;

  document.addEventListener('click', handleClick, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('wordjar:note-detail-rendered', () => setTimeout(boot, 0));

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 350);
})();
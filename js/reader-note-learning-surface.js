// WordJar Note Learning Surface V1
// Turns Note Detail into the main reading + learning surface.

(function installReaderNoteLearningSurface() {
  if (window.__wordjarReaderNoteLearningSurfaceInstalled) return;
  window.__wordjarReaderNoteLearningSurfaceInstalled = true;

  const STYLE_ID = 'readerNoteLearningSurfaceStyle';
  const CUSTOM_SHEET_ID = 'rnCustomSheet';

  let activeNoteId = '';

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

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  function ensureData() {
    window.D = window.D || {};
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
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

  function noteById(id) {
    ensureData();
    return D.readerNotes.find(note => String(note.id) === String(id));
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function notePlain(note) {
    return String(note?.text || plainFromHTML(note?.html || '') || '').trim();
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

  function analysisFor(note) {
    ensureData();
    return D.readerNoteAnalyses[analysisKey(note)] || null;
  }

  function getCustom() {
    ensureData();
    return D.reader.noteCustom;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rn-learning-root { --rn-read-size:16px; --rn-read-line:1.72; --rn-read-gap:1.05em; }
      .rn-learning-root.size-small { --rn-read-size:15px; }
      .rn-learning-root.size-large { --rn-read-size:18px; }
      .rn-learning-root.size-xlarge { --rn-read-size:20px; }
      .rn-learning-root.line-compact { --rn-read-line:1.45; }
      .rn-learning-root.line-regular { --rn-read-line:1.62; }
      .rn-learning-root.line-comfortable { --rn-read-line:1.82; }
      .rn-learning-root.gap-compact { --rn-read-gap:.65em; }
      .rn-learning-root.gap-regular { --rn-read-gap:1em; }
      .rn-learning-root.gap-wide { --rn-read-gap:1.45em; }
      .rn-learning-root.theme-warm { background:#fbfaf2; }
      .rn-learning-root.theme-dark { background:#111318; color:#f4f4f5; }
      .rn-learning-root .rn-detail-body { font-size:var(--rn-read-size) !important; line-height:var(--rn-read-line) !important; }
      .rn-learning-root .rn-detail-body p,
      .rn-learning-root .rn-detail-body div { margin-bottom:var(--rn-read-gap); }
      .rn-aa-btn { min-width:46px; font-weight:950; letter-spacing:-.02em; }
      .rn-learning-banner { margin:0 0 14px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur2); padding:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .rn-learning-banner-title { font-size:13px; font-weight:950; color:var(--ink); }
      .rn-learning-banner-sub { margin-top:3px; font-size:12px; line-height:1.35; font-weight:750; color:var(--ink2); }
      .rn-learning-chipline { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 14px; }
      .rn-learning-chip { border:1px solid var(--bdr); border-radius:999px; background:var(--sur); color:var(--ink2); padding:6px 9px; font-size:11px; font-weight:900; }
      .rn-custom-backdrop { position:absolute; inset:0; z-index:12; background:rgba(0,0,0,.36); display:flex; align-items:flex-end; }
      .rn-custom-sheet { width:100%; max-height:min(82vh,680px); overflow:auto; border-radius:26px 26px 0 0; border:1px solid var(--bdr); border-bottom:0; background:var(--bg); padding:12px 18px 22px; box-shadow:0 -18px 48px rgba(0,0,0,.18); }
      .rn-custom-grabber { width:42px; height:5px; border-radius:999px; background:var(--ink2); opacity:.55; margin:2px auto 16px; }
      .rn-custom-title { font-size:24px; line-height:1.08; font-weight:950; letter-spacing:-.04em; margin-bottom:14px; }
      .rn-custom-section { margin:18px 0 0; }
      .rn-custom-section-title { color:var(--ink2); font-size:13px; font-weight:950; margin-bottom:8px; }
      .rn-custom-segment { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--bdr); border-radius:16px; overflow:hidden; background:var(--sur); }
      .rn-custom-segment button { min-height:40px; border:0; border-right:1px solid var(--bdr); background:transparent; color:var(--ink); font-size:13px; font-weight:900; }
      .rn-custom-segment button:last-child { border-right:0; }
      .rn-custom-segment button.active { background:var(--brand,#2f7cf6); color:white; }
      .rn-custom-row { min-height:54px; display:flex; align-items:center; justify-content:space-between; gap:14px; border-bottom:1px solid var(--bdr); }
      .rn-custom-row:last-child { border-bottom:0; }
      .rn-custom-label { color:var(--ink); font-size:15px; font-weight:900; }
      .rn-custom-sub { color:var(--ink2); font-size:12px; font-weight:750; margin-top:2px; }
      .rn-custom-select { min-width:138px; min-height:36px; border:1px solid var(--bdr); border-radius:12px; background:var(--sur); color:var(--ink); padding:0 10px; font-size:13px; font-weight:850; }
      .rn-custom-toggle { width:52px; height:32px; border:1px solid var(--bdr); border-radius:999px; background:var(--sur2); padding:3px; display:flex; align-items:center; justify-content:flex-start; }
      .rn-custom-toggle.on { justify-content:flex-end; background:var(--brand,#2f7cf6); }
      .rn-custom-toggle span { width:24px; height:24px; border-radius:999px; background:white; box-shadow:0 2px 8px rgba(0,0,0,.16); }
      .rn-menu button.rn-menu-muted { color:var(--ink2); }
    `;
    document.head.appendChild(style);
  }

  function rootClass() {
    const c = getCustom();
    return ['rn-content','rn-learning-root',`size-${c.fontSize}`,
      `line-${c.lineHeight}`,`gap-${c.paragraphGap}`,`theme-${c.theme}`,
      `mode-${c.mode}`].join(' ');
  }

  function analysisBanner(note) {
    const analysis = analysisFor(note);
    if (analysis?.status === 'completed') {
      const count = analysis.createdFrom === 'placeholder' ? 'structure ready' : 'AI ready';
      return `<div class="rn-learning-chipline"><span class="rn-learning-chip">${count}</span><span class="rn-learning-chip">${esc(getCustom().ipaStandard)}</span><span class="rn-learning-chip">${esc(getCustom().mode)}</span></div>`;
    }
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">Analyze this note once.</div><div class="rn-learning-banner-sub">This will cache IPA, translation, grammar, CEFR, phrases, and card candidates for this note.</div></div><button class="rn-text-btn primary" type="button" onclick="analyzeReaderNoteLearning('${esc(note.id)}')">Analyze</button></div>`;
  }

  function detailNoteFromDOM() {
    const noteId = document.querySelector('.rn-learning-root')?.dataset.noteId || activeNoteId;
    if (noteId) return noteById(noteId);
    const title = document.querySelector('#readerNotesBody .rn-detail-title')?.textContent || '';
    return D.readerNotes.find(note => String(note.title || '') === title) || null;
  }

  function patchDetailDOM() {
    ensureData();
    injectStyles();
    const content = document.querySelector('#readerNotesBody .rn-content');
    const actions = document.querySelector('#readerNotesBody .rn-actions');
    const body = document.querySelector('#readerNotesBody .rn-detail-body');
    if (!content || !actions || !body) return;
    const note = detailNoteFromDOM();
    if (!note) return;
    activeNoteId = note.id;
    content.className = rootClass();
    content.dataset.noteId = note.id;

    const readerBtn = [...actions.querySelectorAll('button')]
      .find(btn => /open in reader|reader/i.test(btn.textContent || ''));
    if (readerBtn) readerBtn.remove();
    if (!actions.querySelector('#rnCustomBtn')) {
      actions.insertAdjacentHTML('afterbegin', `<button id="rnCustomBtn" class="rn-text-btn rn-aa-btn" type="button" onclick="openReaderNoteCustomSheet('${esc(note.id)}')">Aa</button>`);
    }
    if (!document.getElementById('rnLearningBanner')) {
      body.insertAdjacentHTML('beforebegin', `<div id="rnLearningBanner">${analysisBanner(note)}</div>`);
    }
  }

  function selectedClass(value, option) {
    return String(value) === String(option) ? ' active' : '';
  }

  function selectRow(key, title, options, subtitle = '') {
    const c = getCustom();
    return `<div class="rn-custom-row"><span><span class="rn-custom-label">${esc(title)}</span>${subtitle ? `<span class="rn-custom-sub">${esc(subtitle)}</span>` : ''}</span><select class="rn-custom-select" onchange="setReaderNoteCustom('${esc(key)}', this.value)">${options.map(opt => `<option value="${esc(opt.value)}" ${String(c[key]) === String(opt.value) ? 'selected' : ''}>${esc(opt.label)}</option>`).join('')}</select></div>`;
  }

  function toggleRow(key, title, subtitle = '') {
    const on = !!getCustom()[key];
    return `<button class="rn-custom-row" type="button" onclick="toggleReaderNoteCustom('${esc(key)}')"><span><span class="rn-custom-label">${esc(title)}</span>${subtitle ? `<span class="rn-custom-sub">${esc(subtitle)}</span>` : ''}</span><span class="rn-custom-toggle ${on ? 'on' : ''}"><span></span></span></button>`;
  }

  function customSheetHTML() {
    const c = getCustom();
    return `<div id="${CUSTOM_SHEET_ID}" class="rn-custom-backdrop" onclick="closeReaderNoteCustomSheet(event)"><div class="rn-custom-sheet" onclick="event.stopPropagation()"><div class="rn-custom-grabber"></div><div class="rn-custom-title">Custom</div>
      <div class="rn-custom-section"><div class="rn-custom-section-title">Display Mode</div><div class="rn-custom-segment">${['clean','learning','detailed'].map(mode => `<button class="${selectedClass(c.mode, mode)}" type="button" onclick="setReaderNoteCustom('mode','${mode}')">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}</div></div>
      <div class="rn-custom-section"><div class="rn-custom-section-title">Text</div>${selectRow('fontSize','Font Size',[{value:'small',label:'Small'},{value:'regular',label:'Regular'},{value:'large',label:'Large'},{value:'xlarge',label:'Extra Large'}])}${selectRow('lineHeight','Line Height',[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'comfortable',label:'Comfortable'}])}${selectRow('paragraphGap','Paragraph Spacing',[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'wide',label:'Wide'}])}${selectRow('theme','Theme',[{value:'light',label:'Light'},{value:'warm',label:'Warm'},{value:'dark',label:'Dark'}])}</div>
      <div class="rn-custom-section"><div class="rn-custom-section-title">Learning Layer</div>${toggleRow('showIPA','IPA','Show phonetic symbols from analysis')}${toggleRow('showTranslation','Translation')}${toggleRow('showGrammar','Grammar Hints')}${toggleRow('showCEFR','CEFR Level')}${toggleRow('showPOS','Part of Speech')}${toggleRow('showPhrases','Phrase Highlights')}</div>
      <div class="rn-custom-section"><div class="rn-custom-section-title">Pronunciation</div>${selectRow('ipaStandard','Standard',[{value:'en-US',label:'American English'},{value:'en-GB',label:'British English'},{value:'en-RP',label:'Received Pronunciation'}])}${selectRow('ipaPosition','IPA Position',[{value:'above',label:'Above word'},{value:'below',label:'Below word'},{value:'inline',label:'Inline'},{value:'popup',label:'Popup only'}])}</div>
      <div class="rn-custom-section"><div class="rn-custom-section-title">Translation</div>${selectRow('translationPosition','Position',[{value:'popup',label:'Popup only'},{value:'sentence',label:'Under sentence'},{value:'paragraph',label:'Under paragraph'},{value:'inline',label:'Inline hint'}])}${selectRow('translationStyle','Style',[{value:'natural',label:'Natural'},{value:'literal',label:'Literal'},{value:'learning',label:'Learning-friendly'}])}</div>
      <div class="rn-custom-section"><div class="rn-custom-section-title">Focus</div>${toggleRow('focusMode','Focus Mode')}${toggleRow('hideEasyWords','Hide Easy Words')}${toggleRow('targetsOnly','Show Learning Targets Only')}${toggleRow('delayedReveal','Delayed Reveal')}</div>
    </div></div>`;
  }

  function saveNow() {
    if (typeof save === 'function') save();
    setTimeout(patchDetailDOM, 0);
  }

  function patchMenu() {
    const menu = document.getElementById('rnMenu');
    const note = detailNoteFromDOM();
    if (!menu || !note || menu.__learningPatched) return;
    menu.__learningPatched = true;
    const openReaderBtn = [...menu.querySelectorAll('button')]
      .find(btn => /open in reader/i.test(btn.textContent || ''));
    if (openReaderBtn) openReaderBtn.textContent = 'Open Legacy Reader';
    menu.insertAdjacentHTML('afterbegin', `<button type="button" onclick="analyzeReaderNoteLearning('${esc(note.id)}')">Analyze Note</button><button type="button" onclick="reanalyzeReaderNoteLearning('${esc(note.id)}')">Re-analyze Note</button><button type="button" onclick="updateReaderNoteIPAOnly('${esc(note.id)}')">Update IPA only</button><button class="rn-menu-muted" type="button" onclick="clearReaderNoteAnalysis('${esc(note.id)}')">Clear Analysis Cache</button>`);
  }

  window.openReaderNoteCustomSheet = function openReaderNoteCustomSheet(noteId = activeNoteId) {
    ensureData();
    injectStyles();
    activeNoteId = noteId || activeNoteId;
    document.getElementById(CUSTOM_SHEET_ID)?.remove();
    const body = document.getElementById('readerNotesBody');
    if (body) body.insertAdjacentHTML('beforeend', customSheetHTML());
  };

  window.closeReaderNoteCustomSheet = function closeReaderNoteCustomSheet(event) {
    if (event && event.target?.id !== CUSTOM_SHEET_ID) return;
    document.getElementById(CUSTOM_SHEET_ID)?.remove();
    setTimeout(patchDetailDOM, 0);
  };

  window.setReaderNoteCustom = function setReaderNoteCustom(key, value) {
    ensureData();
    D.reader.noteCustom[key] = value;
    saveNow();
    openReaderNoteCustomSheet(activeNoteId);
  };

  window.toggleReaderNoteCustom = function toggleReaderNoteCustom(key) {
    ensureData();
    D.reader.noteCustom[key] = !D.reader.noteCustom[key];
    saveNow();
    openReaderNoteCustomSheet(activeNoteId);
  };

  window.analyzeReaderNoteLearning = function analyzeReaderNoteLearning(noteId = activeNoteId) {
    const note = noteById(noteId);
    if (!note) return;
    D.readerNoteAnalyses[analysisKey(note)] = {
      status: 'completed',
      createdFrom: 'placeholder',
      noteId: note.id,
      contentHash: hashText(notePlain(note)),
      config: { ...getCustom() },
      document: {},
      baseAnalysis: { sentences: [], vocabulary: [], grammarPoints: [], phrases: [], learningTargets: [], cardCandidates: [] },
      pronunciationLayers: { [getCustom().ipaStandard]: { status: 'not_generated', items: {} } }
    };
    saveNow();
    const banner = document.getElementById('rnLearningBanner');
    if (banner) banner.innerHTML = analysisBanner(note);
    toastSafe('Learning cache structure created');
  };

  window.reanalyzeReaderNoteLearning = function reanalyzeReaderNoteLearning(noteId = activeNoteId) {
    const note = noteById(noteId);
    if (!note) return;
    delete D.readerNoteAnalyses[analysisKey(note)];
    window.analyzeReaderNoteLearning(noteId);
  };

  window.clearReaderNoteAnalysis = function clearReaderNoteAnalysis(noteId = activeNoteId) {
    const note = noteById(noteId);
    if (!note) return;
    delete D.readerNoteAnalyses[analysisKey(note)];
    saveNow();
    const banner = document.getElementById('rnLearningBanner');
    if (banner) banner.innerHTML = analysisBanner(note);
    toastSafe('Analysis cache cleared');
  };

  window.updateReaderNoteIPAOnly = function updateReaderNoteIPAOnly() {
    toastSafe('IPA-only generation is reserved for the AI layer step');
  };

  function boot() {
    ensureData();
    injectStyles();
    const root = document.getElementById('readerNotesBody') || document.body;
    new MutationObserver(() => setTimeout(() => { patchDetailDOM(); patchMenu(); }, 0))
      .observe(root, { childList: true, subtree: true });
    document.addEventListener('click', () => setTimeout(() => { patchDetailDOM(); patchMenu(); }, 0), true);
    setTimeout(patchDetailDOM, 0);
  }

  boot();
})();
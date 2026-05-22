// WordJar Note Learning Surface V2
// Turns Note Detail into the main reading + learning surface.

(function installReaderNoteLearningSurface() {
  if (window.__wordjarReaderNoteLearningSurfaceInstalled) return;
  window.__wordjarReaderNoteLearningSurfaceInstalled = true;

  const STYLE_ID = 'readerNoteLearningSurfaceStyle';
  const CUSTOM_SHEET_ID = 'rnCustomSheet';
  const AI_MODULE = 'js/reader-note-ai-analysis.js';

  let activeNoteId = '';
  let aiLoadPromise = null;

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

  function noteHTML(note) {
    if (note?.html) return String(note.html || '');
    return esc(notePlain(note)).replace(/\n/g, '<br>');
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
      .rn-ai-text { white-space:normal; }
      .rn-ai-para { margin:0 0 var(--rn-read-gap); }
      .rn-ai-token { display:inline-flex; flex-direction:column; align-items:center; vertical-align:baseline; border-radius:9px; padding:0 2px; margin:0 1px; cursor:pointer; }
      .rn-ai-token:active { background:rgba(0,122,255,.12); }
      .rn-ai-token.focus { box-shadow:0 0 0 1px var(--brand,#2f7cf6) inset; }
      .rn-ai-ipa { font-size:.68em; line-height:1; color:var(--brand,#2f7cf6); font-weight:850; margin-bottom:1px; }
      .rn-ai-word { line-height:1.1; }
      .rn-ai-hint { font-size:.7em; line-height:1.05; color:var(--ink2); font-weight:800; margin-top:2px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .rn-ai-token.inline { display:inline; }
      .rn-ai-token.inline .rn-ai-ipa { display:inline; margin:0 3px 0 0; }
      .rn-ai-translation { margin:7px 0 12px; padding:9px 11px; border:1px solid var(--bdr); border-radius:14px; background:var(--sur2); color:var(--ink2); font-size:.88em; font-weight:750; line-height:1.45; }
      .rn-ai-summary { margin:0 0 14px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur2); padding:12px; }
      .rn-ai-summary-title { font-size:13px; font-weight:950; color:var(--ink); margin-bottom:5px; }
      .rn-ai-summary-text { font-size:13px; line-height:1.48; color:var(--ink2); font-weight:750; }
      .rn-ai-insights { margin-top:16px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur2); overflow:hidden; }
      .rn-ai-insights-head { padding:12px 13px; font-size:13px; font-weight:950; color:var(--ink); border-bottom:1px solid var(--bdr); }
      .rn-ai-insight-row { padding:11px 13px; border-bottom:1px solid var(--bdr); font-size:13px; line-height:1.42; color:var(--ink2); }
      .rn-ai-insight-row:last-child { border-bottom:0; }
      .rn-ai-insight-row b { color:var(--ink); }
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
      const base = analysis.baseAnalysis || {};
      const words = Array.isArray(base.vocabulary) ? base.vocabulary.length : 0;
      const grammar = Array.isArray(base.grammarPoints) ? base.grammarPoints.length : 0;
      const label = analysis.createdFrom === 'placeholder' ? 'structure ready' : 'AI ready';
      return `<div class="rn-learning-chipline"><span class="rn-learning-chip">${label}</span><span class="rn-learning-chip">${words} words</span><span class="rn-learning-chip">${grammar} grammar</span><span class="rn-learning-chip">${esc(getCustom().ipaStandard)}</span><span class="rn-learning-chip">${esc(getCustom().mode)}</span></div>`;
    }
    if (analysis?.status === 'failed') {
      return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">AI analysis failed</div><div class="rn-learning-banner-sub">${esc(analysis.error || 'Retry analysis.')}</div></div><button class="rn-text-btn primary" type="button" onclick="analyzeReaderNoteLearning('${esc(note.id)}')">Retry</button></div>`;
    }
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">Analyze this note once.</div><div class="rn-learning-banner-sub">This will cache IPA, translation, grammar, CEFR, phrases, and card candidates for this note.</div></div><button class="rn-text-btn primary" type="button" onclick="analyzeReaderNoteLearning('${esc(note.id)}')">Analyze</button></div>`;
  }

  function detailNoteFromDOM() {
    const noteId = document.querySelector('.rn-learning-root')?.dataset.noteId || activeNoteId;
    if (noteId) return noteById(noteId);
    const title = document.querySelector('#readerNotesBody .rn-detail-title')?.textContent || '';
    return D.readerNotes.find(note => String(note.title || '') === title) || null;
  }

  function vocabularyMap(analysis) {
    const vocab = analysis?.baseAnalysis?.vocabulary || [];
    const map = new Map();
    vocab.forEach(item => {
      const keys = [item.display, item.lemma]
        .map(value => String(value || '').toLowerCase().trim())
        .filter(Boolean);
      keys.forEach(key => map.set(key, item));
    });
    return map;
  }

  function ipaFor(item, analysis) {
    const standard = getCustom().ipaStandard;
    const layered = analysis?.pronunciationLayers?.[standard]?.items?.[item.id];
    return layered || item.ipa || '';
  }

  function tokenHTML(word, item, analysis) {
    const c = getCustom();
    const classes = ['rn-ai-token'];
    if (c.ipaPosition === 'inline') classes.push('inline');
    if (c.focusMode) classes.push('focus');

    const ipa = c.showIPA && c.ipaPosition !== 'popup' ? ipaFor(item, analysis) : '';
    const meaning = c.showTranslation && c.translationPosition === 'inline'
      ? item.translationThai || item.meaningInContextThai || ''
      : '';
    const cefr = c.showCEFR && item.cefr ? ` · ${item.cefr}` : '';
    const pos = c.showPOS && item.pos ? ` · ${item.pos}` : '';

    return `<span class="${classes.join(' ')}" data-vocab-id="${esc(item.id || '')}" title="${esc([item.translationThai, item.pos, item.cefr].filter(Boolean).join(' · '))}">${ipa ? `<span class="rn-ai-ipa">${esc(ipa)}</span>` : ''}<span class="rn-ai-word">${esc(word)}</span>${meaning ? `<span class="rn-ai-hint">${esc(meaning)}</span>` : ''}${cefr || pos ? `<span class="rn-ai-hint">${esc(`${pos}${cefr}`.replace(/^ · /, ''))}</span>` : ''}</span>`;
  }

  function renderParagraphText(text, analysis) {
    const c = getCustom();
    if (c.mode === 'clean') return esc(text);
    const map = vocabularyMap(analysis);
    const parts = String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|[^A-Za-z]+/g) || [];
    return parts.map(part => {
      if (!/^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(part)) return esc(part);
      const item = map.get(part.toLowerCase());
      if (!item) return esc(part);
      if (c.targetsOnly && item.isLearningTarget === false) return esc(part);
      if (c.hideEasyWords && item.showByDefault === false) return esc(part);
      return tokenHTML(part, item, analysis);
    }).join('');
  }

  function sentenceTranslationsHTML(analysis) {
    const c = getCustom();
    if (!c.showTranslation || c.translationPosition !== 'sentence') return '';
    const sentences = analysis?.baseAnalysis?.sentences || [];
    return sentences.slice(0, 12).map(sentence => {
      const text = sentence.naturalThai || sentence.translationThai || '';
      if (!text) return '';
      return `<div class="rn-ai-translation">${esc(text)}</div>`;
    }).join('');
  }

  function insightsHTML(analysis) {
    const c = getCustom();
    const base = analysis?.baseAnalysis || {};
    const rows = [];
    if (c.showGrammar) {
      (base.grammarPoints || []).slice(0, 5).forEach(item => {
        rows.push(`<div class="rn-ai-insight-row"><b>${esc(item.title || item.pattern || 'Grammar')}</b><br>${esc(item.explanationThai || item.pattern || '')}</div>`);
      });
    }
    if (c.showPhrases) {
      (base.phrases || []).slice(0, 5).forEach(item => {
        rows.push(`<div class="rn-ai-insight-row"><b>${esc(item.text || 'Phrase')}</b><br>${esc(item.meaningThai || item.translationThai || '')}</div>`);
      });
    }
    if (!rows.length) return '';
    return `<div class="rn-ai-insights"><div class="rn-ai-insights-head">Learning notes</div>${rows.join('')}</div>`;
  }

  function summaryHTML(analysis) {
    const doc = analysis?.document || {};
    const text = doc.summaryThai || doc.summarySimple || '';
    if (!text || getCustom().mode === 'clean') return '';
    return `<div class="rn-ai-summary"><div class="rn-ai-summary-title">Summary</div><div class="rn-ai-summary-text">${esc(text)}</div></div>`;
  }

  function renderLearningBody(note, body) {
    const analysis = analysisFor(note);
    const c = getCustom();
    if (!analysis || analysis.status !== 'completed' || c.mode === 'clean') {
      body.innerHTML = noteHTML(note);
      return;
    }

    const paragraphs = notePlain(note)
      .split(/\n{2,}|\n/)
      .map(part => part.trim())
      .filter(Boolean);
    const rendered = paragraphs.map(part => `<p class="rn-ai-para">${renderParagraphText(part, analysis)}</p>`).join('');
    body.innerHTML = `${summaryHTML(analysis)}<div class="rn-ai-text">${rendered}</div>${sentenceTranslationsHTML(analysis)}${insightsHTML(analysis)}`;
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

    const banner = document.getElementById('rnLearningBanner');
    if (banner) banner.innerHTML = analysisBanner(note);
    else body.insertAdjacentHTML('beforebegin', `<div id="rnLearningBanner">${analysisBanner(note)}</div>`);

    renderLearningBody(note, body);
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

  function loadAIAnalysisModule() {
    if (window.__wordjarReaderNoteAIAnalysisInstalled) return Promise.resolve();
    if (aiLoadPromise) return aiLoadPromise;
    if (typeof loadWordJarModule !== 'function') return Promise.resolve();
    aiLoadPromise = loadWordJarModule(AI_MODULE).catch(err => {
      console.warn('Reader note AI module failed to load', err);
    });
    return aiLoadPromise;
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

  function fallbackAnalyze(noteId = activeNoteId) {
    loadAIAnalysisModule().then(() => {
      if (window.analyzeReaderNoteLearning !== fallbackAnalyze) {
        window.analyzeReaderNoteLearning(noteId);
        return;
      }
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
      toastSafe('Learning cache structure created');
    });
  }

  window.analyzeReaderNoteLearning = fallbackAnalyze;

  window.reanalyzeReaderNoteLearning = function reanalyzeReaderNoteLearning(noteId = activeNoteId) {
    loadAIAnalysisModule().then(() => {
      const note = noteById(noteId);
      if (!note) return;
      delete D.readerNoteAnalyses[analysisKey(note)];
      if (typeof save === 'function') save();
      window.analyzeReaderNoteLearning(noteId);
    });
  };

  window.clearReaderNoteAnalysis = function clearReaderNoteAnalysis(noteId = activeNoteId) {
    const note = noteById(noteId);
    if (!note) return;
    delete D.readerNoteAnalyses[analysisKey(note)];
    saveNow();
    toastSafe('Analysis cache cleared');
  };

  window.updateReaderNoteIPAOnly = function updateReaderNoteIPAOnly(noteId = activeNoteId) {
    loadAIAnalysisModule().then(() => {
      if (window.__wordjarReaderNoteAIAnalysisInstalled) {
        window.updateReaderNoteIPAOnly(noteId);
        return;
      }
      toastSafe('Analyze the note first');
    });
  };

  function boot() {
    ensureData();
    injectStyles();
    loadAIAnalysisModule();
    const root = document.getElementById('readerNotesBody') || document.body;
    new MutationObserver(() => setTimeout(() => { patchDetailDOM(); patchMenu(); }, 0))
      .observe(root, { childList: true, subtree: true });
    document.addEventListener('click', () => setTimeout(() => { patchDetailDOM(); patchMenu(); }, 0), true);
    setTimeout(patchDetailDOM, 0);
  }

  boot();
})();
// WordJar Reader Note Detail Core Bridge V1
// Bridges the learning surface to Reader Notes Core V2 (#readerNotesPage).

(function installReaderNoteDetailCoreBridge() {
  if (window.__wordjarReaderNoteDetailCoreBridgeInstalled) return;
  window.__wordjarReaderNoteDetailCoreBridgeInstalled = true;

  const STYLE_ID = 'readerNoteDetailCoreBridgeStyle';

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

  function noteHTML(note) {
    if (note?.html) return String(note.html || '');
    return esc(noteText(note)).replace(/\n/g, '<br>');
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

  function currentNote() {
    ensureData();
    const page = document.getElementById('readerNotesPage');
    const id = page?.dataset?.learningNoteId || page?.querySelector('.rn-learning-core')?.dataset?.noteId;
    if (id) return D.readerNotes.find(note => String(note.id) === String(id));

    const title = page?.querySelector('.rn-detail-title')?.textContent || '';
    const meta = page?.querySelector('.rn-meta')?.textContent || '';
    return D.readerNotes.find(note => {
      const noteTitle = String(note.title || 'Untitled note');
      return noteTitle === title && meta.includes(String(noteText(note).trim().split(/\s+/).filter(Boolean).length));
    }) || D.readerNotes.find(note => String(note.title || 'Untitled note') === title) || null;
  }

  function custom() {
    ensureData();
    return D.reader.noteCustom;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #readerNotesPage .rn-content.rn-learning-core {
        --rn-read-size: 16px;
        --rn-read-line: 1.72;
        --rn-read-gap: 1.05em;
      }
      #readerNotesPage .rn-content.rn-learning-core.size-small { --rn-read-size:15px; }
      #readerNotesPage .rn-content.rn-learning-core.size-large { --rn-read-size:18px; }
      #readerNotesPage .rn-content.rn-learning-core.size-xlarge { --rn-read-size:20px; }
      #readerNotesPage .rn-content.rn-learning-core.line-compact { --rn-read-line:1.45; }
      #readerNotesPage .rn-content.rn-learning-core.line-regular { --rn-read-line:1.62; }
      #readerNotesPage .rn-content.rn-learning-core.line-comfortable { --rn-read-line:1.82; }
      #readerNotesPage .rn-content.rn-learning-core.gap-compact { --rn-read-gap:.65em; }
      #readerNotesPage .rn-content.rn-learning-core.gap-regular { --rn-read-gap:1em; }
      #readerNotesPage .rn-content.rn-learning-core.gap-wide { --rn-read-gap:1.45em; }
      #readerNotesPage .rn-content.rn-learning-core.theme-warm { background:#fbfaf2; }
      #readerNotesPage .rn-content.rn-learning-core.theme-dark { background:#111318; color:#f4f4f5; }
      #readerNotesPage .rn-learning-core .rn-body { font-size:var(--rn-read-size) !important; line-height:var(--rn-read-line) !important; }
      #readerNotesPage .rn-learning-core .rn-body p { margin-bottom:var(--rn-read-gap); }
      #readerNotesPage .rn-aa-btn { min-width:46px; font-weight:950; letter-spacing:-.02em; }
      #readerNotesPage .rn-learning-banner { margin:0 0 14px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur2); padding:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
      #readerNotesPage .rn-learning-banner-title { font-size:13px; font-weight:950; color:var(--ink); }
      #readerNotesPage .rn-learning-banner-sub { margin-top:3px; font-size:12px; line-height:1.35; font-weight:750; color:var(--ink2); }
      #readerNotesPage .rn-learning-chipline { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 14px; }
      #readerNotesPage .rn-learning-chip { border:1px solid var(--bdr); border-radius:999px; background:var(--sur); color:var(--ink2); padding:6px 9px; font-size:11px; font-weight:900; }
      #readerNotesPage .rn-ai-token { display:inline-flex; flex-direction:column; align-items:center; vertical-align:baseline; border-radius:9px; padding:0 2px; margin:0 1px; cursor:pointer; }
      #readerNotesPage .rn-ai-token:active { background:rgba(0,122,255,.12); }
      #readerNotesPage .rn-ai-ipa { font-size:.68em; line-height:1; color:var(--brand,#2f7cf6); font-weight:850; margin-bottom:1px; }
      #readerNotesPage .rn-ai-word { line-height:1.1; }
      #readerNotesPage .rn-ai-hint { font-size:.7em; line-height:1.05; color:var(--ink2); font-weight:800; margin-top:2px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #readerNotesPage .rn-ai-token.inline { display:inline; }
      #readerNotesPage .rn-ai-token.inline .rn-ai-ipa { display:inline; margin:0 3px 0 0; }
      #readerNotesPage .rn-ai-summary,
      #readerNotesPage .rn-ai-insights { margin:0 0 14px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur2); padding:12px; }
      #readerNotesPage .rn-ai-summary-title,
      #readerNotesPage .rn-ai-insights-head { font-size:13px; font-weight:950; color:var(--ink); margin-bottom:5px; }
      #readerNotesPage .rn-ai-summary-text,
      #readerNotesPage .rn-ai-insight-row { font-size:13px; line-height:1.48; color:var(--ink2); font-weight:750; }
      #readerNotesPage .rn-ai-translation { margin:7px 0 12px; padding:9px 11px; border:1px solid var(--bdr); border-radius:14px; background:var(--sur2); color:var(--ink2); font-size:.88em; font-weight:750; line-height:1.45; }
    `;
    document.head.appendChild(style);
  }

  function rootClass() {
    const c = custom();
    return ['rn-content', 'rn-learning-core', `size-${c.fontSize}`,
      `line-${c.lineHeight}`, `gap-${c.paragraphGap}`, `theme-${c.theme}`,
      `mode-${c.mode}`].join(' ');
  }

  function banner(note) {
    const analysis = analysisFor(note);
    if (analysis?.status === 'completed') {
      const base = analysis.baseAnalysis || {};
      const words = Array.isArray(base.vocabulary) ? base.vocabulary.length : 0;
      const grammar = Array.isArray(base.grammarPoints) ? base.grammarPoints.length : 0;
      const label = analysis.createdFrom === 'placeholder' ? 'structure ready' : 'AI ready';
      return `<div class="rn-learning-chipline"><span class="rn-learning-chip">${label}</span><span class="rn-learning-chip">${words} words</span><span class="rn-learning-chip">${grammar} grammar</span><span class="rn-learning-chip">${esc(custom().ipaStandard)}</span><span class="rn-learning-chip">${esc(custom().mode)}</span></div>`;
    }
    if (analysis?.status === 'failed') {
      return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">AI analysis failed</div><div class="rn-learning-banner-sub">${esc(analysis.error || 'Retry analysis.')}</div></div><button class="rn-btn primary" type="button" onclick="analyzeReaderNoteLearning('${esc(note.id)}')">Retry</button></div>`;
    }
    return `<div class="rn-learning-banner"><div><div class="rn-learning-banner-title">Analyze this note once.</div><div class="rn-learning-banner-sub">Cache IPA, translation, grammar, CEFR, phrases, and card candidates for this note.</div></div><button class="rn-btn primary" type="button" onclick="analyzeReaderNoteLearning('${esc(note.id)}')">Analyze</button></div>`;
  }

  function vocabMap(analysis) {
    const map = new Map();
    (analysis?.baseAnalysis?.vocabulary || []).forEach(item => {
      [item.display, item.lemma].map(v => String(v || '').toLowerCase().trim())
        .filter(Boolean).forEach(key => map.set(key, item));
    });
    return map;
  }

  function ipaFor(item, analysis) {
    const standard = custom().ipaStandard;
    return analysis?.pronunciationLayers?.[standard]?.items?.[item.id] || item.ipa || '';
  }

  function tokenHTML(word, item, analysis) {
    const c = custom();
    const classes = ['rn-ai-token'];
    if (c.ipaPosition === 'inline') classes.push('inline');
    const ipa = c.showIPA && c.ipaPosition !== 'popup' ? ipaFor(item, analysis) : '';
    const meaning = c.showTranslation && c.translationPosition === 'inline'
      ? item.translationThai || item.meaningInContextThai || '' : '';
    const cefr = c.showCEFR && item.cefr ? item.cefr : '';
    const pos = c.showPOS && item.pos ? item.pos : '';
    const meta = [pos, cefr].filter(Boolean).join(' · ');
    return `<span class="${classes.join(' ')}" data-vocab-id="${esc(item.id || '')}" title="${esc([item.translationThai, item.pos, item.cefr].filter(Boolean).join(' · '))}">${ipa ? `<span class="rn-ai-ipa">${esc(ipa)}</span>` : ''}<span class="rn-ai-word">${esc(word)}</span>${meaning ? `<span class="rn-ai-hint">${esc(meaning)}</span>` : ''}${meta ? `<span class="rn-ai-hint">${esc(meta)}</span>` : ''}</span>`;
  }

  function renderText(text, analysis) {
    const c = custom();
    if (c.mode === 'clean') return esc(text);
    const map = vocabMap(analysis);
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

  function summaryHTML(analysis) {
    const doc = analysis?.document || {};
    const text = doc.summaryThai || doc.summarySimple || '';
    if (!text || custom().mode === 'clean') return '';
    return `<div class="rn-ai-summary"><div class="rn-ai-summary-title">Summary</div><div class="rn-ai-summary-text">${esc(text)}</div></div>`;
  }

  function translationsHTML(analysis) {
    if (!custom().showTranslation || custom().translationPosition !== 'sentence') return '';
    return (analysis?.baseAnalysis?.sentences || []).slice(0, 12).map(sentence => {
      const text = sentence.naturalThai || sentence.translationThai || '';
      return text ? `<div class="rn-ai-translation">${esc(text)}</div>` : '';
    }).join('');
  }

  function insightsHTML(analysis) {
    const rows = [];
    if (custom().showGrammar) {
      (analysis?.baseAnalysis?.grammarPoints || []).slice(0, 5).forEach(item => {
        rows.push(`<div class="rn-ai-insight-row"><b>${esc(item.title || item.pattern || 'Grammar')}</b><br>${esc(item.explanationThai || item.pattern || '')}</div>`);
      });
    }
    if (custom().showPhrases) {
      (analysis?.baseAnalysis?.phrases || []).slice(0, 5).forEach(item => {
        rows.push(`<div class="rn-ai-insight-row"><b>${esc(item.text || 'Phrase')}</b><br>${esc(item.meaningThai || item.translationThai || '')}</div>`);
      });
    }
    return rows.length ? `<div class="rn-ai-insights"><div class="rn-ai-insights-head">Learning notes</div>${rows.join('')}</div>` : '';
  }

  function renderBody(note, body) {
    const analysis = analysisFor(note);
    if (!analysis || analysis.status !== 'completed' || custom().mode === 'clean') {
      body.innerHTML = noteHTML(note);
      return;
    }
    const paragraphs = noteText(note).split(/\n{2,}|\n/).map(v => v.trim()).filter(Boolean);
    const html = paragraphs.map(part => `<p>${renderText(part, analysis)}</p>`).join('');
    body.innerHTML = `${summaryHTML(analysis)}${html}${translationsHTML(analysis)}${insightsHTML(analysis)}`;
  }

  function patch() {
    ensureData();
    injectStyles();
    const page = document.getElementById('readerNotesPage');
    if (!page?.classList.contains('active')) return;

    const content = page.querySelector('.rn-content');
    const body = page.querySelector('.rn-body');
    const actions = page.querySelector('.rn-right');
    const title = page.querySelector('.rn-detail-title');
    if (!content || !body || !actions || !title) return;

    const note = currentNote();
    if (!note) return;

    page.dataset.learningNoteId = note.id;
    content.className = rootClass();
    content.dataset.noteId = note.id;

    [...actions.querySelectorAll('button')]
      .filter(button => /open in reader|reader/i.test(button.textContent || ''))
      .forEach(button => button.remove());

    if (!actions.querySelector('#rnCoreCustomBtn')) {
      actions.insertAdjacentHTML('afterbegin', `<button id="rnCoreCustomBtn" class="rn-btn rn-aa-btn" type="button" onclick="openReaderNoteCustomSheet('${esc(note.id)}')">Aa</button>`);
    }

    const existing = page.querySelector('#rnCoreLearningBanner');
    if (existing) existing.innerHTML = banner(note);
    else body.insertAdjacentHTML('beforebegin', `<div id="rnCoreLearningBanner">${banner(note)}</div>`);

    renderBody(note, body);
  }

  function boot() {
    injectStyles();
    const observer = new MutationObserver(() => setTimeout(patch, 0));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', () => setTimeout(patch, 0), true);
    setTimeout(patch, 0);
    setTimeout(patch, 350);
  }

  boot();
})();
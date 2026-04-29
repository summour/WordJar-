// WordJar FSRS Scheduler V2
// Uses the official open-spaced-repetition/ts-fsrs browser ESM build.
// Owns flashcard scheduling, due queues, review logs, and deck study counts.

(function installWordJarFSRSModule() {
  if (window.__wordjarFSRSInstallStarted) return;
  window.__wordjarFSRSInstallStarted = true;

  const TS_FSRS_CDN = 'https://cdn.jsdelivr.net/npm/ts-fsrs@latest/+esm';
  const REQUEST_RETENTION = 0.9;
  const MAX_INTERVAL = 36500;
  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const NO_DECK_NAME = typeof SYSTEM_NO_DECK_NAME !== 'undefined' ? SYSTEM_NO_DECK_NAME : 'No Deck';

  function todayISO() {
    if (typeof today === 'function') return today();
    return new Date().toISOString().split('T')[0];
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

  function ensureFSRSSettings() {
    D.settings = D.settings || {};
    D.settings.fsrs = D.settings.fsrs || {};
    if (D.settings.fsrs.requestRetention === undefined) D.settings.fsrs.requestRetention = REQUEST_RETENTION;
    if (D.settings.fsrs.maximumInterval === undefined) D.settings.fsrs.maximumInterval = MAX_INTERVAL;
    if (!Array.isArray(D.reviewLog)) D.reviewLog = [];
  }

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
  }

  function realDeckExists(deckId) {
    return D.decks.some(d => String(d.id) === String(deckId));
  }

  function normalizeDeckIds() {
    if (typeof normalizeWordDeckIds === 'function') normalizeWordDeckIds();
    D.words.forEach(w => {
      if (!w.deckId || (!realDeckExists(w.deckId) && !isNoDeck(w.deckId))) w.deckId = NO_DECK_ID;
    });
  }

  function cardDeckId(w) {
    if (!w || !w.deckId || (!realDeckExists(w.deckId) && !isNoDeck(w.deckId))) return NO_DECK_ID;
    return String(w.deckId);
  }

  function wordsForDeck(deckId) {
    if (!deckId) return D.words;
    if (isNoDeck(deckId)) return D.words.filter(w => isNoDeck(w.deckId) || !realDeckExists(w.deckId));
    return D.words.filter(w => String(w.deckId) === String(deckId));
  }

  function deckOptions(deckId) {
    const d = D.decks.find(x => String(x.id) === String(deckId));
    return d?.options || {
      newPerDay: 25,
      revPerDay: 999,
      ignoreRev: false,
      learnSteps: '1m 10m',
      reLearnSteps: '10m'
    };
  }

  function parseSteps(value, fallback) {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const steps = text.split(/\s+/).filter(Boolean);
    return steps.length ? steps : fallback;
  }

  function makeScheduler(tsfsrs, deckId) {
    const opts = deckOptions(deckId);
    return tsfsrs.fsrs({
      request_retention: Number(D.settings?.fsrs?.requestRetention || REQUEST_RETENTION),
      maximum_interval: Number(D.settings?.fsrs?.maximumInterval || MAX_INTERVAL),
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: parseSteps(opts.learnSteps, ['1m', '10m']),
      relearning_steps: parseSteps(opts.reLearnSteps, ['10m'])
    });
  }

  function toFsrsState(tsfsrs, state) {
    const State = tsfsrs.State || {};
    const normalized = String(state || 'new').toLowerCase();
    if (normalized === 'learning') return State.Learning ?? 1;
    if (normalized === 'review') return State.Review ?? 2;
    if (normalized === 'relearning') return State.Relearning ?? 3;
    return State.New ?? 0;
  }

  function fromFsrsState(tsfsrs, state) {
    const State = tsfsrs.State || {};
    if (state === State.Learning || state === 1) return 'learning';
    if (state === State.Review || state === 2) return 'review';
    if (state === State.Relearning || state === 3) return 'relearning';
    return 'new';
  }

  function toDate(value, fallback = new Date()) {
    if (!value) return fallback;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? fallback : d;
  }

  function dateOnly(date) {
    return toDate(date).toISOString().split('T')[0];
  }

  function makeFsrsCard(tsfsrs, w) {
    migrateCard(w);
    return {
      due: toDate(w.dueAt || w.nextReview, new Date()),
      stability: Number(w.stability || 0),
      difficulty: Number(w.difficulty || 0),
      elapsed_days: Number(w.elapsedDays || 0),
      scheduled_days: Number(w.scheduledDays || w.interval || 0),
      reps: Number(w.reps || 0),
      lapses: Number(w.lapses || 0),
      state: toFsrsState(tsfsrs, w.srsState),
      last_review: w.lastReview ? toDate(w.lastReview, null) : undefined
    };
  }

  function applyFsrsCard(tsfsrs, w, card) {
    w.dueAt = toDate(card.due).toISOString();
    w.nextReview = dateOnly(card.due);
    w.stability = Number(card.stability || 0);
    w.difficulty = Number(card.difficulty || 0);
    w.elapsedDays = Number(card.elapsed_days || 0);
    w.scheduledDays = Number(card.scheduled_days || 0);
    w.interval = Math.max(0, Number(card.scheduled_days || 0));
    w.reps = Number(card.reps || 0);
    w.lapses = Number(card.lapses || 0);
    w.srsState = fromFsrsState(tsfsrs, card.state);
    w.lastReview = card.last_review ? toDate(card.last_review).toISOString() : new Date().toISOString();
    if (w.learningStep === undefined || w.learningStep === null) w.learningStep = 0;
  }

  function migrateCard(w) {
    if (!w) return;
    if (!w.srsState) w.srsState = (w.reps || 0) > 0 || w.nextReview ? 'review' : 'new';
    if (w.interval === undefined || w.interval === null) w.interval = Number(w.scheduledDays || 0) || 0;
    if (w.scheduledDays === undefined || w.scheduledDays === null) w.scheduledDays = Number(w.interval || 0);
    if (w.reps === undefined || w.reps === null) w.reps = 0;
    if (w.lapses === undefined || w.lapses === null) w.lapses = 0;
    if (w.elapsedDays === undefined || w.elapsedDays === null) w.elapsedDays = 0;
    if (!w.dueAt && w.nextReview) w.dueAt = `${w.nextReview}T00:00:00.000Z`;
    if (!w.dueAt && w.srsState !== 'new') w.dueAt = new Date().toISOString();
    if (w.learningStep === undefined || w.learningStep === null) w.learningStep = 0;
  }

  function migrateAllCards() {
    ensureFSRSSettings();
    normalizeDeckIds();
    D.words.forEach(migrateCard);
  }

  function isDueCard(w) {
    migrateCard(w);
    if (w.srsState === 'new') return true;
    if (!w.dueAt && !w.nextReview) return true;
    if (w.dueAt) return new Date(w.dueAt).getTime() <= Date.now();
    return String(w.nextReview) <= todayISO();
  }

  function calcDeckStats(deckId) {
    migrateAllCards();
    const opts = deckOptions(deckId);
    const newLimit = Math.max(0, Number(opts.newPerDay ?? 25));
    const revLimit = opts.ignoreRev ? 999999 : Math.max(0, Number(opts.revPerDay ?? 999));
    let newAll = 0, lrnC = 0, revAll = 0;

    wordsForDeck(deckId).forEach(w => {
      migrateCard(w);
      if (w.srsState === 'new') newAll++;
      else if (isDueCard(w) && (w.srsState === 'learning' || w.srsState === 'relearning')) lrnC++;
      else if (isDueCard(w)) revAll++;
    });

    return {
      newC: Math.min(newAll, newLimit),
      lrnC,
      dueC: Math.min(revAll, revLimit),
      total: wordsForDeck(deckId).length,
      newAll,
      revAll
    };
  }

  function dueQueue(deckId) {
    migrateAllCards();
    const opts = deckOptions(deckId);
    const newLimit = Math.max(0, Number(opts.newPerDay ?? 25));
    const revLimit = opts.ignoreRev ? 999999 : Math.max(0, Number(opts.revPerDay ?? 999));
    const learning = [];
    const review = [];
    const fresh = [];

    wordsForDeck(deckId).forEach(w => {
      migrateCard(w);
      if (w.srsState === 'new') fresh.push(w);
      else if (isDueCard(w) && (w.srsState === 'learning' || w.srsState === 'relearning')) learning.push(w);
      else if (isDueCard(w)) review.push(w);
    });

    learning.sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
    review.sort((a, b) => new Date(a.dueAt || a.nextReview || 0) - new Date(b.dueAt || b.nextReview || 0));
    return [...learning, ...review.slice(0, revLimit), ...fresh.slice(0, newLimit)];
  }

  function ratingFromOldValue(tsfsrs, q) {
    const Rating = tsfsrs.Rating || {};
    if (q === 0) return Rating.Again ?? 1;
    if (q === 3) return Rating.Hard ?? 2;
    if (q === 4) return Rating.Good ?? 3;
    return Rating.Easy ?? 4;
  }

  function ratingName(tsfsrs, rating) {
    const Rating = tsfsrs.Rating || {};
    if (rating === Rating.Again || rating === 1) return 'again';
    if (rating === Rating.Hard || rating === 2) return 'hard';
    if (rating === Rating.Good || rating === 3) return 'good';
    return 'easy';
  }

  function gradeCard(w, q) {
    const tsfsrs = window.tsfsrs;
    if (!tsfsrs) {
      toast('FSRS is still loading');
      return false;
    }

    migrateCard(w);
    const scheduler = makeScheduler(tsfsrs, cardDeckId(w));
    const rating = ratingFromOldValue(tsfsrs, q);
    const before = {
      state: w.srsState,
      dueAt: w.dueAt || '',
      interval: Number(w.interval || 0),
      stability: w.stability || null,
      difficulty: w.difficulty || null
    };

    const result = scheduler.next(makeFsrsCard(tsfsrs, w), new Date(), rating);
    applyFsrsCard(tsfsrs, w, result.card);

    const log = result.log || {};
    D.reviewLog.push({
      cardId: w.id,
      deckId: cardDeckId(w),
      reviewedAt: toDate(log.review || new Date()).toISOString(),
      rating: ratingName(tsfsrs, rating),
      previousState: before.state,
      nextState: w.srsState,
      elapsedDays: Number(w.elapsedDays || 0),
      scheduledDays: Number(w.scheduledDays || 0),
      stability: Number(w.stability || 0),
      difficulty: Number(w.difficulty || 0),
      source: 'ts-fsrs'
    });

    return true;
  }

  function deckName(deckId) {
    if (isNoDeck(deckId)) return NO_DECK_NAME;
    if (typeof getDeckName === 'function') return getDeckName(deckId);
    return D.decks.find(d => String(d.id) === String(deckId))?.name || '';
  }

  function deckCardHtml(d) {
    const stats = calcDeckStats(d.id);
    const draggingClass = window.__wordjarDraggingDeckId === String(d.id) ? ' deck-dragging-card' : '';
    return `<div class="deck-card deck-reorderable${draggingClass}" data-deck-id="${safeText(d.id)}" onclick="showDeckOverview('${safeText(d.id)}')">
      <div class="deck-info">
        <div class="deck-name" style="color: ${d.color || 'var(--ink)'}">${safeText(d.name)}</div>
        <div class="deck-stats"><span class="d-stat">New <b>${stats.newC}</b></span><span class="d-stat">Learn <b>${stats.lrnC}</b></span><span class="d-stat">Due <b>${stats.dueC}</b></span></div>
      </div>
      <div class="deck-gear" onclick="openDeckMenu('${safeText(d.id)}', event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></div>
    </div>`;
  }

  function systemDeckCardHtml() {
    const stats = calcDeckStats(NO_DECK_ID);
    return `<div class="deck-card system-deck-card" data-system-deck="true" onclick="showDeckOverview('${NO_DECK_ID}')">
      <div class="deck-info">
        <div class="deck-name" style="color: var(--ink)">${NO_DECK_NAME} <span class="d-stat" style="margin-left:8px;">System</span></div>
        <div class="deck-stats"><span class="d-stat">New <b>${stats.newC}</b></span><span class="d-stat">Learn <b>${stats.lrnC}</b></span><span class="d-stat">Due <b>${stats.dueC}</b></span></div>
      </div>
    </div>`;
  }

  function installScheduler(tsfsrs) {
    window.tsfsrs = tsfsrs;

    window.WordJarFSRS = {
      calcDeckStats,
      dueQueue,
      gradeCard,
      migrateAllCards,
      isDueCard,
      library: 'ts-fsrs'
    };

    window.isDue = isDueCard;
    window.sm2 = gradeCard;

    window.startFC = function startFCFSRS(deckIdOverride) {
      const dId = deckIdOverride !== undefined ? deckIdOverride : currentStudyDeckId;
      const queue = dueQueue(dId || null);
      if (!queue.length) {
        toast('No cards due now');
        return;
      }
      fcQ = queue;
      fcI = 0;
      nav('fc');
      renderFC();
    };

    window.startDeckSession = function startDeckSessionFSRS() {
      startFC(currentStudyDeckId);
    };

    window.renderFC = function renderFCFSRS() {
      const done = document.getElementById('fcDone');
      const main = document.getElementById('fcMain');
      if (!done || !main) return;

      if (fcI >= fcQ.length) {
        main.style.display = 'none';
        done.style.display = 'flex';
        return;
      }

      main.style.display = 'flex';
      done.style.display = 'none';

      const w = fcQ[fcI];
      migrateCard(w);

      let remN = 0, remL = 0, remR = 0;
      for (let i = fcI; i < fcQ.length; i++) {
        const cw = fcQ[i];
        migrateCard(cw);
        if (cw.srsState === 'new') remN++;
        else if (cw.srsState === 'learning' || cw.srsState === 'relearning') remL++;
        else remR++;
      }

      document.getElementById('fcStatsTop').innerHTML = `<span class="fc-s-n">${remN}</span><span class="fc-s-plus">+</span><span class="fc-s-l">${remL}</span><span class="fc-s-plus">+</span><span class="fc-s-r">${remR}</span>`;
      document.getElementById('fcCardInner').classList.remove('flipped');

      const deckTagHtml = `<div class="tag-pill">${safeText(deckName(cardDeckId(w)))}</div>`;
      const typeTagHtml = `<div class="tag-pill">${safeText((w.type || 'N').split(',')[0].toUpperCase())}</div>`;
      document.getElementById('fcTagsF').innerHTML = deckTagHtml + typeTagHtml;
      document.getElementById('fcTagsB').innerHTML = deckTagHtml + typeTagHtml;
      document.getElementById('fcWordF').textContent = w.word;
      document.getElementById('fcPronF').textContent = w.pronunciation || '';
      document.getElementById('fcWordB').textContent = w.word;
      document.getElementById('fcPronB').textContent = w.pronunciation || '';
      document.getElementById('fcMeaning').textContent = w.meaning;

      const ex = document.getElementById('fcEx');
      ex.textContent = w.example ? `"${w.example}"` : '';
      document.getElementById('fcExWrap').style.display = w.example ? 'block' : 'none';

      const ntWrap = document.getElementById('fcNtWrap');
      const nt = document.getElementById('fcNt');
      if (w.notes && w.notes.trim() !== '' && w.notes.trim() !== '-') {
        nt.textContent = w.notes;
        ntWrap.style.display = 'block';
      } else {
        ntWrap.style.display = 'none';
      }

      const btnEx = document.getElementById('fcPlayEx');
      if (btnEx) btnEx.style.display = w.example ? 'flex' : 'none';
      if (D.profile?.autoPlay) setTimeout(() => speak(w.word), 150);
    };

    window.rateFC = function rateFCFSRS(q) {
      const w = fcQ[fcI];
      if (!w) return;

      if (!gradeCard(w, q)) return;
      D.todayDone = Number(D.todayDone || 0) + 1;
      if (typeof markStudied === 'function') markStudied();

      save();
      fcI++;
      renderFC();
      if (typeof updateHome === 'function') updateHome();
      if (typeof renderDecks === 'function') renderDecks();
    };

    window.renderDecks = function renderDecksFSRS() {
      D.settings = D.settings || {};
      if (D.settings.showSystemNoDeck === undefined) D.settings.showSystemNoDeck = true;
      normalizeDeckIds();
      migrateAllCards();

      const el = document.getElementById('deckList');
      if (!el) return;

      const parts = D.decks.map(deckCardHtml);
      if (D.settings.showSystemNoDeck !== false) parts.push(systemDeckCardHtml());

      if (!parts.length) {
        el.innerHTML = '<div class="empty"><div class="empty-title">No Decks</div><div class="empty-sub">Turn on Show No Deck in Account to show the protected system deck.</div></div>';
        return;
      }

      el.innerHTML = `<div class="deck-grid">${parts.join('')}</div>`;
    };

    window.showDeckOverview = function showDeckOverviewFSRS(deckId) {
      currentStudyDeckId = deckId;
      const isSystem = isNoDeck(deckId);
      const d = isSystem
        ? { id: NO_DECK_ID, name: NO_DECK_NAME, desc: 'System deck for cards without a user deck.', color: 'var(--ink)' }
        : D.decks.find(x => String(x.id) === String(deckId));
      if (!d) return;

      const stats = calcDeckStats(deckId);
      document.getElementById('ovTitle').textContent = d.name;
      document.getElementById('ovTitle').style.color = d.color || 'var(--ink)';
      document.getElementById('ovDesc').textContent = d.desc || '';
      document.getElementById('ovNew').textContent = stats.newC;
      document.getElementById('ovLrn').textContent = stats.lrnC;
      document.getElementById('ovRev').textContent = stats.dueC;
      document.getElementById('ovTotal').textContent = stats.total;

      const optBtn = document.querySelector('#pg-deck-overview button[onclick^="openDeckOptionsModal"]');
      if (optBtn) optBtn.style.display = isSystem ? 'none' : 'flex';

      nav('deck-overview');
    };

    migrateAllCards();
    save();
    if (typeof renderDecks === 'function') renderDecks();
  }

  import(TS_FSRS_CDN)
    .then(installScheduler)
    .catch(err => {
      console.error('Failed to load ts-fsrs', err);
      toast('FSRS library failed to load');
    });
})();

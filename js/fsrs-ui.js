// WordJar FSRS UI V1
// Shows live ts-fsrs interval previews on Again / Hard / Good / Easy buttons.

(function installWordJarFSRSUI() {
  if (window.__wordjarFSRSUIInstalled) return;
  window.__wordjarFSRSUIInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const DEFAULT_RETENTION = 0.9;
  const DEFAULT_MAX_INTERVAL = 36500;

  function injectStyles() {
    if (document.getElementById('fsrsUiStyle')) return;
    const style = document.createElement('style');
    style.id = 'fsrsUiStyle';
    style.textContent = `
      .rb .rs.fsrs-loading { opacity:.55; }
      .study-mode-note { margin: 8px 0 0; color: var(--ink2); font-size: 11px; font-weight: 700; line-height: 1.35; text-align: center; }
    `;
    document.head.appendChild(style);
  }

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
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

  function cardDeckId(w) {
    if (!w?.deckId) return NO_DECK_ID;
    if (isNoDeck(w.deckId)) return NO_DECK_ID;
    return D.decks.some(d => String(d.id) === String(w.deckId)) ? String(w.deckId) : NO_DECK_ID;
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
      request_retention: Number(D.settings?.fsrs?.requestRetention || DEFAULT_RETENTION),
      maximum_interval: Number(D.settings?.fsrs?.maximumInterval || DEFAULT_MAX_INTERVAL),
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

  function toDate(value, fallback = new Date()) {
    if (!value) return fallback;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? fallback : d;
  }

  function makeFsrsCard(tsfsrs, w) {
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

  function formatDueLabel(due) {
    const dueDate = toDate(due);
    const diffMs = dueDate.getTime() - Date.now();
    const absMs = Math.max(0, diffMs);
    const min = Math.ceil(absMs / 60000);
    const hour = Math.ceil(absMs / 3600000);
    const day = Math.ceil(absMs / 86400000);

    if (min <= 1) return '<1m';
    if (min < 60) return `${min}m`;
    if (hour < 24) return `${hour}h`;
    if (day < 31) return `${day}d`;
    if (day < 365) return `${Math.round(day / 30)}mo`;
    return `${Math.round(day / 365)}y`;
  }

  function setRatingLabels(labels, loading = false) {
    const again = document.querySelector('.rb-a .rs');
    const hard = document.querySelector('.rb-h .rs');
    const good = document.querySelector('.rb-g .rs');
    const easy = document.querySelector('.rb-e .rs');
    const pairs = [
      [again, labels.again],
      [hard, labels.hard],
      [good, labels.good],
      [easy, labels.easy]
    ];

    pairs.forEach(([el, label]) => {
      if (!el) return;
      el.textContent = label;
      el.classList.toggle('fsrs-loading', loading);
    });
  }

  function updateRatingPreview() {
    injectStyles();

    if (!Array.isArray(fcQ) || fcI >= fcQ.length) return;
    const w = fcQ[fcI];
    if (!w) return;

    if (!window.tsfsrs) {
      setRatingLabels({ again: '...', hard: '...', good: '...', easy: '...' }, true);
      return;
    }

    try {
      const tsfsrs = window.tsfsrs;
      const scheduler = makeScheduler(tsfsrs, cardDeckId(w));
      const preview = scheduler.repeat(makeFsrsCard(tsfsrs, w), new Date());
      const Rating = tsfsrs.Rating || {};
      const again = preview[Rating.Again ?? 1]?.card?.due;
      const hard = preview[Rating.Hard ?? 2]?.card?.due;
      const good = preview[Rating.Good ?? 3]?.card?.due;
      const easy = preview[Rating.Easy ?? 4]?.card?.due;

      setRatingLabels({
        again: formatDueLabel(again),
        hard: formatDueLabel(hard),
        good: formatDueLabel(good),
        easy: formatDueLabel(easy)
      }, false);
    } catch (err) {
      setRatingLabels({ again: '<1m', hard: '10m', good: '1d', easy: '4d' }, false);
    }
  }

  function addStudyModeNote() {
    injectStyles();
    const area = document.querySelector('#pg-learn #lMain .fc-action-area');
    if (!area || document.getElementById('studyModeFSRSNote')) return;
    const note = document.createElement('div');
    note.id = 'studyModeFSRSNote';
    note.className = 'study-mode-note';
    note.textContent = 'Study Mode is preview only. Use Flashcard review for FSRS scheduling.';
    area.appendChild(note);
  }

  const previousRenderFC = window.renderFC;
  window.renderFC = function renderFCWithFSRSPreview() {
    if (typeof previousRenderFC === 'function') previousRenderFC();
    updateRatingPreview();
  };

  const previousRenderLearn = window.renderLearn;
  window.renderLearn = function renderLearnWithFSRSNote() {
    if (typeof previousRenderLearn === 'function') previousRenderLearn();
    addStudyModeNote();
  };

  window.WordJarFSRSUI = { updateRatingPreview };
  setTimeout(updateRatingPreview, 0);
  setTimeout(addStudyModeNote, 0);
})();

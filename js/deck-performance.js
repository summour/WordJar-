// WordJar Deck Performance V2
// Renders deck stats with one pass over words and reuses cached stats between unchanged renders.

(function installDeckPerformance() {
  if (window.__wordjarDeckPerformanceInstalled) return;
  window.__wordjarDeckPerformanceInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const NO_DECK_NAME = typeof SYSTEM_NO_DECK_NAME !== 'undefined' ? SYSTEM_NO_DECK_NAME : 'No Deck';

  let cachedStatsKey = '';
  let cachedStatsMap = null;
  let normalizedAtKey = '';

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

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
  }

  function deckIdSet() {
    return new Set(D.decks.map(d => String(d.id)));
  }

  function normalizedDeckId(deckId, ids) {
    if (!deckId || isNoDeck(deckId) || !ids.has(String(deckId))) return NO_DECK_ID;
    return String(deckId);
  }

  function deckOptions(deckId) {
    const d = D.decks.find(x => String(x.id) === String(deckId));
    return d?.options || { newPerDay: 25, revPerDay: 999, ignoreRev: false };
  }

  function isDueCard(w) {
    if (window.WordJarFSRS?.isDueCard) return WordJarFSRS.isDueCard(w);
    if ((w.reps || 0) === 0) return true;
    if (!w.dueAt && !w.nextReview) return true;
    if (w.dueAt) return new Date(w.dueAt).getTime() <= Date.now();
    return String(w.nextReview) <= new Date().toISOString().slice(0, 10);
  }

  function emptyStats() {
    return { newAll: 0, lrnC: 0, revAll: 0, total: 0 };
  }

  function statsSignature() {
    const deckSig = D.decks.map(d => `${d.id}:${d.name}:${JSON.stringify(d.options || {})}`).join('|');
    const wordSig = D.words.map(w => [
      w.id, w.deckId, w.srsState, w.reps, w.dueAt, w.nextReview,
      w.scheduledDays, w.interval, w.lapses, w.updatedAt || ''
    ].join(':')).join('|');
    return `${deckSig}::${wordSig}::${D.settings?.showSystemNoDeck}`;
  }

  function normalizeOnceForSignature(sig, ids) {
    if (normalizedAtKey === sig) return;
    let changed = false;
    D.words.forEach(w => {
      const nextDeckId = normalizedDeckId(w.deckId, ids);
      if (String(w.deckId || '') !== nextDeckId) {
        w.deckId = nextDeckId;
        changed = true;
      }
      if (!w.srsState) {
        w.srsState = (w.reps || 0) > 0 || w.nextReview ? 'review' : 'new';
        changed = true;
      }
      if (w.interval === undefined || w.interval === null) {
        w.interval = Number(w.scheduledDays || 0) || 0;
        changed = true;
      }
      if (w.scheduledDays === undefined || w.scheduledDays === null) {
        w.scheduledDays = Number(w.interval || 0);
        changed = true;
      }
    });
    normalizedAtKey = sig;
    if (changed) save();
  }

  function computeStatsMap() {
    const sig = statsSignature();
    if (cachedStatsKey === sig && cachedStatsMap) return cachedStatsMap;

    const ids = deckIdSet();
    normalizeOnceForSignature(sig, ids);

    const stats = new Map();
    D.decks.forEach(d => stats.set(String(d.id), emptyStats()));
    stats.set(NO_DECK_ID, emptyStats());

    D.words.forEach(w => {
      const dId = normalizedDeckId(w.deckId, ids);
      const s = stats.get(dId) || emptyStats();
      stats.set(dId, s);
      s.total++;

      const state = String(w.srsState || ((w.reps || 0) > 0 || w.nextReview ? 'review' : 'new'));
      const due = state === 'new' ? true : isDueCard(w);
      if (state === 'new') s.newAll++;
      else if (due && (state === 'learning' || state === 'relearning')) s.lrnC++;
      else if (due) s.revAll++;
    });

    cachedStatsKey = sig;
    cachedStatsMap = stats;
    return stats;
  }

  function clearCache() {
    cachedStatsKey = '';
    cachedStatsMap = null;
    normalizedAtKey = '';
  }

  function limitedStats(deckId, statsMap) {
    const raw = statsMap.get(String(deckId)) || emptyStats();
    const opts = deckOptions(deckId);
    const newLimit = Math.max(0, Number(opts.newPerDay ?? 25));
    const revLimit = opts.ignoreRev ? 999999 : Math.max(0, Number(opts.revPerDay ?? 999));
    return {
      newC: Math.min(raw.newAll, newLimit),
      lrnC: raw.lrnC,
      dueC: Math.min(raw.revAll, revLimit),
      total: raw.total,
      newAll: raw.newAll,
      revAll: raw.revAll
    };
  }

  function deckCardHtml(d, statsMap) {
    const stats = limitedStats(d.id, statsMap);
    const draggingClass = window.__wordjarDraggingDeckId === String(d.id) ? ' deck-dragging-card' : '';
    return `<div class="deck-card deck-reorderable${draggingClass}" data-deck-id="${safeText(d.id)}" onclick="showDeckOverview('${safeText(d.id)}')">
      <div class="deck-info">
        <div class="deck-name" style="color: ${d.color || 'var(--ink)'}">${safeText(d.name)}</div>
        <div class="deck-stats"><span class="d-stat">New <b>${stats.newC}</b></span><span class="d-stat">Learn <b>${stats.lrnC}</b></span><span class="d-stat">Due <b>${stats.dueC}</b></span></div>
      </div>
      <div class="deck-gear" onclick="openDeckMenu('${safeText(d.id)}', event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></div>
    </div>`;
  }

  function systemDeckCardHtml(statsMap) {
    const stats = limitedStats(NO_DECK_ID, statsMap);
    return `<div class="deck-card system-deck-card" data-system-deck="true" onclick="showDeckOverview('${NO_DECK_ID}')">
      <div class="deck-info">
        <div class="deck-name" style="color: var(--ink)">${NO_DECK_NAME} <span class="d-stat" style="margin-left:8px;">System</span></div>
        <div class="deck-stats"><span class="d-stat">New <b>${stats.newC}</b></span><span class="d-stat">Learn <b>${stats.lrnC}</b></span><span class="d-stat">Due <b>${stats.dueC}</b></span></div>
      </div>
    </div>`;
  }

  window.renderDecks = function renderDecksSinglePassCached() {
    D.settings = D.settings || {};
    if (D.settings.showSystemNoDeck === undefined) D.settings.showSystemNoDeck = true;
    const el = document.getElementById('deckList');
    if (!el) return;

    const statsMap = computeStatsMap();
    const parts = D.decks.map(d => deckCardHtml(d, statsMap));
    const systemStats = statsMap.get(NO_DECK_ID) || emptyStats();
    if (D.settings.showSystemNoDeck !== false && systemStats.total > 0) parts.push(systemDeckCardHtml(statsMap));

    if (!parts.length) {
      el.innerHTML = '<div class="empty"><div class="empty-title">No Decks</div><div class="empty-sub">Words without a deck can stay in the protected system deck.</div></div>';
      return;
    }

    el.innerHTML = `<div class="deck-grid">${parts.join('')}</div>`;
  };

  window.WordJarDeckPerformance = { computeStatsMap, limitedStats, clearCache };
})();

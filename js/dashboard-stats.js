// WordJar Dashboard Stats V2
// Adds FSRS-aware dashboard cards and a compact Account settings modal, with cached stats.

(function installWordJarDashboardStats() {
  if (window.__wordjarDashboardStatsInstalled) return;
  window.__wordjarDashboardStatsInstalled = true;

  const DEFAULT_WIDGETS = {
    dueToday: true,
    learningNow: true,
    retention7d: true,
    reviewLoad: true,
    matureCards: true,
    lapses7d: true
  };

  let cachedStatsKey = '';
  let cachedStats = null;

  function ensureDashboardSettings() {
    D.settings = D.settings || {};
    D.settings.dashboard = D.settings.dashboard || {};
    Object.keys(DEFAULT_WIDGETS).forEach(key => {
      if (D.settings.dashboard[key] === undefined) D.settings.dashboard[key] = DEFAULT_WIDGETS[key];
    });
    if (D.settings.dashboard.showFsrsPanel === undefined) D.settings.dashboard.showFsrsPanel = true;
  }

  function isNoDeck(deckId) {
    const noDeckId = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
    return String(deckId || '') === noDeckId;
  }

  function deckIdSet() {
    return new Set((D.decks || []).map(d => String(d.id)));
  }

  function normalizeCard(w) {
    if (!w.srsState) w.srsState = (w.reps || 0) > 0 || w.nextReview ? 'review' : 'new';
  }

  function isDue(w) {
    if (window.WordJarFSRS?.isDueCard) return WordJarFSRS.isDueCard(w);
    normalizeCard(w);
    if (w.srsState === 'new') return true;
    if (!w.dueAt && !w.nextReview) return true;
    if (w.dueAt) return new Date(w.dueAt).getTime() <= Date.now();
    return String(w.nextReview) <= new Date().toISOString().split('T')[0];
  }

  function daysAgoStart(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function statsSignature() {
    const wordsSig = (D.words || []).map(w => [
      w.id, w.deckId, w.srsState, w.reps, w.dueAt, w.nextReview,
      w.scheduledDays, w.interval, w.stability, w.difficulty, w.lapses
    ].join(':')).join('|');
    const logs = D.reviewLog || [];
    const lastLog = logs.length ? logs[logs.length - 1] : null;
    const logSig = `${logs.length}:${lastLog?.reviewedAt || lastLog?.review || ''}:${lastLog?.rating || ''}`;
    const deckSig = (D.decks || []).map(d => d.id).join('|');
    return `${deckSig}::${wordsSig}::${logSig}`;
  }

  function calcStats() {
    const sig = statsSignature();
    if (cachedStatsKey === sig && cachedStats) return cachedStats;

    const deckIds = deckIdSet();
    let newDue = 0;
    let learningDue = 0;
    let reviewDue = 0;
    let mature = 0;
    let young = 0;
    let orphan = 0;
    let stabilitySum = 0;
    let stabilityCount = 0;

    (D.words || []).forEach(w => {
      normalizeCard(w);
      const state = String(w.srsState || 'new');
      const due = isDue(w);

      if (!w.deckId || (!deckIds.has(String(w.deckId)) && !isNoDeck(w.deckId))) orphan++;
      if (state === 'new' && due) newDue++;
      else if ((state === 'learning' || state === 'relearning') && due) learningDue++;
      else if (due) reviewDue++;

      const scheduled = Number(w.scheduledDays || w.interval || 0);
      if (scheduled >= 21) mature++;
      else if (state !== 'new') young++;

      if (Number(w.stability) > 0) {
        stabilitySum += Number(w.stability);
        stabilityCount++;
      }
    });

    const todayStart = daysAgoStart(0).getTime();
    const weekStart = daysAgoStart(7).getTime();
    let reviewsToday = 0;
    let reviews7d = 0;
    let again7 = 0;
    let lapses7 = 0;

    (D.reviewLog || []).forEach(log => {
      const t = new Date(log.reviewedAt || log.review || 0).getTime();
      if (!Number.isFinite(t) || t < weekStart) return;
      reviews7d++;
      const rating = String(log.rating || '').toLowerCase();
      if (rating === 'again') {
        again7++;
        if (String(log.previousState || '').toLowerCase() === 'review') lapses7++;
      }
      if (t >= todayStart) reviewsToday++;
    });

    const retention7 = reviews7d ? Math.round(((reviews7d - again7) / reviews7d) * 100) : 0;
    const avgStability = stabilityCount ? Math.round(stabilitySum / stabilityCount) : 0;

    cachedStatsKey = sig;
    cachedStats = {
      dueTotal: newDue + learningDue + reviewDue,
      newDue,
      learningDue,
      reviewDue,
      reviewsToday,
      reviews7d,
      retention7,
      lapses7,
      mature,
      young,
      avgStability,
      orphan
    };
    return cachedStats;
  }

  function clearStatsCache() {
    cachedStatsKey = '';
    cachedStats = null;
  }

  function injectStyles() {
    if (document.getElementById('dashboardStatsStyle')) return;
    const style = document.createElement('style');
    style.id = 'dashboardStatsStyle';
    style.textContent = `
      .fsrs-dashboard-panel { margin: 14px 20px 22px; }
      .fsrs-panel-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:10px; }
      .fsrs-panel-title { font-size: 15px; font-weight: 900; color: var(--ink); }
      .fsrs-panel-sub { font-size: 12px; font-weight: 700; color: var(--ink2); }
      .fsrs-stats-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; }
      .fsrs-stat-card { background: var(--sur); border:1px solid var(--bdr); border-radius:18px; padding:13px; box-shadow: 0 10px 24px rgba(0,0,0,.04); min-width:0; }
      .fsrs-stat-label { color: var(--ink2); font-size: 11px; font-weight: 800; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .fsrs-stat-value { color: var(--ink); font-size: 24px; font-weight: 900; margin-top:5px; letter-spacing:-.03em; line-height:1; }
      .fsrs-stat-note { color: var(--ink2); font-size: 11px; font-weight: 700; margin-top:6px; line-height:1.25; min-height:14px; }
      .fsrs-status-pill { display:inline-flex; align-items:center; padding:6px 9px; border-radius:999px; border:1px solid var(--bdr); background:rgba(255,255,255,.9); color:var(--ink2); font-size:11px; font-weight:800; white-space:nowrap; }
      .settings-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 0; border-top:1px solid var(--bdr); }
      .settings-toggle-row:first-of-type { border-top:0; padding-top:2px; }
      .settings-toggle-text { min-width:0; }
      .settings-toggle-title { font-size:13px; font-weight:800; color:var(--ink); }
      .settings-toggle-desc { font-size:12px; color:var(--ink2); margin-top:4px; line-height:1.35; }
      .settings-inline-note { color:var(--ink2); font-size:12px; line-height:1.4; margin:0 0 12px; }
    `;
    document.head.appendChild(style);
  }

  function widgetHtml(key, label, value, note) {
    if (D.settings.dashboard[key] === false) return '';
    return `<div class="fsrs-stat-card" data-dashboard-widget="${key}"><div class="fsrs-stat-label">${label}</div><div class="fsrs-stat-value">${value}</div><div class="fsrs-stat-note">${note}</div></div>`;
  }

  function renderDashboardStats() {
    ensureDashboardSettings();
    injectStyles();
    const home = document.getElementById('pg-home');
    if (!home) return;

    let panel = document.getElementById('fsrsDashboardPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'fsrsDashboardPanel';
      panel.className = 'fsrs-dashboard-panel';
      const streak = home.querySelector('.streak-strip');
      if (streak) streak.insertAdjacentElement('afterend', panel);
      else home.appendChild(panel);
    }

    if (D.settings.dashboard.showFsrsPanel === false) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';
    const s = calcStats();
    const fsrsReady = window.WordJarFSRS?.library === 'ts-fsrs';
    const body = [
      widgetHtml('dueToday', 'Due Now', s.dueTotal, `${s.newDue} new · ${s.learningDue} learning · ${s.reviewDue} review`),
      widgetHtml('learningNow', 'Learning', s.learningDue, 'Short-term cards due now'),
      widgetHtml('retention7d', '7-day Retention', s.reviews7d ? `${s.retention7}%` : '—', `${s.reviews7d} reviews in 7 days`),
      widgetHtml('reviewLoad', 'Reviewed Today', s.reviewsToday, `${s.reviewDue} review cards due`),
      widgetHtml('matureCards', 'Mature Cards', s.mature, `${s.young} young review cards`),
      widgetHtml('lapses7d', 'Lapses 7d', s.lapses7, `${s.avgStability ? `Avg stability ${s.avgStability}d` : 'No stability data yet'}`)
    ].join('');

    panel.innerHTML = `
      <div class="fsrs-panel-head"><div><div class="fsrs-panel-title">FSRS Dashboard</div><div class="fsrs-panel-sub">Scheduling, retention, and review load</div></div><div class="fsrs-status-pill">${fsrsReady ? 'ts-fsrs' : 'loading'}</div></div>
      <div class="fsrs-stats-grid">${body || '<div class="fsrs-stat-card"><div class="fsrs-stat-label">Hidden</div><div class="fsrs-stat-note">Enable widgets in Account settings.</div></div>'}</div>
    `;
  }

  function toggleRow(key, title, desc) {
    const checked = D.settings.dashboard[key] !== false ? 'checked' : '';
    return `<div class="settings-toggle-row"><div class="settings-toggle-text"><div class="settings-toggle-title">${title}</div><div class="settings-toggle-desc">${desc}</div></div><label class="switch" style="flex-shrink:0;"><input type="checkbox" data-dashboard-toggle="${key}" ${checked}><span class="slider"></span></label></div>`;
  }

  function ensureDashboardSettingsModal() {
    let modal = document.getElementById('dashboardSettingsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'dashboardSettingsModal';
    modal.className = 'overlay';
    modal.addEventListener('click', e => { if (e.target === modal) closeO('dashboardSettingsModal'); });
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;"><div><div class="sh-title">Dashboard Statistics</div><div class="modal-subtitle" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;">Choose which FSRS statistics appear on Dashboard.</div></div><button class="btn-close" type="button" onclick="closeO('dashboardSettingsModal')" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div class="settings-inline-note">These switches only affect display. Review data and scheduling still work normally.</div>
        <div id="dashboardSettingsModalBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function refreshDashboardSettingsModalBody() {
    ensureDashboardSettings();
    const body = document.getElementById('dashboardSettingsModalBody');
    if (!body) return;
    body.innerHTML = `
      ${toggleRow('showFsrsPanel', 'Show FSRS Dashboard', 'Show or hide the whole FSRS statistics panel on Dashboard.')}
      ${toggleRow('dueToday', 'Due Now', 'Cards available to study now: new, learning, and review.')}
      ${toggleRow('learningNow', 'Learning Now', 'Short-term learning and relearning cards due now.')}
      ${toggleRow('retention7d', '7-day Retention', 'Estimated success rate from recent review logs.')}
      ${toggleRow('reviewLoad', 'Review Load', 'Reviews completed today and review cards currently due.')}
      ${toggleRow('matureCards', 'Mature Cards', 'Cards with longer scheduled intervals.')}
      ${toggleRow('lapses7d', 'Lapses', 'Review cards that were marked Again in the last 7 days.')}
    `;

    body.querySelectorAll('[data-dashboard-toggle]').forEach(input => {
      input.onchange = () => {
        D.settings.dashboard[input.dataset.dashboardToggle] = input.checked;
        clearStatsCache();
        save();
        renderDashboardStats();
        toast('Dashboard setting saved');
      };
    });
  }

  window.openDashboardSettingsModal = function openDashboardSettingsModal() {
    ensureDashboardSettingsModal();
    refreshDashboardSettingsModalBody();
    openO('dashboardSettingsModal');
  };

  function injectDashboardSettingsRow() {
    ensureDashboardSettings();
    injectStyles();
    const account = document.getElementById('pg-account');
    const menu = account?.querySelector('.menu-sec');
    if (!menu) return;
    document.getElementById('dashboardSettingsCard')?.remove();
    let row = document.getElementById('dashboardSettingsRow');
    if (!row) {
      row = document.createElement('div');
      row.className = 'mr';
      row.id = 'dashboardSettingsRow';
      row.onclick = () => openDashboardSettingsModal();
      row.innerHTML = `<div class="ml">Dashboard Statistics</div><div class="ma"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg></div>`;
      menu.appendChild(row);
    }
  }

  const originalUpdateHome = window.__wordjarOriginalUpdateHomeForDashboard || window.updateHome;
  window.__wordjarOriginalUpdateHomeForDashboard = originalUpdateHome;
  window.updateHome = function updateHomeWithDashboardStats() {
    if (typeof originalUpdateHome === 'function') originalUpdateHome();
    renderDashboardStats();
  };

  const originalUpdateAccount = window.__wordjarOriginalUpdateAccountForDashboard || window.updateAccount;
  window.__wordjarOriginalUpdateAccountForDashboard = originalUpdateAccount;
  window.updateAccount = function updateAccountWithDashboardSettings() {
    if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
    injectDashboardSettingsRow();
  };

  ensureDashboardSettings();
  setTimeout(renderDashboardStats, 0);
  setTimeout(injectDashboardSettingsRow, 0);
  window.WordJarDashboardStats = { renderDashboardStats, injectDashboardSettings: injectDashboardSettingsRow, calcStats, clearStatsCache };
})();

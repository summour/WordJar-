// WordJar Home Performance V1
// Updates Home without filtering all words repeatedly when cached dashboard stats are available.

(function installHomePerformance() {
  if (window.__wordjarHomePerformanceInstalled) return;
  window.__wordjarHomePerformanceInstalled = true;

  let cachedKey = '';
  let cachedDue = 0;
  let cachedStreak = 0;

  function todayKey() {
    return new Date().toDateString();
  }

  function statsKey() {
    const wordSig = (D.words || []).map(w => [w.id, w.srsState, w.reps, w.dueAt, w.nextReview, w.deckId].join(':')).join('|');
    const studySig = JSON.stringify(D.studyDays || {});
    return `${D.todayDone || 0}::${todayKey()}::${wordSig}::${studySig}`;
  }

  function fallbackDueCount() {
    let count = 0;
    (D.words || []).forEach(w => {
      if (window.WordJarFSRS?.isDueCard) {
        if (WordJarFSRS.isDueCard(w)) count++;
      } else if (typeof isDue === 'function') {
        if (isDue(w)) count++;
      } else {
        count++;
      }
    });
    return count;
  }

  function fallbackStreak() {
    if (typeof streak === 'function') return streak();
    let s = 0;
    const td = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(td);
      d.setDate(td.getDate() - i);
      if ((D.studyDays || {})[d.toDateString()]) s++;
      else break;
    }
    return s;
  }

  function computeHomeStats() {
    const key = statsKey();
    if (key === cachedKey) return { due: cachedDue, streakCount: cachedStreak };

    let due = null;
    if (window.WordJarDashboardStats?.calcStats) {
      try { due = WordJarDashboardStats.calcStats().dueTotal; }
      catch { due = null; }
    }
    if (!Number.isFinite(Number(due))) due = fallbackDueCount();

    cachedKey = key;
    cachedDue = Number(due || 0);
    cachedStreak = fallbackStreak();
    return { due: cachedDue, streakCount: cachedStreak };
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = value;
  }

  window.updateHome = function updateHomeFast() {
    const { due, streakCount } = computeHomeStats();
    const done = Number(D.todayDone || 0);
    const totalProgress = due + done;
    const pct = totalProgress ? Math.round((done / totalProgress) * 100) : 0;

    setText('hDone', done);
    setText('hTotal', (D.words || []).length);
    setText('hStreak', streakCount);
    setText('ringPct', pct + '%');

    const ring = document.getElementById('ringC');
    if (ring) ring.style.strokeDashoffset = 201.06 - (201.06 * pct / 100);

    if (typeof renderCalendar === 'function') renderCalendar();
    if (window.WordJarDashboardStats?.renderDashboardStats) WordJarDashboardStats.renderDashboardStats();
  };

  window.WordJarHomePerformance = {
    clearCache() { cachedKey = ''; cachedDue = 0; cachedStreak = 0; },
    computeHomeStats
  };
})();

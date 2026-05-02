// WordJar Home Performance V2
// Updates Home with Duolingo-style streak logic.

(function installHomePerformance() {
  if (window.__wordjarHomePerformanceInstalledV2) return;
  window.__wordjarHomePerformanceInstalledV2 = true;

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

  function hasStudiedOn(date, offsetFromToday) {
    const key = date.toDateString();
    const studied = !!(D.studyDays || {})[key];
    const isToday = offsetFromToday === 0;
    return studied || (isToday && Number(D.todayDone || 0) > 0);
  }

  function duolingoStreak() {
    let count = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      if (hasStudiedOn(date, i)) {
        count++;
        continue;
      }

      // Duolingo-like behavior: if today is not done yet, keep yesterday's streak visible.
      if (i === 0) continue;
      break;
    }

    return count;
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
    cachedStreak = duolingoStreak();
    return { due: cachedDue, streakCount: cachedStreak };
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = value;
  }

  window.streak = duolingoStreak;

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
    computeHomeStats,
    duolingoStreak
  };
})();

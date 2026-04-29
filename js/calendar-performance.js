// WordJar Calendar Performance V1
// Avoids rebuilding the weekly calendar DOM when the date/study state has not changed.

(function installCalendarPerformance() {
  if (window.__wordjarCalendarPerformanceInstalled) return;
  window.__wordjarCalendarPerformanceInstalled = true;

  let lastKey = '';
  let lastHtml = '';

  function calendarKey() {
    const today = new Date().toDateString();
    const studySig = JSON.stringify(D.studyDays || {});
    return `${today}::${D.todayDone || 0}::${studySig}`;
  }

  function buildCalendarHtml() {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days.map(d => {
      const isToday = d.toDateString() === today.toDateString();
      const isStudied = isToday ? Number(D.todayDone || 0) > 0 : !!(D.studyDays || {})[d.toDateString()];
      return `<div class="cal-day ${isStudied ? 'active' : ''} ${isToday ? 'today' : ''}"><div class="cal-lbl">${dayNames[d.getDay()]}</div><div class="cal-circle">${d.getDate()}</div></div>`;
    }).join('');
  }

  window.renderCalendar = function renderCalendarCached() {
    const el = document.getElementById('weekCalendar');
    if (!el) return;

    const key = calendarKey();
    if (key !== lastKey) {
      lastKey = key;
      lastHtml = buildCalendarHtml();
    }

    if (el.innerHTML !== lastHtml) el.innerHTML = lastHtml;
  };

  window.WordJarCalendarPerformance = {
    clearCache() { lastKey = ''; lastHtml = ''; }
  };
})();

// WordJar Calendar Performance V6
// Restored compact 7-day strip + monthly popup + settings row.

(function installCalendarPerformance() {
  if (window.__wordjarCalendarPerformanceInstalledV6) return;
  window.__wordjarCalendarPerformanceInstalledV6 = true;

  const STYLE_ID = 'wordjarCalendarStyle';
  const CALENDAR_MODAL_ID = 'wordjarCalendarModal';
  const SETTINGS_MODAL_ID = 'wordjarCalendarSettingsModal';
  const SETTINGS_ROW_ID = 'wordjarCalendarSettingsRow';
  const DEFAULT_COLOR = '#0b5f08';
  const PRESET_COLORS = ['#0b5f08', '#09090b', '#f59e0b', '#3b82f6', '#ef4444', '#a855f7'];
  const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  let stripKey = '';
  let monthCursor = new Date();

  function ensureCalendarSettings() {
    window.D = window.D || {};
    D.settings = D.settings || {};
    if (!D.settings.calendarAccentColor) D.settings.calendarAccentColor = DEFAULT_COLOR;
    if (!['sun', 'mon'].includes(D.settings.calendarWeekStart)) D.settings.calendarWeekStart = 'sun';
    applyCalendarColor();
  }

  function getCalendarColor() {
    ensureCalendarSettings();
    return D.settings.calendarAccentColor || DEFAULT_COLOR;
  }

  function getWeekStartMode() {
    ensureCalendarSettings();
    return D.settings.calendarWeekStart || 'sun';
  }

  function getWeekStartIndex() {
    return getWeekStartMode() === 'mon' ? 1 : 0;
  }

  function getOrderedDayNames() {
    const start = getWeekStartIndex();
    return Array.from({ length: 7 }, (_, index) => DAY_NAMES[(start + index) % 7]);
  }

  function applyCalendarColor() {
    const color = D.settings?.calendarAccentColor || DEFAULT_COLOR;
    document.documentElement.style.setProperty('--wordjar-calendar-accent', color);
  }

  function saveCalendarColor(color) {
    ensureCalendarSettings();
    D.settings.calendarAccentColor = color || DEFAULT_COLOR;
    applyCalendarColor();
    saveCalendarSettings();
  }

  function saveWeekStart(value) {
    ensureCalendarSettings();
    D.settings.calendarWeekStart = value === 'mon' ? 'mon' : 'sun';
    saveCalendarSettings();
  }

  function saveCalendarSettings() {
    if (typeof save === 'function') save();
    renderCalendar(true);
    renderMonthCalendar();
    syncSettingsUI();
    if (window.WordJarSettingsOrder?.orderSettingsRows) WordJarSettingsOrder.orderSettingsRows();
  }

  function dateKey(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toDateString();
  }

  function sameDay(a, b) {
    return dateKey(a) === dateKey(b);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function isStudiedDate(date) {
    const today = new Date();
    return sameDay(date, today) ? Number(D.todayDone || 0) > 0 : !!(D.studyDays || {})[dateKey(date)];
  }

  function startOfWeek(date) {
    const start = new Date(date);
    start.setHours(12, 0, 0, 0);
    const weekStartIndex = getWeekStartIndex();
    const diff = (start.getDay() - weekStartIndex + 7) % 7;
    start.setDate(start.getDate() - diff);
    return start;
  }

  function stripStateKey() {
    return [
      new Date().toDateString(),
      Number(D.todayDone || 0),
      JSON.stringify(D.studyDays || {}),
      getCalendarColor(),
      getWeekStartMode()
    ].join('::');
  }

  function buildStripHtml() {
    const currentWeekStart = startOfWeek(new Date());
    const first = addDays(currentWeekStart, -21);
    const days = Array.from({ length: 49 }, (_, index) => addDays(first, index));

    return days.map(date => {
      const todayClass = sameDay(date, new Date()) ? ' is-today' : '';
      const studiedClass = isStudiedDate(date) ? ' is-studied' : '';
      const currentWeekClass = date >= currentWeekStart && date < addDays(currentWeekStart, 7) ? ' is-current-week' : '';
      return `
        <button class="wordjar-calendar-strip-day${todayClass}${studiedClass}${currentWeekClass}" type="button" data-date="${dateKey(date)}" aria-label="Open calendar for ${dateKey(date)}">
          <span class="wordjar-calendar-strip-label">${DAY_NAMES[date.getDay()]}</span>
          <span class="wordjar-calendar-strip-circle">${date.getDate()}</span>
        </button>
      `;
    }).join('');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .calendar-strip{
        --wordjar-calendar-gap:8px;
        display:flex;
        align-items:center;
        gap:var(--wordjar-calendar-gap);
        overflow-x:auto;
        overscroll-behavior-x:contain;
        scroll-snap-type:x mandatory;
        -webkit-overflow-scrolling:touch;
        padding:14px 20px 18px;
        margin:0 -20px;
        cursor:grab;
      }

      .calendar-strip::-webkit-scrollbar{display:none}

      .wordjar-calendar-strip-day{
        flex:0 0 calc((100% - (var(--wordjar-calendar-gap) * 6)) / 7);
        min-width:42px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:10px;
        border:0;
        background:transparent;
        color:var(--ink);
        font:inherit;
        padding:0;
        scroll-snap-align:start;
        cursor:pointer;
        touch-action:pan-x;
      }

      .wordjar-calendar-strip-label{
        color:var(--ink2);
        font-size:13px;
        font-weight:950;
        letter-spacing:.05em;
      }

      .wordjar-calendar-strip-circle{
        width:44px;
        height:44px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:var(--wordjar-calendar-accent, #0b5f08);
        color:#fff;
        font-size:18px;
        font-weight:950;
        box-shadow:0 8px 18px color-mix(in srgb, var(--wordjar-calendar-accent, #0b5f08) 28%, transparent);
      }

      .wordjar-calendar-strip-day:not(.is-studied) .wordjar-calendar-strip-circle{
        background:var(--sur);
        color:var(--ink);
        border:1px solid var(--bdr);
        box-shadow:none;
      }

      .wordjar-calendar-strip-day.is-today .wordjar-calendar-strip-circle{
        outline:3px solid color-mix(in srgb, var(--wordjar-calendar-accent, #0b5f08) 18%, transparent);
        outline-offset:3px;
      }

      .wordjar-calendar-modal-card,
      .wordjar-calendar-settings-card{
        width:min(92vw, 390px);
        max-height:82vh;
        overflow:auto;
        position:relative;
        z-index:1;
      }

      .wordjar-calendar-modal-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:16px;
      }

      .wordjar-calendar-title-wrap{min-width:0}

      .wordjar-calendar-modal-title{
        color:var(--ink);
        font-size:20px;
        font-weight:950;
        letter-spacing:-.04em;
        line-height:1.1;
      }

      .wordjar-calendar-modal-subtitle{
        color:var(--ink2);
        font-size:12px;
        font-weight:750;
        line-height:1.35;
        margin-top:5px;
      }

      .wordjar-calendar-nav-row{
        display:grid;
        grid-template-columns:44px minmax(0, 1fr) 44px;
        align-items:center;
        gap:10px;
        margin-bottom:14px;
      }

      .wordjar-calendar-nav-btn,
      .wordjar-calendar-close-btn{
        width:44px;
        height:44px;
        border:1px solid var(--bdr);
        border-radius:16px;
        background:var(--sur);
        color:var(--ink);
        display:grid;
        place-items:center;
        cursor:pointer;
      }

      .wordjar-calendar-nav-btn svg,
      .wordjar-calendar-close-btn svg{
        width:20px;
        height:20px;
        stroke-width:2.4;
      }

      .wordjar-calendar-month-label{
        text-align:center;
        font-size:16px;
        font-weight:950;
        color:var(--ink);
      }

      .wordjar-calendar-weekdays,
      .wordjar-calendar-month-grid{
        display:grid;
        grid-template-columns:repeat(7, 1fr);
        gap:7px;
      }

      .wordjar-calendar-weekday{
        text-align:center;
        color:var(--ink2);
        font-size:12px;
        font-weight:950;
        padding:4px 0;
      }

      .wordjar-calendar-date{
        aspect-ratio:1;
        border:1px solid var(--bdr);
        border-radius:15px;
        background:var(--sur);
        color:var(--ink);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:4px;
        font-size:15px;
        font-weight:900;
      }

      .wordjar-calendar-date.is-muted{opacity:.35}

      .wordjar-calendar-date.is-studied{
        background:var(--wordjar-calendar-accent, #0b5f08);
        border-color:var(--wordjar-calendar-accent, #0b5f08);
        color:#fff;
        box-shadow:0 8px 18px color-mix(in srgb, var(--wordjar-calendar-accent, #0b5f08) 24%, transparent);
      }

      .wordjar-calendar-date.is-today{
        outline:3px solid color-mix(in srgb, var(--wordjar-calendar-accent, #0b5f08) 18%, transparent);
        outline-offset:2px;
      }

      .wordjar-calendar-dot{
        width:5px;
        height:5px;
        border-radius:999px;
        background:currentColor;
        opacity:.7;
      }

      .wordjar-calendar-summary{
        margin-top:14px;
        padding:12px 14px;
        border:1px solid var(--bdr);
        border-radius:18px;
        background:var(--sur);
        color:var(--ink2);
        font-size:12px;
        font-weight:750;
        line-height:1.45;
      }

      .wordjar-calendar-settings-section{
        padding:14px 0;
        border-top:1px solid var(--bdr);
      }

      .wordjar-calendar-settings-section:first-of-type{
        padding-top:0;
        border-top:0;
      }

      .wordjar-calendar-settings-title{
        color:var(--ink);
        font-size:14px;
        font-weight:950;
        margin-bottom:6px;
      }

      .wordjar-calendar-settings-desc{
        color:var(--ink2);
        font-size:12px;
        font-weight:750;
        line-height:1.4;
      }

      .wordjar-calendar-settings-presets{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top:12px;
      }

      .wordjar-calendar-color-btn{
        width:34px;
        height:34px;
        border-radius:999px;
        border:2px solid var(--bdr);
        background:var(--wordjar-calendar-swatch);
        cursor:pointer;
      }

      .wordjar-calendar-color-btn.is-selected{
        box-shadow:0 0 0 4px color-mix(in srgb, var(--wordjar-calendar-swatch) 18%, transparent);
        border-color:var(--ink);
      }

      .wordjar-calendar-color-input{
        width:100%;
        height:46px;
        border:1px solid var(--bdr);
        border-radius:16px;
        background:var(--sur);
        padding:8px;
        margin-top:12px;
        cursor:pointer;
      }

      .wordjar-calendar-week-start-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:12px;
      }

      .wordjar-calendar-option-btn{
        height:46px;
        border:1px solid var(--bdr);
        border-radius:16px;
        background:var(--sur);
        color:var(--ink);
        font:inherit;
        font-size:13px;
        font-weight:900;
        cursor:pointer;
      }

      .wordjar-calendar-option-btn.is-selected{
        background:var(--ink);
        border-color:var(--ink);
        color:var(--sur);
      }
    `;
    document.head.appendChild(style);
  }

  function renderCalendar(force = false) {
    ensureCalendarSettings();
    injectStyles();

    const el = document.getElementById('weekCalendar');
    if (!el) return;

    const nextKey = stripStateKey();
    if (force || nextKey !== stripKey) {
      stripKey = nextKey;
      el.innerHTML = buildStripHtml();
      bindStripEvents(el);
      showCurrentWeek(el);
    }
  }

  function bindStripEvents(el) {
    el.querySelectorAll('.wordjar-calendar-strip-day').forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        openCalendarModal(button.dataset.date);
      };
    });
  }

  function showCurrentWeek(el) {
    requestAnimationFrame(() => {
      const firstCurrentWeekDay = el.querySelector('.wordjar-calendar-strip-day.is-current-week');
      if (!firstCurrentWeekDay) return;
      el.scrollTo({ left: firstCurrentWeekDay.offsetLeft - 20, behavior: 'smooth' });
    });
  }

  function ensureCalendarModal() {
    let modal = document.getElementById(CALENDAR_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = CALENDAR_MODAL_ID;
    modal.className = 'overlay';
    modal.innerHTML = `
      <div class="modal-card wordjar-calendar-modal-card" onclick="event.stopPropagation()">
        <div class="wordjar-calendar-modal-top">
          <div class="wordjar-calendar-title-wrap">
            <div class="wordjar-calendar-modal-title">Study Calendar</div>
            <div class="wordjar-calendar-modal-subtitle">Monthly overview for your WordJar study days.</div>
          </div>
          <button class="wordjar-calendar-close-btn" type="button" id="wordjarCalendarCloseBtn" aria-label="Close calendar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="wordjar-calendar-nav-row">
          <button class="wordjar-calendar-nav-btn" type="button" id="wordjarCalendarPrevBtn" aria-label="Previous month">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div class="wordjar-calendar-month-label" id="wordjarCalendarMonthLabel"></div>
          <button class="wordjar-calendar-nav-btn" type="button" id="wordjarCalendarNextBtn" aria-label="Next month">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <div class="wordjar-calendar-weekdays" id="wordjarCalendarWeekdays"></div>
        <div class="wordjar-calendar-month-grid" id="wordjarCalendarMonthGrid"></div>
        <div class="wordjar-calendar-summary" id="wordjarCalendarSummary"></div>
      </div>
    `;

    modal.onclick = event => {
      if (event.target === modal) closeCalendarModal();
    };

    document.body.appendChild(modal);
    document.getElementById('wordjarCalendarCloseBtn').onclick = closeCalendarModal;
    document.getElementById('wordjarCalendarPrevBtn').onclick = () => moveMonth(-1);
    document.getElementById('wordjarCalendarNextBtn').onclick = () => moveMonth(1);
    return modal;
  }

  function openCalendarModal(dateText) {
    const selected = dateText ? new Date(dateText) : new Date();
    monthCursor = Number.isNaN(selected.getTime()) ? new Date() : selected;
    ensureCalendarModal().classList.add('open');
    renderMonthCalendar();
  }

  function closeCalendarModal() {
    const modal = document.getElementById(CALENDAR_MODAL_ID);
    if (modal) modal.classList.remove('open');
  }

  function moveMonth(delta) {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1);
    renderMonthCalendar();
  }

  function getMonthDates(cursor) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    const diff = (first.getDay() - getWeekStartIndex() + 7) % 7;
    start.setDate(first.getDate() - diff);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }

  function renderMonthCalendar() {
    const weekdays = document.getElementById('wordjarCalendarWeekdays');
    const label = document.getElementById('wordjarCalendarMonthLabel');
    const grid = document.getElementById('wordjarCalendarMonthGrid');
    const summary = document.getElementById('wordjarCalendarSummary');
    if (!weekdays || !label || !grid || !summary) return;

    const cursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const dates = getMonthDates(cursor);
    const studiedInMonth = dates.filter(date => date.getMonth() === cursor.getMonth() && isStudiedDate(date)).length;

    weekdays.innerHTML = getOrderedDayNames().map(day => `<div class="wordjar-calendar-weekday">${day}</div>`).join('');
    label.textContent = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    grid.innerHTML = dates.map(date => {
      const mutedClass = date.getMonth() === cursor.getMonth() ? '' : ' is-muted';
      const todayClass = sameDay(date, new Date()) ? ' is-today' : '';
      const studiedClass = isStudiedDate(date) ? ' is-studied' : '';
      const dot = isStudiedDate(date) ? '<span class="wordjar-calendar-dot"></span>' : '';
      return `<div class="wordjar-calendar-date${mutedClass}${todayClass}${studiedClass}"><span>${date.getDate()}</span>${dot}</div>`;
    }).join('');

    summary.textContent = `${studiedInMonth} study day${studiedInMonth === 1 ? '' : 's'} in this month. Week starts on ${getWeekStartMode() === 'mon' ? 'Monday' : 'Sunday'}.`;
  }

  function ensureCalendarSettingsModal() {
    let modal = document.getElementById(SETTINGS_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = SETTINGS_MODAL_ID;
    modal.className = 'overlay';
    modal.innerHTML = `
      <div class="modal-card wordjar-calendar-settings-card" onclick="event.stopPropagation()">
        <div class="wordjar-calendar-modal-top">
          <div class="wordjar-calendar-title-wrap">
            <div class="wordjar-calendar-modal-title">Calendar Settings</div>
            <div class="wordjar-calendar-modal-subtitle">Customize Dashboard calendar color and week layout.</div>
          </div>
          <button class="wordjar-calendar-close-btn" type="button" id="wordjarCalendarSettingsCloseBtn" aria-label="Close calendar settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="wordjar-calendar-settings-section">
          <div class="wordjar-calendar-settings-title">Calendar Color</div>
          <div class="wordjar-calendar-settings-desc">Choose a template color or use your own custom color.</div>
          <div class="wordjar-calendar-settings-presets" id="wordjarCalendarColorPresets"></div>
          <input class="wordjar-calendar-color-input" id="wordjarCalendarColorInput" type="color" aria-label="Custom calendar color">
        </div>

        <div class="wordjar-calendar-settings-section">
          <div class="wordjar-calendar-settings-title">Week Starts On</div>
          <div class="wordjar-calendar-settings-desc">Choose how the Dashboard week strip and monthly calendar are arranged.</div>
          <div class="wordjar-calendar-week-start-grid">
            <button class="wordjar-calendar-option-btn" type="button" data-week-start="sun">Sunday</button>
            <button class="wordjar-calendar-option-btn" type="button" data-week-start="mon">Monday</button>
          </div>
        </div>
      </div>
    `;

    modal.onclick = event => {
      if (event.target === modal) closeCalendarSettingsModal();
    };

    document.body.appendChild(modal);
    document.getElementById('wordjarCalendarSettingsCloseBtn').onclick = closeCalendarSettingsModal;
    return modal;
  }

  function openCalendarSettingsModal() {
    ensureCalendarSettingsModal().classList.add('open');
    syncSettingsUI();
  }

  function closeCalendarSettingsModal() {
    const modal = document.getElementById(SETTINGS_MODAL_ID);
    if (modal) modal.classList.remove('open');
  }

  function renderColorPresets() {
    const wrap = document.getElementById('wordjarCalendarColorPresets');
    if (!wrap) return;

    const selected = getCalendarColor().toLowerCase();
    wrap.innerHTML = PRESET_COLORS.map(color => `
      <button class="wordjar-calendar-color-btn${selected === color.toLowerCase() ? ' is-selected' : ''}" type="button" data-color="${color}" aria-label="Set calendar color ${color}"></button>
    `).join('');

    wrap.querySelectorAll('.wordjar-calendar-color-btn').forEach(button => {
      button.style.setProperty('--wordjar-calendar-swatch', button.dataset.color);
      button.onclick = () => saveCalendarColor(button.dataset.color);
    });
  }

  function syncSettingsUI() {
    const input = document.getElementById('wordjarCalendarColorInput');
    if (input) {
      input.value = getCalendarColor();
      input.oninput = () => saveCalendarColor(input.value);
    }

    renderColorPresets();

    document.querySelectorAll('[data-week-start]').forEach(button => {
      const isSelected = button.dataset.weekStart === getWeekStartMode();
      button.classList.toggle('is-selected', isSelected);
      button.onclick = () => saveWeekStart(button.dataset.weekStart);
    });
  }

  function injectCalendarSettingsRow() {
    ensureCalendarSettings();
    injectStyles();

    const account = document.getElementById('pg-account');
    const menu = account?.querySelector('.menu-sec');
    if (!menu) return;

    document.getElementById('wordjarCalendarSettingsCard')?.remove();

    let row = document.getElementById(SETTINGS_ROW_ID);
    if (!row) {
      row = document.createElement('div');
      row.className = 'mr';
      row.id = SETTINGS_ROW_ID;
      row.onclick = openCalendarSettingsModal;
      row.innerHTML = `<div class="ml">Calendar Settings</div><div class="ma"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg></div>`;
      menu.appendChild(row);
    }
  }

  const originalUpdateAccount = window.updateAccount;
  window.updateAccount = function updateAccountWithCalendarSettings() {
    if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
    injectCalendarSettingsRow();
  };

  window.renderCalendar = renderCalendar;
  window.openWordJarCalendarModal = openCalendarModal;
  window.openWordJarCalendarSettingsModal = openCalendarSettingsModal;
  window.WordJarCalendarPerformance = {
    clearCache() { stripKey = ''; },
    open: openCalendarModal,
    openSettings: openCalendarSettingsModal,
    setColor: saveCalendarColor,
    setWeekStart: saveWeekStart,
    injectSettings: injectCalendarSettingsRow
  };

  ensureCalendarSettings();
  injectStyles();
  setTimeout(() => renderCalendar(true), 0);
  setTimeout(injectCalendarSettingsRow, 0);
})();

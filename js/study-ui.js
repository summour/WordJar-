// WordJar Study UI V1
// Adds Skip controls to Study Mode and Flashcard sessions without changing scheduling data.

(function installWordJarStudyUI() {
  if (window.__wordjarStudyUIInstalled) return;
  window.__wordjarStudyUIInstalled = true;

  function injectStyles() {
    if (document.getElementById('studySkipStyle')) return;
    const style = document.createElement('style');
    style.id = 'studySkipStyle';
    style.textContent = `
      .study-action-split {
        display: grid !important;
        grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr) !important;
        gap: 10px !important;
        width: 100% !important;
      }
      .study-action-split .btn {
        width: 100% !important;
        min-width: 0 !important;
        padding: 14px 10px !important;
        font-size: 15px !important;
        border-radius: 14px !important;
      }
      .fc-skip-row {
        display: flex !important;
        justify-content: center !important;
        margin-bottom: 10px !important;
      }
      .fc-skip-btn {
        min-width: 96px !important;
        height: 38px !important;
        border-radius: 999px !important;
        font-size: 13px !important;
        font-weight: 800 !important;
      }
    `;
    document.head.appendChild(style);
  }

  window.skipLearn = function skipLearn() {
    if (!Array.isArray(lList) || !lList.length) return;
    lI++;
    renderLearn();
  };

  window.skipFC = function skipFC() {
    if (!Array.isArray(fcQ) || !fcQ.length) return;
    fcI++;
    renderFC();
  };

  function ensureLearnSkipButton() {
    injectStyles();
    const area = document.querySelector('#pg-learn #lMain .fc-action-area');
    if (!area) return;
    if (area.querySelector('#btnSkipLearn')) return;

    area.innerHTML = `
      <div class="study-action-split">
        <button id="btnSkipLearn" class="btn btn-s" type="button" onclick="skipLearn()">Skip</button>
        <button id="btnMarkLearned" class="btn btn-p" type="button" onclick="nextLearn()">Mark as Learned</button>
      </div>
    `;
  }

  function ensureFCSkipButton() {
    injectStyles();
    const actionArea = document.querySelector('#pg-fc #fcMain .fc-action-area');
    const ratingMode = document.getElementById('fcRatingMode');
    if (!actionArea || !ratingMode) return;
    if (document.getElementById('btnSkipFC')) return;

    const row = document.createElement('div');
    row.className = 'fc-skip-row';
    row.innerHTML = `<button id="btnSkipFC" class="btn btn-s fc-skip-btn" type="button" onclick="skipFC()">Skip</button>`;
    actionArea.insertBefore(row, ratingMode);
  }

  const originalRenderLearn = window.renderLearn;
  window.renderLearn = function renderLearnWithSkip() {
    if (typeof originalRenderLearn === 'function') originalRenderLearn();
    ensureLearnSkipButton();
  };

  const originalRenderFC = window.renderFC;
  window.renderFC = function renderFCWithSkip() {
    if (typeof originalRenderFC === 'function') originalRenderFC();
    ensureFCSkipButton();
  };

  setTimeout(() => {
    ensureLearnSkipButton();
    ensureFCSkipButton();
  }, 0);
})();

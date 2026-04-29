// WordJar Profile User Level V1
// Adds CEFR user level selector to Edit Profile and saves it in D.profile.userLevel.

(function installWordJarProfileUserLevel() {
  if (window.__wordjarProfileUserLevelInstalled) return;
  window.__wordjarProfileUserLevelInstalled = true;

  const STYLE_ID = 'wordjarProfileUserLevelStyle';
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-user-level-field {
        margin-top: 14px;
      }

      .wordjar-user-level-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 8px;
      }

      .wordjar-user-level-btn {
        min-height: 42px;
        border-radius: 999px;
        border: 1px solid var(--bdr);
        background: var(--sur);
        color: var(--ink);
        font: inherit;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
      }

      .wordjar-user-level-btn.is-active {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--sur);
      }

      .wordjar-user-level-help {
        margin-top: 7px;
        color: var(--ink2);
        font-size: 12px;
        font-weight: 750;
        line-height: 1.35;
      }
    `;
    document.head.appendChild(style);
  }

  function currentLevel() {
    const level = String(D?.profile?.userLevel || D?.profile?.englishLevel || D?.profile?.cefrLevel || 'A2').toUpperCase();
    return LEVELS.includes(level) ? level : 'A2';
  }

  function setLevel(level) {
    const safeLevel = LEVELS.includes(String(level).toUpperCase()) ? String(level).toUpperCase() : 'A2';
    D.profile = D.profile || {};
    D.profile.userLevel = safeLevel;
    D.profile.englishLevel = safeLevel;
    D.profile.cefrLevel = safeLevel;
    document.querySelectorAll('.wordjar-user-level-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.level === safeLevel);
    });
  }

  function levelHTML() {
    const active = currentLevel();
    return `
      <div id="wordjarUserLevelField" class="wordjar-user-level-field">
        <label class="fl">English Level</label>
        <div class="wordjar-user-level-grid">
          ${LEVELS.map(level => `
            <button class="wordjar-user-level-btn ${level === active ? 'is-active' : ''}" type="button" data-level="${level}" onclick="setWordJarUserLevel('${level}')">${level}</button>
          `).join('')}
        </div>
        <div class="wordjar-user-level-help">Used by Smart Fill and Smart Analysis to match explanations to your level.</div>
      </div>
    `;
  }

  function findProfileModal() {
    return document.getElementById('profileModal') ||
      Array.from(document.querySelectorAll('.overlay')).find(modal => /Edit Profile|Profile/i.test(modal.textContent || '')) ||
      null;
  }

  function mountUserLevelField() {
    injectStyles();
    const modal = findProfileModal();
    if (!modal || document.getElementById('wordjarUserLevelField')) return;

    const nameInput = modal.querySelector('input[type="text"], input:not([type]), #pName, #profileName');
    const fieldWrap = nameInput?.closest('.fg, .field, .form-group') || nameInput?.parentElement;

    if (fieldWrap) fieldWrap.insertAdjacentHTML('afterend', levelHTML());
    else modal.querySelector('.modal-card')?.insertAdjacentHTML('beforeend', levelHTML());
  }

  function patchOpenProfileModal() {
    if (window.__wordjarProfileLevelOpenPatched) return;
    if (typeof window.openProfileModal !== 'function') return;

    const original = window.openProfileModal;
    window.__wordjarProfileLevelOpenPatched = true;
    window.openProfileModal = function openProfileModalWithUserLevel() {
      const result = original.apply(this, arguments);
      setTimeout(mountUserLevelField, 0);
      return result;
    };
  }

  function patchSaveProfile() {
    if (window.__wordjarProfileLevelSavePatched) return;
    if (typeof window.saveProfile !== 'function') return;

    const original = window.saveProfile;
    window.__wordjarProfileLevelSavePatched = true;
    window.saveProfile = function saveProfileWithUserLevel() {
      const selected = document.querySelector('.wordjar-user-level-btn.is-active')?.dataset.level || currentLevel();
      setLevel(selected);
      const result = original.apply(this, arguments);
      if (typeof save === 'function') save();
      return result;
    };
  }

  function boot() {
    injectStyles();
    D.profile = D.profile || {};
    if (!D.profile.userLevel) setLevel(currentLevel());
    patchOpenProfileModal();
    patchSaveProfile();
    mountUserLevelField();
  }

  window.setWordJarUserLevel = setLevel;
  window.WordJarProfileUserLevel = {
    currentLevel,
    setLevel,
    mountUserLevelField
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

// WordJar Sync Settings V1
// Adds account settings for manual-only Firestore cloud backup behavior.

(function installWordJarSyncSettings() {
  if (window.__wordjarSyncSettingsInstalled) return;
  window.__wordjarSyncSettingsInstalled = true;

  function ensureSettings() {
    D.settings = D.settings || {};
    D.settings.cloudSync = D.settings.cloudSync || {};
    if (D.settings.cloudSync.autoSaveOnClose === undefined) D.settings.cloudSync.autoSaveOnClose = false;
  }

  function injectStyles() {
    if (document.getElementById('syncSettingsStyle')) return;
    const style = document.createElement('style');
    style.id = 'syncSettingsStyle';
    style.textContent = `
      .settings-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 0; border-top:1px solid var(--bdr); }
      .settings-toggle-row:first-of-type { border-top:0; padding-top:2px; }
      .settings-toggle-text { min-width:0; }
      .settings-toggle-title { font-size:13px; font-weight:800; color:var(--ink); }
      .settings-toggle-desc { font-size:12px; color:var(--ink2); margin-top:4px; line-height:1.35; }
      .settings-inline-note { color:var(--ink2); font-size:12px; line-height:1.4; margin:0 0 12px; }
    `;
    document.head.appendChild(style);
  }

  function ensureSyncSettingsModal() {
    let modal = document.getElementById('syncSettingsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'syncSettingsModal';
    modal.className = 'overlay';
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('syncSettingsModal');
    });

    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">Sync Settings</div>
            <div class="modal-subtitle" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;">Control cloud backup behavior.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('syncSettingsModal')" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="settings-inline-note">Cloud backup is manual-only on the free Firestore plan. Use Save to Cloud / Load from Cloud when needed. Export JSON remains the safest full backup.</div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-text">
            <div class="settings-toggle-title">Auto save when closing app</div>
            <div class="settings-toggle-desc">Disabled for the free Firestore backup path to avoid hidden quota usage.</div>
          </div>
          <label class="switch" style="flex-shrink:0;"><input type="checkbox" id="autoSyncOnCloseToggle" disabled><span class="slider"></span></label>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function refreshSyncSettingsModal() {
    ensureSettings();
    D.settings.cloudSync.autoSaveOnClose = false;
    save();

    ensureSyncSettingsModal();
    const toggle = document.getElementById('autoSyncOnCloseToggle');
    if (!toggle) return;

    toggle.checked = false;
    toggle.disabled = true;
  }

  window.openSyncSettingsModal = function openSyncSettingsModal() {
    injectStyles();
    refreshSyncSettingsModal();
    openO('syncSettingsModal');
  };

  function injectSyncSettingsRow() {
    ensureSettings();
    D.settings.cloudSync.autoSaveOnClose = false;

    const account = document.getElementById('pg-account');
    const menu = account?.querySelector('.menu-sec');
    if (!menu) return;

    let row = document.getElementById('syncSettingsRow');
    if (!row) {
      row = document.createElement('div');
      row.className = 'mr';
      row.id = 'syncSettingsRow';
      row.onclick = () => openSyncSettingsModal();
      row.innerHTML = `<div class="ml">Sync Settings</div><div class="ma"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg></div>`;
      menu.appendChild(row);
    }
  }

  const originalUpdateAccount = window.__wordjarOriginalUpdateAccountForSync || window.updateAccount;
  window.__wordjarOriginalUpdateAccountForSync = originalUpdateAccount;
  window.updateAccount = function updateAccountWithSyncSettings() {
    if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
    injectSyncSettingsRow();
  };

  ensureSettings();
  D.settings.cloudSync.autoSaveOnClose = false;
  save();
  setTimeout(injectSyncSettingsRow, 0);
})();

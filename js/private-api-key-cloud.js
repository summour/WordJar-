// WordJar Private API Key Cloud Storage V3
// Stores user API key privately at /users/{userId}/private/config with LocalStorage fallback.
// initAppConfig() loads the key into window.globalApiKey for app-wide use.

(function installWordJarPrivateApiKeyCloud() {
  if (window.__wordjarPrivateApiKeyCloudInstalledV3) return;
  window.__wordjarPrivateApiKeyCloudInstalledV3 = true;

  const LOCAL_KEY = 'wordjar_api_key';
  const STYLE_ID = 'wordjarPrivateApiKeyStyle';
  const MODAL_ID = 'wordjarApiKeyModal';
  const ROW_ID = 'wordjarApiKeySettingsRow';

  window.globalApiKey = String(window.globalApiKey || '').trim();
  window.WordJarPrivateConfig = window.WordJarPrivateConfig || {
    apiKey: '',
    source: 'none',
    loadedAt: null
  };

  function getFirebaseAuthInstance() {
    try {
      if (typeof cloudAuth !== 'undefined' && cloudAuth) return cloudAuth;
    } catch (err) {}

    try {
      if (window.firebase?.auth) return window.firebase.auth();
    } catch (err) {}

    return null;
  }

  function getFirebaseDbInstance() {
    try {
      if (typeof cloudDb !== 'undefined' && cloudDb) return cloudDb;
    } catch (err) {}

    try {
      if (window.firebase?.firestore) return window.firebase.firestore();
    } catch (err) {}

    return null;
  }

  function getCurrentFirebaseUserId() {
    try {
      if (typeof cloudUser !== 'undefined' && cloudUser?.uid) return cloudUser.uid;
    } catch (err) {}

    const auth = getFirebaseAuthInstance();
    return auth?.currentUser?.uid || '';
  }

  function getPrivateConfigRef() {
    const uid = getCurrentFirebaseUserId();
    const db = getFirebaseDbInstance();
    if (!db || !uid) return null;

    return db
      .collection('users')
      .doc(uid)
      .collection('private')
      .doc('config');
  }

  function setMemoryApiKey(key, source) {
    const cleanKey = String(key || '').trim();
    window.globalApiKey = cleanKey;
    window.WordJarPrivateConfig.apiKey = cleanKey;
    window.WordJarPrivateConfig.source = source || (cleanKey ? 'memory' : 'none');
    window.WordJarPrivateConfig.loadedAt = new Date().toISOString();
    return cleanKey;
  }

  function localFallbackKey() {
    return String(localStorage.getItem(LOCAL_KEY) || '').trim();
  }

  function saveLocalFallback(key) {
    const cleanKey = String(key || '').trim();
    if (cleanKey) localStorage.setItem(LOCAL_KEY, cleanKey);
    else localStorage.removeItem(LOCAL_KEY);
  }

  async function saveApiKeyToCloud(key) {
    const cleanKey = String(key || '').trim();

    if (!cleanKey) {
      if (typeof toast === 'function') toast('API Key is empty');
      return false;
    }

    setMemoryApiKey(cleanKey, 'memory');
    saveLocalFallback(cleanKey);

    const ref = getPrivateConfigRef();
    if (!ref) {
      if (typeof toast === 'function') toast('Saved locally. Sign in to sync API Key to cloud.');
      return false;
    }

    try {
      await ref.set({
        apiKey: cleanKey,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      setMemoryApiKey(cleanKey, 'cloud');
      if (typeof toast === 'function') toast('API Key saved to cloud');
      return true;
    } catch (err) {
      console.warn('saveApiKeyToCloud failed', err);
      if (typeof toast === 'function') toast('Cloud save failed. API Key kept locally.');
      return false;
    }
  }

  async function loadApiKeyFromCloud() {
    const ref = getPrivateConfigRef();

    if (ref) {
      try {
        const snap = await ref.get();

        if (snap.exists) {
          const data = snap.data() || {};
          const cloudKey = String(data.apiKey || '').trim();

          if (cloudKey) {
            setMemoryApiKey(cloudKey, 'cloud');
            saveLocalFallback(cloudKey);
            updateApiKeyStatus();
            return cloudKey;
          }
        }
      } catch (err) {
        console.warn('loadApiKeyFromCloud failed, falling back to LocalStorage', err);
      }
    }

    const localKey = localFallbackKey();
    if (localKey) {
      setMemoryApiKey(localKey, 'local');
      updateApiKeyStatus();
      return localKey;
    }

    setMemoryApiKey('', 'none');
    updateApiKeyStatus();
    return '';
  }

  async function initAppConfig() {
    const key = await loadApiKeyFromCloud();
    window.globalApiKey = String(key || '').trim();
    return {
      apiKey: window.globalApiKey,
      hasApiKey: !!window.globalApiKey,
      source: window.WordJarPrivateConfig?.source || 'none',
      loadedAt: window.WordJarPrivateConfig?.loadedAt || null
    };
  }

  function getApiKeyFromMemory() {
    return String(window.globalApiKey || window.WordJarPrivateConfig?.apiKey || '').trim();
  }

  async function clearApiKeyEverywhere() {
    setMemoryApiKey('', 'none');
    saveLocalFallback('');

    const ref = getPrivateConfigRef();
    if (ref) {
      try {
        await ref.set({
          apiKey: '',
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('clearApiKeyEverywhere cloud clear failed', err);
      }
    }

    updateApiKeyStatus();
    if (typeof toast === 'function') toast('API Key cleared');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-api-key-modal-sub {
        color: var(--ink2);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.45;
        margin-top: 5px;
      }
      .wordjar-api-key-status {
        margin-top: 10px;
        border: 1px solid var(--bdr);
        border-radius: 14px;
        background: var(--sur2);
        color: var(--ink2);
        font-size: 12px;
        font-weight: 750;
        line-height: 1.4;
        padding: 10px 12px;
      }
      .wordjar-api-key-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 14px;
      }
      .wordjar-api-key-field {
        margin-top: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  function keyStatusText() {
    const hasKey = !!getApiKeyFromMemory();
    const source = window.WordJarPrivateConfig?.source || 'none';
    const signedIn = !!getCurrentFirebaseUserId();

    if (hasKey && source === 'cloud') return 'API Key loaded from private cloud config.';
    if (hasKey && source === 'local' && signedIn) return 'API Key loaded from LocalStorage fallback. Save again to sync to cloud.';
    if (hasKey && source === 'local') return 'API Key saved locally. Sign in to sync to cloud.';
    if (hasKey) return 'API Key is loaded in memory.';
    return signedIn ? 'No API Key found in cloud or LocalStorage.' : 'Not signed in. API Key can still be saved locally.';
  }

  function updateApiKeyStatus() {
    const el = document.getElementById('wordjarApiKeyStatus');
    if (el) el.textContent = keyStatusText();
  }

  function ensureModal() {
    injectStyles();
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'overlay';
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">Private API Key</div>
            <div class="wordjar-api-key-modal-sub">Stored privately in Firestore after sign-in. The input is hidden and the key is kept in globalApiKey for app use.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeWordJarApiKeyModal()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="wordjar-api-key-field">
          <label class="fl" for="wordjarApiKeyInput">API Key</label>
          <input id="wordjarApiKeyInput" class="fi" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Paste your API Key">
        </div>

        <div id="wordjarApiKeyStatus" class="wordjar-api-key-status"></div>

        <div class="wordjar-api-key-actions">
          <button class="btn btn-s" type="button" onclick="clearWordJarApiKey()">Clear</button>
          <button class="btn btn-p" type="button" onclick="saveWordJarApiKeyFromSettings()">Save</button>
        </div>
      </div>
    `;

    modal.addEventListener('click', event => {
      if (event.target === modal) closeWordJarApiKeyModal();
    });

    document.body.appendChild(modal);
    return modal;
  }

  function openWordJarApiKeyModal() {
    const modal = ensureModal();
    const input = document.getElementById('wordjarApiKeyInput');

    if (input) {
      input.value = '';
      input.placeholder = getApiKeyFromMemory() ? 'API Key saved. Paste a new key to replace.' : 'Paste your API Key';
    }

    updateApiKeyStatus();
    modal.classList.add('open');
    setTimeout(() => input?.focus(), 80);
  }

  function closeWordJarApiKeyModal() {
    const input = document.getElementById('wordjarApiKeyInput');
    if (input) input.value = '';
    document.getElementById(MODAL_ID)?.classList.remove('open');
  }

  async function saveWordJarApiKeyFromSettings() {
    const input = document.getElementById('wordjarApiKeyInput');
    const key = String(input?.value || '').trim();

    if (!key) {
      if (typeof toast === 'function') toast('Paste API Key first');
      return;
    }

    await saveApiKeyToCloud(key);
    if (input) {
      input.value = '';
      input.placeholder = 'API Key saved. Paste a new key to replace.';
    }
    updateApiKeyStatus();
  }

  async function clearWordJarApiKey() {
    const ok = window.confirm('Clear API Key from this device and cloud config?');
    if (!ok) return;
    await clearApiKeyEverywhere();
    const input = document.getElementById('wordjarApiKeyInput');
    if (input) {
      input.value = '';
      input.placeholder = 'Paste your API Key';
    }
  }

  function rowHTML() {
    return `<div id="${ROW_ID}" class="mr" onclick="openWordJarApiKeyModal()"><div class="ml">Private API Key</div><div class="chev">›</div></div>`;
  }

  function mountSettingsRow() {
    injectStyles();
    const menu = document.querySelector('#pg-account .menu-sec');
    if (!menu || document.getElementById(ROW_ID)) return;

    const rows = Array.from(menu.querySelectorAll(':scope > .mr'));
    const voiceRow = rows.find(row => /Voice Settings/i.test(row.textContent || ''));
    if (voiceRow) voiceRow.insertAdjacentHTML('afterend', rowHTML());
    else menu.insertAdjacentHTML('beforeend', rowHTML());
  }

  function patchUpdateAccount() {
    if (window.__wordjarApiKeyUpdateAccountPatchedV3) return;
    const original = window.updateAccount;
    if (typeof original !== 'function') return;

    window.__wordjarApiKeyUpdateAccountPatchedV3 = true;
    window.updateAccount = function updateAccountWithPrivateApiKeyRow() {
      const result = original.apply(this, arguments);
      setTimeout(mountSettingsRow, 0);
      return result;
    };
  }

  async function handleAuthStateApiKeyLoad() {
    return initAppConfig();
  }

  window.initAppConfig = initAppConfig;
  window.saveApiKeyToCloud = saveApiKeyToCloud;
  window.loadApiKeyFromCloud = loadApiKeyFromCloud;
  window.getApiKeyFromMemory = getApiKeyFromMemory;
  window.openWordJarApiKeyModal = openWordJarApiKeyModal;
  window.closeWordJarApiKeyModal = closeWordJarApiKeyModal;
  window.saveWordJarApiKeyFromSettings = saveWordJarApiKeyFromSettings;
  window.clearWordJarApiKey = clearWordJarApiKey;
  window.WordJarPrivateApiKeyCloud = {
    initAppConfig,
    saveApiKeyToCloud,
    loadApiKeyFromCloud,
    getApiKeyFromMemory,
    clearApiKeyEverywhere,
    handleAuthStateApiKeyLoad,
    mountSettingsRow
  };

  function boot() {
    injectStyles();
    if (!getApiKeyFromMemory()) setMemoryApiKey(localFallbackKey(), localFallbackKey() ? 'local' : 'none');
    patchUpdateAccount();
    mountSettingsRow();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 300);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAppConfig(), { once: true });
  } else {
    setTimeout(initAppConfig, 0);
  }
})();

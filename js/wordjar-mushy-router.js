// WordJar Mushy AI Router
// Centralizes model choice for Chat, Reader, Deck Fill, and app-level custom dialogs.

(function installWordJarMushyRouter() {
  if (window.__wordjarMushyRouterInstalled) return;
  window.__wordjarMushyRouterInstalled = true;

  const API_VERSION = 'v1beta';
  const FAST_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  const SMART_MODELS = ['gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.5-flash'];
  const CACHE_KEY = 'wordjar_mushy_ai_cache_v1';

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function getUserLevel() {
    return String(
      D?.profile?.userLevel ||
      D?.profile?.englishLevel ||
      D?.profile?.cefrLevel ||
      D?.reader?.userLevel ||
      'A2'
    ).trim().toUpperCase() || 'A2';
  }

  async function ensureApiKey() {
    if (typeof window.initAppConfig === 'function') await window.initAppConfig();
    const key = String(window.globalApiKey || window.getApiKeyFromMemory?.() || '').trim();
    if (!key) throw new Error('NO_API_KEY');
    return key;
  }

  function normalizeText(value, max = 6000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function isComplexTask(input = {}) {
    const text = `${input.question || ''} ${input.contextText || ''}`.toLowerCase();
    const hardSignals = [
      'why', 'grammar', 'nuance', 'compare', 'difference',
      'ต่างกันยังไง', 'ทำไม', 'แกรมมาร์', 'วิเคราะห์', 'ละเอียด', 'อธิบายลึก'
    ];

    return Boolean(
      input.preferSmart ||
      normalizeText(input.contextText, 20000).length > 5000 ||
      Number(input.historyCount || 0) > 8 ||
      hardSignals.some(signal => text.includes(signal))
    );
  }

  function getModels(input = {}) {
    return isComplexTask(input) ? SMART_MODELS : FAST_MODELS;
  }

  function buildMushyPrompt(input = {}) {
    const task = input.task || 'chat';
    const level = getUserLevel();
    const context = normalizeText(input.contextText || input.context || '', 6000);
    const question = normalizeText(input.question || input.message || '', 3000);
    const modeNote = task === 'reader'
      ? 'The user is asking from Reader. Explain the selected text first, then answer the question.'
      : task === 'deck_fill'
        ? 'The user is working with vocabulary deck data. Be concise and structured.'
        : 'The user is chatting with you as a vocabulary tutor.';

    return `You are Mushy, a playful black cat English teacher for the WordJar app.\n\nPersona:\n- Main language: Thai. Use simple English only when useful.\n- Friendly, supportive, clear, and learner-friendly.\n- End lightly with ~meow or ~เมี๊ยว sometimes, not every line.\n- Do not overuse emoji.\n\nUser level: ${level}\nTask: ${task}\nMode note: ${modeNote}\n\nContext from app, if any:\n${context || '(no extra context)'}\n\nUser question/message:\n${question || '(no question provided)'}\n\nAnswer rules:\n- Keep the answer useful and not too long.\n- If explaining English, give Thai meaning, simple explanation, and 1 natural example when helpful.\n- If context is provided, answer based on that context.\n- Do not invent app data.\n- If the user asks to add/save/apply something, explain what should be saved instead of pretending you already changed the data.`;
  }

  function endpoint(model, apiKey) {
    return `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  function shouldFallback(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.status === 400 || error?.status === 404 || message.includes('not found') || message.includes('unsupported') || message.includes('model');
  }

  async function callGeminiModel(apiKey, model, prompt, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

    try {
      const response = await fetch(endpoint(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.35,
            topP: options.topP ?? 0.9,
            maxOutputTokens: options.maxOutputTokens || 1200
          }
        })
      });

      const raw = await response.text();
      let payload = null;
      try { payload = JSON.parse(raw); } catch (err) {}

      if (!response.ok) {
        const apiMessage = payload?.error?.message || raw || `HTTP ${response.status}`;
        const error = new Error(`AI_${response.status}: ${apiMessage}`);
        error.status = response.status;
        error.model = model;
        throw error;
      }

      const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim() || '';
      if (!text) throw new Error(`EMPTY_AI_RESPONSE from ${model}`);
      return { text, model };
    } finally {
      clearTimeout(timer);
    }
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch (err) { return {}; }
  }

  function saveCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
    catch (err) {}
  }

  async function digest(value) {
    const text = String(value || '');
    if (!crypto?.subtle) return `${text.length}:${text.slice(0, 80)}`;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function getCacheKey(input, prompt) {
    const task = input.task || 'chat';
    const mode = isComplexTask(input) ? 'smart' : 'fast';
    return `${task}:${mode}:${await digest(prompt)}`;
  }

  function userFacingError(error) {
    const message = String(error?.message || '');
    if (message.includes('NO_API_KEY')) return 'ยังไม่มี Private API Key ใน Settings นะครับ';
    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) return 'API Key ไม่ถูกต้อง ลองตรวจใน Settings อีกครั้งครับ';
    if (message.includes('403') || message.includes('PERMISSION_DENIED')) return 'API Key ยังไม่มีสิทธิ์ใช้ Gemini หรือโดนจำกัด referrer ครับ';
    if (message.includes('429')) return 'โควตา Gemini เต็มหรือถูก rate limit ชั่วคราวครับ';
    if (message.includes('Failed to fetch')) return 'เชื่อมต่อ Gemini ไม่สำเร็จ ลองเช็กอินเทอร์เน็ตหรือ API restriction ครับ';
    return 'Mushy ตอบไม่สำเร็จ ลองใหม่อีกครั้งครับ';
  }

  async function askMushy(input = {}) {
    const prompt = buildMushyPrompt(input);
    const useCache = input.cache !== false && input.task !== 'chat';
    const cacheKey = useCache ? await getCacheKey(input, prompt) : '';

    if (useCache) {
      const cache = loadCache();
      const cached = cache[cacheKey];
      if (cached?.text && Date.now() - Number(cached.createdAt || 0) < 1000 * 60 * 60 * 24 * 30) {
        return { text: cached.text, model: cached.model || 'cache', cached: true };
      }
    }

    const apiKey = await ensureApiKey();
    const models = getModels(input);
    let lastError = null;

    for (const model of models) {
      try {
        const result = await callGeminiModel(apiKey, model, prompt, {
          maxOutputTokens: input.maxOutputTokens || 1200,
          temperature: input.temperature ?? 0.35
        });

        if (useCache) {
          const cache = loadCache();
          cache[cacheKey] = { text: result.text, model: result.model, createdAt: Date.now() };
          saveCache(cache);
        }

        window.WordJarMushyAI.lastModel = result.model;
        return result;
      } catch (err) {
        lastError = err;
        console.warn('Mushy model failed', model, err);
        if (!shouldFallback(err)) break;
      }
    }

    throw lastError || new Error('MUSHY_AI_FAILED');
  }

  window.WordJarMushyAI = {
    fastModels: FAST_MODELS,
    smartModels: SMART_MODELS,
    lastModel: '',
    isComplexTask,
    ask: askMushy,
    userFacingError,
    safeToast
  };
})();

(function installWordJarSystemDialogs() {
  if (window.__wordjarSystemDialogsInstalled) return;
  window.__wordjarSystemDialogsInstalled = true;

  const STYLE_ID = 'wordjar-system-dialog-style';
  const ROOT_ID = 'wordjarSystemDialogRoot';
  const PATCH_FLAG = '__wordjarDialogPatchInstalled';

  function escapeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-system-dialog-layer {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 23, 42, .32);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        pointer-events: auto;
      }

      .wordjar-system-dialog-layer.open { display: flex; }

      .wordjar-system-dialog-card {
        width: min(420px, 100%);
        border-radius: 24px;
        border: 1px solid rgba(148, 163, 184, .24);
        background: var(--sur, #fff);
        color: var(--ink, #09090b);
        box-shadow: 0 28px 80px rgba(15, 23, 42, .22);
        padding: 20px;
        transform: translateY(8px) scale(.98);
        opacity: 0;
        transition: transform .18s ease, opacity .18s ease;
      }

      .wordjar-system-dialog-layer.open .wordjar-system-dialog-card {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      .wordjar-system-dialog-title {
        font-size: 18px;
        font-weight: 900;
        letter-spacing: -.03em;
        line-height: 1.2;
        margin: 0 0 8px;
      }

      .wordjar-system-dialog-message {
        color: var(--ink2, #52525b);
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-line;
        margin: 0;
      }

      .wordjar-system-dialog-input {
        width: 100%;
        min-height: 46px;
        margin-top: 16px;
        border-radius: 16px;
        border: 1px solid var(--bdr, #e4e4e7);
        background: var(--bg, #fafafa);
        color: var(--ink, #09090b);
        font: inherit;
        font-size: 15px;
        padding: 0 14px;
        outline: none;
        box-sizing: border-box;
      }

      .wordjar-system-dialog-input:focus {
        border-color: var(--ink, #09090b);
        box-shadow: 0 0 0 4px rgba(9, 9, 11, .08);
      }

      .wordjar-system-dialog-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 18px;
      }

      .wordjar-system-dialog-actions.single { grid-template-columns: 1fr; }

      .wordjar-system-dialog-btn {
        min-height: 46px;
        border-radius: 16px;
        border: 1px solid var(--bdr, #e4e4e7);
        background: var(--sur2, #f4f4f5);
        color: var(--ink, #09090b);
        font: inherit;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .wordjar-system-dialog-btn.primary {
        border-color: var(--ink, #09090b);
        background: var(--ink, #09090b);
        color: var(--sur, #fff);
      }

      .wordjar-system-dialog-btn.danger {
        border-color: #ef4444;
        background: #ef4444;
        color: #fff;
      }

      .wordjar-system-dialog-btn:focus-visible {
        outline: 3px solid rgba(9, 9, 11, .18);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function getRoot() {
    injectStyles();
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'wordjar-system-dialog-layer';
    document.body.appendChild(root);
    return root;
  }

  function openDialog(options = {}) {
    return new Promise(resolve => {
      const type = options.type || 'alert';
      const root = getRoot();
      const hasInput = type === 'prompt';
      const hasCancel = type !== 'alert';
      const title = options.title || (type === 'confirm' ? 'Confirm Action' : type === 'prompt' ? 'Input Required' : 'Notice');
      const message = options.message || '';
      const defaultValue = options.defaultValue ?? '';
      const confirmText = options.confirmText || (type === 'alert' ? 'OK' : 'Confirm');
      const cancelText = options.cancelText || 'Cancel';
      const dangerClass = options.danger ? ' danger' : ' primary';

      root.innerHTML = `
        <div class="wordjar-system-dialog-card" role="dialog" aria-modal="true" aria-labelledby="wordjarSystemDialogTitle">
          <div class="wordjar-system-dialog-title" id="wordjarSystemDialogTitle">${escapeText(title)}</div>
          <p class="wordjar-system-dialog-message">${escapeText(message)}</p>
          ${hasInput ? `<input class="wordjar-system-dialog-input" id="wordjarSystemDialogInput" type="text" value="${escapeText(defaultValue)}" autocomplete="off">` : ''}
          <div class="wordjar-system-dialog-actions ${hasCancel ? '' : 'single'}">
            ${hasCancel ? `<button class="wordjar-system-dialog-btn" type="button" data-action="cancel">${escapeText(cancelText)}</button>` : ''}
            <button class="wordjar-system-dialog-btn${dangerClass}" type="button" data-action="confirm">${escapeText(confirmText)}</button>
          </div>
        </div>
      `;

      const card = root.querySelector('.wordjar-system-dialog-card');
      const input = root.querySelector('#wordjarSystemDialogInput');
      const confirmBtn = root.querySelector('[data-action="confirm"]');
      const cancelBtn = root.querySelector('[data-action="cancel"]');

      const cleanup = value => {
        root.classList.remove('open');
        root.onpointerdown = null;
        document.removeEventListener('keydown', onKeyDown, true);
        setTimeout(() => { root.innerHTML = ''; }, 160);
        resolve(value);
      };

      const confirm = () => {
        if (type === 'prompt') cleanup(input ? input.value : '');
        else cleanup(true);
      };

      const cancel = () => cleanup(type === 'alert' ? true : type === 'prompt' ? null : false);

      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
        if (event.key === 'Enter' && (type !== 'prompt' || document.activeElement === input)) {
          event.preventDefault();
          confirm();
        }
      }

      root.onpointerdown = event => {
        if (!card.contains(event.target)) cancel();
      };
      confirmBtn.onclick = confirm;
      if (cancelBtn) cancelBtn.onclick = cancel;

      document.addEventListener('keydown', onKeyDown, true);
      root.classList.add('open');
      setTimeout(() => (input || confirmBtn).focus(), 20);
    });
  }

  window.wordjarAlert = function wordjarAlert(message, options = {}) {
    return openDialog({ ...options, type: 'alert', message: String(message ?? '') });
  };

  window.wordjarConfirm = function wordjarConfirm(message, options = {}) {
    return openDialog({ ...options, type: 'confirm', message: String(message ?? '') });
  };

  window.wordjarPrompt = function wordjarPrompt(message, defaultValue = '', options = {}) {
    return openDialog({ ...options, type: 'prompt', message: String(message ?? ''), defaultValue });
  };

  window.alert = function wordjarNativeAlertReplacement(message) {
    window.wordjarAlert(message, { title: 'WordJar' });
  };

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function patchAppActions() {
    if (window[PATCH_FLAG]) return;

    const canPatchCore =
      typeof window.deleteSelectedCards === 'function' &&
      typeof window.deleteWord === 'function' &&
      typeof window.saveWord === 'function' &&
      typeof window.processCSV === 'function' &&
      typeof window.handleJSONImport === 'function';

    if (!canPatchCore) return;
    window[PATCH_FLAG] = true;

    window.deleteSelectedCards = async function deleteSelectedCardsWordJarDialog() {
      if (selectedCards.size === 0) return safeToast('No cards selected');
      const count = selectedCards.size;
      const ok = await wordjarConfirm(`Delete ${count} selected cards?`, {
        title: 'Delete Cards',
        confirmText: 'Delete',
        danger: true
      });
      if (!ok) return;

      D.words = D.words.filter(w => !selectedCards.has(String(w.id)));
      selectedCards.clear();
      isSelectMode = false;
      save();

      const btn = document.getElementById('btnSelectCards');
      if (btn) btn.textContent = 'Select';
      updateSelectActions();
      renderDeckCards();
      renderWords();
      renderDecks();
      updateHome();
      safeToast(`${count} cards deleted`);
    };

    window.deleteWord = async function deleteWordWordJarDialog() {
      const ok = await wordjarConfirm('Delete this word?', {
        title: 'Delete Word',
        confirmText: 'Delete',
        danger: true
      });
      if (!ok) return;

      D.words = D.words.filter(x => x.id !== editWordId);
      save();
      closeO('wordModal');
      closeO('detailModal');
      renderWords();
      renderDecks();
      updateHome();
      safeToast('Deleted');
      setTimeout(() => {
        if (prevPage === 'deck-cards') { renderDeckCards(); nav('deck-cards'); }
        else if (prevPage === 'deck-overview') { showDeckOverview(currentStudyDeckId); }
      }, 50);
    };

    window.saveWord = async function saveWordWordJarDialog() {
      const word = document.getElementById('fWord').value.trim();
      const meaning = document.getElementById('fMeaning').value.trim();
      const deckId = document.getElementById('fDeck').value;

      if (!word || !meaning) return safeToast('Please fill in required fields');

      const normalizedWord = word.toLowerCase();
      const duplicateWords = D.words.filter(w =>
        w.id !== editWordId &&
        String(w.word || '').trim().toLowerCase() === normalizedWord
      );

      if (duplicateWords.length > 0) {
        const sameDeck = duplicateWords.some(w => w.deckId === deckId);
        const ok = await wordjarConfirm(
          sameDeck
            ? 'This word already exists in this deck. Add it again?'
            : 'This word already exists in another deck. Add it again?',
          { title: 'Duplicate Word', confirmText: 'Add Again' }
        );
        if (!ok) {
          safeToast('Cancelled');
          return;
        }
      }

      const typeStr = [...selectedTypes].join(', ') || 'N';
      const data = {
        word,
        meaning,
        type: typeStr,
        deckId,
        lang: /[\u3040-\u30ff\u3400-\u9fff]/.test(word) ? 'ja' : 'en',
        pronunciation: document.getElementById('fPron').value.trim(),
        example: document.getElementById('fEx').value.trim(),
        notes: document.getElementById('fNotes').value.trim()
      };

      if (editWordId) {
        Object.assign(D.words.find(x => x.id === editWordId), data);
        safeToast('Updated');
      } else {
        D.words.push({ id: 'w' + Date.now(), ...data, starred: false, addedDate: today(), interval: 1, reps: 0, ef: 2.5, nextReview: null });
        safeToast('Added!');
      }

      save();
      document.getElementById('wordModal').classList.remove('open');
      document.getElementById('detailModal').classList.remove('open');

      setTimeout(() => {
        renderWords();
        updateHome();
        renderDecks();
        if (prevPage === 'deck-cards') { renderDeckCards(); nav('deck-cards'); }
        else if (prevPage === 'deck-overview') showDeckOverview(currentStudyDeckId);
        else if (prevPage === 'words') nav('words');
        else if (prevPage === 'decks') nav('decks');
        else if (prevPage === 'home') nav('home');
      }, 50);
    };

    window.processCSV = async function processCSVWordJarDialog(text) {
      try {
        const lines = String(text || '').split(/\r?\n/);
        const targetDeck = importTargetDeckId || D.decks[0]?.id || SYSTEM_NO_DECK_ID;
        const targetDeckName = isSystemNoDeckId(targetDeck)
          ? SYSTEM_NO_DECK_NAME
          : (D.decks.find(d => String(d.id) === String(targetDeck))?.name || SYSTEM_NO_DECK_NAME);

        const importable = [];
        const duplicateSameDeck = [];
        let invalidCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = parseCSVLine(line);
          const item = makeImportedWord(cols, targetDeck, i);
          if (!item) {
            invalidCount++;
            continue;
          }

          const lowerWord = item.word.toLowerCase().trim();
          const existsInTargetDeck = D.words.some(w =>
            String(w.word || '').toLowerCase().trim() === lowerWord &&
            String(w.deckId || '') === String(targetDeck || '')
          );

          if (existsInTargetDeck) duplicateSameDeck.push(item);
          else importable.push(item);
        }

        let finalImport = [...importable];
        let skippedDuplicateCount = 0;

        if (duplicateSameDeck.length > 0) {
          const includeDupes = await askDuplicateImportChoice(duplicateSameDeck.length, targetDeckName);
          if (includeDupes) finalImport = finalImport.concat(duplicateSameDeck);
          else skippedDuplicateCount = duplicateSameDeck.length;
        }

        if (!finalImport.length) {
          await wordjarAlert(`No words imported.${skippedDuplicateCount ? ` ${skippedDuplicateCount} duplicates were skipped.` : ''}${invalidCount ? ` ${invalidCount} invalid rows.` : ''}`.trim(), { title: 'Import CSV' });
          return;
        }

        const skipped = skippedDuplicateCount ? `\nSkipped ${skippedDuplicateCount} duplicates already in this deck.` : '';
        const invalid = invalidCount ? `\nIgnored ${invalidCount} invalid rows.` : '';
        const ok = await wordjarConfirm(`Import ${finalImport.length} words to "${targetDeckName}"?${skipped}${invalid}`, {
          title: 'Import CSV',
          confirmText: 'Import'
        });

        if (ok) {
          D.words = [...D.words, ...finalImport];
          save();
          updateHome();
          renderWords();
          renderDecks();
          if (currentStudyDeckId && (isSystemNoDeckId(currentStudyDeckId) || D.decks.some(d => String(d.id) === String(currentStudyDeckId)))) showDeckOverview(currentStudyDeckId);
          if (curPage === 'deck-cards') renderDeckCards();
          safeToast('Imported successfully!');
        }
      } catch (err) {
        safeToast('Import failed');
      }

      const input = document.getElementById('csvInput');
      if (input) input.value = '';
    };

    window.handleJSONImport = function handleJSONImportWordJarDialog(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const parsed = JSON.parse(e.target.result);
          const restored = normalizeWordJarData(parsed.data || parsed);
          if (!Array.isArray(restored.words) || !Array.isArray(restored.decks)) throw new Error('Invalid structure');

          const ok = await wordjarConfirm('Restore this JSON backup? This will replace current local WordJar data.', {
            title: 'Restore Backup',
            confirmText: 'Restore',
            danger: true
          });

          if (ok) {
            D = restored;
            normalizeWordDeckIds();
            save();
            updateHome();
            renderWords();
            renderDecks();
            updateAccount();
            safeToast('JSON backup restored');
          }
        } catch (err) {
          await wordjarAlert('Invalid WordJar JSON backup. No data was changed.', { title: 'Invalid Backup' });
        }
        event.target.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    };

    if (typeof window.loadCloudBackup === 'function') {
      window.loadCloudBackup = async function loadCloudBackupWordJarDialog() {
        const ref = cloudBackupRef();
        if (!ref) return safeToast('Sign in first');

        try {
          const snap = await ref.get();
          if (!snap.exists) return safeToast('No cloud backup found');
          const restored = await getCloudBackupDataFromSnap(snap);
          const ok = await wordjarConfirm('Load cloud backup and replace current local data?', {
            title: 'Load Cloud Backup',
            confirmText: 'Load Backup',
            danger: true
          });

          if (ok) {
            applyCloudBackupData(restored);
            setCloudStatus(`Signed in: ${cloudUser.email || cloudUser.uid}. Loaded from cloud.`, 'ok');
            safeToast('Loaded from cloud');
          }
        } catch (err) {
          setCloudStatus(`Cloud load failed. ${getFirebaseErrorText(err)}`, 'err');
          safeToast('Cloud load failed');
        }
      };
    }

    if (typeof window.clearAll === 'function') {
      window.clearAll = async function clearAllWordJarDialog() {
        const ok = await wordjarConfirm('Clear all WordJar data on this device? This cannot be undone.', {
          title: 'Clear All Data',
          confirmText: 'Clear All',
          danger: true
        });
        if (!ok) return;

        localStorage.removeItem(SK);
        location.reload();
      };
    }
  }

  function schedulePatch() {
    patchAppActions();
    if (!window[PATCH_FLAG]) setTimeout(schedulePatch, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePatch, { once: true });
  } else {
    schedulePatch();
  }
})();

// WordJar AI Smart Fill V1
// Adds Smart Fill next to Auto Fill and uses window.globalApiKey from initAppConfig().

(function installWordJarSmartFillAI() {
  if (window.__wordjarSmartFillAIInstalled) return;
  window.__wordjarSmartFillAIInstalled = true;

  const STYLE_ID = 'wordjarSmartFillAIStyle';
  const GEMINI_MODEL = 'gemini-1.5-flash';
  const BULK_CONCURRENCY = 2;

  let smartFillRunning = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-smart-fill-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 10px;
      }
      .wordjar-smart-fill-btn {
        min-height: 42px;
        border-radius: 14px;
        border: 1px solid var(--bdr);
        background: var(--ink);
        color: var(--sur);
        font: inherit;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
      }
      .wordjar-smart-fill-btn:disabled {
        opacity: .55;
        cursor: not-allowed;
      }
      .wordjar-smart-fill-btn.secondary {
        background: var(--sur);
        color: var(--ink);
      }
    `;
    document.head.appendChild(style);
  }

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function setStatus(message, state) {
    if (typeof setAutoFillStatus === 'function') {
      setAutoFillStatus(message, state);
      return;
    }
    safeToast(message);
  }

  function normalizeWord(value) {
    return String(value || '').trim();
  }

  function escapeHTMLLocal(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function ensureApiKey() {
    if (typeof window.initAppConfig === 'function') {
      await window.initAppConfig();
    }

    const key = String(window.globalApiKey || window.getApiKeyFromMemory?.() || '').trim();
    if (!key) {
      throw new Error('NO_API_KEY');
    }
    return key;
  }

  function extractJSON(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('EMPTY_AI_RESPONSE');

    try {
      return JSON.parse(raw);
    } catch (err) {}

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));

    throw new Error('INVALID_AI_JSON');
  }

  function normalizeSmartFillResult(data) {
    const item = data || {};
    const type = String(item.type || 'N').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'N';
    return {
      word: String(item.word || '').trim(),
      type: ['N', 'V', 'ADJ', 'ADV', 'ART', 'PRON', 'PHR'].includes(type) ? type : 'N',
      pronunciation: String(item.pronunciation || '').trim(),
      meaning: String(item.meaning || '').trim(),
      example: String(item.example || '').trim(),
      notes: String(item.notes || '').trim()
    };
  }

  function buildSmartFillPrompt(word) {
    const mode = D?.reader?.mode || 'en-th';
    const targetMeaning = mode === 'en-th' ? 'Thai meaning for an English learner' : 'clear English learner definition';

    return `You are helping fill a vocabulary flashcard for an A2 English learner.\n\nWord: ${word}\n\nReturn ONLY valid JSON. No markdown.\nSchema:\n{\n  "word": "base word or phrase",\n  "type": "N | V | ADJ | ADV | ART | PRON | PHR",\n  "pronunciation": "/IPA/",\n  "meaning": "${targetMeaning}",\n  "example": "short natural A2-level example sentence using the word",\n  "notes": "short helpful note in Thai, include common usage or confusion"\n}\n\nRules:\n- Keep meaning concise.\n- Example must be simple and natural.\n- Do not include unsafe content.\n- If the word is a phrase, use type PHR.`;
  }

  async function fetchGeminiSmartFill(word) {
    const apiKey = await ensureApiKey();
    const prompt = buildSmartFillPrompt(word);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.25,
            topP: 0.85,
            maxOutputTokens: 512,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`AI_${response.status}_${text.slice(0, 120)}`);
      }

      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
      return normalizeSmartFillResult(extractJSON(text));
    } finally {
      clearTimeout(timer);
    }
  }

  function fillField(id, value, overwrite = true) {
    const el = document.getElementById(id);
    const clean = String(value || '').trim();
    if (!el || !clean) return false;
    if (!overwrite && el.value.trim()) return false;
    el.value = clean;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function selectSmartType(type) {
    if (typeof selectOnlyType === 'function') {
      selectOnlyType(type);
      return;
    }

    const safeType = String(type || 'N').toUpperCase();
    if (typeof selectedTypes !== 'undefined' && selectedTypes.clear) selectedTypes.clear();
    document.querySelectorAll('#typePills .tp').forEach(btn => btn.classList.remove('sel'));
    const target = document.querySelector(`#typePills .tp[data-t="${safeType}"]`) || document.querySelector('#typePills .tp[data-t="N"]');
    if (target) {
      target.classList.add('sel');
      if (typeof selectedTypes !== 'undefined' && selectedTypes.add) selectedTypes.add(target.dataset.t);
    }
  }

  function applySmartFillToForm(result) {
    if (!result) return 0;
    let count = 0;
    if (fillField('fWord', result.word, false)) count++;
    if (fillField('fPron', result.pronunciation, true)) count++;
    if (fillField('fMeaning', result.meaning, true)) count++;
    if (fillField('fEx', result.example, true)) count++;
    if (fillField('fNotes', result.notes || 'Smart-filled with AI. Please check before saving.', true)) count++;
    selectSmartType(result.type);
    return count + 1;
  }

  function applySmartFillToWordObject(wordObject, result) {
    if (!wordObject || !result) return false;
    let changed = false;

    if (result.type) { wordObject.type = result.type; changed = true; }
    if (result.pronunciation) { wordObject.pronunciation = result.pronunciation; changed = true; }
    if (result.meaning) { wordObject.meaning = result.meaning; changed = true; }
    if (result.example) { wordObject.example = result.example; changed = true; }
    if (result.notes) { wordObject.notes = result.notes; changed = true; }

    return changed;
  }

  async function smartFillWord() {
    if (smartFillRunning) return;

    const word = normalizeWord(document.getElementById('fWord')?.value);
    if (!word) {
      setStatus('Type a word first.', 'err');
      safeToast('Type a word first');
      return;
    }

    smartFillRunning = true;
    const btn = document.getElementById('wordjarSmartFillBtn');
    const oldText = btn?.textContent || 'Smart Fill';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Thinking...';
    }

    setStatus('Smart Fill is thinking...', 'loading');

    try {
      const result = await fetchGeminiSmartFill(word);
      const filled = applySmartFillToForm(result);
      setStatus(filled ? 'Smart Fill completed. Check before saving.' : 'Smart Fill found no usable result.', filled ? 'ok' : 'err');
      safeToast(filled ? 'Smart-filled' : 'No AI result');
    } catch (err) {
      if (String(err.message || '').includes('NO_API_KEY')) {
        setStatus('Add Private API Key in Settings first.', 'err');
        safeToast('Add API Key first');
      } else {
        console.warn('smartFillWord failed', err);
        setStatus('Smart Fill failed. Check API Key or try again.', 'err');
        safeToast('Smart Fill failed');
      }
    } finally {
      smartFillRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  async function runSmartFillPool(items, worker, limit, onProgress) {
    let index = 0;
    let done = 0;
    const count = Math.min(limit, items.length);

    async function runWorker() {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
        done++;
        if (onProgress) onProgress(done, items.length);
      }
    }

    await Promise.all(Array.from({ length: count }, runWorker));
  }

  function getDeckCardsForSmartFill() {
    if (!Array.isArray(D?.words)) return [];
    if (typeof currentStudyDeckId === 'undefined') return [];
    return D.words.filter(w => String(w.deckId) === String(currentStudyDeckId));
  }

  function getSmartFillTargetCardIds() {
    if (typeof isSelectMode === 'undefined' || !isSelectMode) return [];
    if (typeof selectedCards !== 'undefined' && selectedCards?.size > 0) return Array.from(selectedCards).map(String);
    return getDeckCardsForSmartFill().map(w => String(w.id));
  }

  async function smartFillSelectedCards() {
    if (smartFillRunning) return;

    const targetIds = getSmartFillTargetCardIds();
    if (!targetIds.length) {
      safeToast('No cards available');
      return;
    }

    try {
      await ensureApiKey();
    } catch (err) {
      safeToast('Add API Key first');
      return;
    }

    const idSet = new Set(targetIds);
    const targets = D.words.filter(w => idSet.has(String(w.id)) && normalizeWord(w.word));
    const btn = document.getElementById('btnSmartFillSelectedCards');
    const badge = document.getElementById('selectCountBadge');
    const oldText = btn?.textContent || 'Smart';

    let filled = 0;
    let failed = 0;
    let saveCounter = 0;

    smartFillRunning = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'AI...';
    }

    try {
      await runSmartFillPool(
        targets,
        async w => {
          try {
            const result = await fetchGeminiSmartFill(w.word);
            if (applySmartFillToWordObject(w, result)) {
              filled++;
              saveCounter++;
              if (saveCounter >= 8) {
                saveCounter = 0;
                if (typeof save === 'function') save();
              }
            }
          } catch (err) {
            failed++;
          }
        },
        BULK_CONCURRENCY,
        (done, total) => {
          if (btn) btn.textContent = `${done}/${total}`;
          if (badge) badge.textContent = `Smart Filling ${done}/${total}`;
        }
      );

      if (typeof save === 'function') save();
      if (typeof renderDeckCards === 'function') renderDeckCards();
      if (typeof renderWords === 'function') renderWords();
      if (typeof renderDecks === 'function') renderDecks();
      if (typeof updateHome === 'function') updateHome();
      safeToast(`Smart Fill done: ${filled} filled${failed ? `, ${failed} failed` : ''}`);
    } finally {
      smartFillRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
      if (typeof updateSelectActions === 'function') updateSelectActions();
    }
  }

  function findAutoFillButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => /auto\s*fill/i.test(btn.textContent || '') && !btn.dataset.wordjarSmartFillLinked);
  }

  function mountWordSmartFillButton() {
    injectStyles();
    if (document.getElementById('wordjarSmartFillBtn')) return;

    const autoBtn = findAutoFillButton();
    if (!autoBtn) return;

    autoBtn.dataset.wordjarSmartFillLinked = '1';

    const row = document.createElement('div');
    row.className = 'wordjar-smart-fill-row';

    const autoCloneSlot = document.createElement('div');
    const smartBtn = document.createElement('button');
    smartBtn.id = 'wordjarSmartFillBtn';
    smartBtn.className = 'wordjar-smart-fill-btn';
    smartBtn.type = 'button';
    smartBtn.textContent = 'Smart Fill';
    smartBtn.onclick = smartFillWord;

    const parent = autoBtn.parentElement;
    parent.insertBefore(row, autoBtn);
    row.appendChild(autoCloneSlot);
    autoCloneSlot.appendChild(autoBtn);
    row.appendChild(smartBtn);

    autoBtn.classList.add('wordjar-smart-fill-btn', 'secondary');
    autoBtn.style.width = '100%';
  }

  function mountDeckSmartFillButton() {
    const buttonsWrap = document.querySelector('#cardSelectActions .select-action-buttons');
    if (!buttonsWrap || document.getElementById('btnSmartFillSelectedCards')) return;

    const fillBtn = document.getElementById('btnAutoFillSelectedCards');
    const smartBtn = document.createElement('button');
    smartBtn.id = 'btnSmartFillSelectedCards';
    smartBtn.className = 'btn btn-soft-fill';
    smartBtn.type = 'button';
    smartBtn.textContent = 'Smart';
    smartBtn.onclick = smartFillSelectedCards;

    if (fillBtn) fillBtn.insertAdjacentElement('afterend', smartBtn);
    else buttonsWrap.appendChild(smartBtn);
  }

  function patchDeckBulkRender() {
    if (window.__wordjarSmartFillDeckBulkPatched) return;
    const originalUpdate = window.updateSelectActions;
    if (typeof originalUpdate !== 'function') return;

    window.__wordjarSmartFillDeckBulkPatched = true;
    window.updateSelectActions = function updateSelectActionsWithSmartFill() {
      const result = originalUpdate.apply(this, arguments);
      setTimeout(mountDeckSmartFillButton, 0);
      return result;
    };
  }

  function boot() {
    injectStyles();
    mountWordSmartFillButton();
    mountDeckSmartFillButton();
    patchDeckBulkRender();
  }

  window.smartFillWord = smartFillWord;
  window.smartFillSelectedCards = smartFillSelectedCards;
  window.WordJarSmartFillAI = {
    smartFillWord,
    smartFillSelectedCards,
    fetchGeminiSmartFill
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 400);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

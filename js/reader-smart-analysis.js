// WordJar Reader Smart Translation and Analysis V1
// Uses the private API key in window.globalApiKey to translate and explain Reader context sentences.

(function installWordJarReaderSmartAnalysis() {
  if (window.__wordjarReaderSmartAnalysisInstalled) return;
  window.__wordjarReaderSmartAnalysisInstalled = true;

  const STYLE_ID = 'wordjarReaderSmartAnalysisStyle';
  const GEMINI_MODEL = 'gemini-1.5-flash';
  const DEFAULT_LEVEL = 'A2';
  const ENHANCE_RETRY_LIMIT = 18;
  const ENHANCE_RETRY_DELAY = 45;

  let activeWord = '';
  let activeText = '';
  let analysisRunning = false;
  let enhanceObserver = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-reader-ai-card {
        margin-top: 12px;
        border: 1px solid var(--bdr);
        border-radius: 16px;
        background: var(--sur2);
        padding: 12px;
      }
      .wordjar-reader-ai-title {
        color: var(--ink);
        font-size: 13px;
        font-weight: 900;
        margin-bottom: 6px;
      }
      .wordjar-reader-ai-section {
        margin-top: 10px;
      }
      .wordjar-reader-ai-label {
        color: var(--ink2);
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
        margin-bottom: 4px;
      }
      .wordjar-reader-ai-text {
        color: var(--ink);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 700;
      }
      .wordjar-reader-ai-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-top: 6px;
      }
      .wordjar-reader-ai-vocab {
        border: 1px solid var(--bdr);
        border-radius: 12px;
        background: var(--sur);
        padding: 8px 10px;
      }
      .wordjar-reader-ai-vocab b {
        color: var(--ink);
        font-size: 13px;
      }
      .wordjar-reader-ai-vocab span {
        display: block;
        color: var(--ink2);
        font-size: 12px;
        line-height: 1.35;
        margin-top: 2px;
        font-weight: 700;
      }
      .wordjar-reader-ai-btn {
        grid-column: 1 / -1;
      }
      .wordjar-reader-ai-error {
        color: #991b1b;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  function safeText(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function getUserLevel() {
    return String(
      D?.profile?.userLevel ||
      D?.profile?.englishLevel ||
      D?.profile?.cefrLevel ||
      D?.reader?.userLevel ||
      DEFAULT_LEVEL
    ).trim().toUpperCase() || DEFAULT_LEVEL;
  }

  async function ensureApiKey() {
    if (typeof window.initAppConfig === 'function') await window.initAppConfig();
    const key = String(window.globalApiKey || window.getApiKeyFromMemory?.() || '').trim();
    if (!key) throw new Error('NO_API_KEY');
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

  function buildPrompt(text, userLevel) {
    return `You are an English learning assistant for Thai learners.\n\nTask: Smart_Translation_and_Analysis\nUser level: ${userLevel}\nText: ${text}\n\nReturn ONLY valid JSON. No markdown.\nSchema:\n{\n  "translation": "Natural Thai translation that fits the context and sounds polished",\n  "grammar_explanation": "Explain difficult grammar simply for a ${userLevel} learner in Thai",\n  "vocabulary_focus": [\n    {\n      "word": "important word or phrase",\n      "meaning": "Thai meaning in this context",\n      "why_important": "short Thai explanation why this matters for ${userLevel}"\n    }\n  ]\n}\n\nRules:\n- Translation must preserve the feeling and context, not word-by-word.\n- Grammar explanation must be simple, short, and easy.\n- Choose 2-5 vocabulary items useful for this learner level.\n- Keep Thai wording natural and learner-friendly.`;
  }

  function normalizeAnalysis(data) {
    const item = data || {};
    const vocab = Array.isArray(item.vocabulary_focus) ? item.vocabulary_focus : [];

    return {
      translation: String(item.translation || '').trim(),
      grammar_explanation: String(item.grammar_explanation || item.explanation || '').trim(),
      vocabulary_focus: vocab
        .map(v => ({
          word: String(v?.word || '').trim(),
          meaning: String(v?.meaning || '').trim(),
          why_important: String(v?.why_important || v?.note || '').trim()
        }))
        .filter(v => v.word || v.meaning || v.why_important)
        .slice(0, 5)
    };
  }

  async function smartTranslateAndAnalyze(text, userLevel = getUserLevel()) {
    const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleanText) throw new Error('EMPTY_TEXT');

    const apiKey = await ensureApiKey();
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
              parts: [{ text: buildPrompt(cleanText, userLevel) }]
            }
          ],
          generationConfig: {
            temperature: 0.25,
            topP: 0.85,
            maxOutputTokens: 900,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`AI_${response.status}_${errorText.slice(0, 120)}`);
      }

      const payload = await response.json();
      const output = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
      return normalizeAnalysis(extractJSON(output));
    } finally {
      clearTimeout(timer);
    }
  }

  function analysisHTML(result, userLevel = getUserLevel()) {
    const vocab = Array.isArray(result?.vocabulary_focus) ? result.vocabulary_focus : [];
    return `
      <div class="wordjar-reader-ai-card">
        <div class="wordjar-reader-ai-title">Smart Analysis · ${safeText(userLevel)}</div>
        <div class="wordjar-reader-ai-section">
          <div class="wordjar-reader-ai-label">Translation</div>
          <div class="wordjar-reader-ai-text">${safeText(result?.translation || 'No translation returned.')}</div>
        </div>
        <div class="wordjar-reader-ai-section">
          <div class="wordjar-reader-ai-label">Grammar</div>
          <div class="wordjar-reader-ai-text">${safeText(result?.grammar_explanation || 'No grammar explanation returned.')}</div>
        </div>
        <div class="wordjar-reader-ai-section">
          <div class="wordjar-reader-ai-label">Vocabulary Focus</div>
          <div class="wordjar-reader-ai-list">
            ${vocab.length ? vocab.map(item => `
              <div class="wordjar-reader-ai-vocab">
                <b>${safeText(item.word)}</b>
                <span>${safeText(item.meaning)}</span>
                <span>${safeText(item.why_important)}</span>
              </div>
            `).join('') : '<div class="wordjar-reader-ai-text">No vocabulary focus returned.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderAnalysisLoading() {
    const slot = document.getElementById('wordjarReaderAIAnalysisSlot');
    if (slot) {
      slot.innerHTML = `
        <div class="wordjar-reader-ai-card">
          <div class="wordjar-reader-ai-title">Smart Analysis</div>
          <div class="wordjar-reader-ai-text">AI is reading the sentence...</div>
        </div>
      `;
    }
  }

  function renderAnalysisError(message) {
    const slot = document.getElementById('wordjarReaderAIAnalysisSlot');
    if (slot) {
      slot.innerHTML = `
        <div class="wordjar-reader-ai-card">
          <div class="wordjar-reader-ai-title">Smart Analysis</div>
          <div class="wordjar-reader-ai-error">${safeText(message)}</div>
        </div>
      `;
    }
  }

  async function runReaderSmartAnalysis() {
    if (analysisRunning) return;

    const text = activeText || document.querySelector('#readerPanel .reader-context')?.textContent || '';
    if (!String(text || '').trim()) {
      safeToast('No sentence to analyze');
      return;
    }

    analysisRunning = true;
    const btn = document.getElementById('wordjarReaderAIAnalyzeBtn');
    const oldText = btn?.textContent || 'Smart Analysis';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Analyzing...';
    }
    renderAnalysisLoading();

    try {
      const result = await smartTranslateAndAnalyze(text, getUserLevel());
      const slot = document.getElementById('wordjarReaderAIAnalysisSlot');
      if (slot) slot.innerHTML = analysisHTML(result, getUserLevel());
      safeToast('Analysis ready');
    } catch (err) {
      console.warn('runReaderSmartAnalysis failed', err);
      const message = String(err.message || '').includes('NO_API_KEY')
        ? 'Add Private API Key in Settings first.'
        : 'Smart Analysis failed. Check API Key or try again.';
      renderAnalysisError(message);
      safeToast(message);
    } finally {
      analysisRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  function patchOpenReaderPanel() {
    if (window.__wordjarReaderSmartAnalysisPanelPatched) return;
    const original = window.openReaderPanel;
    if (typeof original !== 'function') return;

    window.__wordjarReaderSmartAnalysisPanelPatched = true;
    window.openReaderPanel = function openReaderPanelWithSmartAnalysis(word, offset) {
      const result = original.apply(this, arguments);
      scheduleEnhancePanel(word);
      return result;
    };
  }

  function ensureAnalyzeButton(actions) {
    let btn = document.getElementById('wordjarReaderAIAnalyzeBtn');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'wordjarReaderAIAnalyzeBtn';
    btn.className = 'btn btn-s wordjar-reader-ai-btn';
    btn.type = 'button';
    btn.textContent = 'Smart Analysis';
    btn.onclick = runReaderSmartAnalysis;
    actions.appendChild(btn);
    return btn;
  }

  function ensureAnalysisSlot(panel) {
    let slot = document.getElementById('wordjarReaderAIAnalysisSlot');
    if (slot) return slot;

    slot = document.createElement('div');
    slot.id = 'wordjarReaderAIAnalysisSlot';
    panel.appendChild(slot);
    return slot;
  }

  function enhancePanel(word = '') {
    injectStyles();
    const panel = document.getElementById('readerPanel');
    if (!panel || !panel.classList.contains('open')) return false;

    const actions = panel.querySelector('.reader-actions');
    if (!actions) return false;

    const context = panel.querySelector('.reader-context')?.textContent || '';
    activeWord = String(word || panel.querySelector('.reader-word')?.textContent || activeWord || '').trim();
    activeText = String(context || activeText || '').trim();

    ensureAnalyzeButton(actions);
    ensureAnalysisSlot(panel);
    return true;
  }

  function scheduleEnhancePanel(word = '', attempt = 0) {
    if (enhancePanel(word)) return;
    if (attempt >= ENHANCE_RETRY_LIMIT) return;

    setTimeout(() => scheduleEnhancePanel(word, attempt + 1), ENHANCE_RETRY_DELAY);
  }

  function startPanelObserver() {
    if (enhanceObserver || !document.body || typeof MutationObserver !== 'function') return;

    enhanceObserver = new MutationObserver(() => {
      const panel = document.getElementById('readerPanel');
      if (panel?.classList.contains('open')) scheduleEnhancePanel(activeWord);
    });

    enhanceObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function boot() {
    injectStyles();
    patchOpenReaderPanel();
    startPanelObserver();
    scheduleEnhancePanel();
  }

  window.smartTranslateAndAnalyze = smartTranslateAndAnalyze;
  window.runReaderSmartAnalysis = runReaderSmartAnalysis;
  window.WordJarReaderSmartAnalysis = {
    smartTranslateAndAnalyze,
    runReaderSmartAnalysis,
    enhancePanel,
    scheduleEnhancePanel
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 350);
  setTimeout(boot, 900);
  document.addEventListener('click', () => setTimeout(() => scheduleEnhancePanel(), 0), true);
})();

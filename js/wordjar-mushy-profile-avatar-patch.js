// WordJar Mushy Profile Avatar Patch
// Keeps Mushy's empty state and clear dialog aligned with the selected profile avatar.
// Also upgrades Mushy chat to long-form smart Gemini responses.

(function installWordJarMushyProfileAvatarPatch() {
  if (window.__wordjarMushyProfileAvatarPatchInstalled) return;
  window.__wordjarMushyProfileAvatarPatchInstalled = true;

  const STYLE_ID = 'wordjarMushyProfileAvatarPatchStyle';
  const SMART_PATCH_FLAG = '__wordjarMushySmartResponsePatchInstalled';
  const CONTEXT_KEY = 'wordjar_mushy_pending_context_v1';
  const API_VERSION = 'v1beta';
  const MAX_OUTPUT_TOKENS = 8192;
  const MAX_CONTEXT_CHARS = 20000;
  const MAX_QUESTION_CHARS = 5000;
  const SMART_MODELS = [
    'gemini-2.5-pro',
    'gemini-pro-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest'
  ];

  function safeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-mushy-confirm-icon {
        width: auto;
        height: auto;
        min-width: 0;
        min-height: 0;
        margin-bottom: 18px;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: #0d0d0d;
        box-shadow: none;
        filter: none;
        padding: 0;
      }

      .wordjar-mushy-confirm-icon .wordjar-mushy-empty-avatar-img {
        width: 76px;
        height: 76px;
        display: block;
        object-fit: contain;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        filter: none;
      }

      .wordjar-mushy-confirm-icon .wordjar-mushy-empty-avatar-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        line-height: 1;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        filter: none;
      }

      #pg-mushy-chat .wordjar-mushy-messages {
        overflow-y: auto;
        overflow-x: hidden;
        padding-top: 28px;
        padding-bottom: calc(24px + env(safe-area-inset-bottom));
      }

      #pg-mushy-chat .wordjar-mushy-msg,
      #pg-mushy-chat .wordjar-mushy-bubble,
      #pg-mushy-chat .wordjar-mushy-bubble p {
        max-height: none;
        height: auto;
        overflow: visible;
        -webkit-line-clamp: unset;
        line-clamp: unset;
      }

      #pg-mushy-chat .wordjar-mushy-bubble {
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      #pg-mushy-chat .wordjar-mushy-msg.assistant .wordjar-mushy-bubble {
        line-height: 1.72;
      }

      #pg-mushy-chat .wordjar-mushy-msg.assistant .wordjar-mushy-bubble p + p {
        margin-top: 1em;
      }
    `;

    document.head.appendChild(style);
  }

  function getComputedAvatarSrc() {
    const avatarEl = document.getElementById('avIcon') || document.querySelector('.avatar-img');
    if (!avatarEl) return '';

    const image = avatarEl.querySelector?.('img');
    if (image?.src) return image.src;

    const inlineBg = avatarEl.style?.backgroundImage || '';
    const computedBg = window.getComputedStyle ? getComputedStyle(avatarEl).backgroundImage : '';
    const raw = inlineBg && inlineBg !== 'none' ? inlineBg : computedBg;
    const match = String(raw || '').match(/url\(["']?(.*?)["']?\)/i);
    return match?.[1] || '';
  }

  function getProfileAvatarSrc() {
    const profile = window.D?.profile || {};
    const directCandidates = [
      profile.photoURL,
      profile.photoUrl,
      profile.avatarUrl,
      profile.avatarURL,
      profile.profileImage,
      profile.profileImageUrl,
      profile.image,
      localStorage.getItem('wordjar_profile_photo'),
      localStorage.getItem('wordjar_profile_avatar'),
      localStorage.getItem('wordjar_profile_image'),
      getComputedAvatarSrc()
    ];

    const direct = directCandidates
      .map(value => String(value || '').trim())
      .find(value => value && (/^(data:image|blob:|https?:|assets\/)/i.test(value) || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(value)));

    if (direct) return direct;

    const avatarId = String(profile.avatar || '').trim();
    const avatarMap = {
      idle: 'assets/avatars/BunnyIdle.gif',
      run: 'assets/avatars/BunnyRun.gif',
      jump: 'assets/avatars/BunnyJump.gif',
      sit: 'assets/avatars/BunnySitting.gif',
      sleep: 'assets/avatars/BunnySleep.gif',
      carrot: 'assets/avatars/BunnyCarrotSkill.gif',
      hurt: 'assets/avatars/BunnyHurt.gif',
      attack: 'assets/avatars/BunnyAttack.gif',
      lie: 'assets/avatars/BunnyLieDown.gif',
      dead: 'assets/avatars/BunnyDead.gif',
      'frog-idle': 'assets/avatars/FrogIdle.gif',
      'frog-jump': 'assets/avatars/FrogJump.gif',
      'frog-land': 'assets/avatars/FrogLand.gif',
      'frog-fall': 'assets/avatars/FrogFall.gif',
      'frog-hurt': 'assets/avatars/FrogHurt.gif',
      'frog-death': 'assets/avatars/FrogDeath.gif',
      'ducky-idle': 'assets/avatars/Duckyidle.gif',
      'ducky-walk': 'assets/avatars/Duckywalk.gif',
      'ducky-jump': 'assets/avatars/Duckyjump.gif',
      'ducky-land': 'assets/avatars/Duckyland.gif',
      'ducky-fall': 'assets/avatars/Duckyfall.gif',
      'ducky-fall-2': 'assets/avatars/Duckyfall_2.gif',
      'ducky-death': 'assets/avatars/Duckydeath.gif',
      'ducky-hit': 'assets/avatars/Duckyhit.gif',
      'ducky-wall-hit': 'assets/avatars/Duckywall_hit.gif',
      'ducky-wall-slide': 'assets/avatars/Duckywall_slide.gif',
      'ducky-climb-back': 'assets/avatars/DuckyClimbBack.gif',
      'ducky-crouch': 'assets/avatars/Duckycrouch.gif',
      'ducky-crouch-walk': 'assets/avatars/Duckycrouch_walk.gif',
      'ducky-floating-flap': 'assets/avatars/Duckyfloating_flap.gif',
      'ducky-inhale-start': 'assets/avatars/Duckyinhale_start.gif',
      'ducky-inhale-float': 'assets/avatars/Duckyinhale_float.gif',
      'ducky-inhaling': 'assets/avatars/Duckyinhaling.gif',
      'ducky-jump-fall-land': 'assets/avatars/Duckyjump_fall_land.gif',
      'ducky-ledge-grab': 'assets/avatars/Duckyledge_grab.gif',
      'ducky-multi-jump': 'assets/avatars/Duckymulti_jump.gif',
      'ducky-left-jab': 'assets/avatars/Duckyleft_jab.gif',
      'ducky-right-hook': 'assets/avatars/Duckyright_hook.gif'
    };

    if (avatarMap[avatarId]) return avatarMap[avatarId];
    if (/^(data:image|blob:|https?:|assets\/)/i.test(avatarId)) return avatarId;
    return '';
  }

  function renderProfileAvatar() {
    const src = getProfileAvatarSrc();
    if (src) {
      return `<img class="wordjar-mushy-empty-avatar-img" src="${safeText(src)}" alt="Mushy profile avatar">`;
    }
    return '<span class="wordjar-mushy-empty-avatar-fallback" aria-hidden="true">🐈‍⬛🍄</span>';
  }

  function applyClearDialogAvatar() {
    injectStyle();
    const icon = document.querySelector('#wordjarMushyClearDialog .wordjar-mushy-confirm-icon');
    if (!icon) return;
    icon.innerHTML = renderProfileAvatar();
  }

  function patchClearAction() {
    if (window.__wordjarMushyClearProfilePatched || !window.WordJarMushyChat?.clear) return;
    window.__wordjarMushyClearProfilePatched = true;

    const originalClear = window.WordJarMushyChat.clear;
    window.WordJarMushyChat.clear = function clearWithProfileAvatar() {
      const result = originalClear.apply(this, arguments);
      setTimeout(applyClearDialogAvatar, 0);
      setTimeout(applyClearDialogAvatar, 80);
      return result;
    };
  }

  function getUserLevel() {
    return String(
      window.D?.profile?.userLevel ||
      window.D?.profile?.englishLevel ||
      window.D?.profile?.cefrLevel ||
      window.D?.reader?.userLevel ||
      'B1'
    ).trim().toUpperCase() || 'B1';
  }

  function normalizeText(value, maxLength) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()
      .slice(0, maxLength);
  }

  async function ensureApiKey() {
    if (typeof window.initAppConfig === 'function') await window.initAppConfig();
    const key = String(
      window.globalApiKey || window.getApiKeyFromMemory?.() || ''
    ).trim();
    if (!key) throw new Error('NO_API_KEY');
    return key;
  }

  function buildSmartMushyPrompt(input = {}) {
    const level = getUserLevel();
    const task = String(input.task || 'chat');
    const question = normalizeText(
      input.question || input.message || '',
      MAX_QUESTION_CHARS
    );
    const context = normalizeText(
      input.contextText || input.context || '',
      MAX_CONTEXT_CHARS
    );

    return `You are Mushy, WordJar's strongest English-learning assistant.\n\nCore role:\n- Act like Gemini-level language tutor for Thai learners.\n- Main language is Thai. Use English only for examples, vocabulary, grammar labels, and quoted text.\n- Be accurate, context-aware, and useful for serious English study.\n- Do not pretend to change app data unless a WordJar function actually does it.\n\nLearner level: ${level}\nTask: ${task}\n\nContext from WordJar, Reader, deck, or previous chat:\n${context || '(no extra context)'}\n\nUser message:\n${question || '(no question provided)'}\n\nAnswer policy:\n- Do not summarize aggressively. Give complete, long-form answers when the user asks for translation, grammar, nuance, or analysis.\n- Preserve paragraph spacing. Use readable Thai paragraphs.\n- Avoid cramped bullet lists unless a list is clearly better.\n- For English text analysis, cover: การแปล, ความหมายในบริบท, คำศัพท์และวลีสำคัญ, grammar / sentence structure, nuance, and extra examples.\n- If the text is long, analyze the most important parts first and say clearly what remains.\n- For vocabulary, explain meaning in context, pronunciation if useful, collocations, register, common mistakes, and 2-4 examples.\n- For grammar, explain the structure, why it is used, and how to reuse it.\n- Match examples to ${level}, but do not oversimplify important nuance.\n- End naturally. Do not force cat roleplay or excessive emoji.\n\nOutput requirements:\n- Use Thai headings only when they improve readability.\n- Never cut off mid-section intentionally.\n- If the API output limit is reached, end with: [กดต่อเพื่อให้ Mushy วิเคราะห์ต่อ]`;
  }

  function geminiEndpoint(model, apiKey) {
    return `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  function shouldTryNextModel(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.status === 400 ||
      error?.status === 404 ||
      message.includes('not found') ||
      message.includes('unsupported') ||
      message.includes('model');
  }

  async function callMushyGeminiModel({ apiKey, model, prompt, options }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 90000);

    try {
      const response = await fetch(geminiEndpoint(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.45,
            topP: options.topP ?? 0.95,
            maxOutputTokens: options.maxOutputTokens || MAX_OUTPUT_TOKENS
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
        error.apiMessage = apiMessage;
        throw error;
      }

      const candidate = payload?.candidates?.[0] || {};
      const text = candidate.content?.parts
        ?.map(part => part.text || '')
        .join('\n')
        .trim() || '';

      if (!text) throw new Error(`EMPTY_AI_RESPONSE from ${model}`);

      return {
        text,
        model,
        finishReason: candidate.finishReason || ''
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function userFacingError(error) {
    const message = String(error?.message || '');
    const apiMessage = String(error?.apiMessage || '');
    if (message.includes('NO_API_KEY')) return 'ยังไม่มี Private API Key ใน Settings';
    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) return 'API Key ไม่ถูกต้อง ตรวจใน Settings อีกครั้ง';
    if (message.includes('403') || message.includes('PERMISSION_DENIED')) return 'API Key ยังไม่มีสิทธิ์ใช้โมเดลนี้ หรือถูกจำกัด referrer';
    if (message.includes('429')) return 'Gemini quota หรือ rate limit เต็มชั่วคราว';
    if (message.includes('Failed to fetch') || message.includes('aborted')) return 'เชื่อมต่อ Gemini ไม่สำเร็จ หรือคำตอบใช้เวลานานเกินไป';
    return `Mushy ตอบไม่สำเร็จ: ${apiMessage || message || 'unknown error'}`;
  }

  async function askSmartMushy(input = {}) {
    const apiKey = await ensureApiKey();
    const prompt = buildSmartMushyPrompt(input);
    const models = input.models || SMART_MODELS;
    let lastError = null;

    for (const model of models) {
      try {
        const result = await callMushyGeminiModel({
          apiKey,
          model,
          prompt,
          options: {
            maxOutputTokens: input.maxOutputTokens || MAX_OUTPUT_TOKENS,
            temperature: input.temperature,
            topP: input.topP,
            timeoutMs: input.timeoutMs
          }
        });

        const isTokenCut = String(result.finishReason).toUpperCase() === 'MAX_TOKENS';
        const suffix = isTokenCut && !result.text.includes('[กดต่อ')
          ? '\n\n[กดต่อเพื่อให้ Mushy วิเคราะห์ต่อ]'
          : '';

        window.WordJarMushyAI.lastModel = result.model;
        return {
          text: `${result.text}${suffix}`,
          model: result.model,
          cached: false,
          finishReason: result.finishReason
        };
      } catch (err) {
        lastError = err;
        console.warn('Smart Mushy model failed', model, err);
        if (!shouldTryNextModel(err)) break;
      }
    }

    throw lastError || new Error('MUSHY_AI_FAILED');
  }

  function patchReaderContextLimit() {
    if (window.__wordjarMushyReaderContextLimitPatched || !window.WordJarMushyChat?.askFromReader) return;
    window.__wordjarMushyReaderContextLimitPatched = true;

    window.WordJarMushyChat.askFromReader = function askFromReaderLong(text, question) {
      const cleanText = normalizeText(text, MAX_CONTEXT_CHARS);
      sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({
        source: 'reader',
        text: cleanText
      }));
      WordJarMushyChat.open();
      if (!question) return;

      const input = document.getElementById('wordjarMushyInput');
      if (!input) return;
      input.value = question;
      WordJarMushyChat.autosizeInput?.();
    };
  }

  function patchSmartMushyAI() {
    if (window[SMART_PATCH_FLAG] || !window.WordJarMushyAI) return;
    window[SMART_PATCH_FLAG] = true;

    window.WordJarMushyAI.ask = askSmartMushy;
    window.WordJarMushyAI.smartModels = SMART_MODELS;
    window.WordJarMushyAI.maxOutputTokens = MAX_OUTPUT_TOKENS;
    window.WordJarMushyAI.userFacingError = userFacingError;
  }

  function boot() {
    injectStyle();
    patchClearAction();
    applyClearDialogAvatar();
    patchSmartMushyAI();
    patchReaderContextLimit();
  }

  const observer = new MutationObserver(applyClearDialogAvatar);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

// WordJar Mushy Chat UI
// ChatGPT-style vocabulary tutor page with Reader/Deck context hooks.

(function installWordJarMushyChat() {
  if (window.__wordjarMushyChatInstalled) return;
  window.__wordjarMushyChatInstalled = true;

  const HISTORY_KEY = 'wordjar_mushy_chat_history_v1';
  const CONTEXT_KEY = 'wordjar_mushy_pending_context_v1';
  const MAX_HISTORY = 40;

  let sending = false;
  let previousPage = 'home';

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

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch (err) {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(-MAX_HISTORY)));
  }

  function getPendingContext() {
    try { return JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || 'null'); }
    catch (err) { return null; }
  }

  function setPendingContext(context) {
    if (!context) sessionStorage.removeItem(CONTEXT_KEY);
    else sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  }

  function getHistoryContext(history) {
    return history.slice(-10).map(item => `${item.role === 'user' ? 'User' : 'Mushy'}: ${item.text}`).join('\n');
  }

  function markdownLite(text) {
    const escaped = safeText(text).replace(/\n{3,}/g, '\n\n');
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
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

  function renderMushyProfileAvatar() {
    const src = getProfileAvatarSrc();
    if (src) {
      return `<img class="wordjar-mushy-empty-avatar-img" src="${safeText(src)}" alt="Mushy profile avatar">`;
    }
    return '<span class="wordjar-mushy-empty-avatar-fallback" aria-hidden="true">🐈‍⬛🍄</span>';
  }

  function ensureMushyClearDialog() {
    let overlay = document.getElementById('wordjarMushyClearDialog');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'wordjarMushyClearDialog';
    overlay.className = 'wordjar-mushy-confirm-overlay';
    overlay.innerHTML = `
      <div class="wordjar-mushy-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="wordjarMushyClearTitle">
        <div class="wordjar-mushy-confirm-icon" aria-hidden="true">🐈‍⬛🍄</div>
        <div class="wordjar-mushy-confirm-title" id="wordjarMushyClearTitle">Clear Mushy chat?</div>
        <div class="wordjar-mushy-confirm-text">This will delete Mushy's chat history on this device.</div>
        <div class="wordjar-mushy-confirm-actions">
          <button class="wordjar-mushy-confirm-btn" type="button" data-wordjar-mushy-cancel>Cancel</button>
          <button class="wordjar-mushy-confirm-btn wordjar-danger" type="button" data-wordjar-mushy-clear>Clear</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeClearDialog();
    });

    overlay.querySelector('[data-wordjar-mushy-cancel]')?.addEventListener('click', closeClearDialog);
    overlay.querySelector('[data-wordjar-mushy-clear]')?.addEventListener('click', confirmClear);

    return overlay;
  }

  function openClearDialog() {
    const overlay = ensureMushyClearDialog();
    overlay.classList.add('is-open');
  }

  function closeClearDialog() {
    document.getElementById('wordjarMushyClearDialog')?.classList.remove('is-open');
  }

  function confirmClear() {
    saveHistory([]);
    closeClearDialog();
    render();
    safeToast('Mushy chat cleared');
  }

  function ensurePage() {
    if (document.getElementById('pg-mushy-chat')) return;

    const app = document.querySelector('.app');
    if (!app) return;

    const page = document.createElement('div');
    page.className = 'page wordjar-mushy-page';
    page.id = 'pg-mushy-chat';
    page.innerHTML = `
      <div class="wordjar-mushy-shell">
        <div class="wordjar-mushy-header">
          <button class="wordjar-mushy-back" type="button" onclick="WordJarMushyChat.goBack()" aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div class="wordjar-mushy-avatar" aria-hidden="true">🍄</div>
          <div class="wordjar-mushy-title-wrap">
            <div class="wordjar-mushy-title">Mushy</div>
            <div class="wordjar-mushy-subtitle" id="wordjarMushySubtitle">Vocabulary buddy · Gemini Flash first</div>
          </div>
          <button class="wordjar-mushy-clear" type="button" onclick="WordJarMushyChat.clear()">Clear</button>
        </div>

        <div class="wordjar-mushy-context" id="wordjarMushyContext" hidden></div>
        <div class="wordjar-mushy-messages" id="wordjarMushyMessages"></div>

        <div class="wordjar-mushy-quick" id="wordjarMushyQuick">
          <button type="button" onclick="WordJarMushyChat.quick('ช่วยอธิบายคำนี้ให้เข้าใจง่าย')">Explain a word</button>
          <button type="button" onclick="WordJarMushyChat.quick('สองคำนี้ต่างกันยังไง')">Compare words</button>
          <button type="button" onclick="WordJarMushyChat.quick('ช่วยแต่งประโยคตัวอย่าง')">Make example</button>
          <button type="button" onclick="WordJarMushyChat.quick('ช่วย quiz คำศัพท์ฉันหน่อย')">Quiz me</button>
        </div>

        <form class="wordjar-mushy-inputbar" onsubmit="WordJarMushyChat.submit(event)">
          <textarea id="wordjarMushyInput" rows="1" placeholder="Ask Mushy..." oninput="WordJarMushyChat.autosizeInput()"></textarea>
          <button id="wordjarMushySend" type="submit" aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M12 19V6"></path>
              <path d="M6.75 11.25L12 6l5.25 5.25"></path>
            </svg>
          </button>
        </form>
      </div>
    `;

    const firstOverlay = app.querySelector('.overlay');
    if (firstOverlay) app.insertBefore(page, firstOverlay);
    else app.appendChild(page);
  }

  function ensureNavButton() {
    const topNav = document.querySelector('.top-nav');
    if (!topNav || document.getElementById('tb-mushy-chat')) return;

    const button = document.createElement('button');
    button.className = 'top-btn';
    button.id = 'tb-mushy-chat';
    button.type = 'button';
    button.onclick = () => open();
    button.setAttribute('aria-label', 'Mushy Chat');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
        <path d="M8 9h8M8 13h5"/>
      </svg>
    `;
    topNav.appendChild(button);
  }

  function markNavActive() {
    document.querySelectorAll('.top-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tb-mushy-chat')?.classList.add('active');
  }

  function showContext(context) {
    const box = document.getElementById('wordjarMushyContext');
    if (!box) return;

    if (!context?.text) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    const label = context.source === 'reader'
      ? 'Reader context'
      : context.source === 'deck'
        ? 'Deck context'
        : 'Context';

    box.hidden = false;
    box.innerHTML = `
      <div class="wordjar-mushy-context-label">${safeText(label)}</div>
      <div class="wordjar-mushy-context-text">${safeText(context.text).slice(0, 900)}</div>
      <button type="button" onclick="WordJarMushyChat.clearContext()">Remove context</button>
    `;
  }

  function messageHTML(item) {
    const isUser = item.role === 'user';
    const meta = item.model ? `<div class="wordjar-mushy-meta">${safeText(item.model)}${item.cached ? ' · cached' : ''}</div>` : '';
    return `
      <div class="wordjar-mushy-msg ${isUser ? 'user' : 'assistant'}">
        ${!isUser ? '<div class="wordjar-mushy-msg-avatar">🐾</div>' : ''}
        <div class="wordjar-mushy-bubble">
          <p>${markdownLite(item.text || '')}</p>
          ${!isUser ? `<div class="wordjar-mushy-actions"><button type="button" onclick="WordJarMushyChat.copyMessage('${safeText(item.id)}')">Copy</button><button type="button" onclick="WordJarMushyChat.saveToNote('${safeText(item.id)}')">Save to Note</button></div>${meta}` : ''}
        </div>
      </div>
    `;
  }

  function render() {
    ensurePage();
    const history = loadHistory();
    const messages = document.getElementById('wordjarMushyMessages');
    const quick = document.getElementById('wordjarMushyQuick');
    const subtitle = document.getElementById('wordjarMushySubtitle');

    if (!messages) return;

    if (!history.length) {
      messages.innerHTML = `
        <div class="wordjar-mushy-empty">
          <div class="wordjar-mushy-empty-icon">${renderMushyProfileAvatar()}</div>
          <div class="wordjar-mushy-empty-title">Ask Mushy anything about English.</div>
          <div class="wordjar-mushy-empty-sub">คำศัพท์ ประโยค ตัวอย่าง grammar หรือข้อความจาก Reader ก็ส่งมาถามได้เลย~เมี๊ยว</div>
        </div>
      `;
      if (quick) quick.hidden = false;
    } else {
      messages.innerHTML = history.map(messageHTML).join('');
      if (quick) quick.hidden = true;
    }

    if (subtitle && window.WordJarMushyAI?.lastModel) {
      subtitle.textContent = `Vocabulary buddy · ${window.WordJarMushyAI.lastModel}`;
    }

    showContext(getPendingContext());
    messages.scrollTop = messages.scrollHeight;
  }

  function open(context) {
    ensurePage();
    ensureNavButton();

    const currentPage = String(window.curPage || 'home').trim();
    if (currentPage && currentPage !== 'mushy-chat') previousPage = currentPage;

    if (context) setPendingContext(context);

    if (typeof window.nav === 'function') {
      try {
        window.nav('mushy-chat');
      } catch (err) {
        document.querySelectorAll('.page,.study-page').forEach(page => page.classList.remove('active'));
        document.getElementById('pg-mushy-chat')?.classList.add('active');
      }
    } else {
      document.querySelectorAll('.page,.study-page').forEach(page => page.classList.remove('active'));
      document.getElementById('pg-mushy-chat')?.classList.add('active');
    }

    try { window.curPage = 'mushy-chat'; } catch (err) {}
    markNavActive();
    render();
    setTimeout(() => document.getElementById('wordjarMushyInput')?.focus(), 80);
  }

  function goBack() {
    const targetPage = previousPage && previousPage !== 'mushy-chat' ? previousPage : 'home';
    const mushyPage = document.getElementById('pg-mushy-chat');

    mushyPage?.classList.remove('active');
    document.getElementById('tb-mushy-chat')?.classList.remove('active');

    if (typeof window.nav === 'function') {
      try {
        window.nav(targetPage);
        return;
      } catch (err) {}
    }

    document.querySelectorAll('.page,.study-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`pg-${targetPage}`)?.classList.add('active');
    try { window.curPage = targetPage; } catch (err) {}
  }

  function clear() {
    openClearDialog();
  }

  function clearContext() {
    setPendingContext(null);
    render();
  }

  function appendMessage(role, text, extra = {}) {
    const history = loadHistory();
    const item = {
      id: `mushy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role,
      text: String(text || '').trim(),
      createdAt: new Date().toISOString(),
      ...extra
    };
    history.push(item);
    saveHistory(history);
    render();
    return item;
  }

  function setTyping(active) {
    const messages = document.getElementById('wordjarMushyMessages');
    if (!messages) return;
    document.getElementById('wordjarMushyTyping')?.remove();
    if (!active) return;

    const typing = document.createElement('div');
    typing.id = 'wordjarMushyTyping';
    typing.className = 'wordjar-mushy-msg assistant';
    typing.innerHTML = '<div class="wordjar-mushy-msg-avatar">🐾</div><div class="wordjar-mushy-bubble"><div class="wordjar-mushy-typing"><span></span><span></span><span></span></div></div>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }

  async function send(message) {
    const text = String(message || '').trim();
    if (!text || sending) return;

    sending = true;
    const input = document.getElementById('wordjarMushyInput');
    const sendBtn = document.getElementById('wordjarMushySend');
    if (input) input.value = '';
    autosizeInput();
    if (sendBtn) sendBtn.disabled = true;

    const context = getPendingContext();
    appendMessage('user', text);
    setTyping(true);

    try {
      const result = await window.WordJarMushyAI.ask({
        task: context?.source === 'reader' ? 'reader' : 'chat',
        question: text,
        contextText: context?.text || getHistoryContext(loadHistory()),
        historyCount: loadHistory().length,
        cache: false
      });
      appendMessage('assistant', result.text, { model: result.model, cached: result.cached });
    } catch (err) {
      console.warn('Mushy chat failed', err);
      const message = window.WordJarMushyAI?.userFacingError?.(err) || 'Mushy ตอบไม่สำเร็จ ลองใหม่อีกครั้งครับ';
      appendMessage('assistant', `${message} ~เมี๊ยว`);
      safeToast(message);
    } finally {
      setTyping(false);
      sending = false;
      if (sendBtn) sendBtn.disabled = false;
      render();
    }
  }

  function submit(event) {
    event.preventDefault();
    send(document.getElementById('wordjarMushyInput')?.value || '');
  }

  function quick(text) {
    const input = document.getElementById('wordjarMushyInput');
    if (!input) return;
    input.value = text;
    autosizeInput();
    input.focus();
  }

  function autosizeInput() {
    const input = document.getElementById('wordjarMushyInput');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(130, input.scrollHeight)}px`;
  }

  function copyMessage(id) {
    const item = loadHistory().find(m => m.id === id);
    if (!item) return;
    navigator.clipboard?.writeText(item.text).then(() => safeToast('Copied'));
  }

  function saveToNote(id) {
    const item = loadHistory().find(m => m.id === id);
    if (!item?.text) return;
    const current = String(D?.reader?.mushyNotes || '').trim();
    if (!D.reader) D.reader = {};
    D.reader.mushyNotes = `${current ? `${current}\n\n` : ''}${item.text}`;
    if (typeof save === 'function') save();
    safeToast('Saved to Reader notes');
  }

  function askFromReader(text, question) {
    const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
    open({ source: 'reader', text: cleanText.slice(0, 6000) });
    if (question) {
      const input = document.getElementById('wordjarMushyInput');
      if (input) {
        input.value = question;
        autosizeInput();
      }
    }
  }

  function askAboutWord(wordData) {
    const item = wordData || {};
    const text = [
      item.word ? `Word: ${item.word}` : '',
      item.type ? `Type: ${item.type}` : '',
      item.meaning ? `Meaning: ${item.meaning}` : '',
      item.example ? `Example: ${item.example}` : '',
      item.notes ? `Notes: ${item.notes}` : ''
    ].filter(Boolean).join('\n');

    open({ source: 'deck', text });
  }

  function patchNav() {
    if (window.__wordjarMushyNavPatched) return;
    const originalNav = window.nav;
    if (typeof originalNav !== 'function') return;

    window.__wordjarMushyNavPatched = true;
    window.nav = function wordjarNavWithMushy(page) {
      if (page === 'mushy-chat') {
        document.querySelectorAll('.page,.study-page').forEach(el => el.classList.remove('active'));
        document.getElementById('pg-mushy-chat')?.classList.add('active');
        try { window.curPage = 'mushy-chat'; } catch (err) {}
        markNavActive();
        render();
        return;
      }

      document.getElementById('pg-mushy-chat')?.classList.remove('active');
      return originalNav.apply(this, arguments);
    };
  }

  function bindEscapeToCloseDialog() {
    if (document.__wordjarMushyClearEscapeBound) return;
    document.__wordjarMushyClearEscapeBound = true;
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeClearDialog();
    });
  }

  function boot() {
    if (!window.WordJarMushyAI) return;
    ensurePage();
    ensureNavButton();
    bindEscapeToCloseDialog();
    patchNav();
    if (window.curPage === 'mushy-chat') render();
  }

  window.WordJarMushyChat = {
    open,
    goBack,
    clear,
    clearContext,
    submit,
    send,
    quick,
    autosizeInput,
    copyMessage,
    saveToNote,
    askFromReader,
    askAboutWord,
    render
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 400);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

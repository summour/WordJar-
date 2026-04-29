// WordJar Mushy Deck Fill Bridge
// Lets Mushy Chat trigger the existing Smart Fill deck workflow without duplicating AI logic.

(function installWordJarMushyDeckFillBridge() {
  if (window.__wordjarMushyDeckFillBridgeInstalled) return;
  window.__wordjarMushyDeckFillBridgeInstalled = true;

  const HISTORY_KEY = 'wordjar_mushy_chat_history_v1';
  const MAX_HISTORY = 40;

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function loadHistory() {
    try {
      const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (err) {
      return [];
    }
  }

  function saveHistory(items) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(-MAX_HISTORY))); }
    catch (err) {}
  }

  function appendChat(role, text, extra = {}) {
    const history = loadHistory();
    history.push({
      id: `mushy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role,
      text: String(text || '').trim(),
      createdAt: new Date().toISOString(),
      ...extra
    });
    saveHistory(history);
    window.WordJarMushyChat?.render?.();
  }

  function commandMatches(text) {
    const clean = String(text || '').trim().toLowerCase();
    if (!clean) return false;

    return [
      'fill deck',
      'fill this deck',
      'smart fill deck',
      'smart fill all',
      'auto fill deck',
      'เติม deck',
      'เติมเดค',
      'เติมการ์ด',
      'เติมการ์ดที่เลือก',
      'เติมคำใน deck',
      'เติมคำในเดค',
      'เติมทั้งหมด'
    ].some(phrase => clean.includes(phrase));
  }

  function hasCurrentDeck() {
    try { return !!currentStudyDeckId; }
    catch (err) { return false; }
  }

  function selectModeActive() {
    try { return !!isSelectMode; }
    catch (err) { return false; }
  }

  function ensureDeckSelectMode() {
    if (selectModeActive()) return true;
    if (typeof toggleSelectMode !== 'function') return false;

    try {
      toggleSelectMode();
      return selectModeActive();
    } catch (err) {
      console.warn('Mushy could not enable deck select mode', err);
      return false;
    }
  }

  function countDeckTargets() {
    try {
      if (!Array.isArray(D?.words) || !currentStudyDeckId) return 0;

      if (selectModeActive() && selectedCards?.size) return selectedCards.size;
      return D.words.filter(card => String(card.deckId) === String(currentStudyDeckId)).length;
    } catch (err) {
      return 0;
    }
  }

  function getDeckName() {
    try {
      const deck = (D.decks || []).find(item => String(item.id) === String(currentStudyDeckId));
      return String(deck?.name || 'this deck').trim() || 'this deck';
    } catch (err) {
      return 'this deck';
    }
  }

  async function runExistingSmartFill() {
    if (window.WordJarSmartAllBatch?.run) {
      await window.WordJarSmartAllBatch.run();
      return true;
    }

    if (typeof window.smartFillSelectedCards === 'function') {
      await window.smartFillSelectedCards();
      return true;
    }

    if (typeof smartFillSelectedCards === 'function') {
      await smartFillSelectedCards();
      return true;
    }

    return false;
  }

  async function handleDeckFillCommand(messageText) {
    appendChat('user', messageText);

    if (!hasCurrentDeck()) {
      appendChat('assistant', 'เปิดหน้า Deck หรือหน้า Cards ของ deck ที่ต้องการก่อนนะครับ แล้วค่อยพิมพ์ Fill deck อีกครั้ง ~เมี๊ยว');
      safeToast('Open a deck first');
      return;
    }

    if (!ensureDeckSelectMode()) {
      appendChat('assistant', 'Mushy ยังเข้าโหมดเลือกการ์ดไม่ได้ครับ ลองเปิดหน้า Cards ของ deck นี้ก่อน แล้วกด Fill deck อีกครั้ง ~เมี๊ยว');
      safeToast('Open deck cards first');
      return;
    }

    const targetCount = countDeckTargets();
    if (!targetCount) {
      appendChat('assistant', 'ไม่เจอการ์ดใน deck นี้ครับ เพิ่มคำหรือเลือกการ์ดก่อน แล้วลองใหม่อีกครั้ง ~เมี๊ยว');
      safeToast('No cards found');
      return;
    }

    appendChat('assistant', `Mushy เริ่มเติม ${targetCount} การ์ดใน ${getDeckName()} แล้วครับ จะเติมเฉพาะช่องที่ว่างและใช้ Smart Fill เดิมของ WordJar ~เมี๊ยว`, { model: 'Smart Fill' });

    try {
      const started = await runExistingSmartFill();
      if (!started) {
        appendChat('assistant', 'Smart Fill ยังไม่พร้อมครับ ตรวจ Private API Key หรือรอให้ module โหลดเสร็จก่อนนะครับ');
      }
    } catch (err) {
      console.warn('Mushy deck fill command failed', err);
      appendChat('assistant', 'Mushy สั่งเติม deck ไม่สำเร็จครับ ลองใหม่ หรือเช็ก Private API Key ก่อนนะครับ ~เมี๊ยว');
      safeToast('Deck fill failed');
    }
  }

  function interceptSubmit(event) {
    const form = event.target;
    if (!form?.classList?.contains('wordjar-mushy-inputbar')) return;

    const input = form.querySelector('#wordjarMushyInput');
    const messageText = String(input?.value || '').trim();
    if (!commandMatches(messageText)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }

    handleDeckFillCommand(messageText);
  }

  window.WordJarMushyDeckFillBridge = {
    commandMatches,
    run: handleDeckFillCommand
  };

  document.addEventListener('submit', interceptSubmit, true);
})();

// WordJar Dialogs V1
// Owns app-styled alert and confirm dialogs.

(function installWordJarDialogs() {
  if (window.__wordjarDialogsInstalled) return;
  window.__wordjarDialogsInstalled = true;

  const STYLE_ID = 'wordjarDialogsStyle';
  const MODAL_ID = 'wordjarDialogModal';
  const queue = [];
  let activeRequest = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-dialog-overlay {
        position: fixed;
        inset: 0;
        z-index: 5000;
        display: none;
        align-items: flex-end;
        justify-content: center;
        padding: 18px;
        background: rgba(0, 0, 0, .24);
        backdrop-filter: blur(10px);
      }

      .wordjar-dialog-overlay.open {
        display: flex;
      }

      .wordjar-dialog-card {
        width: min(100%, 420px);
        border: 1px solid var(--bdr);
        border-radius: 28px;
        background: rgba(255, 255, 255, .98);
        box-shadow: 0 24px 70px rgba(0, 0, 0, .18);
        overflow: hidden;
      }

      .wordjar-dialog-body {
        padding: 22px 22px 16px;
      }

      .wordjar-dialog-kicker {
        width: 38px;
        height: 5px;
        margin: 0 auto 18px;
        border-radius: 999px;
        background: rgba(0, 0, 0, .12);
      }

      .wordjar-dialog-title {
        margin: 0;
        color: var(--ink);
        font-size: 20px;
        font-weight: 900;
        line-height: 1.16;
        letter-spacing: -.02em;
        text-align: center;
      }

      .wordjar-dialog-message {
        margin: 10px 0 0;
        color: var(--ink2);
        font-size: 14px;
        font-weight: 750;
        line-height: 1.45;
        text-align: center;
        white-space: pre-line;
      }

      .wordjar-dialog-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding: 0 16px 16px;
      }

      .wordjar-dialog-actions.single {
        grid-template-columns: 1fr;
      }

      .wordjar-dialog-button {
        min-height: 52px;
        border-radius: 18px;
        border: 1px solid var(--bdr);
        background: #fff;
        color: var(--ink);
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
      }

      .wordjar-dialog-button.primary {
        border-color: #111;
        background: #111;
        color: #fff;
      }

      .wordjar-dialog-button.danger {
        border-color: #f0aaaa;
        background: #fff7f7;
        color: #e15249;
      }

      .wordjar-dialog-button:active {
        transform: scale(.985);
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    injectStyle();

    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'wordjar-dialog-overlay';
    modal.innerHTML = `
      <div class="wordjar-dialog-card" role="dialog" aria-modal="true" aria-labelledby="wordjarDialogTitle">
        <div class="wordjar-dialog-body">
          <div class="wordjar-dialog-kicker" aria-hidden="true"></div>
          <h2 id="wordjarDialogTitle" class="wordjar-dialog-title"></h2>
          <p id="wordjarDialogMessage" class="wordjar-dialog-message"></p>
        </div>
        <div id="wordjarDialogActions" class="wordjar-dialog-actions">
          <button id="wordjarDialogCancel" class="wordjar-dialog-button" type="button">Cancel</button>
          <button id="wordjarDialogConfirm" class="wordjar-dialog-button primary" type="button">OK</button>
        </div>
      </div>
    `;

    modal.addEventListener('click', event => {
      if (event.target === modal) finish(false);
    });

    document.addEventListener('keydown', event => {
      if (!activeRequest || !modal.classList.contains('open')) return;
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });

    document.body.appendChild(modal);
    return modal;
  }

  function renderRequest(request) {
    const modal = ensureModal();
    const title = document.getElementById('wordjarDialogTitle');
    const message = document.getElementById('wordjarDialogMessage');
    const actions = document.getElementById('wordjarDialogActions');
    const cancel = document.getElementById('wordjarDialogCancel');
    const confirm = document.getElementById('wordjarDialogConfirm');

    title.textContent = request.title || 'WordJar';
    message.textContent = request.message || '';
    cancel.textContent = request.cancelText || 'Cancel';
    confirm.textContent = request.confirmText || 'OK';

    confirm.className = `wordjar-dialog-button ${request.danger ? 'danger' : 'primary'}`;
    cancel.hidden = request.type === 'alert';
    actions.classList.toggle('single', request.type === 'alert');

    cancel.onclick = () => finish(false);
    confirm.onclick = () => finish(true);

    modal.classList.add('open');
    setTimeout(() => confirm.focus(), 0);
  }

  function flushQueue() {
    if (activeRequest || !queue.length) return;
    activeRequest = queue.shift();
    renderRequest(activeRequest);
  }

  function finish(value) {
    const request = activeRequest;
    if (!request) return;

    document.getElementById(MODAL_ID)?.classList.remove('open');
    activeRequest = null;
    request.resolve(value);
    setTimeout(flushQueue, 80);
  }

  function ask(options) {
    return new Promise(resolve => {
      queue.push({ ...options, resolve });
      flushQueue();
    });
  }

  async function confirmDialog(options = {}) {
    if (typeof options === 'string') {
      return ask({
        type: 'confirm',
        title: 'Confirm',
        message: options,
        confirmText: 'OK',
        cancelText: 'Cancel'
      });
    }

    return ask({
      type: 'confirm',
      title: options.title || 'Confirm',
      message: options.message || '',
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      danger: !!options.danger
    });
  }

  async function alertDialog(options = {}) {
    if (typeof options === 'string') {
      return ask({ type: 'alert', title: 'WordJar', message: options, confirmText: 'OK' });
    }

    return ask({
      type: 'alert',
      title: options.title || 'WordJar',
      message: options.message || '',
      confirmText: options.confirmText || 'OK'
    });
  }

  function notify(message, title = 'WordJar') {
    alertDialog({ title, message: String(message || ''), confirmText: 'OK' });
  }

  window.WordJarDialog = {
    confirm: confirmDialog,
    alert: alertDialog,
    notify
  };

  window.wordjarConfirm = confirmDialog;
  window.wordjarAlert = alertDialog;

  const nativeAlert = window.alert;
  window.wordjarNativeAlert = nativeAlert;
  window.alert = function wordjarAlertReplacement(message) {
    notify(message);
  };
})();

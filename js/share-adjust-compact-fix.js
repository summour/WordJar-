// WordJar Share Adjust Compact Fix
// Makes the share options modal match the smaller Dashboard Statistics modal style.

(function installWordJarShareAdjustCompactFix() {
  if (window.__wordjarShareAdjustCompactFixInstalled) return;
  window.__wordjarShareAdjustCompactFixInstalled = true;

  const STYLE_ID = 'wordjarShareAdjustCompactFixStyle';

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #shareAdjustModal .share-adjust-modal,
      #shareAdjustModal .modal-card.share-adjust-modal {
        width: min(calc(100vw - 42px), 360px);
        max-width: 360px;
        max-height: min(82vh, 650px);
        padding: 26px 28px 22px;
        border-radius: 22px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        box-shadow: 0 20px 50px rgba(0,0,0,.18);
      }

      #shareAdjustModal .share-adjust-modal::-webkit-scrollbar {
        width: 0;
        height: 0;
      }

      #shareAdjustModal #shareOptionsPanel,
      #shareAdjustModal #shareOptionsPanel.open {
        display: block;
      }

      #shareAdjustModal .share-adjust-section,
      #shareAdjustModal .settings-card,
      #shareAdjustModal .share-options-card,
      #shareAdjustModal .wordjar-share-option-group {
        border: 0;
        border-radius: 0;
        overflow: visible;
        margin: 0;
        background: transparent;
        box-shadow: none;
      }

      #shareAdjustModal .share-adjust-title,
      #shareAdjustModal .share-adjust-section-title,
      #shareAdjustModal .settings-card-title,
      #shareAdjustModal .wordjar-share-section-title {
        padding: 16px 0 10px;
        border: 0;
        background: transparent;
        color: #8e8e93;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: -0.01em;
        text-transform: none;
      }

      #shareAdjustModal .share-check-row,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row {
        min-height: 62px;
        padding: 10px 0;
        border-top: 0;
        border-bottom: 1px solid #e5e5ea;
        background: transparent;
        color: #111111;
        font-size: 15px;
        line-height: 1.25;
        font-weight: 750;
        letter-spacing: -0.02em;
        gap: 14px;
        box-shadow: none;
      }

      #shareAdjustModal .share-check-row:first-of-type,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row:first-of-type {
        border-top: 0;
      }

      #shareAdjustModal .share-check-row span,
      #shareAdjustModal .share-check-row .label,
      #shareAdjustModal .share-check-row .text,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row span {
        color: #111111;
        font-size: 15px;
        line-height: 1.25;
        font-weight: 750;
        letter-spacing: -0.02em;
      }

      #shareAdjustModal .share-check-row input[type="checkbox"],
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"] {
        flex: 0 0 46px;
        width: 46px;
        height: 28px;
        border-radius: 999px;
        border: 0;
        background: #d1d1d6;
        box-shadow: none;
      }

      #shareAdjustModal .share-check-row input[type="checkbox"]::before,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"]::before {
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        box-shadow: 0 1px 3px rgba(0,0,0,.18);
      }

      #shareAdjustModal .share-check-row input[type="checkbox"]:checked::before,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"]:checked::before {
        transform: translateX(18px);
      }

      #shareAdjustModal .form-row,
      #shareAdjustModal .share-adjust-actions {
        display: grid;
        grid-template-columns: 1fr 1.55fr;
        gap: 10px;
        margin-top: 18px;
      }

      #shareAdjustModal .form-row .btn,
      #shareAdjustModal .share-adjust-actions .btn,
      #shareAdjustModal button[id*="Share"],
      #shareAdjustModal button[id*="Cancel"] {
        min-height: 44px;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 850;
      }

      #shareAdjustModal .share-preview-box,
      #shareAdjustModal .share-options-toggle,
      #shareAdjustModal .share-adjust-note {
        display: none;
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 250);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

// WordJar Mushy Profile Avatar Patch
// Keeps Mushy's empty state and clear dialog aligned with the selected profile avatar.

(function installWordJarMushyProfileAvatarPatch() {
  if (window.__wordjarMushyProfileAvatarPatchInstalled) return;
  window.__wordjarMushyProfileAvatarPatchInstalled = true;

  const STYLE_ID = 'wordjarMushyProfileAvatarPatchStyle';

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

  function boot() {
    injectStyle();
    patchClearAction();
    applyClearDialogAvatar();
  }

  const observer = new MutationObserver(applyClearDialogAvatar);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 400);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

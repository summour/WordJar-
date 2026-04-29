// WordJar Performance Scheduler V1
// Coalesces repeated render/update calls into one frame to reduce UI jank from stacked modules.

(function installPerformanceScheduler() {
  if (window.__wordjarPerformanceSchedulerInstalled) return;
  window.__wordjarPerformanceSchedulerInstalled = true;

  const pending = new Map();

  function schedule(key, fn) {
    if (typeof fn !== 'function') return;
    if (pending.has(key)) return;

    const runner = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
    const id = runner(() => {
      pending.delete(key);
      try { fn(); }
      catch (err) { console.warn(`Scheduled render failed: ${key}`, err); }
    });

    pending.set(key, id);
  }

  function wrap(name, key) {
    const original = window[name];
    if (typeof original !== 'function' || original.__wordjarScheduled) return;

    const wrapped = function scheduledRenderWrapper(...args) {
      schedule(key || name, () => original.apply(this, args));
    };
    wrapped.__wordjarScheduled = true;
    wrapped.__wordjarOriginal = original;
    window[name] = wrapped;
  }

  function install() {
    // Do not wrap renderFC/renderLearn because they must update immediately during study.
    wrap('renderDecks', 'renderDecks');
    wrap('updateHome', 'updateHome');
    wrap('updateAccount', 'updateAccount');
  }

  window.WordJarPerformanceScheduler = { schedule, install };
  setTimeout(install, 0);
})();

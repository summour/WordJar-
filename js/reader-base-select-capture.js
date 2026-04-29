// WordJar Reader Base Select Capture V1
// Saves the original Reader selectReaderWord before optional Reader interaction modules patch it.

(function installWordJarReaderBaseSelectCapture() {
  if (window.__wordjarReaderBaseSelectCaptureInstalled) return;
  window.__wordjarReaderBaseSelectCaptureInstalled = true;

  function captureBaseSelect() {
    if (typeof window.selectReaderWord === 'function' && !window.__wordjarReaderBaseSelectReaderWord) {
      window.__wordjarReaderBaseSelectReaderWord = window.selectReaderWord;
    }
  }

  captureBaseSelect();
  setTimeout(captureBaseSelect, 0);
})();

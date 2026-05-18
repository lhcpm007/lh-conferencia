// Wrapper sobre html5-qrcode — câmera + leitura de QR/barcode
const Scanner = (() => {
  let instance = null;
  let running  = false;
  let lastText = '';
  let lastTime = 0;
  let onSuccess = null;

  async function start(containerId, callback) {
    if (running) return;
    onSuccess = callback;

    try {
      instance = new Html5Qrcode(containerId, { verbose: false });
      await instance.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox:       { width: 280, height: 180 },
          aspectRatio: 1.7778,
          // Formatos suportados — todos que podem aparecer em etiquetas de frete
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.AZTEC,
          ]
        },
        _handleScan,
        _handleError
      );
      running = true;
    } catch (err) {
      running = false;
      throw err;
    }
  }

  async function stop() {
    if (!running || !instance) return;
    try {
      await instance.stop();
    } catch (e) {
      console.warn('[Scanner] stop error:', e);
    }
    instance = null;
    running = false;
    lastText = '';
    lastTime = 0;
  }

  function resetDebounce() {
    lastText = '';
    lastTime = 0;
  }

  function _handleScan(text) {
    const now = Date.now();
    // Debounce: ignora mesma leitura em menos de 2 segundos
    if (text === lastText && (now - lastTime) < 2000) return;
    lastText = text;
    lastTime = now;
    if (onSuccess) onSuccess(text);
  }

  function _handleError() { /* silencia erros de frame sem leitura */ }

  return {
    start,
    stop,
    resetDebounce,
    get isRunning() { return running; }
  };
})();

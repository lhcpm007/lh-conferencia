// Alertas sonoros via Web Audio API — sem arquivos externos
const Audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (iOS/Chrome autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, duration, vol = 0.35) {
    const ac = getCtx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  return {
    // Beep simples — volume capturado com sucesso
    success() {
      const t = getCtx().currentTime;
      tone(880, t, 0.13);
    },

    // Beep duplo — duplicata ou cidade errada
    duplicate() {
      const t = getCtx().currentTime;
      tone(880, t,        0.10);
      tone(880, t + 0.18, 0.10);
    },

    // Beep de erro (grave)
    error() {
      const t = getCtx().currentTime;
      tone(440, t, 0.20);
    },

    // Deve ser chamado no primeiro gesto do usuário para desbloquear o contexto
    unlock() {
      try { getCtx(); } catch (e) { /* ignore */ }
    }
  };
})();

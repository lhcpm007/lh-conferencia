// Gerenciamento de dados: Firebase Firestore + LocalStorage como fallback
const Storage = (() => {
  let db = null;
  let firestoreReady = false;

  async function init() {
    if (!CONFIG.isFirebaseConfigured()) {
      console.warn('[Storage] Firebase não configurado — usando localStorage apenas.');
      return;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(CONFIG.firebase);
      }
      db = firebase.firestore();
      // Testar conexão
      await db.collection('_ping').limit(1).get().catch(() => {});
      firestoreReady = true;
      console.log('[Storage] Firestore conectado.');
    } catch (e) {
      console.error('[Storage] Erro ao conectar Firestore:', e);
    }
  }

  // ── Sessão ativa (localStorage) ───────────────────────────────────────────

  function saveSession(data) {
    localStorage.setItem('lh_sessao', JSON.stringify(data));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem('lh_sessao');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem('lh_sessao');
  }

  // ── Coletas ───────────────────────────────────────────────────────────────

  async function saveColeta(data) {
    const id = genId();
    const record = { ...data, id, placa: data.placa.toUpperCase(), savedAt: new Date().toISOString() };

    _lsPush('lh_coletas', record);

    if (firestoreReady) {
      try { await db.collection('coletas').doc(id).set(record); }
      catch (e) { console.error('[Storage] saveColeta Firestore:', e); }
    }
    return id;
  }

  async function getColetasByPlate(placa) {
    const upperPlaca = placa.toUpperCase();
    if (firestoreReady) {
      try {
        const snap = await db.collection('coletas')
          .where('placa', '==', upperPlaca)
          .get();
        if (!snap.empty) return snap.docs.map(d => d.data());
      } catch (e) { console.error('[Storage] getColetasByPlate Firestore:', e); }
    }
    return _lsGet('lh_coletas').filter(c => c.placa === upperPlaca);
  }

  // ── Carregamentos ─────────────────────────────────────────────────────────

  async function saveCarregamento(data) {
    const id = genId();
    const record = { ...data, id, placa: data.placa.toUpperCase(), savedAt: new Date().toISOString() };

    _lsPush('lh_carregamentos', record);

    if (firestoreReady) {
      try { await db.collection('carregamentos').doc(id).set(record); }
      catch (e) { console.error('[Storage] saveCarregamento Firestore:', e); }
    }
    return id;
  }

  async function getCarregamentosByPlate(placa) {
    const upperPlaca = placa.toUpperCase();
    if (firestoreReady) {
      try {
        const snap = await db.collection('carregamentos')
          .where('placa', '==', upperPlaca)
          .orderBy('savedAt', 'desc')
          .limit(20)
          .get();
        if (!snap.empty) return snap.docs.map(d => d.data());
      } catch (e) { console.error('[Storage] getCarregamentosByPlate Firestore:', e); }
    }
    return _lsGet('lh_carregamentos')
      .filter(c => c.placa === upperPlaca)
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _lsGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function _lsPush(key, item) {
    const arr = _lsGet(key);
    arr.push(item);
    // Manter apenas os últimos 200 registros por chave para não estourar localStorage
    if (arr.length > 200) arr.splice(0, arr.length - 200);
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  return {
    init,
    saveSession, loadSession, clearSession,
    saveColeta, getColetasByPlate,
    saveCarregamento, getCarregamentosByPlate,
    get firestoreReady() { return firestoreReady; }
  };
})();

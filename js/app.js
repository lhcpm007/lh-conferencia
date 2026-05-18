// ============================================================
// LH Conferência de Cargas — Aplicação Principal
// ============================================================

// ── Estado Global ─────────────────────────────────────────────────────────

const State = {
  operador: '',

  coleta: {
    cliente: '', placa: '', data: '',
    pallets: [],        // pallets finalizados [{numero, volumes:[]}]
    palletAtual: null,  // {numero, volumes:[]}
    keys: new Set()     // chaves de volumes escaneados (anti-duplicata global da sessão)
  },

  descarga: {
    tipo: null,         // 'coleta' | 'viagem'
    placa: '', cidade: '', data: '',
    volumes: [],
    keys: new Set()
  },

  carga: {
    placa: '', cidades: [], data: '',
    volumes: [],
    keys: new Set()
  }
};

// Modo do scanner ativo: 'coleta' | 'descarga' | 'carga'
let scanMode = null;

// Pausa o processamento de scans enquanto modal de confirmação está aberto
let scanPaused = false;

// Contexto do modal de parse: callback a chamar com dados confirmados
let parseModalCallback = null;

// Contexto do modal de senha: callback ao confirmar
let passwordModalCallback = null;

// ── Inicialização ─────────────────────────────────────────────────────────

async function init() {
  await Storage.init();
  setupAllListeners();
  navigate('home');
  showSetupNotices();

  // Restaurar sessão interrompida se houver
  const saved = Storage.loadSession();
  if (saved) {
    const restore = confirm(`Existe uma sessão de ${saved.tipo} em andamento para "${saved.placa || saved.cliente}". Deseja continuar?`);
    if (restore) {
      restoreSession(saved);
      return;
    }
    Storage.clearSession();
  }
}

function restoreSession(saved) {
  if (saved.tipo === 'coleta') {
    Object.assign(State.coleta, saved.dados);
    State.coleta.keys = new Set(saved.keys || []);
    State.operador = saved.operador || '';
    if (State.operador) q('#inp-operador').value = State.operador;
    navigate('coleta-pallet');
    renderPalletList();
  }
}

// ── Helpers DOM ───────────────────────────────────────────────────────────

function q(sel) { return document.querySelector(sel); }
function qa(sel) { return document.querySelectorAll(sel); }
function today() { return new Date().toISOString().slice(0, 10); }

function navigate(screenId) {
  // Parar scanner ao sair de tela de scan
  if (Scanner.isRunning) Scanner.stop();

  qa('.screen').forEach(s => s.classList.remove('active'));
  const target = q(`#screen-${screenId}`);
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
  }

  // Setup específico por tela ao navegar
  if (screenId === 'carga-setup') resetCargaCidades();

  // Atualizar breadcrumb/header
  const titles = {
    'home':                    'LH Conferência',
    'coleta-setup':            'Conferência de Coleta',
    'coleta-pallet':           'Conferência de Coleta',
    'coleta-scan':             'Captura de Volumes',
    'coleta-summary':          'Resumo do Pallet',
    'descarga-tipo':           'Conferência de Descarga',
    'descarga-coleta-setup':   'Descarga de Coleta',
    'descarga-viagem-setup':   'Descarga de Viagem',
    'descarga-scan':           'Captura de Volumes',
    'descarga-result':         'Resultado da Descarga',
    'carga-setup':             'Conferência de Carregamento',
    'carga-scan':              'Captura de Volumes',
    'carga-result':            'Resultado do Carregamento'
  };
  const titleEl = q('#app-title');
  if (titleEl) titleEl.textContent = titles[screenId] || 'LH Conferência';

  const backBtn = q('#btn-back');
  if (backBtn) backBtn.style.display = screenId === 'home' ? 'none' : 'flex';
}

function showToast(msg, type = 'success', duration = 2500) {
  const t = q('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

function showModal(id) {
  const m = q(`#${id}`);
  if (m) { m.classList.add('open'); m.scrollTop = 0; }
}

function hideModal(id) {
  const m = q(`#${id}`);
  if (m) m.classList.remove('open');
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

// ── Listeners Globais ─────────────────────────────────────────────────────

function setupAllListeners() {
  // Botão Voltar (header)
  q('#btn-back').addEventListener('click', handleBackButton);

  // Desbloquear áudio no primeiro toque
  document.addEventListener('touchstart', () => Audio.unlock(), { once: true });
  document.addEventListener('click', () => Audio.unlock(), { once: true });

  // ── HOME ─────────────────────────────────────────────────────────────────
  q('#btn-proc-coleta').addEventListener('click', () => {
    if (!validateOperador()) return;
    navigate('coleta-setup');
  });
  q('#btn-proc-descarga').addEventListener('click', () => {
    if (!validateOperador()) return;
    navigate('descarga-tipo');
  });
  q('#btn-proc-carga').addEventListener('click', () => {
    if (!validateOperador()) return;
    navigate('carga-setup');
  });

  // ── COLETA SETUP ─────────────────────────────────────────────────────────
  q('#btn-iniciar-coleta').addEventListener('click', () => {
    const cliente = q('#inp-cliente').value.trim();
    const placa   = q('#inp-placa-coleta').value.trim();
    if (!cliente) { showToast('Informe o nome do cliente.', 'error'); return; }
    if (!placa)   { showToast('Informe a placa do veículo.', 'error'); return; }
    State.coleta = { cliente, placa: placa.toUpperCase(), data: today(), pallets: [], palletAtual: null, keys: new Set() };
    navigate('coleta-pallet');
    renderPalletList();
    q('#inp-pallet-num').value = '';
    q('#inp-pallet-num').focus();
  });

  // ── COLETA PALLET ────────────────────────────────────────────────────────
  q('#inp-pallet-num').addEventListener('input', e => {
    // Aceita apenas números, max 4 dígitos
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
  });

  q('#btn-iniciar-scan-coleta').addEventListener('click', () => {
    const num = q('#inp-pallet-num').value.padStart(4, '0');
    if (!num || num === '0000') { showToast('Informe o número do pallet.', 'error'); return; }
    State.coleta.palletAtual = { numero: num, volumes: [] };
    saveSession('coleta');
    startScan('coleta');
  });

  // ── COLETA SCAN ──────────────────────────────────────────────────────────
  q('#btn-finalizar-pallet').addEventListener('click', finishColetaPallet);

  // ── COLETA SUMMARY ───────────────────────────────────────────────────────
  q('#btn-novo-pallet').addEventListener('click', startNewPallet);
  q('#btn-enviar-arquivo').addEventListener('click', () => sendColetaFile(false));
  q('#btn-encerrar-coleta').addEventListener('click', endColeta);
  q('#btn-cancelar-coleta').addEventListener('click', () => {
    showConfirmDialog('Cancelar toda a captura desta coleta? Os dados serão perdidos.', () => {
      Storage.clearSession();
      resetColeta();
      navigate('home');
    });
  });

  // ── DESCARGA TIPO ─────────────────────────────────────────────────────────
  q('#btn-tipo-desc-coleta').addEventListener('click', () => {
    State.descarga = { tipo: 'coleta', placa: '', cidade: '', data: today(), volumes: [], keys: new Set() };
    navigate('descarga-coleta-setup');
  });
  q('#btn-tipo-desc-viagem').addEventListener('click', () => {
    State.descarga = { tipo: 'viagem', placa: '', cidade: '', data: today(), volumes: [], keys: new Set() };
    navigate('descarga-viagem-setup');
  });

  // ── DESCARGA COLETA SETUP ─────────────────────────────────────────────────
  q('#btn-iniciar-desc-coleta').addEventListener('click', () => {
    const placa = q('#inp-placa-desc-coleta').value.trim();
    if (!placa) { showToast('Informe a placa.', 'error'); return; }
    State.descarga.placa = placa.toUpperCase();
    startScan('descarga');
  });

  // ── DESCARGA VIAGEM SETUP ─────────────────────────────────────────────────
  q('#btn-iniciar-desc-viagem').addEventListener('click', () => {
    const placa  = q('#inp-placa-desc-viagem').value.trim();
    const cidade = q('#inp-cidade-desc').value.trim();
    if (!placa)  { showToast('Informe a placa.', 'error'); return; }
    if (!cidade) { showToast('Informe a cidade de descarga.', 'error'); return; }
    State.descarga.placa  = placa.toUpperCase();
    State.descarga.cidade = cidade;
    startScan('descarga');
  });

  // ── DESCARGA SCAN ────────────────────────────────────────────────────────
  q('#btn-encerrar-descarga').addEventListener('click', endDescarga);

  // ── CARGA SETUP ──────────────────────────────────────────────────────────
  q('#btn-add-cidade').addEventListener('click', addCidadeInput);
  q('#btn-iniciar-carregamento').addEventListener('click', () => {
    const placa   = q('#inp-placa-carga').value.trim();
    const cidades = getCidadesList();
    if (!placa)         { showToast('Informe a placa.', 'error'); return; }
    if (!cidades.length){ showToast('Informe pelo menos uma cidade.', 'error'); return; }
    State.carga = { placa: placa.toUpperCase(), cidades, data: today(), volumes: [], keys: new Set() };
    startScan('carga');
  });

  // ── CARGA SCAN ───────────────────────────────────────────────────────────
  q('#btn-encerrar-carga').addEventListener('click', endCarga);

  // ── MODAL PARSE ──────────────────────────────────────────────────────────
  q('#modal-parse-form').addEventListener('input', validateParseForm);
  q('#btn-parse-confirm').addEventListener('click', () => {
    const data = getParseFormData();
    hideModal('modal-parse');
    scanPaused = false;
    if (parseModalCallback) parseModalCallback(data);
    parseModalCallback = null;
  });
  q('#btn-parse-cancel').addEventListener('click', () => {
    hideModal('modal-parse');
    scanPaused = false;
    parseModalCallback = null;
    Scanner.resetDebounce();
  });

  // ── MODAL SENHA ───────────────────────────────────────────────────────────
  q('#btn-password-confirm').addEventListener('click', () => {
    const val = q('#inp-password').value;
    if (!CONFIG.checkAdminPassword(val)) {
      q('#password-error').style.display = 'block';
      q('#inp-password').value = '';
      q('#inp-password').focus();
      Audio.error();
      return;
    }
    q('#inp-password').value = '';
    q('#password-error').style.display = 'none';
    hideModal('modal-password');
    if (passwordModalCallback) passwordModalCallback(true);
    passwordModalCallback = null;
  });
  q('#btn-password-cancel').addEventListener('click', () => {
    q('#inp-password').value = '';
    q('#password-error').style.display = 'none';
    hideModal('modal-password');
    if (passwordModalCallback) passwordModalCallback(false);
    passwordModalCallback = null;
  });

  // ── MODAL GENÉRICO ────────────────────────────────────────────────────────
  q('#btn-modal-confirm').addEventListener('click', () => {
    hideModal('modal-confirm');
    if (window._confirmCallback) { window._confirmCallback(); window._confirmCallback = null; }
  });
  q('#btn-modal-cancel').addEventListener('click', () => {
    hideModal('modal-confirm');
    window._confirmCallback = null;
  });

  // Fechar modais clicando fora
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) {
        // Não fechar modal-parse e modal-password por fora
        if (!m.id.includes('parse') && !m.id.includes('password') && !m.id.includes('pending')) {
          m.classList.remove('open');
        }
      }
    });
  });

  // Cidades dinâmicas no carregamento
  setupInitialCidadesInput();
}

function handleBackButton() {
  const active = q('.screen.active');
  if (!active) return;
  const id = active.id.replace('screen-', '');
  const backMap = {
    'coleta-setup':          'home',
    'coleta-pallet':         'coleta-setup',
    'coleta-summary':        'coleta-pallet',
    'descarga-tipo':         'home',
    'descarga-coleta-setup': 'descarga-tipo',
    'descarga-viagem-setup': 'descarga-tipo',
    'descarga-result':       'home',
    'carga-setup':           'home',
    'carga-result':          'home',
  };
  if (id === 'coleta-scan') {
    showConfirmDialog('Voltar? A captura atual do pallet será perdida.', () => {
      Scanner.stop();
      State.coleta.palletAtual = null;
      navigate('coleta-pallet');
    });
    return;
  }
  if (id === 'descarga-scan') {
    showConfirmDialog('Cancelar a descarga? Os dados não serão salvos.', () => {
      Scanner.stop();
      navigate('descarga-tipo');
    });
    return;
  }
  if (id === 'carga-scan') {
    showConfirmDialog('Cancelar o carregamento? Os dados não serão salvos.', () => {
      Scanner.stop();
      navigate('carga-setup');
    });
    return;
  }
  navigate(backMap[id] || 'home');
}

function validateOperador() {
  const v = q('#inp-operador').value.trim();
  if (!v) { showToast('Informe seu nome antes de continuar.', 'error'); q('#inp-operador').focus(); return false; }
  State.operador = v;
  q('#operator-badge').textContent = v;
  return true;
}

// ── SCANNER ───────────────────────────────────────────────────────────────

async function startScan(mode) {
  scanMode = mode;
  navigate(mode === 'coleta' ? 'coleta-scan' : mode === 'descarga' ? 'descarga-scan' : 'carga-scan');

  // Atualizar info header do scan
  if (mode === 'coleta') {
    q('#scan-info').textContent = `${State.coleta.cliente} — Pallet ${State.coleta.palletAtual.numero}`;
    updateScanCounter();
  } else if (mode === 'descarga') {
    const tipo = State.descarga.tipo === 'coleta' ? 'Descarga de Coleta' : 'Descarga de Viagem';
    q('#scan-info-desc').textContent = `${tipo} — Placa ${State.descarga.placa}${State.descarga.cidade ? ' → '+State.descarga.cidade : ''}`;
    updateDescargaCounter();
  } else {
    q('#scan-info-carga').textContent = `Placa ${State.carga.placa} — ${State.carga.cidades.join(', ')}`;
    updateCargaCounter();
  }

  try {
    const containerId = mode === 'coleta' ? 'reader-coleta' : mode === 'descarga' ? 'reader-descarga' : 'reader-carga';
    await Scanner.start(containerId, handleScanResult);
  } catch (err) {
    showToast('Não foi possível acessar a câmera. Verifique as permissões.', 'error', 4000);
    navigate(mode === 'coleta' ? 'coleta-pallet' : mode === 'descarga' ? `descarga-${State.descarga.tipo}-setup` : 'carga-setup');
  }
}

function handleScanResult(text) {
  if (scanPaused) return;
  scanPaused = true;
  const parsed = Parser.parse(text);
  showParseModal(parsed, text, confirmedData => {
    if (!confirmedData) return;
    if (scanMode === 'coleta')    processColetaScan(confirmedData);
    if (scanMode === 'descarga')  processDescargaScan(confirmedData);
    if (scanMode === 'carga')     processCargaScan(confirmedData);
    Scanner.resetDebounce();
  });
}

// ── MODAL DE PARSE / CONFIRMAÇÃO ──────────────────────────────────────────

function showParseModal(parsed, rawText, callback) {
  parseModalCallback = callback;
  q('#parse-raw').textContent = rawText.length > 120 ? rawText.substring(0, 120) + '…' : rawText;

  // Preencher campos com o que foi extraído
  q('#inp-parse-nf').value       = parsed.nf       || '';
  q('#inp-parse-pedido').value   = parsed.pedido   || '';
  q('#inp-parse-cidade').value   = parsed.cidade   || '';
  q('#inp-parse-volAtual').value = parsed.volAtual != null ? parsed.volAtual : '';
  q('#inp-parse-volTotal').value = parsed.volTotal != null ? parsed.volTotal : '';

  validateParseForm();
  showModal('modal-parse');
  // Focar no primeiro campo vazio obrigatório
  const firstEmpty = ['#inp-parse-nf','#inp-parse-pedido','#inp-parse-cidade','#inp-parse-volAtual','#inp-parse-volTotal']
    .map(s => q(s)).find(el => !el.value.trim());
  if (firstEmpty) setTimeout(() => firstEmpty.focus(), 300);
}

function validateParseForm() {
  const nf    = q('#inp-parse-nf').value.trim();
  const ped   = q('#inp-parse-pedido').value.trim();
  const cid   = q('#inp-parse-cidade').value.trim();
  const va    = q('#inp-parse-volAtual').value.trim();
  const vt    = q('#inp-parse-volTotal').value.trim();
  const valid = (nf || ped) && cid && va && vt;
  q('#btn-parse-confirm').disabled = !valid;

  // Indicar campos obrigatórios não preenchidos
  q('#inp-parse-nf').classList.toggle('field-missing',    !nf && !ped);
  q('#inp-parse-pedido').classList.toggle('field-missing', !nf && !ped);
  q('#inp-parse-cidade').classList.toggle('field-missing', !cid);
  q('#inp-parse-volAtual').classList.toggle('field-missing', !va);
  q('#inp-parse-volTotal').classList.toggle('field-missing', !vt);
}

function getParseFormData() {
  return {
    nf:       q('#inp-parse-nf').value.trim(),
    pedido:   q('#inp-parse-pedido').value.trim(),
    cidade:   q('#inp-parse-cidade').value.trim(),
    volAtual: parseInt(q('#inp-parse-volAtual').value, 10),
    volTotal: parseInt(q('#inp-parse-volTotal').value, 10),
    raw:      q('#parse-raw').textContent
  };
}

// ── COLETA ────────────────────────────────────────────────────────────────

function processColetaScan(vol) {
  const key = Parser.volumeKey(vol);
  if (State.coleta.keys.has(key)) {
    Audio.duplicate();
    showToast(`Duplicata! ${_volLabel(vol)} já foi lido.`, 'warning');
    return;
  }
  State.coleta.keys.add(key);
  State.coleta.palletAtual.volumes.push(vol);
  Audio.success();
  updateScanCounter();
  showToast(`✓ ${_volLabel(vol)}`, 'success', 1500);
  saveSession('coleta');
}

function updateScanCounter() {
  const count = State.coleta.palletAtual ? State.coleta.palletAtual.volumes.length : 0;
  q('#scan-count-coleta').textContent = count;
}

function finishColetaPallet() {
  const pa = State.coleta.palletAtual;
  if (!pa || pa.volumes.length === 0) {
    showToast('Nenhum volume capturado neste pallet.', 'error');
    return;
  }
  Scanner.stop();
  State.coleta.pallets.push({ ...pa });
  State.coleta.palletAtual = null;
  renderColetaSummary();
  navigate('coleta-summary');
}

function renderColetaSummary() {
  const pallet = State.coleta.pallets[State.coleta.pallets.length - 1];
  q('#summary-pallet-num').textContent = pallet.numero;
  q('#summary-count').textContent = pallet.volumes.length;

  // Grupos por NF/Pedido com status de volumes
  const groups = groupVolumes(pallet.volumes);
  const listEl = q('#summary-nf-list');
  listEl.innerHTML = '';
  for (const [id, g] of Object.entries(groups)) {
    const pending = getPendingVolumes(g);
    const li = document.createElement('li');
    li.className = pending.length ? 'nf-item pending' : 'nf-item ok';
    const vols = Array.from({length: g.total}, (_, i) => {
      const v = i + 1;
      return g.captured.has(v) ? `<span class="vol ok">${v}</span>` : `<span class="vol missing">${v}</span>`;
    }).join('');
    li.innerHTML = `<strong>${id}</strong> — ${g.cidade}<br><small>Volumes: ${vols} / ${g.total}</small>`;
    listEl.appendChild(li);
  }
}

function startNewPallet() {
  State.coleta.palletAtual = null;
  q('#inp-pallet-num').value = '';
  renderPalletList();
  navigate('coleta-pallet');
}

function renderPalletList() {
  const listEl = q('#pallet-list');
  listEl.innerHTML = '';
  if (!State.coleta.pallets.length) {
    listEl.innerHTML = '<li class="empty">Nenhum pallet finalizado ainda.</li>';
    return;
  }
  State.coleta.pallets.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Pallet ${p.numero}</strong> — ${p.volumes.length} volume(s)`;
    listEl.appendChild(li);
  });
}

async function sendColetaFile(andClose) {
  const data = {
    operador: State.operador,
    cliente:  State.coleta.cliente,
    placa:    State.coleta.placa,
    data:     State.coleta.data,
    pallets:  State.coleta.pallets
  };
  const btn = q('#btn-enviar-arquivo');
  setLoading(btn, true);
  try {
    await generateAndSend('coleta', data);
    if (andClose) { Storage.clearSession(); resetColeta(); navigate('home'); }
  } finally {
    setLoading(btn, false);
  }
}

async function endColeta() {
  // Verifica pendências em TODOS os pallets
  const allVolumes = State.coleta.pallets.flatMap(p => p.volumes);
  const pending = getPendingGroups(allVolumes);

  if (pending.length) {
    renderPendingModal(pending);
    // Ao voltar: ir para pallet para adicionar nova captura dos volumes faltantes
    q('#btn-pending-back').textContent = '← Voltar para o Pallet';
    q('#btn-pending-back').onclick = () => {
      hideModal('modal-pending');
      navigate('coleta-pallet');
    };
    showModal('modal-pending');
    return;
  }

  // Tudo ok → salvar + gerar Excel + ir para home
  const btn = q('#btn-encerrar-coleta');
  setLoading(btn, true);
  try {
    const data = { operador: State.operador, cliente: State.coleta.cliente, placa: State.coleta.placa, data: State.coleta.data, pallets: State.coleta.pallets };
    await Storage.saveColeta(data);
    await generateAndSend('coleta', data);
    Storage.clearSession();
    resetColeta();
    navigate('home');
    showToast('Coleta encerrada e salva!', 'success', 3000);
  } finally {
    setLoading(btn, false);
  }
}

function resetColeta() {
  State.coleta = { cliente: '', placa: '', data: '', pallets: [], palletAtual: null, keys: new Set() };
}

// ── DESCARGA ──────────────────────────────────────────────────────────────

function processDescargaScan(vol) {
  const key = Parser.volumeKey(vol);

  // Para descarga de viagem: alertar se cidade diferente
  if (State.descarga.tipo === 'viagem') {
    const destCity = Parser.normalize(State.descarga.cidade);
    const volCity  = Parser.normalize(vol.cidade);
    if (destCity && volCity && !volCity.includes(destCity) && !destCity.includes(volCity)) {
      Audio.duplicate();
      showToast(`⚠ Volume de outra cidade! (${vol.cidade})`, 'warning', 3500);
      vol._wrongCity = true;
    }
  }

  if (State.descarga.keys.has(key)) {
    Audio.duplicate();
    showToast(`Duplicata! ${_volLabel(vol)} já foi lido.`, 'warning');
    return;
  }

  State.descarga.keys.add(key);
  State.descarga.volumes.push(vol);
  Audio.success();
  updateDescargaCounter();
  showToast(`✓ ${_volLabel(vol)}`, 'success', 1500);
}

function updateDescargaCounter() {
  q('#scan-count-descarga').textContent = State.descarga.volumes.length;
}

async function endDescarga() {
  await Scanner.stop();

  if (State.descarga.tipo === 'coleta') {
    await endDescargaColeta();
  } else {
    await endDescargaViagem();
  }
}

async function endDescargaColeta() {
  const btn = q('#btn-encerrar-descarga');
  setLoading(btn, true);

  let coletas;
  try {
    coletas = await Storage.getColetasByPlate(State.descarga.placa);
  } finally {
    setLoading(btn, false);
  }

  if (!coletas.length) {
    showToast('Nenhuma coleta encontrada para esta placa.', 'warning', 4000);
  }

  // Construir conjunto de volumes esperados
  const expected = coletas.flatMap(c => c.pallets.flatMap(p => p.volumes.map(v => ({ ...v, cliente: c.cliente }))));
  const scannedKeys = State.descarga.keys;

  const faltas = expected.filter(v => !scannedKeys.has(Parser.volumeKey(v)));

  if (faltas.length === 0) {
    await finalizeDescarga([]);
    return;
  }

  renderDescargaResult(faltas);
  navigate('descarga-result');
}

async function endDescargaViagem() {
  const btn = q('#btn-encerrar-descarga');
  setLoading(btn, true);

  let carregamentos;
  try {
    carregamentos = await Storage.getCarregamentosByPlate(State.descarga.placa);
  } finally {
    setLoading(btn, false);
  }

  // Encontrar o carregamento mais recente que inclui a cidade informada
  const cidNorm = Parser.normalize(State.descarga.cidade);
  const cargMatch = carregamentos.find(c =>
    (c.cidades || []).some(ci => Parser.normalize(ci).includes(cidNorm) || cidNorm.includes(Parser.normalize(ci)))
  );

  const expected = cargMatch
    ? cargMatch.volumes.filter(v => {
        const cn = Parser.normalize(v.cidade);
        return cn.includes(cidNorm) || cidNorm.includes(cn);
      })
    : [];

  const scannedKeys = State.descarga.keys;
  const faltas = expected.filter(v => !scannedKeys.has(Parser.volumeKey(v)));

  // Sobras: volumes escaneados com cidade diferente
  const sobras = State.descarga.volumes.filter(v => v._wrongCity);

  if (faltas.length === 0 && sobras.length === 0) {
    await finalizeDescarga([]);
    return;
  }

  renderDescargaResult(faltas, sobras);
  navigate('descarga-result');
}

function renderDescargaResult(faltas, sobras = []) {
  const el = q('#descarga-result-container');
  let html = '';

  if (faltas.length) {
    html += `<div class="result-section"><h3>⚠ Volumes não recebidos (${faltas.length})</h3><ul class="result-list">`;
    faltas.forEach(v => {
      html += `<li><strong>NF ${v.nf||'-'} / Ped ${v.pedido||'-'}</strong><br>${v.cidade} — Vol <em>${v.volAtual}/${v.volTotal}</em>${v.cliente ? ' — '+v.cliente : ''}</li>`;
    });
    html += '</ul></div>';
  }

  if (sobras.length) {
    html += `<div class="result-section"><h3>⚠ Volumes de outra cidade (${sobras.length})</h3><ul class="result-list">`;
    sobras.forEach(v => {
      html += `<li><strong>NF ${v.nf||'-'}</strong> — Cidade: ${v.cidade} — Vol ${v.volAtual}/${v.volTotal}</li>`;
    });
    html += '</ul></div>';
  }

  html += `<p class="result-note">Para confirmar com pendência é necessário inserir a senha de liberação.</p>`;
  html += `<div class="password-inline">
    <input type="password" id="inp-result-password" placeholder="Senha de liberação" class="input-field">
    <p id="result-password-error" class="error-text" style="display:none">Senha incorreta.</p>
    <button class="btn btn-danger" id="btn-result-confirm">Confirmar com pendência</button>
    <button class="btn btn-outline" id="btn-result-back">Voltar para captura</button>
  </div>`;

  el.innerHTML = html;

  // Listeners dos botões gerados dinamicamente
  q('#btn-result-confirm').addEventListener('click', async () => {
    const pwd = q('#inp-result-password').value;
    if (!CONFIG.checkAdminPassword(pwd)) {
      q('#result-password-error').style.display = 'block';
      Audio.error();
      return;
    }
    q('#result-password-error').style.display = 'none';
    // Marcar faltas como NÃO RECEBIDO NA BASE
    const volsComStatus = State.descarga.volumes.map(v => ({ ...v, status: 'OK' }));
    faltas.forEach(f => {
      volsComStatus.push({ ...f, status: 'NÃO RECEBIDO NA BASE', volAtual: f.volAtual });
    });
    await finalizeDescarga(volsComStatus, true);
  });

  q('#btn-result-back').addEventListener('click', () => {
    State.descarga.volumes = [];
    State.descarga.keys = new Set();
    startScan('descarga');
  });
}

async function finalizeDescarga(extraVolumes, hasPendency = false) {
  const allVolumes = hasPendency ? extraVolumes : State.descarga.volumes.map(v => ({ ...v, status: 'OK' }));
  const data = { ...State.descarga, volumes: allVolumes };

  const tipo = `descarga_${State.descarga.tipo}`;
  const btn  = q('#btn-encerrar-descarga');
  setLoading(btn, true);
  try {
    await generateAndSend(tipo, data);
    navigate('home');
    showToast('Descarga finalizada!', 'success', 3000);
    State.descarga = { tipo: null, placa: '', cidade: '', data: '', volumes: [], keys: new Set() };
  } finally {
    setLoading(btn, false);
  }
}

// ── CARREGAMENTO ──────────────────────────────────────────────────────────

function processCargaScan(vol) {
  const key = Parser.volumeKey(vol);

  // Verificar se a cidade do volume está na lista de cidades do carregamento
  const cidadesNorm = State.carga.cidades.map(c => Parser.normalize(c));
  const volCidade   = Parser.normalize(vol.cidade);
  const cidadeOk    = cidadesNorm.some(c => c.includes(volCidade) || volCidade.includes(c));

  if (!cidadeOk && vol.cidade) {
    Audio.duplicate();
    showToast(`⚠ ${vol.cidade} não está na lista de cidades deste veículo!`, 'warning', 4000);
    vol._wrongCity = true;
  }

  if (State.carga.keys.has(key)) {
    Audio.duplicate();
    showToast(`Duplicata! ${_volLabel(vol)} já foi lido.`, 'warning');
    return;
  }

  State.carga.keys.add(key);
  State.carga.volumes.push(vol);
  Audio.success();
  updateCargaCounter();
  showToast(`✓ ${_volLabel(vol)}`, 'success', 1500);
}

function updateCargaCounter() {
  q('#scan-count-carga').textContent = State.carga.volumes.length;
}

async function endCarga() {
  await Scanner.stop();

  // Verificar volumes pendentes
  const pending = getPendingGroups(State.carga.volumes);

  if (pending.length) {
    renderPendingModal(pending);
    q('#btn-pending-back').textContent = '← Voltar para captura';
    q('#btn-pending-back').onclick = () => {
      hideModal('modal-pending');
      startScan('carga');
    };
    showModal('modal-pending');
    return;
  }

  await finalizeCarga(false);
}

async function finalizeCarga(comPendencia) {
  const data = {
    operador: State.operador,
    placa:    State.carga.placa,
    cidades:  State.carga.cidades,
    data:     State.carga.data,
    volumes:  State.carga.volumes
  };

  const btn = q('#btn-encerrar-carga');
  setLoading(btn, true);
  try {
    await Storage.saveCarregamento(data);
    await generateAndSend('carregamento', data);
    navigate('home');
    showToast('Carregamento finalizado e salvo!', 'success', 3000);
    State.carga = { placa: '', cidades: [], data: '', volumes: [], keys: new Set() };
  } finally {
    setLoading(btn, false);
  }
}

// ── CIDADES DINÂMICAS ─────────────────────────────────────────────────────

function resetCargaCidades() {
  const container = q('#carga-cidades-container');
  container.innerHTML = '';
  addCidadeInput();
}

function setupInitialCidadesInput() {
  resetCargaCidades();
}

function addCidadeInput() {
  const container = q('#carga-cidades-container');
  const wrapper   = document.createElement('div');
  wrapper.className = 'cidade-input-row';

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'input-field';
  inp.placeholder = 'Ex: Campo Grande';
  inp.autocomplete = 'off';

  // Ao sair de um campo preenchido, adicionar novo automaticamente
  inp.addEventListener('blur', () => {
    const val = inp.value.trim();
    if (val) {
      const inputs = qa('#carga-cidades-container .cidade-input-row input');
      const last   = inputs[inputs.length - 1];
      if (last === inp && val.length > 0) addCidadeInput();
    }
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-cidade';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    if (container.children.length > 1) wrapper.remove();
  });

  wrapper.appendChild(inp);
  wrapper.appendChild(removeBtn);
  container.appendChild(wrapper);
  inp.focus();
}

function getCidadesList() {
  return Array.from(qa('#carga-cidades-container .cidade-input-row input'))
    .map(i => i.value.trim())
    .filter(Boolean);
}

// ── LÓGICA DE VOLUMES ─────────────────────────────────────────────────────

function groupVolumes(volumes) {
  const groups = {};
  volumes.forEach(v => {
    const id = _volGroupId(v);
    if (!groups[id]) {
      groups[id] = { id, nf: v.nf, pedido: v.pedido, cidade: v.cidade, total: v.volTotal, captured: new Set() };
    }
    if (v.volTotal > groups[id].total) groups[id].total = v.volTotal;
    groups[id].captured.add(v.volAtual);
  });
  return groups;
}

function getPendingVolumes(group) {
  const missing = [];
  for (let i = 1; i <= group.total; i++) {
    if (!group.captured.has(i)) missing.push(i);
  }
  return missing;
}

function getPendingGroups(volumes) {
  const groups = groupVolumes(volumes);
  const pending = [];
  for (const [, g] of Object.entries(groups)) {
    const missing = getPendingVolumes(g);
    if (missing.length) {
      pending.push({ ...g, missing });
    }
  }
  return pending;
}

function renderPendingModal(pendingGroups) {
  const listEl = q('#pending-list');
  listEl.innerHTML = '';
  pendingGroups.forEach(g => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${g.id}</strong> — ${g.cidade}<br>
      <small>Volumes faltantes: <span class="badge-missing">${g.missing.map(m => `${m}/${g.total}`).join(', ')}</span></small>`;
    listEl.appendChild(li);
  });
}

function _volGroupId(v) {
  const id = v.nf ? `NF ${v.nf}` : `Ped ${v.pedido}`;
  return id;
}

function _volLabel(v) {
  const id = v.nf ? `NF ${v.nf}` : `Ped ${v.pedido}`;
  return `${id} vol ${v.volAtual}/${v.volTotal}`;
}

// ── EXCEL & EMAIL ─────────────────────────────────────────────────────────

async function generateAndSend(tipo, data) {
  let ws, sheetName;
  if (tipo === 'coleta') {
    ws = Excel.buildColeta(data);
    sheetName = 'Coleta';
  } else if (tipo === 'carregamento') {
    ws = Excel.buildCarregamento(data);
    sheetName = 'Carregamento';
  } else {
    ws = Excel.buildDescarga(data);
    sheetName = 'Descarga';
  }

  const wb     = Excel.createWorkbook(ws, sheetName);
  const fname  = Excel.filename(tipo, data.placa, data.data);
  const b64    = Excel.toBase64(wb);

  // Download automático
  Excel.download(wb, fname);

  // Envio por e-mail (não bloqueia o fluxo)
  Email.send(tipo, data, b64, fname).then(ok => {
    if (ok) showToast('E-mail enviado com sucesso!', 'success');
    else if (CONFIG.isEmailConfigured()) showToast('Falha no envio do e-mail. Planilha baixada.', 'warning');
  });
}

// ── MODAIS ────────────────────────────────────────────────────────────────

function showConfirmDialog(msg, onConfirm) {
  q('#modal-confirm-msg').textContent = msg;
  window._confirmCallback = onConfirm;
  showModal('modal-confirm');
}

function saveSession(tipo) {
  Storage.saveSession({
    tipo,
    operador: State.operador,
    keys:     Array.from(State.coleta.keys),
    dados:    {
      cliente:      State.coleta.cliente,
      placa:        State.coleta.placa,
      data:         State.coleta.data,
      pallets:      State.coleta.pallets,
      palletAtual:  State.coleta.palletAtual
    }
  });
}

// ── AVISOS DE CONFIGURAÇÃO ────────────────────────────────────────────────

function showSetupNotices() {
  const notices = [];
  if (!CONFIG.isFirebaseConfigured()) {
    notices.push('🔶 <strong>Firebase não configurado</strong> — dados ficam apenas neste dispositivo. Configure em js/config.js.');
  }
  if (!CONFIG.isEmailConfigured()) {
    notices.push('🔶 <strong>EmailJS não configurado</strong> — envio automático de e-mail desativado. Configure em js/config.js.');
  }
  if (!notices.length) return;

  const homeScreen = q('#screen-home');
  if (!homeScreen) return;

  const div = document.createElement('div');
  div.className = 'notice-card';
  div.innerHTML = notices.join('<br>') + `<br><small style="color:var(--gray-600)">
    <a href="COMO_CONFIGURAR.html" target="_blank" style="color:var(--blue)">Ver guia de configuração →</a>
  </small>`;
  homeScreen.appendChild(div);
}

// ── INICIAR ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

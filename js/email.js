// Envio automático de e-mail com planilha via EmailJS
const Email = (() => {

  let initialized = false;

  function ensureInit() {
    if (!initialized && CONFIG.isEmailConfigured()) {
      emailjs.init(CONFIG.emailjs.publicKey);
      initialized = true;
    }
  }

  async function send(tipo, data, xlsxBase64, fname) {
    if (!CONFIG.isEmailConfigured()) {
      console.warn('[Email] EmailJS não configurado — e-mail não enviado.');
      return false;
    }

    ensureInit();

    const tipoLabels = {
      coleta:           'Conferência de Coleta',
      carregamento:     'Conferência de Carregamento',
      descarga_coleta:  'Descarga de Coleta',
      descarga_viagem:  'Descarga de Viagem'
    };

    const params = {
      to_email:  CONFIG.emailDestino,
      operador:  data.operador  || '',
      tipo:      tipoLabels[tipo] || tipo,
      data:      data.data      || '',
      placa:     data.placa     || '',
      cliente:   data.cliente   || '',
      cidades:   (data.cidades  || []).join(', '),
      filename:  fname,
      // Conteúdo do arquivo em base64 para o template
      attachment_content: xlsxBase64,
      attachment_name:    fname
    };

    try {
      await emailjs.send(
        CONFIG.emailjs.serviceId,
        CONFIG.emailjs.templateId,
        params
      );
      console.log('[Email] Enviado com sucesso:', fname);
      return true;
    } catch (err) {
      console.error('[Email] Falha no envio:', err);
      return false;
    }
  }

  return { send };
})();

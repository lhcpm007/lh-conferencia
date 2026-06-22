// Extração de dados de etiquetas de frete
// Suporta: QR Code NFe, GS1-128, texto livre com padrões comuns
const Parser = (() => {

  function normalize(str) {
    if (!str) return '';
    return String(str)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Tenta extrair de QR Code NFe (chave de 44 dígitos em URL)
  function tryNFeQR(text) {
    const m = text.match(/chNFe=(\d{44})/);
    if (!m) return null;
    const chave = m[1];
    // Posições da chave de acesso NFe:
    // 0-1   = cUF (estado)
    // 2-5   = AAMM
    // 6-19  = CNPJ emitente
    // 20-21 = modelo
    // 22-24 = série
    // 25-33 = número NF (9 dígitos)
    const nfRaw = chave.substring(25, 34);
    return {
      nf:       String(parseInt(nfRaw, 10)), // remove zeros à esquerda
      pedido:   '',
      cidade:   '',
      volAtual: null,
      volTotal: null
    };
  }

  // Extração por padrões de texto livre
  function tryTextPatterns(text) {
    const up = normalize(text);
    const result = {};

    // NF: "NF 001234", "NOTA FISCAL: 1234", "NF:1234", "NF°1234"
    const nfMatch = up.match(/\bN\.?F\.?(?:E\.?)?\s*[:\-#°]?\s*(\d{1,9})\b/);
    if (nfMatch) result.nf = String(parseInt(nfMatch[1], 10));

    // Pedido: "PED 1234", "PEDIDO: 56789", "ORDEM: 1234"
    const pedMatch = up.match(/\b(?:PED(?:IDO)?|ORDEM|ORD|ORDER)\s*[:\-#°]?\s*(\d{4,12})\b/);
    if (pedMatch) result.pedido = String(parseInt(pedMatch[1], 10));

    // Volume: "1/4", "VOL 1/4", "VOLUME 1 DE 4", "1 DE 4", "VOL. 001/004"
    const volMatch = up.match(/\b(?:VOL(?:UME)?\.?\s*)?(\d{1,3})\s*(?:\/|DE)\s*(\d{1,3})\b/);
    if (volMatch) {
      const va = parseInt(volMatch[1], 10);
      const vt = parseInt(volMatch[2], 10);
      if (va <= vt && vt > 0 && vt <= 9999) {
        result.volAtual = va;
        result.volTotal = vt;
      }
    }

    // Cidade destino — várias formas comuns em etiquetas brasileiras
    const cityPatterns = [
      /\bDEST(?:INO|INATARIO)?\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú ]{2,30}?)(?:\s*[-\/|,\n]|$)/,
      /\bENTREGA\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú ]{2,30}?)(?:\s*[-\/|,\n]|$)/,
      /\bCIDADE\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú ]{2,30}?)(?:\s*[-\/|,\n]|$)/,
      /\bMUNICIPIO\s*[:\-]?\s*([A-ZÀ-Ú][A-ZÀ-Ú ]{2,30}?)(?:\s*[-\/|,\n]|$)/,
    ];
    for (const pat of cityPatterns) {
      const cm = up.match(pat);
      if (cm) { result.cidade = cm[1].trim(); break; }
    }

    return Object.keys(result).length ? result : null;
  }

  // Tenta GS1-128 com Application Identifiers
  function tryGS1(text) {
    if (!/\(\d{2}\)/.test(text)) return null;
    const result = {};
    // AI (02) = GTIN de conteúdo | AI (10) = lote/ref | AI (30) = qtd | AI (37) = count
    const lotMatch = text.match(/\(10\)([^\(]{1,20})/);
    if (lotMatch) result.pedido = lotMatch[1].trim();
    const qtyMatch = text.match(/\(37\)(\d+)/);
    if (qtyMatch) result.volTotal = parseInt(qtyMatch[1], 10);
    return Object.keys(result).length ? result : null;
  }

  function parse(rawText) {
    if (!rawText || !rawText.trim()) return null;
    const text = rawText.trim();

    let base = { nf: '', pedido: '', cidade: '', volAtual: null, volTotal: null, raw: text };

    // 0. Templates específicos por cliente (máxima prioridade)
    // parseWithTemplates é definida em label-templates.js (carregado antes)
    if (typeof parseWithTemplates === 'function') {
      const tplResult = parseWithTemplates(text);
      if (tplResult && (tplResult.nf || tplResult.pedido)) {
        return { ...base, ...tplResult };
      }
    }

    // 1. NFe QR code
    if (text.includes('chNFe=')) {
      const r = tryNFeQR(text);
      if (r) base = { ...base, ...r };
    }

    // 2. GS1-128
    const gs1 = tryGS1(text);
    if (gs1) base = { ...base, ...gs1 };

    // 3. Texto livre (complementa os anteriores)
    const txt = tryTextPatterns(text);
    if (txt) {
      // Só sobrescreve campo vazio
      for (const [k, v] of Object.entries(txt)) {
        if (!base[k] && v !== null && v !== undefined) base[k] = v;
      }
    }

    return base;
  }

  function isComplete(data) {
    if (!data) return false;
    if (!data.nf && !data.pedido) return false;
    if (!data.cidade) return false;
    if (!data.volAtual || !data.volTotal) return false;
    return true;
  }

  // Chave única de volume: usada para detecção de duplicatas
  function volumeKey(data) {
    const id = data.nf || data.pedido || '';
    return `${normalize(id)}:${data.volAtual}`;
  }

  return { parse, isComplete, volumeKey, normalize };
})();

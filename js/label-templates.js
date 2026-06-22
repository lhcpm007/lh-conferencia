// ============================================================
// Templates de Etiquetas por Cliente — LH Transportes
// ============================================================
// Este arquivo é atualizado conforme o usuário mostra fotos de
// etiquetas no chat. Claude analisa cada formato e adiciona um
// novo bloco abaixo.
//
// Estrutura de cada template:
//   nome    — identificação legível (para debug)
//   detectar(text) → boolean — identifica se o texto OCR é desta etiqueta
//   extrair(text)  → { nf, pedido, cidade, volAtual, volTotal }
// ============================================================

const LABEL_TEMPLATES = [

  // ──────────────────────────────────────────────────────────
  // Etiqueta WMS com Romaneio (sistema LH Transportes)
  // Exemplo: PED: 19-05114-001 / VOL: 0001 / WMS: 4145604
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta WMS/Romaneio LH',
    detectar: text => {
      const up = text.toUpperCase();
      // Detecta pelo padrão PED com hífens OU pela combinação WMS + ROMANEIO
      return /\bPED\s*[:.]\s*\d{2}[-\s]\d{5}[-\s]\d{3}/.test(up) ||
             (/\bWMS\s*[:.]/i.test(up) && /\bROMANEIO\b/i.test(up));
    },
    extrair: text => {
      const up = text.toUpperCase();

      // PED: 19-05114-001 (tolerante a espaços onde há hífens)
      const pedMatch = up.match(/\bPED\s*[:.]\s*(\d{2}[-\s]\d{5}[-\s]\d{3})/);
      const pedido = pedMatch ? pedMatch[1].replace(/\s/g, '-').trim() : '';

      // Dois formatos possíveis de volume:
      // 1) Campo separado:  VOL: 0001
      // 2) Junto ao PED:    18-05152-001/ 3  → último segmento = volAtual, /N = volTotal
      const volCampo = up.match(/\bVOL\s*[:.]\s*(\d{1,4})\b/);
      const volPed   = up.match(/\d{2}[-\s]\d{5}[-\s](\d{3})\s*\/\s*(\d{1,4})\b/);
      const volAtual = volCampo ? parseInt(volCampo[1], 10)
                     : volPed   ? parseInt(volPed[1], 10) : null;

      // Cidade: texto antes de "MS" na mesma linha
      // Ex: "CAMPO GRANDE    MS" → "CAMPO GRANDE"
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29})\s{2,}MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      // volTotal: vem do /N (formato junto ao PED) ou fica null para o usuário preencher
      const volTotal = volPed ? parseInt(volPed[2], 10) : null;

      return { nf: '', pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta LIFT Logística (Farma Logística e Armazéns)
  // Exemplo: Pedido: 000101350 / Vol.: 7/7 / NF: 101350 / 103
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta LIFT Logística',
    detectar: text => {
      const up = text.toUpperCase();
      // "Pedido:" + "Vol.:" são únicos deste formato
      return /\bPEDIDO\s*[:.]/i.test(up) && /\bVOL\s*\.?\s*[:.]\s*\d+\s*\/\s*\d+/i.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // NF: 101350 / 103  →  captura só o número principal (antes da barra)
      const nfMatch = up.match(/\bNF\s*[:.]\s*(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // Pedido: 000101350
      const pedMatch = text.match(/Pedido\s*[:.]\s*(\d+)/i);
      const pedido = pedMatch ? String(parseInt(pedMatch[1], 10)) : '';

      // Vol.: 7/7  →  volAtual=7, volTotal=7
      const volMatch = up.match(/\bVOL\s*\.?\s*[:.]\s*(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: "CAMPO GRANDE - MS" ou "CAMPO GRANDE - MS - CEP"
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29?})\s*-\s*MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta com "Cidade/Estado" e "Volume X/Y" (ex: Merck/MERCK S/A)
  // Exemplo: NF: 1324188 / Volume 1/1 / Cidade/Estado: CAMPO GRANDE – MS
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta Cidade/Estado + Volume',
    detectar: text => {
      const up = text.toUpperCase();
      return /\bCIDADE\s*\/\s*ESTADO\b/.test(up) && /\bVOLUME\b/.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // NF: 1324188
      const nfMatch = up.match(/\bNF\s*[:.]\s*(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // Volume seguido de X/Y (pode ter newline entre eles)
      const volMatch = up.match(/\bVOLUME\b[^\/]{0,30}(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade/Estado: CAMPO GRANDE – MS (suporta hífen, travessão e em-dash)
      const cidadeMatch = up.match(/CIDADE\s*\/\s*ESTADO[\s\S]{0,15}([A-Z][A-Z\s]{2,29?})\s*[-–—]\s*MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido: '', cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta tgestiona (ex: Telefonica/Vivo)
  // Exemplo: Pedido: 8769747585 / NF:003220386 / Vol: 1 / 1 / Cidade: DOURADOS
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta tgestiona',
    detectar: text => /tgestiona/i.test(text),
    extrair: text => {
      const up = text.toUpperCase();

      // Pedido: 8769747585
      const pedMatch = up.match(/\bPEDIDO\s*[:.]\s*(\d+)/);
      const pedido = pedMatch ? pedMatch[1].trim() : '';

      // NF:003220386 → remove zeros à esquerda
      const nfMatch = up.match(/\bNF\s*[:.]\s*(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // Vol: 1 / 1
      const volMatch = up.match(/\bVOL\s*[:.]\s*(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: DOURADOS (campo explícito "Cidade:")
      const cidadeMatch = up.match(/\bCIDADE\s*[:.]\s*([A-Z][A-Z\s]{2,30?})(?:\s*\n|\s{2,}|$)/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta OCI/OCD (ex: BIOMEDICAL DIST.MERCOSUR)
  // Exemplo: N.Fiscal/Pedido: 0830532899 / Caixa: 1  De: 9
  // Volume em layout especial: labels "Caixa:" e "De:" com números na linha seguinte
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta OCI/OCD N.Fiscal+Caixa',
    detectar: text => {
      const up = text.toUpperCase();
      return /N[\.\s]FISCAL/.test(up) && /\bCAIXA\b/.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // Numero/N.Fiscal/Pedido — número na linha após o label "Pedido"
      const pedMatch = up.match(/\bPEDIDO\s*[\r\n\s]+(\d{8,12})/) ||
                       up.match(/N[\.\s]FISCAL[\s\S]{0,30}?(\d{8,12})/);
      const pedido = pedMatch ? pedMatch[1].trim() : '';
      const nf     = pedido   ? String(parseInt(pedido, 10)) : '';

      // Caixa: X  De: Y (números na mesma linha ou na seguinte em fonte grande)
      const volMatch = up.match(/CAIXA\s*[:.]\s*(\d+)[\s\S]{0,30}?DE\s*[:.]\s*(\d+)/) ||
                       up.match(/CAIXA[\s\S]{0,60}?(\d{1,3})\s{2,}(\d{1,3})/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: CAMPO GRANDE    MS
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29?})\s{2,}MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta "Notas fiscais + Volumes" (ex: OMEGA MED)
  // Exemplo: Notas fiscais: 151709 / Volumes: 001/001 / PORTO MURTINHO - MS
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta Notas Fiscais + Volumes',
    detectar: text => {
      const up = text.toUpperCase();
      return /NOTAS\s+FISCAIS/i.test(up) && /\bVOLUMES\b/i.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // Notas fiscais: 151709
      const nfMatch = up.match(/NOTAS\s+FISCAIS[\s\r\n]+(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // Volumes: 001/001
      const volMatch = up.match(/\bVOLUMES[\s\r\n]+(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: PORTO MURTINHO - MS
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29?})\s*-\s*MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido: '', cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta CONEXAO (M M DE CARVALHO E CIA LTDA)
  // Exemplo: Ped: 51216 / Volume: 1/6 / CAMPO GRANDE - MS
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta CONEXAO',
    detectar: text => /\bCONEXAO\b/i.test(text) && /\bPED\s*[:.]\s*\d+/i.test(text),
    extrair: text => {
      const up = text.toUpperCase();

      // Ped: 51216
      const pedMatch = up.match(/\bPED\s*[:.]\s*(\d+)/);
      const pedido = pedMatch ? pedMatch[1].trim() : '';

      // Volume: 1/6
      const volMatch = up.match(/\bVOLUME\s*[:.]\s*(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: CAMPO GRANDE - MS
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29?})\s*-\s*MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf: '', pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta com Razao Social + Pedido/OS (ex: CASA DE COSMETICOS)
  // Exemplo: Pedido/OS: /0018182 / Volume: 4/5 / Cidade: CAMPO GRANDE / Estado: MS
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta Pedido/OS + Razao Social',
    detectar: text => /PEDIDO\s*\/\s*OS/i.test(text) && /RAZAO\s+SOCIAL/i.test(text),
    extrair: text => {
      const up = text.toUpperCase();

      // Pedido/OS: /0018182 — strip "/" inicial e zeros à esquerda
      const pedMatch = up.match(/PEDIDO\s*\/\s*OS[\s\r\n]+\/?(\d+)/);
      const pedido = pedMatch ? String(parseInt(pedMatch[1], 10)) : '';

      // Volume: 4/5
      const volMatch = up.match(/\bVOLUME[\s\r\n]+(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: CAMPO GRANDE  Estado: MS — cidade aparece antes de MS
      const cidadeMatch = up.match(/\bCIDADE[\s\S]{0,30}?\n([A-Z][A-Z\s]{2,29?})\s+MS\b/) ||
                          up.match(/([A-Z][A-Z\s]{2,29?})\s+MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf: '', pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta NOTAFISCAL + REMESSA + VOLUME em duas linhas (distribuidora)
  // Exemplo: NOTAFISCAL: 000340968 / REMESSA: 81334478 / VOLUME: 0027 / 0041 volumes
  // Cidade não consta — usuário preenche no modal
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta NOTAFISCAL + REMESSA',
    detectar: text => {
      const up = text.toUpperCase();
      return /\bNOTAFISCAL\b/.test(up) && /\bREMESSA\b/.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // NOTAFISCAL: 000340968 → remove zeros à esquerda
      const nfMatch = up.match(/\bNOTAFISCAL[\s\r\n]+(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // REMESSA: 81334478
      const pedMatch = up.match(/\bREMESSA[\s\r\n]+(\d+)/);
      const pedido = pedMatch ? pedMatch[1].trim() : '';

      // VOLUME: 0027 (linha 1) / 0041 volumes (linha 2)
      const volMatch = up.match(/\bVOLUME[\s\S]{0,10}?(\d+)[\s\S]{0,15}?(\d+)\s*VOLUMES?/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade não consta neste formato
      return { nf, pedido, cidade: '', volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta Ordem de Venda + Remessa (SAP/ERP)
  // Exemplo: Remessa: 0101073617 / Ordem de Venda: 8834452 / Volume: 0001/0002
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta Ordem de Venda (SAP)',
    detectar: text => /ORDEM\s+DE\s+VENDA/i.test(text),
    extrair: text => {
      const up = text.toUpperCase();

      // Ordem de Venda: 8834452
      const pedMatch = up.match(/ORDEM\s+DE\s+VENDA[\s\r\n:]+(\d+)/);
      const pedido = pedMatch ? pedMatch[1].trim() : '';

      // Remessa: 0101073617 (sem zeros à esquerda)
      const nfMatch = up.match(/\bREMESSA\s*[:.]\s*(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // Volume: 0001/0002
      const volMatch = up.match(/\bVOLUME\s*[:.]\s*(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: campo explícito "Cidade:"
      const cidadeMatch = up.match(/\bCIDADE\s*[:.]\s*([A-Z][A-Z\s]{2,29?})(?=[\r\n]|\s{2,}|$)/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta Meta Distribuidora (Nota Fiscal + Volumes em linhas separadas)
  // Exemplo: Nota Fiscal: 073996 / Volumes: 6/8 / ALCINOPOLIS-MS
  // Identificador único: "Espaço para etiqueta da transportadora"
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta Meta Distribuidora',
    detectar: text => /espa[cç]o\s+para\s+etiqueta/i.test(text),
    extrair: text => {
      const up = text.toUpperCase();

      // Nota Fiscal: 073996 — aceita número na mesma linha (com :) ou na seguinte
      const nfMatch = up.match(/NOTA\s+FISCAL[\s\r\n]*:?[\s\r\n]*(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // Volumes: 6/8 — aceita "Volumes: 6/8" (mesma linha c/ :) ou em linhas separadas
      const volMatch = up.match(/\bVOLUMES?\s*[:\s\r\n]+(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: "ALCINOPOLIS-MS" ou "ALCINOPOLIS MS" (com ou sem hífen)
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{1,29?})\s*[-–]\s*MS\b/) ||
                         up.match(/^([A-Z][A-Z\s]{1,29?})\s+MS\s*$/m);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido: '', cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta NOTA FISCAL + VOLUMES espaçados (distribuidora hospitalar)
  // Exemplo: NOTA FISCAL: 2160 / VOLUMES: 75  83 / NIOAQUE MS
  // Volume sem barra: dois números separados por espaço
  // Cidade destino em linha própria (ex: "NIOAQUE MS")
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta NOTA FISCAL + VOLUMES espaçados',
    detectar: text => {
      const up = text.toUpperCase();
      // NOTA FISCAL singular + VOLUMES com dois números sem barra
      return /\bNOTA\s+FISCAL\b/.test(up) &&
             /\bVOLUMES[\s\r\n]+\d+\s+\d+/.test(up) &&
             !/\bVOLUMES[\s\r\n]+\d+\s*\//.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // NOTA FISCAL: 2160
      const nfMatch = up.match(/\bNOTA\s+FISCAL[\s\r\n]+(\d+)/);
      const nf = nfMatch ? String(parseInt(nfMatch[1], 10)) : '';

      // VOLUMES: 75   83 (volAtual e volTotal separados por espaço)
      const volMatch = up.match(/\bVOLUMES[\s\r\n]+(\d+)\s+(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: linha isolada com "CIDADE MS" (sem traço nem vírgula)
      const cidadeMatch = up.match(/^([A-Z][A-Z\s]{2,29?})\s+MS\s*$/m);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido: '', cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta SAP ECP (REM + PED + VOL na mesma etiqueta)
  // Exemplo: REM: 8004456174 / PED: 2003984392 / VOL: 2/2 / COXIM-MS
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta SAP ECP (REM+PED+VOL)',
    detectar: text => {
      const up = text.toUpperCase();
      return /\bREM\s*[:.]\s*\d+/.test(up) &&
             /\bPED\s*[:.]\s*\d+/.test(up) &&
             /\bVOL\s*[:.]\s*\d+\s*\/\s*\d+/.test(up);
    },
    extrair: text => {
      const up = text.toUpperCase();

      // PED: 2003984392
      const pedMatch = up.match(/\bPED\s*[:.]\s*(\d+)/);
      const pedido = pedMatch ? pedMatch[1].trim() : '';

      // REM: 8004456174 (usado como NF por ser o número principal do romaneio)
      const remMatch = up.match(/\bREM\s*[:.]\s*(\d+)/);
      const nf = remMatch ? String(parseInt(remMatch[1], 10)) : '';

      // VOL: 2/2
      const volMatch = up.match(/\bVOL\s*[:.]\s*(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: COXIM-MS
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29?})\s*-\s*MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf, pedido, cidade, volAtual, volTotal };
    }
  },

  // ──────────────────────────────────────────────────────────
  // Etiqueta FRACIONADO (amarela — PMSEXP)
  // Exemplo: Volume: 0001/0002 / RIO NEGRO-MS / barcode = Pedido
  // Pedido = número impresso abaixo do código de barras (12+ dígitos)
  // ──────────────────────────────────────────────────────────
  {
    nome: 'Etiqueta FRACIONADO (amarela)',
    detectar: text => /\bFRACIONADO\b/i.test(text),
    extrair: text => {
      const up = text.toUpperCase();

      // Pedido = número do código de barras (12+ dígitos — único número longo na etiqueta)
      const barcodeMatch = up.match(/\b(\d{12,})\b/);
      const pedido = barcodeMatch ? barcodeMatch[1] : '';

      // Volume: 0001 / 0002
      const volMatch = up.match(/\bVOLUME\s*[:.]\s*(\d+)\s*\/\s*(\d+)/);
      const volAtual = volMatch ? parseInt(volMatch[1], 10) : null;
      const volTotal = volMatch ? parseInt(volMatch[2], 10) : null;

      // Cidade: RIO NEGRO - MS
      const cidadeMatch = up.match(/([A-Z][A-Z\s]{2,29?})\s*-\s*MS\b/);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : '';

      return { nf: '', pedido, cidade, volAtual, volTotal };
    }
  },

];

// ── Função de extração usando templates ──────────────────────
// Retorna { nf, pedido, cidade, volAtual, volTotal } ou null
function parseWithTemplates(text) {
  if (!text || !LABEL_TEMPLATES.length) return null;

  for (const tmpl of LABEL_TEMPLATES) {
    try {
      if (!tmpl.detectar(text)) continue;
      const result = tmpl.extrair(text);
      // Só retorna se extraiu pelo menos NF ou Pedido
      if (result && (result.nf || result.pedido)) {
        console.log(`[Templates] Usando template: ${tmpl.nome}`);
        return result;
      }
    } catch (e) {
      console.warn(`[Templates] Erro no template "${tmpl.nome}":`, e);
    }
  }
  return null;
}

// Geração de planilhas Excel com SheetJS
const Excel = (() => {

  function _header(ws, cols) {
    const blue  = { patternType: 'solid', fgColor: { rgb: '1A56DB' } };
    const white = { rgb: 'FFFFFF' };
    for (let c = 0; c < cols; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) continue;
      ws[addr].s = { fill: blue, font: { bold: true, color: white }, alignment: { horizontal: 'center' } };
    }
  }

  function _autoWidth(ws) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const widths = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      let max = 8;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v != null) {
          const len = String(cell.v).length;
          if (len > max) max = len;
        }
      }
      widths.push({ wch: Math.min(max + 2, 60) });
    }
    ws['!cols'] = widths;
  }

  function _fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString('pt-BR');
  }

  // ── Planilha de Coleta ────────────────────────────────────────────────────

  function buildColeta(coleta) {
    const rows = [[
      'Data', 'Operador', 'Cliente', 'Placa', 'Pallet',
      'NF', 'Pedido', 'Cidade Destino', 'Volume', 'Total Volumes'
    ]];

    for (const pallet of (coleta.pallets || [])) {
      for (const vol of (pallet.volumes || [])) {
        rows.push([
          _fmtDate(coleta.data),
          coleta.operador   || '',
          coleta.cliente    || '',
          coleta.placa      || '',
          pallet.numero     || '',
          vol.nf            || '',
          vol.pedido        || '',
          vol.cidade        || '',
          vol.volAtual      ?? '',
          vol.volTotal      ?? ''
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    _header(ws, 10);
    _autoWidth(ws);
    return ws;
  }

  // ── Planilha de Carregamento ──────────────────────────────────────────────

  function buildCarregamento(carga) {
    const rows = [[
      'Data', 'Operador', 'Placa', 'Cidades',
      'NF', 'Pedido', 'Cidade Destino', 'Volume', 'Total Volumes'
    ]];

    const cidadesStr = (carga.cidades || []).join(' / ');

    for (const vol of (carga.volumes || [])) {
      rows.push([
        _fmtDate(carga.data),
        carga.operador  || '',
        carga.placa     || '',
        cidadesStr,
        vol.nf          || '',
        vol.pedido      || '',
        vol.cidade      || '',
        vol.volAtual    ?? '',
        vol.volTotal    ?? ''
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    _header(ws, 9);
    _autoWidth(ws);
    return ws;
  }

  // ── Planilha de Descarga ──────────────────────────────────────────────────

  function buildDescarga(descarga) {
    const tipoLabel = descarga.tipo === 'coleta' ? 'Descarga de Coleta' : 'Descarga de Viagem';
    const rows = [[
      'Data', 'Operador', 'Placa', 'Tipo', 'Cidade Descarga',
      'NF', 'Pedido', 'Cidade Origem', 'Volume', 'Total Volumes', 'Status'
    ]];

    for (const vol of (descarga.volumes || [])) {
      rows.push([
        _fmtDate(descarga.data),
        descarga.operador   || '',
        descarga.placa      || '',
        tipoLabel,
        descarga.cidade     || '',
        vol.nf              || '',
        vol.pedido          || '',
        vol.cidade          || '',
        vol.volAtual        ?? '',
        vol.volTotal        ?? '',
        vol.status          || 'OK'
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    _header(ws, 11);
    _autoWidth(ws);
    return ws;
  }

  // ── Geração e exportação ──────────────────────────────────────────────────

  function createWorkbook(ws, sheetName) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    return wb;
  }

  function download(wb, filename) {
    XLSX.writeFile(wb, filename);
  }

  function toBase64(wb) {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  function filename(tipo, placa, data) {
    const d = data ? data.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const p = (placa || 'XX').replace(/[^A-Z0-9]/gi, '');
    return `${tipo}_${p}_${d}.xlsx`;
  }

  return { buildColeta, buildCarregamento, buildDescarga, createWorkbook, download, toBase64, filename };
})();

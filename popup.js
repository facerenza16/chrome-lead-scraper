// popup.js — lógica del popup

const $ = id => document.getElementById(id);

const els = {
  statusText:    $('status-text'),
  leadCount:     $('lead-count'),
  leadsPreview:  $('leads-preview'),
  errorMsg:      $('error-msg'),
  btnScrape:     $('btn-scrape'),
  btnStop:       $('btn-stop'),
  btnExportExcel:$('btn-export-excel'),
  btnExportCsv:  $('btn-export-csv'),
  btnClear:      $('btn-clear'),
  btnReport:     $('btn-report'),
  panelMain:     $('panel-main'),
  panelNoMaps:   $('panel-no-maps'),
  toggleEmail:   $('toggle-email'),
};

let cachedLeads = [];

// ── Reporte de errores (Google Form) ───────────────────
// Reemplazar REPORT_FORM_URL con la URL real del form después de crearlo.
// Para obtener los entry IDs: abrir el form → "⋮" → "Obtener enlace pre-llenado"
// → completar los campos → copiar la URL generada.
const REPORT_FORM_URL = 'https://docs.google.com/forms/d/e/TU_FORM_ID/viewform';
const REPORT_FIELDS = {
  version:       'entry.XXXXXXXXXX',  // campo "Versión"
  selectorHealth:'entry.XXXXXXXXXX',  // campo "Estado de selectores"
  sessionInfo:   'entry.XXXXXXXXXX',  // campo "Información de sesión"
};

const EXPORT_COLUMNS = [
  { header: 'Nombre', key: 'nombre', width: 220 },
  { header: 'Categoría', key: 'categoria', width: 140 },
  { header: 'Calificación', key: 'calificacion', width: 90 },
  { header: 'Reseñas', key: 'resenas', width: 90 },
  { header: 'Dirección', key: 'direccion', width: 240 },
  { header: 'Teléfono', key: 'telefono', width: 130 },
  { header: 'Sitio Web', key: 'sitio_web', width: 220, isLink: true },
  { header: 'Email', key: 'email', width: 200 },
  { header: 'URL Maps', key: 'url_maps', width: 260, isLink: true },
  { header: 'Fecha', key: 'fecha_scraping', width: 95 },
];

// ── Estado visual ──────────────────────────────────────

function setState(state, opts = {}) {
  document.body.className = state ? `state-${state}` : '';

  const messages = {
    default:        'Listo para raspar',
    raspando:       'Raspando resultados…',
    deteniendo:     'Deteniendo búsqueda y finalizando leads encontrados…',
    enriqueciendo:  opts.total
                      ? `Enriqueciendo ${opts.current}/${opts.total}…`
                      : 'Enriqueciendo resultados…',
    cancelado:      `Cancelado · ${opts.count ?? cachedLeads.length} leads`,
    completado:     `Completado · ${opts.count ?? cachedLeads.length} leads`,
    error:          'Ocurrió un error',
    'no-maps':      '',
  };

  els.statusText.textContent = messages[state] ?? '';

  if (opts.error) {
    els.errorMsg.textContent = opts.error;
  }
}

function setCount(n) {
  els.leadCount.textContent = n;
}

function renderPreview(leads) {
  const last = leads.slice(-5).reverse();
  els.leadsPreview.innerHTML = '';
  last.forEach(lead => {
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.innerHTML = `
      <div class="lead-card-name">${escapeHtml(lead.nombre)}</div>
      <div class="lead-card-meta">${escapeHtml(lead.categoria || lead.direccion || '')}</div>
    `;
    els.leadsPreview.appendChild(card);
  });
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Init: leer estado persistido ───────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onMaps = tab?.url?.startsWith('https://www.google.com/maps');

  if (!onMaps) {
    els.panelNoMaps.classList.add('visible');
    return;
  }

  els.panelMain.classList.add('visible');

  const { scrapeState, leads } = await chrome.storage.local.get(['scrapeState', 'leads']);

  cachedLeads = leads || [];
  setCount(cachedLeads.length);

  if (scrapeState?.status === 'completado') {
    setState('completado', { count: cachedLeads.length });
    renderPreview(cachedLeads);
  } else if (scrapeState?.status === 'cancelado') {
    setState('cancelado', { count: cachedLeads.length });
    renderPreview(cachedLeads);
  } else if (scrapeState?.status === 'raspando') {
    setState('raspando');
  } else if (scrapeState?.status === 'enriqueciendo') {
    setState('enriqueciendo', { current: scrapeState.current, total: scrapeState.total });
  } else if (scrapeState?.status === 'error') {
    setState('error', { error: scrapeState.error });
  } else {
    setState('default');
  }
}

// ── Escuchar mensajes del background ───────────────────

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'SCRAPE_STATUS') {
    if (msg.status === 'enriqueciendo') {
      setState('enriqueciendo', { current: msg.current, total: msg.total });
    } else {
      setState('raspando');
    }
    setCount(msg.count);
  }

  if (msg.type === 'SCRAPE_DONE') {
    cachedLeads = msg.leads;
    setCount(msg.count);
    setState('completado', { count: msg.count });
    renderPreview(cachedLeads);
  }

  if (msg.type === 'SCRAPE_CANCELED') {
    cachedLeads = msg.leads;
    setCount(msg.count);
    setState('cancelado', { count: msg.count });
    renderPreview(cachedLeads);
  }

  if (msg.type === 'SCRAPE_ERROR') {
    setState('error', { error: msg.error });
  }
});

// ── Botones ────────────────────────────────────────────

els.btnScrape.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const fetchEmail = els.toggleEmail?.checked || false;

  setState('raspando');
  setCount(0);
  els.leadsPreview.innerHTML = '';

  chrome.tabs.sendMessage(tab.id, { type: 'START_SCRAPE', fetchEmail }, resp => {
    if (chrome.runtime.lastError || !resp?.ok) {
      setState('error', { error: resp?.error || 'No se pudo iniciar el raspado. Recargá la página de Maps e intentá de nuevo.' });
    }
  });
});

els.btnStop.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'STOP_SCRAPE' });
  setState('deteniendo');
});

els.btnExportExcel.addEventListener('click', () => {
  if (!cachedLeads.length) return;
  exportToExcel(cachedLeads);
});

els.btnExportCsv.addEventListener('click', () => {
  if (!cachedLeads.length) return;
  exportToCSV(cachedLeads);
});

els.btnClear.addEventListener('click', async () => {
  cachedLeads = [];
  await chrome.storage.local.remove(['leads', 'scrapeState']);
  setCount(0);
  els.leadsPreview.innerHTML = '';
  setState('default');
});

els.btnReport.addEventListener('click', async () => {
  const { selectorHealth, scrapeState, leads } = await chrome.storage.local.get(
    ['selectorHealth', 'scrapeState', 'leads']
  );
  const params = new URLSearchParams({
    [REPORT_FIELDS.version]: chrome.runtime.getManifest().version,
    [REPORT_FIELDS.selectorHealth]: selectorHealth
      ? `${selectorHealth.status} | emptyName: ${selectorHealth.emptyNamePct}% | muestra: ${selectorHealth.sampleSize} | ${selectorHealth.checkedAt}`
      : 'no disponible',
    [REPORT_FIELDS.sessionInfo]: `Estado: ${scrapeState?.status ?? 'n/a'} | Leads: ${leads?.length ?? 0}`,
  });
  chrome.tabs.create({ url: `${REPORT_FORM_URL}?usp=pp_url&${params.toString()}` });
});

// ── Exportar CSV ───────────────────────────────────────

function exportToCSV(leads) {
  const rows = leads.map(lead =>
    EXPORT_COLUMNS.map(column => lead[column.key] || '')
    .map(val => `"${(val || '').replace(/"/g, '""')}"`)
    .join(',')
  );
  const csv = '\uFEFF' + [EXPORT_COLUMNS.map(column => column.header).join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadBlob(url, `leads_maps_${new Date().toISOString().split('T')[0]}.csv`);
  URL.revokeObjectURL(url);
}

function exportToExcel(leads) {
  const ROW_HEIGHT_PX = 24;
  const colGroup = EXPORT_COLUMNS
    .map(column => `<col style="width:${column.width}px;">`)
    .join('');
  const headerRow = EXPORT_COLUMNS
    .map(column => `<th style="width:${column.width}px;">${escapeHtml(column.header)}</th>`)
    .join('');
  const bodyRows = leads.map(lead => {
    const cells = EXPORT_COLUMNS
      .map(column => {
        const value = lead[column.key] || '';

        if (column.isLink && value) {
          const safeUrl = escapeHtmlAttr(value);
          return `<td style="width:${column.width}px;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a></td>`;
        }

        return `<td style="width:${column.width}px;">${escapeHtml(value)}</td>`;
      })
      .join('');
    return `<tr style="height:${ROW_HEIGHT_PX}px;">${cells}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; table-layout: fixed; }
    tr { height: ${ROW_HEIGHT_PX}px; }
    th, td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; vertical-align: top; height: ${ROW_HEIGHT_PX}px; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    th { font-weight: 700; background: #f6f8fa; }
    a { color: #0969da; text-decoration: underline; }
  </style>
</head>
<body>
  <table>
    <colgroup>${colGroup}</colgroup>
    <thead><tr style="height:${ROW_HEIGHT_PX}px;">${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadBlob(url, `leads_maps_${new Date().toISOString().split('T')[0]}.xls`);
  URL.revokeObjectURL(url);
}

function downloadBlob(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// ── Arrancar ───────────────────────────────────────────

init();

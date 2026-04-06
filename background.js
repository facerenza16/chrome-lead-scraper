// background.js — service worker
// Relay de mensajes entre content.js y popup.js.
// También persiste el estado en chrome.storage.local para que el popup
// pueda leerlo al abrirse (el popup no existe cuando content.js manda mensajes).

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();

  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number);
    if (parts.some(part => part < 0 || part > 255)) return true;

    return parts[0] === 0
      || parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19))
      || (parts[0] === 198 && parts[1] === 51 && parts[2] === 100)
      || (parts[0] === 203 && parts[1] === 0 && parts[2] === 113);
  }

  if (host.includes(':')) {
    return host === '::1'
      || host === '::'
      || host.startsWith('fc')
      || host.startsWith('fd')
      || host.startsWith('fe8')
      || host.startsWith('fe9')
      || host.startsWith('fea')
      || host.startsWith('feb');
  }

  return !host.includes('.');
}

function isAllowedFetchUrl(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  return (url.protocol === 'http:' || url.protocol === 'https:')
    && !url.username
    && !url.password
    && !isPrivateHostname(url.hostname);
}

function extractBestEmail(html) {
  const all = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  const filtered = all.filter(email => {
    const lowered = email.toLowerCase();
    return !/\.(png|jpg|gif|svg|css|js)$/.test(lowered)
      && !lowered.startsWith('noreply')
      && !lowered.startsWith('no-reply')
      && !lowered.includes('example.com')
      && !lowered.includes('sentry');
  });

  return filtered[0] || '';
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'FETCH_EMAIL_FROM_URL') {
    if (!isAllowedFetchUrl(msg.url)) {
      sendResponse({ email: '' });
      return;
    }

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);

    fetch(msg.url, { signal: ctrl.signal })
      .then(r => r.ok ? r.text() : '')
      .then(html => {
        clearTimeout(tid);
        sendResponse({ email: extractBestEmail(html) });
      })
      .catch(() => { clearTimeout(tid); sendResponse({ email: '' }); });

    return true;
  }

  if (msg.type === 'SCRAPE_STATUS') {
    chrome.storage.local.set({
      scrapeState: {
        status: msg.status,
        count: msg.count,
        current: msg.current,
        total: msg.total,
      }
    });
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  if (msg.type === 'SCRAPE_DONE') {
    chrome.storage.local.set({
      scrapeState: { status: 'completado', count: msg.count },
      leads: msg.leads,
    });
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  if (msg.type === 'SCRAPE_CANCELED') {
    chrome.storage.local.set({
      scrapeState: { status: 'cancelado', count: msg.count },
      leads: msg.leads,
    });
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  if (msg.type === 'SCRAPE_ERROR') {
    chrome.storage.local.set({ scrapeState: { status: 'error', error: msg.error } });
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  if (msg.type === 'SELECTOR_HEALTH') {
    chrome.storage.local.set({ selectorHealth: msg.health });
  }

  sendResponse({ ok: true });
});

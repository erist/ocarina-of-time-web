const origin = 'https://erist.github.io';
const sitePath = '/ocarina-of-time-web/';
const storageKey = 'ocarina-of-time-web:visits:v1';
const sessionLength = 30 * 60 * 1000;
const countedPages = new WeakMap();

// true = Instagram, false = an explicit different source, null = no new source.
function instagramEntry(url, referrer) {
  const campaign = url.searchParams.get('utm_source')?.trim().toLowerCase();
  if (campaign) return campaign === 'instagram' || campaign === 'ig';
  try {
    const from = new URL(referrer);
    if (from.origin === url.origin || !['http:', 'https:'].includes(from.protocol)) return null;
    return from.hostname === 'instagram.com' || from.hostname.endsWith('.instagram.com');
  } catch {
    return null;
  }
}

function usableStorage(browser, name) {
  try {
    const store = browser[name];
    // Private browsing may expose an object that throws on every write.
    const probe = storageKey + ':probe';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

async function recordVisit(send, browser, url) {
  const persistent = usableStorage(browser, 'localStorage');
  const store = persistent || usableStorage(browser, 'sessionStorage');
  let previous = {};
  try { previous = JSON.parse(store?.getItem(storageKey)) || {}; } catch {}
  const now = Date.now();
  const elapsed = now - previous.lastLoad;
  const recent = Number.isFinite(previous.lastLoad) && elapsed >= 0 && elapsed < sessionLength;
  const entry = instagramEntry(url, browser.document.referrer);
  const instagram = entry ?? (recent && previous.instagram === true);
  const visit = Boolean(store) && (!recent || instagram !== previous.instagram);
  const event = {
    view: true,
    visit,
    instagramVisit: visit && instagram,
    visitor: Boolean(persistent) && previous.seen !== true,
    instagramVisitor: Boolean(persistent) && instagram && previous.seenInstagram !== true,
    instagramView: instagram,
  };
  if (await send(event) === false) return false;
  try {
    store?.setItem(storageKey, JSON.stringify({
      lastLoad: now, instagram, seen: true, seenInstagram: instagram || previous.seenInstagram === true,
    }));
  } catch {}
  return true;
}

/**
 * Call once at the site entry point. The sender must reject or return false on
 * delivery failure. Only aggregate increment flags cross the network.
 */
export function startVisitTracking(send, browser = window) {
  const { document, navigator } = browser;
  const url = new URL(browser.location.href);
  if (url.origin !== origin || ![sitePath, sitePath + 'index.html'].includes(url.pathname)) return Promise.resolve(false);
  if (navigator.globalPrivacyControl || ['1', 'yes'].includes(navigator.doNotTrack || browser.doNotTrack)) return Promise.resolve(false);
  if (countedPages.has(document)) return countedPages.get(document);
  const task = (async () => {
    if (document.prerendering) {
      await new Promise(resolve => document.addEventListener('prerenderingchange', resolve, { once: true }));
    }
    const record = () => recordVisit(send, browser, url);
    if (navigator.locks?.request) return navigator.locks.request(storageKey, record);
    return record();
  })().catch(() => false);
  countedPages.set(document, task);
  return task;
}

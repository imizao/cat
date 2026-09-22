export async function enableOfflineMode() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return { supported: false };

  const serviceWorkerUrl = new URL('sw.js', document.baseURI);
  const scopeUrl = new URL('./', serviceWorkerUrl);
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: scopeUrl.pathname });
  await navigator.serviceWorker.ready;

  const pageUrl = new URL(location.href);
  pageUrl.search = '';
  pageUrl.hash = '';
  const urls = new Set([scopeUrl.href, pageUrl.href]);
  performance.getEntriesByType('resource').forEach((entry) => {
    const url = new URL(entry.name, location.href);
    if (url.origin === location.origin) urls.add(url.href);
  });
  registration.active?.postMessage({ type: 'CACHE_GAME_ASSETS', urls: [...urls] });
  return { supported: true, registration };
}

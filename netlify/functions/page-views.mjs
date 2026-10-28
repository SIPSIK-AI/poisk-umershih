import { getStore } from '@netlify/blobs';

// Counts page loads, not unique people. Conditional writes avoid lost updates.
export default async (request) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const origin = request.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(request.url).host) return respond({ error: 'Forbidden' }, 403); }
    catch { return respond({ error: 'Forbidden' }, 403); }
  }
  try {
    const store = getStore({ name: 'page-views', consistency: 'strong' });
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await store.getWithMetadata('total', { consistency: 'strong' });
      const previous = current === null ? 0 : Number(current.data);
      if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid count');
      const count = previous + 1;
      const options = current === null ? { onlyIfNew: true } : { onlyIfMatch: current.etag };
      const result = await store.set('total', String(count), options);
      if (result.modified) return respond({ count });
    }
    return respond({ error: 'Please retry later' }, 503);
  } catch (error) {
    console.error('Page counter unavailable:', error.message);
    return respond({ error: 'Counter unavailable' }, 503);
  }
};

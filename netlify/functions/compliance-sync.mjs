// Netlify Function v2 — save/load compliance records via Netlify Blobs
// POST /.netlify/functions/compliance-sync  — save records (body: JSON array)
// GET  /.netlify/functions/compliance-sync  — load records
//
// Kept as its own store because the scheduled reminder reads from it.
// v2 (export default) rather than a Lambda-style handler: the Blobs context is
// only reliably injected for v2.

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });

  let store;
  try {
    store = getStore({ name: 'compliance', consistency: 'strong' });
  } catch (e) {
    return json({ error: 'blobs_unavailable', detail: String(e && e.message || e) }, 503);
  }

  if (req.method === 'GET') {
    try {
      const records = await store.get('records', { type: 'json' });
      return json(records ?? null);
    } catch (e) {
      return json({ error: 'blobs_read_failed', detail: String(e && e.message || e) }, 503);
    }
  }

  if (req.method === 'POST') {
    let records;
    try {
      records = await req.json();
      if (!Array.isArray(records)) throw new Error('Expected array');
    } catch (e) {
      return json({ error: 'bad_request', detail: String(e && e.message || e) }, 400);
    }
    try {
      await store.setJSON('records', records);
      return json({ ok: true, count: records.length });
    } catch (e) {
      return json({ error: 'blobs_write_failed', detail: String(e && e.message || e) }, 503);
    }
  }

  return json({ error: 'method_not_allowed' }, 405);
};

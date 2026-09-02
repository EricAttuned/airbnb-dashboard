// Netlify Function v2 — save/load dashboard state via Netlify Blobs
// POST /.netlify/functions/state-sync  — merge state in
// GET  /.netlify/functions/state-sync  — load state
//
// Body shape: { values: { <key>: <json string> }, meta: { <key>: <iso date> } }
//
// Merges are decided per key by the meta timestamps, which record when the user
// last actually edited that key on some device. Deciding by arrival order would
// mean that merely opening the dashboard on a device holding stale data
// overwrites newer edits made elsewhere.
//
// This is a v2 function (export default) rather than a Lambda-style handler:
// the Blobs context is only reliably injected for v2, and the previous
// exports.handler version failed with an opaque 500.

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

// Values arrive as the raw JSON strings out of localStorage, so an absent key
// looks like '{}', '[]' or 'null' rather than undefined.
function isEmptyValue(v) {
  return v == null || v === 'null' || v === '{}' || v === '[]' || v === '';
}

// Older clients posted the keys flat at the top level.
function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.values && typeof raw.values === 'object') {
    return { values: raw.values, meta: raw.meta || {}, savedAt: raw.savedAt };
  }
  const values = {};
  for (const [k, v] of Object.entries(raw)) if (k !== 'savedAt') values[k] = v;
  return { values, meta: {}, savedAt: raw.savedAt };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });

  let store;
  try {
    store = getStore({ name: 'dashboard-state', consistency: 'strong' });
  } catch (e) {
    // Surface this instead of throwing a bare 500 — a silent failure here is
    // what made the dashboard report "cloud backup is empty".
    return json({ error: 'blobs_unavailable', detail: String(e && e.message || e) }, 503);
  }

  if (req.method === 'GET') {
    try {
      const state = await store.get('state', { type: 'json' });
      return json(state ?? null);
    } catch (e) {
      return json({ error: 'blobs_read_failed', detail: String(e && e.message || e) }, 503);
    }
  }

  if (req.method === 'POST') {
    let incoming;
    try {
      incoming = normalize(await req.json());
      if (!incoming) throw new Error('Expected an object');
    } catch (e) {
      return json({ error: 'bad_request', detail: String(e && e.message || e) }, 400);
    }

    try {
      let existing = null;
      try { existing = normalize(await store.get('state', { type: 'json' })); } catch (_) {}
      existing = existing || { values: {}, meta: {} };

      const values = { ...existing.values };
      const meta   = { ...existing.meta };
      const applied = [];

      for (const [k, inc] of Object.entries(incoming.values)) {
        const incT = incoming.meta[k] || null;
        const ex   = existing.values[k];
        const exT  = existing.meta[k] || null;

        let accept;
        if (isEmptyValue(inc)) {
          // Only honour a clear that is explicitly stamped and strictly newer,
          // so a browser with an empty localStorage cannot wipe the backup.
          accept = !!incT && !!exT && incT > exT;
        } else if (isEmptyValue(ex)) {
          accept = true;                        // nothing to lose
        } else {
          // Both sides hold data: the newer stamped edit wins. Unstamped
          // incoming data never displaces a stamped value.
          accept = !!incT && (!exT || incT > exT);
        }

        if (accept) {
          values[k] = inc;
          if (incT) meta[k] = incT;
          applied.push(k);
        }
      }

      await store.setJSON('state', { values, meta, savedAt: new Date().toISOString() });
      return json({ ok: true, applied });
    } catch (e) {
      return json({ error: 'blobs_write_failed', detail: String(e && e.message || e) }, 503);
    }
  }

  return json({ error: 'method_not_allowed' }, 405);
};

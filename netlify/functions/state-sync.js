// Netlify function — save/load dashboard state via Netlify Blobs
// POST /.netlify/functions/state-sync  — merge state in
// GET  /.netlify/functions/state-sync  — load state
//
// Body shape: { values: { <key>: <json string> }, meta: { <key>: <iso date> } }
//
// Merges are decided per key by the meta timestamps, which record when the user
// last actually edited that key on some device. Deciding by arrival order would
// mean that merely opening the dashboard on a device holding stale data
// overwrites newer edits made elsewhere.

const { getStore } = require('@netlify/blobs');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

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

exports.handler = async (event) => {
  const store = getStore('dashboard-state');

  if (event.httpMethod === 'GET') {
    try {
      const state = await store.get('state', { type: 'json' });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(state ?? null) };
    } catch (e) {
      return { statusCode: 200, headers: CORS, body: 'null' };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const incoming = normalize(JSON.parse(event.body));
      if (!incoming) throw new Error('Expected an object');

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

      const merged = { values, meta, savedAt: new Date().toISOString() };
      await store.setJSON('state', merged);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, applied }) };
    } catch (e) {
      return { statusCode: 400, body: e.message };
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
};

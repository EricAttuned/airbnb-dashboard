// Netlify Function v2 — storage diagnostics
// GET /.netlify/functions/diag
//
// Reports whether Netlify Blobs actually works at runtime and what is currently
// stored. Exists because blob failures previously surfaced as an opaque 500,
// which the dashboard reported as "cloud backup is empty" — indistinguishable
// from a genuinely empty backup.

import { getStore } from '@netlify/blobs';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export default async () => {
  const out = {
    checkedAt: new Date().toISOString(),
    runtime: { node: process.version, hasBlobsContext: !!process.env.NETLIFY_BLOBS_CONTEXT },
    blobs: {},
    stores: {},
  };

  // Can we construct a store at all?
  let store;
  try {
    store = getStore({ name: 'dashboard-state', consistency: 'strong' });
    out.blobs.getStore = 'ok';
  } catch (e) {
    out.blobs.getStore = 'FAILED';
    out.blobs.detail = String(e && e.message || e);
    return new Response(JSON.stringify(out, null, 2), { status: 200, headers: CORS });
  }

  // Round-trip a throwaway key to prove writes and reads both work.
  try {
    const probe = { at: new Date().toISOString() };
    await store.setJSON('__diag_probe', probe);
    const back = await store.get('__diag_probe', { type: 'json' });
    out.blobs.writeRead = back && back.at === probe.at ? 'ok' : 'mismatch';
  } catch (e) {
    out.blobs.writeRead = 'FAILED';
    out.blobs.detail = String(e && e.message || e);
  }

  // What is actually saved right now.
  try {
    const state = await store.get('state', { type: 'json' });
    if (!state) {
      out.stores.dashboardState = 'empty';
    } else {
      const values = state.values || state;
      out.stores.dashboardState = {
        savedAt: state.savedAt || null,
        keys: Object.keys(values).filter(k => k !== 'savedAt'),
        sizes: Object.fromEntries(
          Object.entries(values)
            .filter(([k]) => k !== 'savedAt')
            .map(([k, v]) => [k, typeof v === 'string' ? v.length : null])
        ),
        meta: state.meta || null,
      };
    }
  } catch (e) {
    out.stores.dashboardState = 'READ FAILED: ' + String(e && e.message || e);
  }

  try {
    const comp = getStore({ name: 'compliance', consistency: 'strong' });
    const recs = await comp.get('records', { type: 'json' });
    out.stores.compliance = Array.isArray(recs) ? { count: recs.length } : 'empty';
  } catch (e) {
    out.stores.compliance = 'READ FAILED: ' + String(e && e.message || e);
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: CORS });
};

// Netlify function — save/load cleaner assignment state via Netlify Blobs
// POST /.netlify/functions/state-sync  — save state (body: JSON object)
// GET  /.netlify/functions/state-sync  — load state

const { getStore } = require('@netlify/blobs');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

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
      const state = JSON.parse(event.body);
      await store.setJSON('state', state);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 400, body: e.message };
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
};

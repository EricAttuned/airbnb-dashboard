// Netlify function — save/load compliance data via Netlify Blobs
// POST /.netlify/functions/compliance-sync  — save records (body: JSON array)
// GET  /.netlify/functions/compliance-sync  — load records

const { getStore } = require('@netlify/blobs');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  const store = getStore('compliance');

  if (event.httpMethod === 'GET') {
    try {
      const records = await store.get('records', { type: 'json' });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(records ?? null) };
    } catch (e) {
      return { statusCode: 200, headers: CORS, body: 'null' };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const records = JSON.parse(event.body);
      if (!Array.isArray(records)) throw new Error('Expected array');
      await store.setJSON('records', records);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, count: records.length }) };
    } catch (e) {
      return { statusCode: 400, body: e.message };
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
};

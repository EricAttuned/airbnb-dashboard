// Netlify function — save compliance data to Netlify Blobs
// Called from browser whenever compliance records change.
// POST /.netlify/functions/compliance-sync
// Body: JSON array of compliance records

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const records = JSON.parse(event.body);
    if (!Array.isArray(records)) throw new Error('Expected array');

    const store = getStore('compliance');
    await store.setJSON('records', records);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, count: records.length }),
    };
  } catch (e) {
    return { statusCode: 400, body: e.message };
  }
};

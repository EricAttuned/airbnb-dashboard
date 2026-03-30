// Netlify serverless function — CORS proxy for iCal fetching
// Replaces the local server.py proxy server.
// Endpoint: /.netlify/functions/proxy?url=<encoded-url>

exports.handler = async (event) => {
  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, body: 'Missing url param' };
  }

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Property Dashboard)' },
    });
    const text = await resp.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
      body: text,
    };
  } catch (e) {
    return { statusCode: 502, body: e.message };
  }
};

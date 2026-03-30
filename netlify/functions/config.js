exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      icalUrl:       process.env.ICAL_URL        || '',
      sheetsId:      process.env.SHEETS_ID       || '',
      sheetsApiKey:  process.env.SHEETS_API_KEY  || '',
      gmailClientId: process.env.GMAIL_CLIENT_ID || '',
    }),
  };
};

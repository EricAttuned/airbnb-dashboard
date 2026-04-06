// Netlify scheduled function — sends daily compliance reminder email
// Schedule: 8:00 AM Pacific every day (15:00 UTC)
// Reads compliance records from Netlify Blobs, sends email via Resend.
//
// Required Netlify env vars:
//   RESEND_API_KEY  — from resend.com (free account, 3k emails/month)
//   REMINDER_EMAIL  — recipient address (e.g. ericlee1219@gmail.com)

const { getStore } = require('@netlify/blobs');

const REMINDER_EMAIL = process.env.REMINDER_EMAIL || 'ericlee1219@gmail.com';

const OBLIGATION_LABELS = {
  RENT_BOARD_REGISTRATION:   'Rent Board Registration',
  BUSINESS_LICENSE_TAX:      'Business License Tax',
  RHSP_SELF_INSPECTION:      'RHSP Schedule A Inspection',
  SECURITY_DEPOSIT_INTEREST: 'Security Deposit Interest',
  PROPERTY_TAX_INSTALLMENT_1:'Property Tax — 1st Installment',
  PROPERTY_TAX_INSTALLMENT_2:'Property Tax — 2nd Installment',
  STR_ZONING_CERT:           'STR Zoning Certificate',
  E3_INSPECTION:             'E3 Elevated Elements Inspection',
  TENANCY_REGISTRATION:      'Tenancy Registration',
  RENT_ORDINANCE_NOTICE:     'Rent Ordinance Rights Notice',
  TOT_MONTHLY:               'TOT Enforcement Fee',
};

const PROPERTY_NAMES = {
  'prop-tenth':      'Tenth St',
  'prop-california': 'California St',
  'prop-chaucer':    'Chaucer St',
};

const UNIT_INFO = {
  'unit-tenth-house':  { label: 'House',  propId: 'prop-tenth' },
  'unit-tenth-a':      { label: 'Unit A', propId: 'prop-tenth' },
  'unit-tenth-b':      { label: 'Unit B', propId: 'prop-tenth' },
  'unit-calif-house':  { label: 'House',  propId: 'prop-california' },
  'unit-calif-a':      { label: 'Unit A', propId: 'prop-california' },
  'unit-calif-b':      { label: 'Unit B', propId: 'prop-california' },
  'unit-chaucer-1112': { label: '1112',   propId: 'prop-chaucer' },
  'unit-chaucer-1114': { label: '1114',   propId: 'prop-chaucer' },
};

function locationLabel(r) {
  if (r.propertyId) return PROPERTY_NAMES[r.propertyId] || r.propertyId;
  if (r.unitId) {
    const u = UNIT_INFO[r.unitId];
    if (!u) return r.unitId;
    return `${PROPERTY_NAMES[u.propId] || u.propId} / ${u.label}`;
  }
  return '';
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function computeStatus(r) {
  if (r.completedAt) return 'COMPLETE';
  const deadline = r.delinquentDate || r.dueDate;
  return new Date(deadline) < new Date() ? 'OVERDUE' : 'PENDING';
}

function shouldRemind(r) {
  if (r.completedAt) return false;
  const deadline = r.delinquentDate || r.dueDate;
  const days = daysUntil(deadline);
  // Remind if overdue or due within 60 days — at key intervals
  const INTERVALS = [-1, 0, 1, 3, 7, 14, 30, 60];
  return INTERVALS.includes(days) || days < 0;
}

function buildEmailHtml(overdue, upcoming, complete, total) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const rowStyle = 'padding:10px 16px;border-bottom:1px solid #f3f4f6;';
  const badgeRed = 'display:inline-block;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;';
  const badgeAmber = 'display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;';

  let html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

  <div style="background:#1d4ed8;padding:20px 24px;">
    <h1 style="color:#fff;margin:0;font-size:18px;">🏠 Berkeley PM — Compliance Reminder</h1>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">${today}</p>
  </div>

  <div style="padding:20px 24px;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#dc2626;">${overdue.length}</div>
        <div style="font-size:11px;color:#b91c1c;">Overdue</div>
      </div>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#d97706;">${upcoming.length}</div>
        <div style="font-size:11px;color:#92400e;">Upcoming</div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#16a34a;">${complete}</div>
        <div style="font-size:11px;color:#15803d;">Complete (of ${total})</div>
      </div>
    </div>
  `;

  if (overdue.length) {
    html += `<h2 style="font-size:14px;color:#b91c1c;margin:0 0 8px;">⚠️ Overdue</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #fca5a5;border-radius:8px;overflow:hidden;">`;
    for (const r of overdue) {
      const deadline = r.delinquentDate || r.dueDate;
      const days = Math.abs(daysUntil(deadline));
      html += `<tr style="${rowStyle}">
        <td style="font-size:13px;">
          <strong>${OBLIGATION_LABELS[r.obligationType] || r.obligationType}</strong><br>
          <span style="color:#6b7280;font-size:12px;">${locationLabel(r)}</span>
        </td>
        <td style="text-align:right;white-space:nowrap;">
          <span style="${badgeRed}">${days}d overdue</span><br>
          <span style="font-size:11px;color:#9ca3af;">${fmtDate(r.delinquentDate || r.dueDate)}</span>
        </td>
      </tr>`;
    }
    html += `</table>`;
  }

  if (upcoming.length) {
    html += `<h2 style="font-size:14px;color:#92400e;margin:0 0 8px;">📅 Upcoming (next 60 days)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #fcd34d;border-radius:8px;overflow:hidden;">`;
    for (const r of upcoming) {
      const deadline = r.delinquentDate || r.dueDate;
      const days = daysUntil(deadline);
      html += `<tr style="${rowStyle}">
        <td style="font-size:13px;">
          <strong>${OBLIGATION_LABELS[r.obligationType] || r.obligationType}</strong><br>
          <span style="color:#6b7280;font-size:12px;">${locationLabel(r)}</span>
        </td>
        <td style="text-align:right;white-space:nowrap;">
          <span style="${badgeAmber}">in ${days}d</span><br>
          <span style="font-size:11px;color:#9ca3af;">${fmtDate(deadline)}</span>
        </td>
      </tr>`;
    }
    html += `</table>`;
  }

  if (!overdue.length && !upcoming.length) {
    html += `<p style="color:#6b7280;text-align:center;padding:20px;">✅ No upcoming deadlines in the next 60 days.</p>`;
  }

  html += `
    <p style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:4px;">
      Sent by your Berkeley PM Dashboard · <a href="https://ericpropertymanager.netlify.app" style="color:#3b82f6;">Open Dashboard →</a>
    </p>
  </div>
</div>
</body></html>`;

  return html;
}

exports.handler = async () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping reminder');
    return { statusCode: 200, body: 'No API key' };
  }

  let records = [];
  try {
    const store = getStore('compliance');
    records = await store.get('records', { type: 'json' }) || [];
  } catch (e) {
    console.error('Could not read compliance records from Blobs:', e.message);
    return { statusCode: 200, body: 'No data yet' };
  }

  if (!records.length) {
    console.log('No compliance records saved yet — skipping');
    return { statusCode: 200, body: 'No records' };
  }

  const overdue  = records.filter(r => computeStatus(r) === 'OVERDUE');
  const upcoming = records
    .filter(r => !r.completedAt && computeStatus(r) !== 'OVERDUE')
    .filter(r => { const deadline = r.delinquentDate || r.dueDate; return daysUntil(deadline) <= 60; })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const complete = records.filter(r => r.completedAt).length;

  // Only send if there's something to report
  if (!overdue.length && !upcoming.length) {
    console.log('Nothing to remind — skipping email');
    return { statusCode: 200, body: 'Nothing to remind' };
  }

  const subject = overdue.length
    ? `⚠️ ${overdue.length} overdue compliance item${overdue.length > 1 ? 's' : ''} — Berkeley PM`
    : `📅 ${upcoming.length} upcoming compliance deadline${upcoming.length > 1 ? 's' : ''} — Berkeley PM`;

  const html = buildEmailHtml(overdue, upcoming, complete, records.length);

  const emailResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Berkeley PM <onboarding@resend.dev>',
      to: REMINDER_EMAIL,
      subject,
      html,
    }),
  });

  if (!emailResp.ok) {
    const err = await emailResp.text();
    console.error('Resend error:', err);
    return { statusCode: 500, body: err };
  }

  console.log(`Reminder sent to ${REMINDER_EMAIL}: ${overdue.length} overdue, ${upcoming.length} upcoming`);
  return { statusCode: 200, body: 'Sent' };
};

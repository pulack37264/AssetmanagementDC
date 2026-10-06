import nodemailer from 'nodemailer';

const REPORTS = {
  assets: {
    label: 'Equipment inventory',
    columns: [
      ['Name', 'Name'],
      ['Type', 'Type'],
      ['Serial Number', 'SerialNumber'],
      ['Purchase Date', 'PurchaseDate'],
    ],
  },
  licenses: {
    label: 'Software license inventory',
    columns: [
      ['Name', 'Name'],
      ['Purchase Date', 'PurchaseDate'],
    ],
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportHtml(report, records, reportDate) {
  const title = 'DATA CENTER INVENTORY SYSTEM';
  const headers = report.columns.map(([label]) => `
    <th align="left" style="padding:13px 12px;">${escapeHtml(label)}</th>
  `).join('');
  const rows = records.map((record) => `
    <tr>${report.columns.map(([, key]) => `
      <td style="padding:12px;border-bottom:1px solid #dedede;color:#222;">${escapeHtml(record[key]) || '&mdash;'}</td>
    `).join('')}</tr>
  `).join('');

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#222;">
        <div style="max-width:600px;margin:0 auto;background:#fff;">
          <div style="padding:18px 20px 14px;text-align:center;border-bottom:3px solid #df1740;">
            <div style="font-size:22px;line-height:1.3;font-weight:800;color:#333;">${title}</div>
          </div>
          <div style="padding:24px 20px;">
            <p style="margin:0 0 16px;font-size:15px;">Hello Management,</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">
              The selected ${escapeHtml(report.label.toLowerCase())} records are listed below.
            </p>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#df1740;color:#fff;">
                  ${headers}
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:20px;padding:13px 14px;background:#d7efdc;border-left:4px solid #29a34a;color:#216b35;font-size:14px;line-height:1.45;">
              <strong>Report sent:</strong> The selected records are included in this email.
            </div>
            <p style="margin:22px 0 0;font-size:14px;line-height:1.5;">
              Best regards,<br />
              CBL INFORMATION TECHNOLOGY DEPARTMENT
            </p>
          </div>
          <div style="height:1px;background:#dedede;"></div>
          <div style="padding:14px 20px;color:#777;font-size:12px;">
            Data Center Inventory
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendInventoryReport(listType, records) {
  const report = REPORTS[listType];
  if (!report) throw new Error('Unsupported inventory list');

  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'INVENTORY_REPORT_TO'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    const error = new Error(`Inventory email is not configured. Set: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const reportDate = new Date().toISOString().slice(0, 10);
  const text = [
    'Hello Management,',
    `Selected ${report.label.toLowerCase()}:`,
    report.columns.map(([label]) => label).join(' | '),
    ...records.map((record) => report.columns.map(([, key]) => record[key] ?? '').join(' | ')),
  ].join('\n');

  await transporter.sendMail({
    from: process.env.MAIL_FROM?.trim() || process.env.SMTP_USER,
    to: process.env.INVENTORY_REPORT_TO,
    subject: `${report.label} - ${reportDate}`,
    text,
    html: buildReportHtml(report, records, reportDate),
  });

  return { recordCount: records.length, reportDate };
}

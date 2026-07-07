const nodemailer = require("nodemailer");

const {
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_SERVICE,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE
} = process.env;

let transporter = null;

if (EMAIL_USER && EMAIL_PASS) {
  const transportConfig = {
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  };

  if (EMAIL_SERVICE) {
    transportConfig.service = EMAIL_SERVICE;
  } else if (SMTP_HOST && SMTP_PORT) {
    transportConfig.host = SMTP_HOST;
    transportConfig.port = parseInt(SMTP_PORT, 10);
    transportConfig.secure = SMTP_SECURE === "true" || SMTP_SECURE === "1";
  }

  transporter = nodemailer.createTransport(transportConfig);
} else {
  console.warn("Email is not configured. Set EMAIL_USER and EMAIL_PASS in backend/.env to enable email notifications.");
}

function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function wrapHtml(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Complaint Portal</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#F3F7FA;color:#1E293B;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F7FA;padding:24px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background:#0F3D2E;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:0.5px;">Complaint Portal</h1>
              <p style="margin:8px 0 0;color:#D4A017;font-size:14px;">Customer Care Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#F8FAFC;padding:20px;text-align:center;font-size:13px;color:#64748B;">
              Complaint Portal • Delivering instant updates on complaint progress.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createComplaintRegisteredHtml(user, complaint) {
  return wrapHtml(`
    <p style="font-size:16px;color:#1E293B;">Hello ${user.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">Your complaint has been registered successfully. Our team will review it and begin working on a resolution right away.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
      <tr><td style="background:#F8FAFC;padding:16px;font-weight:700;color:#0F3D2E;">Complaint Details</td></tr>
      <tr><td style="padding:16px;">
        <p style="margin:0 0 8px;"><strong>Complaint ID:</strong> ${complaint.complaintId}</p>
        <p style="margin:0 0 8px;"><strong>Title:</strong> ${complaint.title}</p>
        <p style="margin:0 0 8px;"><strong>Category:</strong> ${complaint.category}</p>
        <p style="margin:0 0 8px;"><strong>Priority:</strong> ${complaint.priority}</p>
        <p style="margin:0 0 8px;"><strong>Date & Time:</strong> ${formatDateTime(complaint.createdAt)}</p>
        <p style="margin:0;"><strong>Status:</strong> Pending</p>
      </td></tr>
    </table>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin-top:20px;">Thank you for reporting this issue. You can log in at any time to view updates in the Complaint Portal.</p>
  `);
}

function createComplaintResolvedHtml(user, complaint) {
  return wrapHtml(`
    <p style="font-size:16px;color:#1E293B;">Hello ${user.name},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">Good news! Your complaint has been marked as resolved.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
      <tr><td style="background:#F8FAFC;padding:16px;font-weight:700;color:#0F3D2E;">Resolution Summary</td></tr>
      <tr><td style="padding:16px;">
        <p style="margin:0 0 8px;"><strong>Complaint ID:</strong> ${complaint.complaintId}</p>
        <p style="margin:0 0 8px;"><strong>Title:</strong> ${complaint.title}</p>
        <p style="margin:0 0 8px;"><strong>Resolution Date:</strong> ${formatDateTime(new Date())}</p>
        <p style="margin:0;"><strong>Status:</strong> Resolved</p>
      </td></tr>
    </table>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin-top:20px;">Please log in and provide your feedback if the issue has been resolved satisfactorily.</p>
  `);
}

function createComplaintReopenedHtml(adminUser, complaint, reason) {
  return wrapHtml(`
    <p style="font-size:16px;color:#1E293B;">Hello ${adminUser.name || "Admin"},</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;">A complaint has been reopened and requires further attention.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
      <tr><td style="background:#F8FAFC;padding:16px;font-weight:700;color:#0F3D2E;">Reopened Complaint Details</td></tr>
      <tr><td style="padding:16px;">
        <p style="margin:0 0 8px;"><strong>Complaint ID:</strong> ${complaint.complaintId}</p>
        <p style="margin:0 0 8px;"><strong>User Name:</strong> ${complaint.residentName || "Unknown"}</p>
        <p style="margin:0 0 8px;"><strong>Title:</strong> ${complaint.title}</p>
        <p style="margin:0 0 8px;"><strong>Reason:</strong> ${reason || "No feedback reason provided."}</p>
        <p style="margin:0;"><strong>Reopened Date:</strong> ${formatDateTime(new Date())}</p>
      </td></tr>
    </table>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin-top:20px;">Please review this complaint and take the necessary next steps.</p>
  `);
}

async function sendEmail(options) {
  if (!transporter) {
    console.warn("Email transport is not configured. Skipping email send.");
    return;
  }

  const mailOptions = {
    from: EMAIL_USER,
    ...options
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendEmail,
  createComplaintRegisteredHtml,
  createComplaintResolvedHtml,
  createComplaintReopenedHtml
};

import nodemailer from "nodemailer";

async function sendEmailLogs(emailTo, successPath, errorPath) {
  if (!emailTo) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "vasanvasan944@gmail.com",
      pass: process.env.SMTP_PASS || "fodw ovwx nwgl qzfz",
    },
  });

  await transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      '"Migration Tool" <vasanvasan944@gmail.com>',
    to: emailTo,
    subject: "Freshservice Migration Completed",
    text: "The ticket migration process has finished. Please find the logs attached.",
    attachments: [
      { filename: "success.log", path: successPath },
      { filename: "error.log", path: errorPath },
    ],
  });
}

export { sendEmailLogs };

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD
  }
});

async function sendPasswordResetEmail(email, resetUrl) {
  await transporter.sendMail({
    from: `"Heartstone Estate" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset your Heartstone password",
    text: `We received a request to reset your Heartstone password.

Use this link to reset your password:
${resetUrl}

This link expires in 15 minutes.

If you did not request this, you can ignore this email.`
  });
}

module.exports = { sendPasswordResetEmail };

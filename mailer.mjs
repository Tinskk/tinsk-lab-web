import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendContactEmail({ name, email, phone, projectType, message }) {
  const to = process.env.CONTACT_TO_EMAIL || process.env.GMAIL_USER;

  await transporter.sendMail({
    from: `"TINSK Labs Website" <${process.env.GMAIL_USER}>`,
    to,
    replyTo: email,
    subject: `New project inquiry from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || '—'}`,
      `Project type: ${projectType || '—'}`,
      '',
      'Message:',
      message,
    ].join('\n'),
    html: [
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
      `<p><strong>Phone:</strong> ${escapeHtml(phone || '—')}</p>`,
      `<p><strong>Project type:</strong> ${escapeHtml(projectType || '—')}</p>`,
      `<p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    ].join('\n'),
  });
}

export async function sendNewsletterOwnerNotification(email) {
  const to = process.env.CONTACT_TO_EMAIL || process.env.GMAIL_USER;

  await transporter.sendMail({
    from: `"TINSK Labs Website" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'New newsletter signup',
    text: `New newsletter signup: ${email}`,
    html: `<p>New newsletter signup: <strong>${escapeHtml(email)}</strong></p>`,
  });
}

export async function sendNewsletterConfirmation(email) {
  await transporter.sendMail({
    from: `"TINSK Labs" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "You're subscribed to TINSK Labs",
    text: "Thanks for subscribing — you'll hear from us occasionally with insights, project updates, and applied-AI notes. Never spam.",
    html: "<p>Thanks for subscribing — you'll hear from us occasionally with insights, project updates, and applied-AI notes. Never spam.</p>",
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

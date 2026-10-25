import nodemailer from 'nodemailer';
import { env, isProd, isTest } from '../config/env.js';

export const outbox = []; // populated in tests only
let transporter;

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (isTest) { outbox.push({ to, subject, text, html }); return; }
  if (!env.smtpConfigured) {
    // No SMTP configured: print to the console in development so flows stay testable. Never in production.
    if (!isProd) console.log(`\n[email:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    else console.warn(`Email "${subject}" not sent: SMTP is not configured.`);
    return;
  }
  await getTransport().sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
}

const shell = (body) => `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#0f1b30">${body}<p style="color:#6b7480;font-size:12px;margin-top:32px">Makaanly</p></div>`;
const button = (href, label) => `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#0f1b30;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${label}</a></p>`;

export const clientLink = (path, token) => `${env.clientOrigins[0]}${path}?token=${token}`;

export const sendVerificationEmail = (user, token) => {
  const link = clientLink('/verify-email', token);
  return sendMail({
    to: user.email, subject: 'Verify your Makaanly email',
    text: `Hi ${user.name},\n\nConfirm your email address to finish setting up your account:\n${link}\n\nThis link expires in 24 hours.`,
    html: shell(`<h2>Confirm your email</h2><p>Hi ${escapeHtml(user.name)}, confirm your email address to finish setting up your account.</p>${button(link, 'Verify email')}<p>This link expires in 24 hours.</p>`),
  });
};

export const sendPasswordResetEmail = (user, token) => {
  const link = clientLink('/reset-password', token);
  return sendMail({
    to: user.email, subject: 'Reset your Makaanly password',
    text: `Hi ${user.name},\n\nUse this link to choose a new password:\n${link}\n\nIt expires in 1 hour and works once. If you didn't ask for this, you can ignore this email.`,
    html: shell(`<h2>Reset your password</h2><p>Hi ${escapeHtml(user.name)}, use the button below to choose a new password. The link expires in 1 hour and works once.</p>${button(link, 'Reset password')}<p>If you didn't ask for this, you can ignore this email.</p>`),
  });
};

const appLink = (path) => `${env.clientOrigins[0]}${path}`;

export const sendListingDecisionEmail = (owner, property, decision, reason) => {
  const approved = decision === 'approve';
  const link = approved ? appLink(`/properties/${property.slug}`) : appLink(`/dashboard/properties/${property._id}/edit`);
  const subject = approved ? `Your listing is live: ${property.title}` : `Your listing needs changes: ${property.title}`;
  return sendMail({
    to: owner.email, subject,
    text: approved
      ? `Hi ${owner.name},\n\nGood news: "${property.title}" has been approved and is now visible on Makaanly.\n${link}`
      : `Hi ${owner.name},\n\n"${property.title}" was not approved.\n\nReason: ${reason}\n\nYou can update the listing and submit it again:\n${link}`,
    html: shell(approved
      ? `<h2>Your listing is live</h2><p>Hi ${escapeHtml(owner.name)}, “${escapeHtml(property.title)}” has been approved and is now visible on Makaanly.</p>${button(link, 'View listing')}`
      : `<h2>Your listing needs changes</h2><p>Hi ${escapeHtml(owner.name)}, “${escapeHtml(property.title)}” was not approved.</p><p><strong>Reason:</strong> ${escapeHtml(reason)}</p>${button(link, 'Update listing')}`),
  });
};

export const sendVerificationDecisionEmail = (user, decision, reason) => {
  const text = { approve: 'Your verification has been approved. A verified badge now shows on your profile and listings.', reject: `Your verification request was not approved.\n\nReason: ${reason}\n\nYou can apply again with updated documents.`, revoke: `Your verified status has been removed.\n\nReason: ${reason}` }[decision];
  return sendMail({
    to: user.email, subject: decision === 'approve' ? 'You are verified on Makaanly' : 'Update on your Makaanly verification',
    text: `Hi ${user.name},\n\n${text}\n\n${appLink('/dashboard/verification')}`,
    html: shell(`<h2>Verification update</h2><p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>${button(appLink('/dashboard/verification'), 'Open verification')}`),
  });
};

// Optional notifications (new inquiry, reply, viewing changes, admin actions on a listing). People can turn these off in Settings.
export const sendNotificationEmail = (user, { subject, text, link, linkLabel = 'Open on Makaanly' }) => {
  const url = link ? appLink(link) : appLink('/dashboard');
  return sendMail({
    to: user.email, subject,
    text: `Hi ${user.name},\n\n${text}\n\n${url}\n\nYou can turn these emails off in Settings: ${appLink('/dashboard/settings')}`,
    html: shell(`<h2>${escapeHtml(subject)}</h2><p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>${button(url, linkLabel)}<p style="color:#6b7480;font-size:12px">You can turn these emails off in <a href="${escapeHtml(appLink('/dashboard/settings'))}">Settings</a>.</p>`),
  });
};

// A security notice. Always sent, whatever the person's email preference.
export const sendPasswordChangedEmail = (user) => sendMail({
  to: user.email, subject: 'Your Makaanly password was changed',
  text: `Hi ${user.name},\n\nThe password for your Makaanly account was just changed, and you were signed out on your other devices.\n\nIf this was not you, reset your password now: ${appLink('/forgot-password')}`,
  html: shell(`<h2>Your password was changed</h2><p>Hi ${escapeHtml(user.name)}, the password for your account was just changed, and you were signed out on your other devices.</p><p>If this was not you, reset your password right away.</p>${button(appLink('/forgot-password'), 'Reset password')}`),
});

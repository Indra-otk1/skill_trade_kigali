import 'dotenv/config';
import { betterAuth } from 'better-auth';
import db from './db/database.js';

// Set to true while seeding demo accounts so no emails are sent for them
export const emailControl = { suppress: false };

// Sends through Brevo's HTTPS API. Without credentials, the email is printed
// to the server console instead (handy for local development).
async function sendEmail({ to, subject, text, html }) {
  if (emailControl.suppress) return;

  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'SkillTrade Kigali', email: process.env.EMAIL_FROM },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error('Email provider error:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Failed to send email:', err.message);
  }
}

export const auth = betterAuth({
  appName: 'SkillTrade Kigali',
  database: db,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600, // links last 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: 'Verify your SkillTrade Kigali account',
        text: `Hi ${user.name},\n\nClick this link to verify your email:\n${url}\n\nThe link expires in 1 hour.`,
        html: `<p>Hi ${user.name},</p><p><a href="${url}">Verify your email</a> to start trading skills.</p><p>The link expires in 1 hour.</p>`,
      });
    },
  },
});
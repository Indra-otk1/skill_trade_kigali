import 'dotenv/config';
import { betterAuth } from 'better-auth';
import nodemailer from 'nodemailer';
import db from './db/database.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// If no email credentials are set, print the email to the console instead
async function sendEmail({ to, subject, text, html }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"SkillTrade Kigali" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
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
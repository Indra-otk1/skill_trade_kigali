import db from './db/database.js';
import { auth, emailControl } from './auth.js';

export const DEMO_PASSWORD = 'Demo@12345';

const DEMO_USERS = [
  {
    name: 'Aline Uwase',
    email: 'aline.demo@example.com',
    skills: [
      { title: 'Python tutoring', description: 'Python basics, data structures and debugging help.', category: 'Tech' },
      { title: 'Web design basics', description: 'HTML, CSS and layout tips for beginners.', category: 'Design' },
    ],
  },
  {
    name: 'Eric Mugisha',
    email: 'eric.demo@example.com',
    skills: [
      { title: 'Guitar lessons', description: 'Beginner acoustic guitar, chords and simple songs.', category: 'Music' },
      { title: 'French conversation', description: 'Practice everyday French with a patient partner.', category: 'Languages' },
    ],
  },
  {
    name: 'Grace Ineza',
    email: 'grace.demo@example.com',
    skills: [
      { title: 'Calculus help', description: 'Limits, derivatives and exam preparation.', category: 'Academics' },
      { title: 'Pitch deck feedback', description: 'Structure and review for startup pitch decks.', category: 'Business' },
    ],
  },
];

export async function seedDemoData() {
  emailControl.suppress = true;
  try {
    for (const demo of DEMO_USERS) {
      const existing = db.prepare('SELECT id FROM "user" WHERE email = ?').get(demo.email);
      if (existing) continue;

      const result = await auth.api.signUpEmail({
        body: { name: demo.name, email: demo.email, password: DEMO_PASSWORD },
      });
      db.prepare('UPDATE "user" SET emailVerified = 1 WHERE id = ?').run(result.user.id);

      const insert = db.prepare(
        'INSERT INTO skills (user_id, title, description, category) VALUES (?, ?, ?, ?)'
      );
      for (const s of demo.skills) {
        insert.run(result.user.id, s.title, s.description, s.category);
      }
    }
    console.log('Demo accounts ready.');
  } finally {
    emailControl.suppress = false;
  }
}
import app from './app.js';
import { setupDatabase } from './setup.js';
import { seedDemoData } from './seed.js';

const PORT = process.env.PORT || 3000;

await setupDatabase();
if (process.env.SEED_DEMO_DATA === 'true') {
  await seedDemoData();
}

app.listen(PORT, () => {
  console.log(`SkillTrade Kigali running on http://localhost:${PORT}`);
});
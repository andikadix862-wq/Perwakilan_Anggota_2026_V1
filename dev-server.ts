// Local development entry point
import { app } from './server';

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  SISTEM PEMILIHAN ANGGOTA PERWAKILAN ONLINE`);
  console.log(`  KOPSYAH YKK AP INDONESIA - PERIODE 2026`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
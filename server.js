import app from './src/app.js';
import { PORT } from './src/config.js';

app.listen(PORT, () => {
  process.stdout.write(`Member Portal API listening on http://localhost:${PORT}\n`);
});

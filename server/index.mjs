import { createApp } from './app.mjs';
import { loadEnv } from './loadEnv.mjs';

loadEnv();

const PORT = Number(process.env.PORT || 8787);
const app = createApp();

app.listen(PORT, () => {
  console.log(`MRV API escuchando en http://localhost:${PORT} (PostgreSQL Aiven)`);
});

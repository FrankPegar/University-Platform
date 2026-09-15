import { createApp } from './src/app.js';
import { env } from './src/config/env.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`University Q&A API listening on port ${env.port} (${env.nodeEnv})`);
});

import { createApp } from './app.ts';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, DEFAULT_VARIABLES } from './defaults.ts';
import type { GoogleToken } from './google.ts';
import { createTransportFactory } from './mailer.ts';
import { DATA_DIR, jsonStore } from './store.ts';

const port = Number(process.env['PORT'] ?? 3000);
// Loopback only: credentials and tokens must not be reachable from other machines on the network.
const host = process.env['HOST'] ?? '127.0.0.1';

// Secret files (0600): SMTP password / OAuth client secret, and the Google refresh token.
const googleToken = jsonStore<GoogleToken | null>('google-token.json', () => null, true);

const app = createApp({
  settings: jsonStore('settings.json', () => structuredClone(DEFAULT_SETTINGS), true),
  templates: jsonStore('templates.json', () => structuredClone(DEFAULT_TEMPLATES)),
  variables: jsonStore('variables.json', () => structuredClone(DEFAULT_VARIABLES)),
  history: jsonStore('history.json', () => []),
  googleToken,
  transport: createTransportFactory(fetch, googleToken),
  fetch,
});

app.listen(port, host, () => {
  console.log(`Local Leads email server on http://${host}:${port} (data: ${DATA_DIR})`);
});

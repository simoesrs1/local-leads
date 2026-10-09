import { createApp } from './app.ts';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, DEFAULT_VARIABLES } from './defaults.ts';
import { smtpTransport } from './mailer.ts';
import { DATA_DIR, jsonStore } from './store.ts';

const port = Number(process.env['PORT'] ?? 3000);
// Loopback only: the SMTP credentials must not be reachable from other machines on the network.
const host = process.env['HOST'] ?? '127.0.0.1';

const app = createApp({
  settings: jsonStore('settings.json', () => structuredClone(DEFAULT_SETTINGS), true),
  templates: jsonStore('templates.json', () => structuredClone(DEFAULT_TEMPLATES)),
  variables: jsonStore('variables.json', () => structuredClone(DEFAULT_VARIABLES)),
  history: jsonStore('history.json', () => []),
  transport: smtpTransport,
});

app.listen(port, host, () => {
  console.log(`Local Leads email server on http://${host}:${port} (data: ${DATA_DIR})`);
});

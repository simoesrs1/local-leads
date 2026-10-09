import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  ApiError,
  EmailSettingsUpdate,
  EmailTemplate,
  HistoryEntry,
  SendEmailRequest,
  SendEmailResult,
  TemplateVariable,
} from '../src/app/models/email.model.ts';
import {
  type StoredSettings,
  type TransportFactory,
  fromHeader,
  mergeSettings,
  resolveDelivery,
  textToHtml,
  toPublicSettings,
  validateSettings,
} from './mailer.ts';
import type { Store } from './store.ts';

export interface AppDeps {
  settings: Store<StoredSettings>;
  templates: Store<EmailTemplate[]>;
  variables: Store<TemplateVariable[]>;
  history: Store<HistoryEntry[]>;
  transport: TransportFactory;
}

const KEY = /^[a-z][a-z0-9_]*$/;

/** Error that maps to a JSON `{ error }` response with a given status. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly key: string,
    readonly detail?: string,
  ) {
    super(key);
  }
}

/** Express app with the email API. Kept separate from `listen` so tests can inject fakes. */
export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---- Settings (sensitive: the password is write-only) ----------------------------------
  app.get('/api/settings', async (_req, res) => {
    res.json(toPublicSettings(await deps.settings.read()));
  });

  app.put('/api/settings', async (req, res) => {
    const update = req.body as EmailSettingsUpdate;
    if (typeof update?.host !== 'string' || typeof update?.fromEmail !== 'string') {
      throw new HttpError(400, 'EMAIL_ERRORS.INVALID_REQUEST');
    }
    const next = mergeSettings(await deps.settings.read(), update);
    await deps.settings.write(next);
    res.json(toPublicSettings(next));
  });

  /** Opens an SMTP connection and authenticates, without sending anything. */
  app.post('/api/settings/verify', async (_req, res) => {
    const settings = await deps.settings.read();
    const invalid = validateSettings(settings);
    if (invalid) throw new HttpError(400, invalid);
    try {
      await deps.transport(settings).verify();
    } catch (error) {
      throw new HttpError(502, 'EMAIL_ERRORS.SMTP_FAILED', (error as Error).message);
    }
    res.json({ ok: true });
  });

  // ---- Templates & variables (not sensitive, stored as whole lists) ----------------------
  app.get('/api/templates', async (_req, res) => {
    res.json(await deps.templates.read());
  });

  app.put('/api/templates', async (req, res) => {
    const templates = req.body as EmailTemplate[];
    const valid =
      Array.isArray(templates) &&
      templates.every(
        (template) =>
          typeof template.id === 'string' &&
          typeof template.name === 'string' &&
          typeof template.subject === 'string' &&
          typeof template.body === 'string',
      );
    if (!valid) throw new HttpError(400, 'EMAIL_ERRORS.INVALID_REQUEST');
    await deps.templates.write(templates);
    res.json(templates);
  });

  app.get('/api/variables', async (_req, res) => {
    res.json(await deps.variables.read());
  });

  app.put('/api/variables', async (req, res) => {
    const variables = req.body as TemplateVariable[];
    const keys = new Set<string>();
    const valid =
      Array.isArray(variables) &&
      variables.every((variable) => {
        const ok =
          typeof variable.key === 'string' && KEY.test(variable.key) && !keys.has(variable.key);
        keys.add(variable.key);
        return ok;
      });
    if (!valid) throw new HttpError(400, 'EMAIL_ERRORS.INVALID_REQUEST');
    await deps.variables.write(variables);
    res.json(variables);
  });

  // ---- Sending (one message per request so the browser can show progress and stop) -----
  app.post('/api/email/send', async (req, res) => {
    const message = req.body as SendEmailRequest;
    if (
      typeof message?.leadId !== 'string' ||
      typeof message.subject !== 'string' ||
      typeof message.text !== 'string'
    ) {
      throw new HttpError(400, 'EMAIL_ERRORS.INVALID_REQUEST');
    }

    const settings = await deps.settings.read();
    const invalid = validateSettings(settings);
    if (invalid) throw new HttpError(400, invalid);

    const result: SendEmailResult = {
      leadId: message.leadId,
      status: 'sent',
      to: null,
      testMode: settings.testMode,
    };

    const delivery = resolveDelivery(settings, message);
    if ('skipped' in delivery) {
      res.json({ ...result, status: 'skipped', error: delivery.skipped });
      return;
    }

    let final: SendEmailResult;
    try {
      await deps.transport(settings).sendMail({
        from: fromHeader(settings),
        to: delivery.to,
        subject: delivery.subject,
        text: delivery.text,
        html: textToHtml(delivery.text),
      });
      final = { ...result, to: delivery.to };
    } catch (error) {
      final = { ...result, to: delivery.to, status: 'failed', error: (error as Error).message };
    }

    // Every attempt (test or live, sent or failed) is logged; only live "sent" marks a lead as contacted.
    await appendHistory({
      id: randomUUID(),
      leadId: message.leadId,
      leadName: message.leadName ?? message.leadId,
      leadEmail: message.to?.trim() || null,
      to: delivery.to,
      subject: message.subject,
      templateId: message.templateId ?? null,
      templateName: message.templateName ?? null,
      testMode: settings.testMode,
      status: final.status === 'sent' ? 'sent' : 'failed',
      error: final.error,
      sentAt: new Date().toISOString(),
    });
    res.json(final);
  });

  // ---- History ---------------------------------------------------------------------------
  // Writes are chained so concurrent sends never overwrite each other's entries.
  let historyQueue: Promise<unknown> = Promise.resolve();
  const appendHistory = (entry: HistoryEntry) => {
    const next = historyQueue.then(async () => {
      const entries = await deps.history.read();
      await deps.history.write([...entries, entry]);
    });
    historyQueue = next.catch(() => undefined);
    return next;
  };
  const updateHistory = (change: (entries: HistoryEntry[]) => HistoryEntry[]) => {
    const next = historyQueue.then(async () =>
      deps.history.write(change(await deps.history.read())),
    );
    historyQueue = next.catch(() => undefined);
    return next;
  };

  app.get('/api/history', async (_req, res) => {
    const entries = await deps.history.read();
    // Entries are appended in order, so reversing gives newest first (even within the same millisecond).
    res.json([...entries].reverse());
  });

  app.delete('/api/history/:id', async (req, res) => {
    await updateHistory((entries) => entries.filter((entry) => entry.id !== req.params['id']));
    res.status(204).end();
  });

  /** Clears the history; `?testOnly=true` keeps the real sends. */
  app.delete('/api/history', async (req, res) => {
    const testOnly = req.query['testOnly'] === 'true';
    await updateHistory((entries) => (testOnly ? entries.filter((entry) => !entry.testMode) : []));
    res.status(204).end();
  });

  // Express 5 forwards rejected promises here.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const body: ApiError =
      error instanceof HttpError
        ? { error: error.key, detail: error.detail }
        : { error: 'EMAIL_ERRORS.SERVER_ERROR', detail: (error as Error)?.message };
    if (!(error instanceof HttpError)) console.error(error);
    res.status(error instanceof HttpError ? error.status : 500).json(body);
  });

  return app;
}

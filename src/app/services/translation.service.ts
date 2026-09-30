import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export const LANGUAGES = ['en', 'pt'] as const;
export type Language = (typeof LANGUAGES)[number];

type Dictionary = Record<string, string>;

const STORAGE_KEY = 'local-leads.lang';

/**
 * Minimal signal-based i18n. Dictionaries live in `public/i18n/<lang>.json` as flat
 * `"KEY": "translation"` pairs, with the same keys in every language file.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly dictionaries = signal<Partial<Record<Language, Dictionary>>>({});

  readonly language = signal<Language>(this.initialLanguage());
  private readonly current = computed(() => this.dictionaries()[this.language()] ?? {});

  /** Loads the initial language. Called from an app initializer so the first render is translated. */
  init(): Promise<void> {
    return this.load(this.language());
  }

  async use(language: Language): Promise<void> {
    await this.load(language);
    this.language.set(language);
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage may be blocked (private mode); the choice just won't persist.
    }
  }

  /** Returns the translation for `key`, replacing `{{param}}` placeholders. Falls back to the key. */
  translate(key: string, params?: Record<string, string | number>): string {
    let text = this.current()[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{{${name}}}`, String(value));
      }
    }
    return text;
  }

  private async load(language: Language): Promise<void> {
    if (this.dictionaries()[language]) return;
    const dictionary = await firstValueFrom(this.http.get<Dictionary>(`i18n/${language}.json`));
    this.dictionaries.update((all) => ({ ...all, [language]: dictionary }));
  }

  private initialLanguage(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (LANGUAGES as readonly string[]).includes(stored)) return stored as Language;
    } catch {
      // Ignore storage errors and fall back to the browser language.
    }
    return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  }
}

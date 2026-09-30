import { Injectable, signal } from '@angular/core';

/** Shared UI state between pages and the app shell. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** True while a dark full-bleed section (e.g. the home globe) sits under the header. */
  readonly darkHeader = signal(false);
}

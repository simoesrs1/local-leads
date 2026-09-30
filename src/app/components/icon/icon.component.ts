import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Inner SVG markup (24x24 viewBox, stroke-based) for each icon. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone:
    '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  smartphone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  store: '<path d="M3 5h18l-1 5H4zM4 10v10h16V10M9 20v-6h6v6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  sparkles:
    '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  userX: '<circle cx="9" cy="8" r="4"/><path d="M3 20a6 6 0 0 1 12 0M17 8l4 4M21 8l-4 4"/>',
  languages: '<path d="M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c0 4-3 7-6 8M13 21l4-9 4 9M14.5 18h5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Inline SVG icon that inherits `currentColor` and scales with `size` (px).
 * Usage: <app-icon name="search" [size]="18" />
 */
@Component({
  selector: 'app-icon',
  template: '<span class="icon" [innerHTML]="svg()"></span>',
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(2);

  // Markup comes only from the static ICONS map above, never from user input, so bypassing is safe.
  protected readonly svg = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size()}" height="${this.size()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${this.strokeWidth()}" stroke-linecap="round" stroke-linejoin="round">${ICONS[this.name()]}</svg>`,
    ),
  );
}

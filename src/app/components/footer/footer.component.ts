import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-footer',
  imports: [TranslatePipe],
  template: `
    <footer class="footer">
      <div class="container footer__inner">
        <span
          ><strong>{{ 'APP.TITLE' | translate }}</strong> · {{ 'APP.SUBTITLE' | translate }}</span
        >
        <!-- OSM data is ODbL-licensed and requires attribution wherever it is shown. -->
        <span>
          {{ 'FOOTER.DATA' | translate }}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            >© OpenStreetMap contributors</a
          >
        </span>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      margin-top: 4rem;
      padding: 1.5rem 0;
      border-top: 1px solid var(--color-border);
      font-size: 0.85rem;
      color: var(--color-muted);
    }

    .footer__inner {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {}

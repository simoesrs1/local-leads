import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type LoaderSize = 'small' | 'medium' | 'large';

/**
 * Reusable loading spinner.
 *
 * Usage:
 *   <app-loader />                                   inline spinner, screen-reader text only
 *   <app-loader size="large" message="SEARCH.LOADING" />   spinner + visible message
 *   <app-loader overlay />                           covers the nearest positioned parent (e.g. a list being refreshed)
 *
 * `message` is a translation key; plain text also works because missing keys fall back to themselves.
 * The spinner uses `currentColor`, so it inherits the text colour (e.g. white inside a primary button).
 */
@Component({
  selector: 'app-loader',
  imports: [TranslatePipe],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class]': "'loader loader--' + size()",
    '[class.loader--overlay]': 'overlay()',
  },
})
export class LoaderComponent {
  readonly size = input<LoaderSize>('medium');
  readonly message = input<string>('');
  /** Absolute-positioned backdrop over the parent. The parent needs `position: relative`. */
  readonly overlay = input(false);
}

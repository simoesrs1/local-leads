import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LayoutService } from '../../services/layout.service';
import { GlobeComponent, GlobeTarget } from '../globe/globe.component';
import { IconComponent, IconName } from '../icon/icon.component';

interface Feature {
  icon: IconName;
  key: string;
  soon?: boolean;
}

/**
 * Landing page. The first section is a tall "scrollytelling" block: its scroll progress (0..1)
 * drives the globe and is exposed to CSS as `--p`, so every text layer can move/fade at its own
 * speed (parallax) with plain CSS calc().
 */
@Component({
  selector: 'app-home',
  imports: [GlobeComponent, IconComponent, RouterLink, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--p]': 'progress()' },
})
export class HomeComponent {
  private readonly story = viewChild.required<ElementRef<HTMLElement>>('story');
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutService);

  protected readonly progress = signal(0);
  /** Which text layer is interactive; hidden layers must not catch clicks. */
  protected readonly stage = computed(() => {
    const progress = this.progress();
    if (progress < 0.14) return 'hero';
    if (progress < 0.62) return 'zoom';
    return 'leads';
  });

  protected readonly target: GlobeTarget = {
    latitude: 39.7436,
    longitude: -8.8071,
    countryId: '620', // Portugal
  };

  protected readonly steps: { icon: IconName; key: string }[] = [
    { icon: 'pin', key: 'HOME.STEP_1' },
    { icon: 'filter', key: 'HOME.STEP_2' },
    { icon: 'send', key: 'HOME.STEP_3' },
  ];

  protected readonly features: Feature[] = [
    { icon: 'layers', key: 'HOME.FEATURE_SOURCES' },
    { icon: 'filter', key: 'HOME.FEATURE_FILTERS' },
    { icon: 'smartphone', key: 'HOME.FEATURE_MOBILE' },
    { icon: 'download', key: 'HOME.FEATURE_EXPORT' },
    { icon: 'languages', key: 'HOME.FEATURE_I18N' },
    { icon: 'mail', key: 'HOME.FEATURE_EMAIL', soon: true },
  ];

  constructor() {
    afterNextRender(() => this.trackScroll());
  }

  private headerHeight(): number {
    return (
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) ||
      64
    );
  }

  private trackScroll(): void {
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const rect = this.story().nativeElement.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      this.progress.set(Math.min(1, Math.max(0, -rect.top / scrollable)));
      // Header stays dark while the space scene is behind it.
      this.layout.darkHeader.set(rect.bottom > this.headerHeight());
    };
    // Throttle to one update per frame.
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    this.destroyRef.onDestroy(() => {
      this.layout.darkHeader.set(false);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
  }
}

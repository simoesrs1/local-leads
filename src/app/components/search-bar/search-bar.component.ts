import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadSource } from '../../models/lead.model';
import {
  BUSINESS_CATEGORIES,
  BusinessCategory,
  DEFAULT_RADIUS_KM,
  DEFAULT_SOURCE,
  SearchCriteria,
} from '../../models/search.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-search-bar',
  imports: [FormsModule, IconComponent, LoaderComponent, TranslatePipe],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent {
  readonly loading = input(false);
  /** Data sources the user can pick from (only providers that are configured). */
  readonly sources = input<LeadSource[]>(['osm']);
  /** Current search (if any); the form is pre-filled with it, e.g. after a search started from the home page. */
  readonly criteria = input<SearchCriteria | null>(null);
  readonly search = output<SearchCriteria>();

  protected readonly allCategories = BUSINESS_CATEGORIES;
  protected readonly radiusOptions = [1, 2, 5, 10, 20];

  // linkedSignal: editable locally, but reset whenever a new `criteria` comes in.
  protected readonly locality = linkedSignal(() => this.criteria()?.locality ?? '');
  protected readonly categories = linkedSignal<BusinessCategory[]>(() => [
    ...(this.criteria()?.categories ?? BUSINESS_CATEGORIES),
  ]);
  protected readonly radiusKm = linkedSignal(() => this.criteria()?.radiusKm ?? DEFAULT_RADIUS_KM);
  protected readonly source = linkedSignal<LeadSource>(
    () => this.criteria()?.source ?? DEFAULT_SOURCE,
  );

  protected toggleCategory(category: BusinessCategory): void {
    this.categories.update((selected) =>
      selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category],
    );
  }

  protected toggleAllCategories(): void {
    this.categories.update((selected) =>
      selected.length === BUSINESS_CATEGORIES.length ? [] : [...BUSINESS_CATEGORIES],
    );
  }

  protected submit(): void {
    const locality = this.locality().trim();
    if (!locality || !this.categories().length || this.loading()) return;
    const current = this.criteria();
    this.search.emit({
      locality,
      categories: this.categories(),
      radiusKm: this.radiusKm(),
      source: this.source(),
      // Keep the exact coordinates only while the locality text is unchanged (e.g. a geolocated search).
      center: current?.locality === locality ? current.center : undefined,
    });
  }
}

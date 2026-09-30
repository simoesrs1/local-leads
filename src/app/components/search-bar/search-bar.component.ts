import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadSource } from '../../models/lead.model';
import { BUSINESS_CATEGORIES, BusinessCategory, SearchCriteria } from '../../models/search.model';
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
  readonly search = output<SearchCriteria>();

  protected readonly allCategories = BUSINESS_CATEGORIES;
  protected readonly radiusOptions = [1, 2, 5, 10, 20];

  protected readonly locality = signal('');
  protected readonly categories = signal<BusinessCategory[]>([...BUSINESS_CATEGORIES]);
  protected readonly radiusKm = signal(2);
  protected readonly source = signal<LeadSource>('osm');

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
    this.search.emit({
      locality,
      categories: this.categories(),
      radiusKm: this.radiusKm(),
      source: this.source(),
    });
  }
}

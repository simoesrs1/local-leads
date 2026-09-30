import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LayoutService } from '../../services/layout.service';
import { LANGUAGES, Language, TranslationService } from '../../services/translation.service';
import { IconComponent } from '../icon/icon.component';

/** Sticky glass navigation bar shown on every page. */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, IconComponent, TranslatePipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly translation = inject(TranslationService);
  protected readonly layout = inject(LayoutService);
  protected readonly languages = LANGUAGES;

  protected changeLanguage(language: Language): void {
    void this.translation.use(language);
  }
}

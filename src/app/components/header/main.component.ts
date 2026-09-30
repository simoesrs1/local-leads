import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LANGUAGES, Language, TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-header',
  imports: [TranslatePipe],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly translation = inject(TranslationService);
  protected readonly languages = LANGUAGES;

  protected changeLanguage(language: Language): void {
    void this.translation.use(language);
  }
}

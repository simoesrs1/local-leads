import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { EmailConfigService } from '../../services/email-config.service';
import { LayoutService } from '../../services/layout.service';
import { LANGUAGES, Language, TranslationService } from '../../services/translation.service';
import { IconComponent, IconName } from '../icon/icon.component';

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
  protected readonly emailConfig = inject(EmailConfigService);

  protected readonly links: { path: string; icon: IconName; label: string; exact: boolean }[] = [
    { path: '/', icon: 'home', label: 'NAV.HOME', exact: true },
    { path: '/search', icon: 'search', label: 'NAV.SEARCH', exact: false },
    { path: '/templates', icon: 'fileText', label: 'NAV.TEMPLATES', exact: false },
    { path: '/history', icon: 'clock', label: 'NAV.HISTORY', exact: false },
    { path: '/settings', icon: 'settings', label: 'NAV.SETTINGS', exact: false },
  ];

  constructor() {
    // Needed for the test-mode badge; fails silently when the email server is not running.
    void this.emailConfig.load();
  }
  protected readonly languages = LANGUAGES;

  protected changeLanguage(language: Language): void {
    void this.translation.use(language);
  }
}

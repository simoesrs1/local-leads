import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeaderComponent } from './components/header/main.component';
import { LeadFinderComponent } from './components/lead-finder/main.component';

@Component({
  selector: 'app-root',
  imports: [HeaderComponent, LeadFinderComponent],
  template: `
    <main class="container">
      <app-header />
      <app-lead-finder />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}

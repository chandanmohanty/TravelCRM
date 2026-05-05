import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LocaleService } from './core/services/locale.service';
import { CoreService } from './services/core.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'TravelCRM Plus - Enterprise Travel CRM';
  private readonly locale = inject(LocaleService);
  private readonly coreService = inject(CoreService);

  constructor() {
    this.locale.init();
    // Apply saved theme immediately to avoid flash of default theme
    this.coreService.applyThemeToDOM();
  }
}

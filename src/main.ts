import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Capacitor } from '@capacitor/core';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { TelemetryService } from './app/services/telemetry.service';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    console.error(err);
    TelemetryService.reportBootstrapError(err);
  });

// Service worker solo per la versione web (PWA): nell'app Android non serve e non va registrato.
// Percorso relativo, così funziona sia con base "/" sia con base "/FinanzAi/".
if (environment.production && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('Service worker non registrato', err));
  });
}

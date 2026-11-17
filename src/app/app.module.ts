import { ErrorHandler, NgModule, inject, provideAppInitializer } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { SharedModule } from './components/shared.module';
import { GlobalErrorHandler } from './services/global-error-handler';
import { TelemetryService } from './services/telemetry.service';

@NgModule({
  declarations: [AppComponent, OnboardingComponent],
  imports: [
    BrowserModule,
    FormsModule,
    IonicModule.forRoot({ mode: 'ios' }),
    IonicStorageModule.forRoot(),
    AppRoutingModule,
    SharedModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Telemetria per il bot dell'amministratore: tutti gli errori (ErrorHandler, window.onerror, promesse,
    // console.error) + coda locale con reinvio. Non blocca mai l'avvio.
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => inject(TelemetryService).install()),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

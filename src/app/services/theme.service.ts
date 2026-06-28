import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemeMode } from '../models/user-preferences.model';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'finanzai_theme';
  private theme$ = new BehaviorSubject<ThemeMode>('system');

  get currentTheme$() { return this.theme$.asObservable(); }
  get currentTheme(): ThemeMode { return this.theme$.value; }

  init(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
    this.applyTheme(saved ?? 'system');
  }

  setTheme(mode: ThemeMode): void {
    localStorage.setItem(this.STORAGE_KEY, mode);
    this.applyTheme(mode);
  }

  private applyTheme(mode: ThemeMode): void {
    this.theme$.next(mode);
    const body = document.body;
    body.classList.remove('ion-palette-dark', 'ion-palette-light');
    if (mode === 'dark')  body.classList.add('ion-palette-dark');
    if (mode === 'light') body.classList.add('ion-palette-light');
  }
}

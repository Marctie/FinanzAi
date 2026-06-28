import { Component, OnInit } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { StorageService } from '../../services/storage.service';
import { ThemeMode } from '../../models/user-preferences.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  currentTheme: ThemeMode = 'system';
  version = '1.0.0';

  constructor(
    private themeService: ThemeService,
    private storage:      StorageService,
  ) {}

  ngOnInit(): void {
    this.currentTheme = this.themeService.currentTheme;
  }

  setTheme(mode: ThemeMode): void {
    this.currentTheme = mode;
    this.themeService.setTheme(mode);
  }

  openDeveloper(): void {
    window.open('https://marctie.github.io/marco.peluso/home', '_blank', 'noopener,noreferrer');
  }

  openGithub(): void {
    window.open('https://github.com/Marctie/FinanzAi', '_blank', 'noopener,noreferrer');
  }
}

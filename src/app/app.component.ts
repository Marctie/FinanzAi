import { Component, OnInit } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private theme:   ThemeService,
    private storage: StorageService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.theme.init();
    await this.storage.init();
  }
}

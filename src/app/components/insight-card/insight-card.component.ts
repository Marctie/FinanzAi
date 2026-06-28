import { Component, Input } from '@angular/core';
import { AiInsight } from '../../services/ai.service';

@Component({
  selector: 'app-insight-card',
  templateUrl: './insight-card.component.html',
  styleUrls: ['./insight-card.component.scss'],
  standalone: false,
})
export class InsightCardComponent {
  @Input() insight!: AiInsight;
}

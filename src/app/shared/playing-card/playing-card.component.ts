import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-playing-card',
  templateUrl: './playing-card.component.html',
  styleUrl: './playing-card.component.scss',
})
export class PlayingCardComponent {
  @Input() label = '';
  @Input() face: 'front' | 'back' = 'front';
  @Input() selected = false;
}

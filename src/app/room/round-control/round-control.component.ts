import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PointingType } from '../../model/pointing-type.model';

@Component({
  selector: 'app-round-control',
  templateUrl: './round-control.component.html',
})
export class RoundControlComponent {
  @Input() busy = false;
  @Output() start = new EventEmitter<{ text: string; pointingType: PointingType }>();

  text = '';

  submit(pointingType: PointingType | null) {
    const text = this.text.trim();

    if (text === '' || pointingType == null) {
      return;
    }

    this.start.emit({ text, pointingType });
  }

  // chamado pelo pai só depois que a rodada foi criada, pra não perder o texto se a escrita falhar
  reset() {
    this.text = '';
  }
}

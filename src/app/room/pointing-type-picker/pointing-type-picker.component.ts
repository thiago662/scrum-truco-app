import { Component } from '@angular/core';
import { PointingOption, PointingType } from '../../model/pointing-type.model';
import { POINTING_TYPES } from '../pointing-types';

const CUSTOM = 'custom';

@Component({
  selector: 'app-pointing-type-picker',
  templateUrl: './pointing-type-picker.component.html',
})
export class PointingTypePickerComponent {
  types = POINTING_TYPES;
  selectedId: string = POINTING_TYPES[0].id!;
  customOptions: PointingOption[] = [{ label: '', weight: null }, { label: '', weight: null }];

  get isCustom(): boolean {
    return this.selectedId === CUSTOM;
  }

  // null quando o personalizado ainda está inválido (menos de 2 valores ou nomes repetidos)
  get current(): PointingType | null {
    if (!this.isCustom) {
      return this.types.find((type) => type.id === this.selectedId) ?? null;
    }

    const options = this.customOptions
      .map((option) => ({ label: option.label.trim(), weight: option.weight == null ? null : Number(option.weight) }))
      .filter((option) => option.label !== '');

    if (options.length < 2 || new Set(options.map((option) => option.label)).size !== options.length) {
      return null;
    }

    return { id: null, name: 'Personalizado', options };
  }

  addOption() {
    this.customOptions.push({ label: '', weight: null });
  }

  removeOption(index: number) {
    this.customOptions.splice(index, 1);
  }
}

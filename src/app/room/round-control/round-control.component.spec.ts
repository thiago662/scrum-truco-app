import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PointingTypePickerComponent } from '../pointing-type-picker/pointing-type-picker.component';

import { RoundControlComponent } from './round-control.component';

describe('RoundControlComponent', () => {
  let component: RoundControlComponent;
  let fixture: ComponentFixture<RoundControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RoundControlComponent, PointingTypePickerComponent],
      imports: [FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RoundControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emite o texto e o tipo escolhido e só limpa o campo no reset', () => {
    const emitted: any[] = [];
    component.start.subscribe((value) => emitted.push(value));

    const type = { id: 'fibonacci', name: 'Fibonacci', options: [{ label: '1', weight: 1 }] };
    component.text = '  Login com Google  ';
    component.submit(type);

    expect(emitted).toEqual([{ text: 'Login com Google', pointingType: type }]);
    expect(component.text).toBe('  Login com Google  ');

    component.reset();
    expect(component.text).toBe('');
  });

  it('não emite sem texto ou sem tipo válido', () => {
    const emitted: any[] = [];
    component.start.subscribe((value) => emitted.push(value));

    component.text = 'algo';
    component.submit(null);
    component.text = '   ';
    component.submit({ id: null, name: 'x', options: [] });

    expect(emitted.length).toBe(0);
  });
});

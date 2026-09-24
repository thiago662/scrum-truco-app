import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { PointingTypePickerComponent } from './pointing-type-picker.component';

describe('PointingTypePickerComponent', () => {
  let component: PointingTypePickerComponent;
  let fixture: ComponentFixture<PointingTypePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PointingTypePickerComponent],
      imports: [FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PointingTypePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('começa em Fibonacci e renderiza as opções', () => {
    expect(component.current?.id).toBe('fibonacci');
    expect(fixture.nativeElement.querySelectorAll('.badge').length).toBe(component.current!.options.length);
  });

  it('personalizado só é válido com 2+ valores distintos', () => {
    component.selectedId = 'custom';
    expect(component.current).toBeNull();

    component.customOptions = [{ label: 'A', weight: 1 }, { label: 'A', weight: 2 }];
    expect(component.current).toBeNull();

    component.customOptions = [{ label: 'A', weight: 1 }, { label: ' B ', weight: null }];
    expect(component.current).toEqual({ id: null, name: 'Personalizado', options: [{ label: 'A', weight: 1 }, { label: 'B', weight: null }] });
  });
});

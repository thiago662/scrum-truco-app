import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    document.documentElement.setAttribute('data-bs-theme', 'light');
    localStorage.removeItem('theme');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-bs-theme');
    localStorage.removeItem('theme');
  });

  it('lê o tema atual do atributo do documento', () => {
    expect(service.current).toBe('light');
    document.documentElement.setAttribute('data-bs-theme', 'dark');
    expect(service.current).toBe('dark');
  });

  it('toggle alterna o atributo e persiste em localStorage', () => {
    service.toggle();
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    service.toggle();
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});

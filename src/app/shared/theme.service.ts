import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// A escolha manual fica em localStorage; sem ela, index.html decide pelo SO antes do Angular
// carregar (evita o flash de tema errado). Chamar em SSR não quebra: apply() e toggle() saem
// sem fazer nada fora do browser (localStorage não existe no prerender, ver CLAUDE.md).
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'theme';
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get current(): 'light' | 'dark' {
    if (!this.isBrowser) {
      return 'light';
    }

    return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
  }

  toggle(): void {
    if (!this.isBrowser) {
      return;
    }

    const next = this.current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);

    try {
      localStorage.setItem(this.storageKey, next);
    } catch {
      // navegação privada pode bloquear storage; a troca de tema já aconteceu, só não persiste
    }
  }
}

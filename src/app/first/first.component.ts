import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthModalService } from '../auth/auth-modal.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-first',
  templateUrl: './first.component.html',
  styleUrl: './first.component.scss'
})
export class FirstComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);

  constructor(
    private authModalService: AuthModalService,
    private authService: AuthService,
    private router: Router,
  ) { }

  async ngOnInit() {
    // Firebase Auth nunca resolve durante o prerender SSR (ng build gera as rotas
    // estáticas) — sem essa guarda, o build trava esperando uma Promise que nunca chega.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const user = await this.authService.getCurrentUser();

    if (user != null) {
      this.router.navigate(['/rooms']);
    }
  }

  openLogin() {
    this.authModalService.open('login');
  }

  openRegister() {
    this.authModalService.open('create');
  }
}

import { Component } from '@angular/core';
import { AuthModalService } from '../auth/auth-modal.service';

@Component({
  selector: 'app-first',
  templateUrl: './first.component.html',
  styleUrl: './first.component.scss'
})
export class FirstComponent {
  constructor(private authModalService: AuthModalService) { }

  openLogin() {
    this.authModalService.open('login');
  }

  openRegister() {
    this.authModalService.open('create');
  }
}

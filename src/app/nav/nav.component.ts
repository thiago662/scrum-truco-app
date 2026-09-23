import { Component, inject, TemplateRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { NgbOffcanvas, NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthModalService } from '../auth/auth-modal.service';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss'
})
export class NavComponent implements OnInit, OnDestroy {
  private offcanvasService = inject(NgbOffcanvas);

  @ViewChild('contentmodal') contentModal!: TemplateRef<any>;

  isMenuCollapsed = true;

  userForm = new FormGroup({
    id: new FormControl(''),
    name: new FormControl(''),
    companyName: new FormControl(''),
    email: new FormControl(''),
    password: new FormControl(''),
  });
  isLogged = false;
  mode: any;
  errorMessage = '';

  private userSub?: Subscription;
  private modalRequestSub?: Subscription;

  constructor(
    config: NgbModalConfig,
    private modalService: NgbModal,
    private authService: AuthService,
    private authModalService: AuthModalService,
  ) { }

  ngOnInit() {
    this.userSub = this.authService.currentUser$.subscribe((user) => {
      this.isLogged = user != null && !user.isGuest;

      this.userForm.patchValue({
        id: user?.id ?? '',
        name: user?.isGuest ? '' : user?.name ?? '',
        companyName: user?.companyName ?? '',
        email: user?.email ?? '',
        password: '',
      });
    });

    this.modalRequestSub = this.authModalService.openRequest$.subscribe((mode) => {
      this.selectedMode(mode);
      this.open(this.contentModal);
    });
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.modalRequestSub?.unsubscribe();
  }

  openCanvasEnd(content: TemplateRef<any>) {
    this.offcanvasService.open(content, { position: 'end' });
  }

  checkCanvas() {
    return this.offcanvasService.hasOpenOffcanvas() ?? false;
  }

  open(content: any) {
    this.errorMessage = '';
    this.modalService.open(content);
  }

  selectedMode(mode: any) {
    this.errorMessage = '';
    this.mode = mode;
  }

  async login() {
    var userForm = this.userForm.value;

    try {
      await this.authService.login(userForm?.email ?? '', userForm?.password ?? '');
    } catch {
      this.errorMessage = 'E-mail ou senha inválidos.';
    }
  }

  async createUser() {
    var userForm = this.userForm.value;

    try {
      await this.authService.register(
        userForm?.email ?? '',
        userForm?.password ?? '',
        userForm?.name ?? '',
        userForm?.companyName ?? '',
      );
    } catch {
      this.errorMessage = 'Não foi possível criar a conta. O e-mail já pode estar em uso.';
    }
  }

  async updateProfile() {
    var userForm = this.userForm.value;

    await this.authService.updateProfile(userForm?.id ?? '', {
      name: userForm?.name ?? '',
      companyName: userForm?.companyName ?? '',
    });
  }

  async logout() {
    await this.authService.logout();

    this.mode = '';
  }

  async deleteUser() {
    try {
      await this.authService.deleteAccount(this.userForm.value?.id ?? '');
    } catch {
      this.errorMessage = 'Não foi possível excluir a conta. Faça login novamente e tente de novo.';
    }
  }
}

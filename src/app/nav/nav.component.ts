import { Component, inject, TemplateRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { NgbOffcanvas, NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthModalService } from '../auth/auth-modal.service';
import { ThemeService } from '../shared/theme.service';

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
  mode: 'login' | 'create' = 'login';
  errorMessage = '';

  private userSub?: Subscription;
  private modalRequestSub?: Subscription;

  constructor(
    config: NgbModalConfig,
    private modalService: NgbModal,
    private authService: AuthService,
    private authModalService: AuthModalService,
    private themeService: ThemeService,
  ) { }

  get isDarkTheme(): boolean {
    return this.themeService.current === 'dark';
  }

  toggleTheme() {
    this.themeService.toggle();
  }

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

  open(content: TemplateRef<unknown>) {
    this.errorMessage = '';
    this.modalService.open(content);
  }

  selectedMode(mode: 'login' | 'create') {
    this.errorMessage = '';
    this.mode = mode;
  }

  submit() {
    if (this.isLogged) {
      this.updateProfile();
    } else if (this.mode === 'create') {
      this.createUser();
    } else {
      this.login();
    }
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

    try {
      await this.authService.updateProfile(userForm?.id ?? '', {
        name: userForm?.name ?? '',
        companyName: userForm?.companyName ?? '',
      });
    } catch {
      this.errorMessage = 'Não foi possível salvar as alterações.';
    }
  }

  async logout() {
    await this.authService.logout();

    this.mode = 'login';
  }

  get profileInitial(): string {
    const name = this.userForm.value.name?.trim() || this.userForm.value.email?.trim() || '';
    return name.charAt(0).toUpperCase() || '?';
  }

  async deleteUser() {
    try {
      await this.authService.deleteAccount(this.userForm.value?.id ?? '');
    } catch {
      this.errorMessage = 'Não foi possível excluir a conta. Faça login novamente e tente de novo.';
    }
  }
}

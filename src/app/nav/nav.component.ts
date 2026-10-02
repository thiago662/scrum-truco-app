import { Component, TemplateRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthModalService } from '../auth/auth-modal.service';
import { ThemeService } from '../shared/theme.service';
import { User } from '../model/user.model';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss'
})
export class NavComponent implements OnInit, OnDestroy {
  @ViewChild('contentmodal') contentModal!: TemplateRef<any>;

  userForm = new FormGroup({
    id: new FormControl(''),
    name: new FormControl('', Validators.required),
    companyName: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    // 6 pra bater com o mínimo que o próprio Firebase Auth já exige -- não faz sentido
    // o client aceitar algo que o servidor vai rejeitar de qualquer forma
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });
  isLogged = false;
  mode: 'login' | 'create' = 'login';
  errorMessage = '';
  resetMessage = '';

  // fonte do rótulo do botão no menu -- não pode ser o userForm (buffer de edição): se a
  // pessoa digitar um nome novo em "Editar perfil" e fechar sem salvar, o botão ficaria
  // mostrando o rascunho não salvo pelo resto da sessão
  private currentUser: User | null = null;

  private userSub?: Subscription;
  private modalRequestSub?: Subscription;

  constructor(
    config: NgbModalConfig,
    private modalService: NgbModal,
    private authService: AuthService,
    private authModalService: AuthModalService,
    private themeService: ThemeService,
  ) { }

  // nome na linha de cima, empresa (só se tiver as duas) na linha de baixo -- cada uma
  // com seu próprio max-width/ellipsis no template, em vez de uma string "Nome · Empresa"
  // só (truncava no meio sem critério, cortava letra da empresa quase sempre)
  get accountName(): string {
    if (!this.isLogged || this.currentUser == null) {
      return 'Entrar ou Cadastrar';
    }

    return this.currentUser.name?.trim() || this.currentUser.companyName?.trim() || 'Minha conta';
  }

  get accountCompany(): string {
    if (!this.isLogged || this.currentUser == null) {
      return '';
    }

    const name = this.currentUser.name?.trim();
    const companyName = this.currentUser.companyName?.trim();

    return name && companyName ? companyName : '';
  }

  // separado de profileInitial (abaixo): esse não pode ler o userForm -- mesmo problema
  // do accountName, um rascunho de nome não salvo não pode aparecer na letra do avatar
  get accountInitial(): string {
    const name = this.currentUser?.name?.trim() || this.currentUser?.companyName?.trim() || '';
    // [...name][0] (não charAt(0)): nome começando com emoji/caractere fora do BMP usa par
    // substituto de 2 code units -- charAt(0) pegaria só a metade e quebraria o glifo
    return [...name][0]?.toUpperCase() || '?';
  }

  get isDarkTheme(): boolean {
    return this.themeService.current === 'dark';
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  ngOnInit() {
    this.userSub = this.authService.currentUser$.subscribe((user) => {
      this.isLogged = user != null && !user.isGuest;
      this.currentUser = user;

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

  open(content: TemplateRef<unknown>) {
    this.errorMessage = '';
    this.resetMessage = '';
    this.modalService.open(content);
  }

  selectedMode(mode: 'login' | 'create') {
    this.errorMessage = '';
    this.resetMessage = '';
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
    this.resetMessage = '';
    var userForm = this.userForm.value;

    try {
      await this.authService.login(userForm?.email ?? '', userForm?.password ?? '');
    } catch {
      this.errorMessage = 'E-mail ou senha inválidos.';
    }
  }

  async createUser() {
    this.resetMessage = '';
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
    this.resetMessage = '';
    var userForm = this.userForm.value;

    try {
      const name = userForm?.name ?? '';
      const companyName = userForm?.companyName ?? '';
      await this.authService.updateProfile(userForm?.id ?? '', { name, companyName });

      // updateProfile grava direto no Firestore sem passar pelo Firebase Auth -- authState()
      // não reemite, currentUser$ não sabe que o perfil mudou. Sem isso, accountName/
      // accountCompany ficavam presos no valor antigo até o próximo login/logout.
      if (this.currentUser) {
        this.currentUser = new User(this.currentUser.id, name, this.currentUser.email, companyName, this.currentUser.isGuest);
      }
    } catch {
      this.errorMessage = 'Não foi possível salvar as alterações.';
    }
  }

  async sendPasswordReset() {
    this.errorMessage = '';
    this.resetMessage = '';

    if (this.userForm.controls.email.invalid) {
      return;
    }

    try {
      await this.authService.resetPassword(this.userForm.value.email ?? '');
    } catch (error: any) {
      // nunca revela se o e-mail existe ou não (enumeração de conta) -- só erro de
      // verdade (rede, limite de tentativas) vira mensagem de falha
      if (error?.code !== 'auth/user-not-found') {
        this.errorMessage = 'Não foi possível enviar o e-mail agora.';
        return;
      }
    }

    this.resetMessage = 'Enviamos um link pra redefinir sua senha nesse e-mail.';
  }

  async logout() {
    await this.authService.logout();

    this.mode = 'login';
  }

  // só valida os campos relevantes pro modo atual -- password/name/companyName vazios
  // não podem travar o botão de Entrar, por exemplo, já que nem aparecem nessa aba
  get loginInvalid(): boolean {
    return this.userForm.controls.email.invalid || this.userForm.controls.password.invalid;
  }

  get createInvalid(): boolean {
    return this.userForm.invalid;
  }

  get profileInvalid(): boolean {
    return this.userForm.controls.name.invalid || this.userForm.controls.companyName.invalid;
  }

  get profileInitial(): string {
    const name = this.userForm.value.name?.trim() || this.userForm.value.email?.trim() || '';
    return [...name][0]?.toUpperCase() || '?';
  }

  async deleteUser() {
    try {
      await this.authService.deleteAccount(this.userForm.value?.id ?? '');
    } catch {
      this.errorMessage = 'Não foi possível excluir a conta. Faça login novamente e tente de novo.';
    }
  }
}

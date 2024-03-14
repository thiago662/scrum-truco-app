import { Component, inject, TemplateRef, ViewEncapsulation, Injectable } from '@angular/core';
import { NgbOffcanvas, NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { NavService } from './nav.service';
import { User } from '../model/user.model';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss'
})
export class NavComponent {
  private offcanvasService = inject(NgbOffcanvas);

  isMenuCollapsed = true;

  userForm = new FormGroup({
    id: new FormControl(''),
    name: new FormControl(''),
    email: new FormControl(''),
    password: new FormControl(''),
  });
  isLogged: boolean = false;
  mode: any;

  constructor(
    config: NgbModalConfig,
		private modalService: NgbModal,
    private navService: NavService,
  ) { }

  async ngOnInit() {
    this.getUserIfIsLog();
  }

  openCanvasEnd(content: TemplateRef<any>) {
		this.offcanvasService.open(content, { position: 'end' });
	}

  checkCanvas() {
    return this.offcanvasService.hasOpenOffcanvas() ?? false;
  }

	open(content: any) {
		this.modalService.open(content);
	}

	selectedMode(mode: any) {
		this.mode = mode;
	}

  async getUserIfIsLog() {
    var user: any = await this.navService.getUser();

    if (user == null) {
      this.isLogged = await false;
    } else {
      this.userForm.setValue({
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
      });

      this.isLogged = true;
    }
  }

  async logout() {
    await this.navService.removeLocalStoregeUser();

    await this.userForm.setValue({
      id: '',
      name: '',
      email: '',
      password: '',
    });

    this.mode = await '';

    this.isLogged = await false;
  }

  async login() {
    var userForm = await this.userForm.value;

    var userIsLogged: any = await this.navService.loginUser(userForm?.email, userForm?.password);

    if (userIsLogged != null) {
      await this.userForm.setValue({
        id: userIsLogged?.id ?? '',
        name: userIsLogged?.name ?? '',
        email: userIsLogged?.email ?? '',
        password: userIsLogged?.password ?? '',
      });
  
      this.isLogged = await true;
    }
  }

  async createUser() {
    var userForm = await this.userForm.value;

    var emailExist = await this.navService.checkEmailExistFirebase(userForm?.email);

    if (emailExist) {
      this.isLogged = await false;

      return;
    }

    var user: any = await {
      name: userForm?.name ?? '',
      email: userForm?.email ?? '',
      password: userForm?.password ?? '',
      rooms: {},
    };

    var userFirebase: any = await this.navService.createUser(user);

    await this.userForm.patchValue({
      id: userFirebase?.id,
    });

    this.isLogged = await true;
  }

  async updateUser() {
    var userForm = await this.userForm.value;

    var userNow = await this.navService.getUser();

    if (userNow?.email != userForm?.email) {
      var emailExist = await this.navService.checkEmailExistFirebase(userForm?.email);

      if (emailExist) {
        return;
      }
    }

    var user: any = {
      id: userForm?.id ?? '',
      name: userForm?.name ?? '',
      email: userForm?.email ?? '',
      password: userForm?.password ?? '',
    };

    var userFirebase: any = await this.navService.updateUser(user?.id, user);

    this.userForm.patchValue({
      id: userFirebase?.id ?? '',
      name: userFirebase?.name ?? '',
      email: userFirebase?.email ?? '',
      password: userFirebase?.password ?? '',
    });
  }

  async deleteUser() {
    await this.navService.deleteUser(this.userForm.value?.id);

    window.location.reload();
  }
}

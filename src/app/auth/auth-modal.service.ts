import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthModalService {
  private openRequest = new Subject<'login' | 'create'>();
  openRequest$ = this.openRequest.asObservable();

  open(mode: 'login' | 'create') {
    this.openRequest.next(mode);
  }
}

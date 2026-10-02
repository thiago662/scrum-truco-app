import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { User } from '../model/user.model';
import { loggedInGuard } from './logged-in.guard';

describe('loggedInGuard', () => {
  function configure(user: User | null) {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: { getCurrentUser: () => Promise.resolve(user) } },
      ],
    });
  }

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      loggedInGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('redireciona pra raiz sem sessão', async () => {
    configure(null);

    const result = await runGuard();
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('redireciona pra raiz se for convidado anônimo', async () => {
    configure(new User('uid-1', '', '', '', true));

    const result = await runGuard();
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('deixa passar conta cadastrada de verdade', async () => {
    configure(new User('uid-1', 'Fulano', 'fulano@teste.com', 'Empresa'));

    const result = await runGuard();
    expect(result).toBe(true);
  });
});

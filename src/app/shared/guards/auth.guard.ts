import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../biosys-core/services/auth.service';


@Injectable()
export class AuthGuard  {
    constructor(protected authService: AuthService, protected router: Router) {
    }

    canActivate() {
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/login']);

            return false;
        }

        return true;
    }
}

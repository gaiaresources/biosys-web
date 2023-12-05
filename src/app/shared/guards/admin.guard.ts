import { Injectable } from '@angular/core';

import { AuthService } from '../../../biosys-core/services/auth.service';
import { map } from 'rxjs/operators';
import { User } from '../../../biosys-core/interfaces/api.interfaces';


@Injectable()
export class AdminGuard  {
    constructor(private authService: AuthService) {
    }

    canActivate() {
        return this.authService.getCurrentUser().pipe(
            map((user: User) => user.is_admin)
        );
    }
}

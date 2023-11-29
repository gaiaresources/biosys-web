import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../../biosys-core/services/auth.service';
import { User } from '../../../../biosys-core/interfaces/api.interfaces';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'biosys-login',
    templateUrl: 'login.component.html'
})
export class LoginComponent {
    public errorMessages: string[];
    public loginForm: FormGroup;

    constructor(private formBuilder: FormBuilder, private authService: AuthService, private router: Router) {
        this.authService = authService;
        this.router = router;

        this.loginForm = formBuilder.group({
            username: ['', Validators.required],
            password: ['', Validators.required]
        });
    }

    public login(event: any) {
        event.preventDefault();

        this.authService.login(this.loginForm.value.username, this.loginForm.value.password).subscribe(
            (user: User) => {
                // 25/06/2019: a little hack to prevent public users registered through a mobile app like koala or slug to access the app.
                // this is a temp solution waiting for the update of the server's permission model.
                // TODO: remove that once the server permission model has been updated.
                const isAppAdminOnly = environment.hasOwnProperty('adminOnly') && environment['adminOnly'];
                const forbidden = isAppAdminOnly && !(user.is_admin  || user.is_data_engineer);
                if (forbidden) {
                    this.authService.logout();
                    this.router.navigate(['/admin-only']);
                } else {
                    this.router.navigate(['/']);
                }
            },
            () => this.errorMessages = ['Invalid username/password.']
        );

        event.preventDefault();
    }
}

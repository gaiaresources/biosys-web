import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../biosys-core/services/auth.service';
import { MenuItem } from 'primeng/primeng';
import { User } from '../../../biosys-core/interfaces/api.interfaces';
import { Router } from '@angular/router';

/**
 * This class represents the lazy loaded HomeComponent.
 */
@Component({
    moduleId: module.id,
    selector: 'biosys-navbar',
    templateUrl: 'navbar.component.html',
    styleUrls: []
})
export class NavbarComponent implements OnInit {
    public items: MenuItem[];

    constructor(private authService: AuthService, private router: Router) {
    }

    ngOnInit() {
        this.items = [
            {
                label: 'Home',
                icon: 'fa fa-home',
                routerLink: ['/']
            },
            {
                label: 'Data',
                icon: 'fa fa-database',
                routerLink: ['/data/projects']
            },
            {
                label: 'View',
                icon: 'fa fa-search',
                routerLink: ['/view']
            },
            {
                label: 'Logout',
                icon: 'fa fa-sign-out',
                command: () => this.logout()
            }
        ];

        this.authService.getCurrentUser().subscribe((user: User) => {
            const projectItem = {
                label: 'Projects',
                routerLink: ['/management/projects']
            };

            if (user.is_admin) {
                this.items.splice(1, 0, {
                    label: 'Manage',
                    icon: 'fa fa-university',
                    items: [
                        {
                            label: 'Programs',
                            routerLink: ['/management/programs']
                        },
                        projectItem
                    ]
                });
            } else if (user.is_data_engineer) {
                this.items.splice(1, 0, {
                    label: 'Manage',
                    icon: 'fa fa-university',
                    items: [
                        projectItem
                    ]
                });
            }
        });
    }

    logout() {
        this.authService.logout();

        this.router.navigate(['/login']);
    }
}

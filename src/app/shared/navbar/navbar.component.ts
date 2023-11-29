import { Component, OnInit } from '@angular/core';

import { MenuItem } from 'primeng/api';

import { AuthService } from '../../../biosys-core/services/auth.service';
import { User } from '../../../biosys-core/interfaces/api.interfaces';
import { Router } from '@angular/router';
import { formatUserFullName } from '../../../biosys-core/utils/functions';
import { environment } from '../../../environments/environment';

/**
 * This class represents the lazy loaded HomeComponent.
 */
@Component({
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
                icon: 'pi pi-home',
                routerLink: ['/']
            },
            {
                label: 'Data Management',
                icon: 'pi pi-desktop',
                routerLink: ['/data-management/projects']
            },
            {
                label: 'View and Export',
                icon: 'pi pi-search',
                routerLink: ['/view']
            }
        ];

        this.authService.getCurrentUser().subscribe((user: User) => {
            const projectItem = {
                label: 'Projects',
                routerLink: ['/administration/projects']
            };

            if (user.is_admin) {
                this.items.splice(1, 0, {
                    label: 'Administration',
                    icon: 'pi pi-globe',
                    items: [
                        {
                            label: 'Programs',
                            routerLink: ['/administration/programs']
                        },
                        projectItem
                    ]
                });
            } else if (user.is_data_engineer) {
                this.items.splice(1, 0, {
                    label: 'Administration',
                    icon: 'pi pi-globe',
                    items: [
                        projectItem
                    ]
                });
            }

            const accountItems: MenuItem[] = [
                {
                    label: 'Logout',
                    icon: 'pi pi-sign-out',
                    command: () => this.logout()
                }
            ];

            if (!environment['useSSOAuth']) {
                accountItems.unshift({
                    label: 'Change Password',
                    icon: 'pi pi-key',
                    routerLink: ['/change-password']
                });
            }

            this.items.push({
                label: `Logged in as ${formatUserFullName(user)}`,
                icon: 'pi pi-user',
                items: accountItems
            });
        });
    }

    logout() {
        this.authService.logout();

        this.router.navigate(['/login']);
    }
}

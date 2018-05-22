import { Component, OnInit } from '@angular/core';
import { APIError, Project, User } from '../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../biosys-core/services/api.service';
import { Router } from '@angular/router';

@Component({
    moduleId: module.id,
    selector: 'biosys-data-project-list',
    templateUrl: 'list-projects.component.html',
    styleUrls: [],
})

export class DataListProjectsComponent implements OnInit {
    public breadcrumbItems: any = [];
    public projects: Project[] = [];

    constructor(private apiService: APIService, private router: Router) {
    }

    ngOnInit() {
        this.apiService.whoAmI()
            .subscribe(
                (user: User) => this.apiService.getProjects([user.id])
                    .subscribe(
                        (projects: Project[]) => this.projects = projects,
                        (error: APIError) => console.log('error.msg', error.msg)
                    ),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.breadcrumbItems = [
            {label: 'Enter Records - Projects'},
        ];
    }
}

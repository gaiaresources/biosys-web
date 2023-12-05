import { Component, OnInit } from '@angular/core';
import { APIError, Program, Project, User } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { AuthService } from '../../../../biosys-core/services/auth.service';

@Component({
    selector: 'biosys-data-project-list',
    templateUrl: 'list-projects.component.html',
    styleUrls: [],
})
export class DataListProjectsComponent implements OnInit {
    public breadcrumbItems: any = [];
    public projects: Project[] = [];
    public programNameLookup: object = {};

    constructor(private apiService: APIService, private authService: AuthService) {
    }

    ngOnInit() {
        this.authService.getCurrentUser()
            .subscribe(
                (user: User) => this.apiService.getProjects({custodians: [user.id]})
                    .subscribe(
                        (projects: Project[]) => this.projects = projects,
                        (error: APIError) => console.log('error.msg', error.msg)
                    ),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.apiService.getPrograms()
            .subscribe(
                (programs: Program[]) =>
                    programs.forEach((program: Program) => this.programNameLookup[program.id] = program.name),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.breadcrumbItems = [
            {label: 'Data Management - Projects'},
        ];
    }
}

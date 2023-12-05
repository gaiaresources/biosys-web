import { Component, OnInit } from '@angular/core';
import { APIError, Program, Project, User } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../../biosys-core/services/auth.service';

@Component({
    selector: 'biosys-management-project-list',
    templateUrl: 'list-projects.component.html',
    styleUrls: [],
})

export class ManagementListProjectsComponent implements OnInit {
    public breadcrumbItems: any = [];
    public projects: Project[] = [];
    public programNameLookup: object = {};

    private user: User;

    constructor(private apiService: APIService, private authService: AuthService, private router: Router,
                private messageService: MessageService, private confirmationService: ConfirmationService) {
    }

    ngOnInit() {
        this.authService.getCurrentUser()
            .toPromise()
            .then((user: User) => this.user = user,
                (error: APIError) => console.log('error.msg', error.msg)
            )
            .then(() => {
                if (this.user.is_admin) {
                    this.apiService.getProjects().subscribe(
                        (projects: Project[]) => this.projects = projects,
                        (error: APIError) => console.log('error.msg', error.msg)
                    );
                } else if (this.user.is_data_engineer) {
                    this.apiService.getProjects({program__data_engineers: this.user.id}).subscribe(
                        (projects: Project[]) => this.projects = projects,
                        (error: APIError) => console.log('error.msg', error.msg)
                    );
                }
            }, (error: APIError) => console.log('error.msg', error.msg));

        this.apiService.getPrograms()
            .subscribe(
                (programs: Program[]) =>
                    programs.forEach((program: Program) => this.programNameLookup[program.id] = program.name),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.breadcrumbItems = [
            {label: 'Administration - Projects'}
        ];
    }

    public confirmDelete(project: Project) {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete this project?',
            accept: () => {
                this.apiService.deleteProject(project.id)
                    .subscribe(
                        () => this.onDeleteSuccess(),
                        (error: APIError) => this.onDeleteError(error)
                    );
            }
        });
    }

    private onDeleteSuccess() {
        if (this.user.is_admin) {
            this.apiService.getProjects().subscribe(
                (projects: Project[]) => this.projects = projects,
                (error: APIError) => console.log('error.msg', error.msg)
            );
        } else if (this.user.is_data_engineer) {
            this.apiService.getProjects({program__data_engineers: this.user.id}).subscribe(
                (projects: Project[]) => this.projects = projects,
                (error: APIError) => console.log('error.msg', error.msg)
            );
        }

        this.messageService.add({
            severity: 'success',
            summary: 'Project deleted',
            detail: 'The project was deleted',
            key: 'mainToast'
        });
    }

    private onDeleteError(projectError: any) {
        this.messageService.add({
            severity: 'error',
            summary: 'Project delete error',
            detail: 'There were error(s) deleting the project: ' + projectError.msg,
            key: 'mainToast'
        });
    }
}

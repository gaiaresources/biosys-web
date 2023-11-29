import { Component, OnInit } from '@angular/core';
import { APIError, Program, User } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../../biosys-core/services/auth.service';
import { formatUserFullName } from '../../../../biosys-core/utils/functions';

@Component({
    selector: 'biosys-management-program-list',
    templateUrl: 'list-programs.component.html',
    styleUrls: [],
})

export class ListProgramsComponent implements OnInit {
    public breadcrumbItems: any = [];
    public programs: Program[];

    private allUsers: { [id: number]: User } = {};

    constructor(private apiService: APIService, private authService: AuthService, private router: Router,
                private route: ActivatedRoute, private messageService: MessageService,
                private confirmationService: ConfirmationService) {
    }

    ngOnInit() {
        this.apiService.getPrograms().subscribe(
            (programs: Program[]) => this.programs = programs,
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.apiService.getUsers()
            .subscribe(
                (users: User[]) => users.forEach((user: User) => this.allUsers[user.id] = user),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.breadcrumbItems = [
            {label: 'Administration - Programs'}
        ];
    }
    public formatDataEngineers(userIds: number[]): string {
        return userIds
            .filter(id => this.allUsers.hasOwnProperty(id))
            .map(id => formatUserFullName(this.allUsers[id]))
            .join('; ')
            .trim();
    }

    public confirmDelete(program: Program) {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete this program?',
            accept: () => {
                this.apiService.deleteProgram(program.id)
                    .subscribe(
                        () => this.onDeleteSuccess(),
                        (error: APIError) => this.onDeleteError(error)
                    );
            }
        });
    }

    private onDeleteSuccess() {
        this.apiService.getPrograms().subscribe(
            (programs: Program[]) => this.programs = programs,
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.messageService.add({
            severity: 'success',
            summary: 'Program deleted',
            detail: 'The program was deleted'
        });
    }

    private onDeleteError(programError: any) {
        this.messageService.add({
            severity: 'error',
            summary: 'Program delete error',
            detail: 'There were error(s) deleting the program: ' + programError.msg
        });
    }
}

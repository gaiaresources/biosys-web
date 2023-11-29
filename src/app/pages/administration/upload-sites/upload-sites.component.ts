import { Component, OnInit, ViewChild } from '@angular/core';
import { APIError, Project } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { AuthService } from '../../../../biosys-core/services/auth.service';
import { Message } from 'primeng/api';
import { Router, ActivatedRoute } from '@angular/router';
import { FileUpload } from 'primeng/fileupload';
import { ACCEPTED_TYPES } from '../../../shared/utils/consts';

@Component({
    selector: 'biosys-upload-site',
    templateUrl: 'upload-sites.component.html',
    styleUrls: [],
})

export class UploadSitesComponent implements OnInit {
    accepted_types = ACCEPTED_TYPES;

    breadcrumbItems: any = [];

    messages: Message[] = [];
    url: string = null;
    projectId: number;

    @ViewChild(FileUpload)
    uploader: FileUpload;

    constructor(private apiService: APIService,
                private authService: AuthService,
                private router: Router,
                private route: ActivatedRoute) {
    }

    ngOnInit(): void {
        const params = this.route.snapshot.params;
        this.projectId = params['projectId'];

        this.apiService.getProjectById(this.projectId)
            .subscribe(
                (project: Project) => this.breadcrumbItems.splice(1, 0, {
                    label: project.name,
                    routerLink: ['/administration/projects/edit-project/' + this.projectId]
                }),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.url = this.apiService.getProjectSiteUploadURL(this.projectId);

        this.breadcrumbItems = [
            {label: 'Administration - Projects', routerLink: ['/administration/projects']},
            {label: 'Upload sites', routerLink: ['/administration/projects/edit-project' + this.projectId + '/upload-sites']},
        ];
    }

    onUpload() {
        const successUrl = '/administration/projects/edit-project/' + this.projectId;
        return this.router.navigate([successUrl]);
    }

    onError(event: any) {
        const addErrorMessage = (summary: any, detail: any) => {
            this.messages.push({
                severity: 'error',
                summary: summary.toString(),
                detail: detail.toString()
            });
        };
        this.messages = [];
        const statusCode = event.xhr.status;
        let resp = event.xhr.response;
        if (statusCode === 400) {
            resp = JSON.parse(resp);
            // find errors
            for (const rowNumber of Object.keys(resp)) {
                const error = resp[rowNumber]['error'];
                if (error) {
                    addErrorMessage('Row #' + rowNumber, error);
                }
            }
        } else {
            addErrorMessage('Error', statusCode + ':' + resp);
        }
    }

    onSelect() {
        // check file type (the last in the list)
        // use the file list of uploader instead of the file list given in the event so we can add/remove to it.
        const files: File[] = this.uploader.files;
        const file: File = files.pop();
        if (this.accepted_types.indexOf(file.type) === -1) {
            this.messages = [];
            this.messages.push({
                severity: 'info',
                summary: 'Wrong file type',
                detail: 'It must be an Excel (.xlsx) or a csv file.'
            });
        } else {
            // put back the file in the list
            files.push(file);
        }
    }
}

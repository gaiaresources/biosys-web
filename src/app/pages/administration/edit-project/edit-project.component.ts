import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';

import { from, forkJoin } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ConfirmationService, MessageService, SelectItem } from 'primeng/api';

import {
    APIError, User, Project, Site, Dataset, ModelChoice, Program, ProjectMedia, Media
} from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { AuthService } from '../../../../biosys-core/services/auth.service';

import { environment } from '../../../../environments/environment';

import { FeatureMapComponent } from '../../../shared/featuremap/featuremap.component';
import { formatUserFullName } from '../../../../biosys-core/utils/functions';
import { MediaManagerComponent } from '../../../shared/media-manager/media-manager.component';


@Component({
    selector: 'biosys-edit-project',
    templateUrl: 'edit-project.component.html',
})

export class EditProjectComponent implements OnInit {
    public static DEFAULT_TIMEZONE = 'Australia/Perth';

    private static COLUMN_WIDTH = 240;
    private static FIXED_COLUMNS_TOTAL_WIDTH = 700;

    @ViewChild(FeatureMapComponent)
    public featureMapComponent: FeatureMapComponent;

    @ViewChild(MediaManagerComponent)
    public mediaManagerComponent: MediaManagerComponent;

    public TEMPLATE_LATLNG_URL: string = environment.server + '/download/templates/site/lat-long';
    public TEMPLATE_EASTNORTH_URL: string = environment.server + '/download/templates/site/easting-northing';
    public selectedSites: Site[] = [];
    public flatSites: any[];
    public siteAttributeKeys: string[] = [];
    public breadcrumbItems: any = [];
    public project: Project = <Project> {
        timezone: EditProjectComponent.DEFAULT_TIMEZONE,
        custodians: []
    };
    public datasets: Dataset[];
    public isEditing: boolean;
    public programChoices: SelectItem[];
    public datumTypeChoices: SelectItem[];
    public custodianChoices: SelectItem[];
    public projectErrors: any = {};
    public projectMedia: ProjectMedia[] = [];
    public isUploadingMedia = false;
    public user: User;

    constructor(private apiService: APIService, private authService: AuthService,
                private router: Router, private route: ActivatedRoute,
                private confirmationService: ConfirmationService, private messageService: MessageService,
                private sanitizer: DomSanitizer) {
    }

    ngOnInit() {
        const params = this.route.snapshot.params;

        this.isEditing = !('projId' in params);

        if (!this.isEditing) {
            this.apiService.getProjectById(+params['projId']).subscribe(
                (project: Project) => {
                    this.project = project;
                    this.breadcrumbItems.push({label: this.project.name});
                },
                (error: APIError) => console.log('error.msg', error.msg)
            );

            this.apiService.getAllDatasetsForProjectID(+params['projId']).subscribe(
                (datasets: Dataset[]) => this.datasets = datasets,
                (error: APIError) => console.log('error.msg', error.msg)
            );

            this.apiService.getAllSitesForProjectID(+params['projId']).subscribe(
                (sites: Site[]) => {
                    this.flatSites = this.formatFlatSites(sites);
                    this.siteAttributeKeys = sites.length > 0 ? this.extractSiteAttributeKeys(sites[0]) : [];
                },
                (error: APIError) => console.log('error.msg', error.msg)
            );

            this.apiService.getProjectMedia(+params['projId']).subscribe(
                (projectMedia: ProjectMedia[]) => this.projectMedia = projectMedia
            );
        }

        // fetch authorized program list
        forkJoin([this.authService.getCurrentUser(), this.apiService.getPrograms()])
            .subscribe((data) => {
                this.user = data[0];
                const allPrograms = data[1];
                let allowedPrograms;
                if (this.user.is_admin) {
                    allowedPrograms = allPrograms;
                } else {
                    allowedPrograms = allPrograms.filter((p: Program) => p.data_engineers.includes(this.user.id));
                }
                this.programChoices = allowedPrograms.map((program: Program) => ({
                    label: program.name,
                    value: program.id
                }));
                // initial value of program
                if (this.programChoices.length > 0 ) {
                    this.project.program = this.project.program || this.programChoices[0].value;
                }
            });

        this.apiService.getModelChoices('project', 'datum')
            .subscribe(
                (choices: ModelChoice[]) => this.datumTypeChoices = choices.map((choice: ModelChoice) => ({
                        label: choice.display_name,
                        value: choice.value
                    })
                ),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.apiService.getUsers()
            .subscribe(
                (users: User[]) => this.custodianChoices = users.map((user: User) => ({
                        label: formatUserFullName(user),
                        value: user.id
                    })
                ),
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.breadcrumbItems = [
            {label: 'Administration - Projects', routerLink: ['/administration/projects']},
        ];

        if (this.isEditing) {
            this.breadcrumbItems.push({label: 'Create Project'});

            // add self to selected custodians if creating project
            this.apiService.whoAmI().subscribe(
                (user: User) => this.project.custodians.push(user.id),
                (error: APIError) => console.log('error.msg', error.msg)
            );
        }
    }

    public getProgramLabel(value: number): string {
        if (!value || !this.programChoices) {
            return '';
        }

        return this.programChoices.filter(choice => choice.value === value).pop().label;
    }

    public getDatumLabel(value: string): string {
        if (!this.datumTypeChoices) {
            return '';
        }

        return this.datumTypeChoices.filter(choice => choice.value === value).pop().label;
    }

    public getSiteTableWidth(): any {
        if (!this.siteAttributeKeys.length) {
            return this.sanitizer.bypassSecurityTrustStyle('100%');
        }

        const width = EditProjectComponent.FIXED_COLUMNS_TOTAL_WIDTH +
            this.siteAttributeKeys.length * EditProjectComponent.COLUMN_WIDTH;

        return this.sanitizer.bypassSecurityTrustStyle(`${width}px`);
    }

    public formatSitePopup(site: Site): string {
        let popupContent: string = '<p class="m-0"><strong>' + (site.name ? site.name : site.code) + '</strong></p>';
        if (site.description) {
            popupContent += '<p class="mt-1">' + site.description + '</p>';
        }

        const projId = this.project.id ? this.project.id : Number(this.route.snapshot.params['id']);

        if (projId) {
            popupContent += '<p class="mt-1"><a href="/administration/projects/edit-project/' + projId + '/edit-site/' +
                site.id + '">Edit Site</a></p>';
        }

        return popupContent;
    }

    public getSelectedCustodiansLabel(custodians: number[]): string {
        if (!this.custodianChoices || !custodians || !custodians.length) {
            return '';
        }

        return this.custodianChoices.filter(c =>
            custodians.indexOf(c.value) > -1).map(c => c.label).reduce((a, b) => a + '; ' + b);
    }

    public saveProject() {
        this.project.geometry = this.featureMapComponent.getFeatureGeometry();

        if (this.project.id) {
            this.apiService.updateProject(this.project).subscribe(
                (project: Project) => {
                    this.project = project;
                    this.projectErrors = {};
                    this.isEditing = false;
                },
                (errors: APIError) => this.projectErrors = errors.msg,
            );
        } else {
            this.apiService.createProject(this.project).subscribe(
                (project: Project) => {
                    this.project = project;
                    this.breadcrumbItems.pop();
                    this.breadcrumbItems.push({label: 'Edit ' + this.project.name});
                    this.projectErrors = {};
                    this.isEditing = false;
                    // The next two lines are for stopping the spinner on datasets and sites tables
                    this.datasets = [];
                    this.flatSites = [];
                },
                (errors: APIError) => this.projectErrors = errors.msg
            );
        }
    }

    public editProject() {
        this.isEditing = true;
    }

    public cancelEditProject() {
        this.apiService.getProjectById(this.project.id).subscribe(
            (project: Project) => this.project = project,
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.isEditing = false;
    }

    public confirmDeleteDataset(dataset: Dataset) {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete this dataset?',
            accept: () => {
                this.apiService.deleteDataset(dataset.id)
                    .subscribe(
                        () => this.onDeleteDatasetSuccess(),
                        (error: APIError) => this.onDeleteDatasetError(error)
                    );
            }
        });
    }

    public confirmDeleteSelectedSites() {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete all selected sites?',
            accept: () => {
                this.apiService.deleteSites(this.project.id, this.selectedSites.map((site: Site) => site.id))
                    .subscribe(
                        () => this.onDeleteSitesSuccess(),
                        (error: APIError) => this.onDeleteSiteError(error)
                    );
            }
        });
    }

    private onDeleteDatasetSuccess() {
        this.datasets = null;
        this.apiService.getAllDatasetsForProjectID(this.project.id).subscribe(
            (datasets: Dataset[]) => this.datasets = datasets,
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.messageService.add({
            severity: 'success',
            summary: 'Dataset deleted',
            detail: 'The dataset was deleted',
            key: 'mainToast'
        });
    }

    private onDeleteDatasetError(error: APIError) {
        this.messageService.add({
            severity: 'error',
            summary: 'Dataset delete error',
            detail: 'There were error(s) deleting the dataset: ' + error.msg,
            key: 'mainToast'
        });
    }

    private extractSiteAttributeKeys(site: Site): string[] {
        // For now just use attributes for first site in array as all sites *should* have the same
        // attributes. In future use site schema associated with project.
        return site ? Object.keys(site.attributes) : [];
    }

    private formatFlatSites(sites: Site[]): any[] {
        return sites.map((s: Site) => Object.assign({
            id: s.id,
            code: s.code,
            name: s.name,
            description: s.description,
            centroid: s.centroid
        }, s.attributes));
    }

    private onDeleteSitesSuccess() {
        this.flatSites = null;
        this.apiService.getAllSitesForProjectID(this.project.id).subscribe(
            (sites: Site[]) => {
                this.flatSites = this.formatFlatSites(sites);
                this.siteAttributeKeys = sites.length > 0 ? this.extractSiteAttributeKeys(sites[0]) : [];
            },
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.messageService.add({
            severity: 'success',
            summary: 'Site(s) deleted',
            detail: 'The site(s) was deleted',
            key: 'mainToast'
        });
    }

    private onDeleteSiteError(error: APIError) {
        this.messageService.add({
            severity: 'error',
            summary: 'Site delete error',
            detail: 'There were error(s) deleting the site(s): ' + error.msg,
            key: 'mainToast'
        });
    }

    public onUploadMedia(files: File[]) {
        this.isUploadingMedia = true;
        from(files).pipe(
            mergeMap((file: any) => this.apiService.uploadProjectMediaBinary(this.project.id, file))
        ).subscribe(
            (pm: ProjectMedia) => {
                this.projectMedia.push(pm);
                this.messageService.add({
                    severity: 'success',
                    summary: 'File Attachment Uploaded',
                    detail: `The file ${pm.file.substring(pm.file.lastIndexOf('/') + 1)} was uploaded`,
                    key: 'mainToast'
                });
            },
            (error: APIError) => {
                this.isUploadingMedia = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error Uploading File Attachment',
                    detail: error.msg as string,
                    key: 'mainToast'
                });
            },
            () => this.isUploadingMedia = false
        );
    }

    public onDeleteMedia(media: Media) {
        this.confirmationService.confirm({
            message: `Are you sure that you want to delete the file ${media.file.substring(media.file.lastIndexOf('/') + 1)}`,
            accept: () => this.apiService.deleteProjectMedia(this.project.id, media.id).subscribe(
                () => {
                    this.projectMedia.splice(this.projectMedia.map(
                        (pm: ProjectMedia) => pm.id
                        ).indexOf(media.id), 1
                    );
                    this.mediaManagerComponent.refresh();
                    this.messageService.add({
                        severity: 'success',
                        summary: 'File Attachment Deleted',
                        detail: `The file ${media.file.substring(media.file.lastIndexOf('/') + 1)} was deleted`,
                        key: 'mainToast'
                    });
                },
                (error: APIError) => this.messageService.add({
                    severity: 'error',
                    summary: 'Error Deleting File Attachment',
                    detail: error.msg as string,
                    key: 'mainToast'
                })
            )
        });
    }
}

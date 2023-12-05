import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';

import { APIError, Project, Site } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';

import { FeatureMapComponent } from '../../../shared/featuremap/featuremap.component';

@Component({
    selector: 'biosys-edit-site',
    templateUrl: 'edit-site.component.html',
    styleUrls: [],
})

export class EditSiteComponent implements OnInit {
    public breadcrumbItems: any = [];

    @ViewChild(FeatureMapComponent, { static: true })
    public featureMapComponent: FeatureMapComponent;

    public site: Site = <Site>{};
    public siteErrors: any = {};
    public additionalAttributes: string[][] = [['', '']];

    private completeUrl: string;

    constructor(private apiService: APIService, private router: Router, private route: ActivatedRoute,
                private messageService: MessageService, private confirmationService: ConfirmationService) {
    }

    ngOnInit() {
        const params = this.route.snapshot.params;

        const projId: number = Number(params['projId']);

        this.apiService.getProjectById(projId)
        .subscribe(
            (project: Project) => this.breadcrumbItems.splice(1, 0, {
                label: project.name,
                routerLink: ['/administration/projects/edit-project/' + projId]
            }),
            (error: APIError) => console.log('error.msg', error.msg)
        );

        if ('id' in params) {
            this.apiService.getSiteById(Number(params['id'])).subscribe(
                (site: Site) => {
                    this.site = site;
                    if (this.site.attributes) {
                        this.additionalAttributes = Object.keys(this.site.attributes).map(
                            (k) => [k, this.site.attributes[k]]
                        );
                    }
                    this.breadcrumbItems.push({label: this.site.code ? this.site.code : this.site.name});
                },
                (error: APIError) => console.log('error.msg', error.msg),
            );
        } else {
            this.site.project = projId;
        }

        this.breadcrumbItems = [
            {label: 'Administration - Projects', routerLink: ['/administration/projects']},
        ];

        if (!('id' in params)) {
            this.breadcrumbItems.push({label: 'Create Site '});
        }

        this.completeUrl = '/administration/projects/edit-project/' + projId;
    }

    public addAdditionalAttribute() {
        this.additionalAttributes.push(['', '']);
    }

    public removeAdditionalAttribute(index: number) {
        this.additionalAttributes.splice(index, 1);
    }

    public save() {
        this.site.attributes = this.additionalAttributes.reduce((acc: any, cur: any) => {
                if (cur[0]) {
                    acc[cur[0]] = cur[1];
                }
                return acc;
            }, {}
        );

        this.site.geometry = this.featureMapComponent.getFeatureGeometry();

        if (this.site.id) {
            this.apiService.updateSite(this.site).subscribe(
                () => {
                    this.router.navigate([this.completeUrl]);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Site saved',
                        detail: 'The site was saved',
                        key: 'mainToast'
                    });
                },
                (errors: APIError) => this.siteErrors = errors.msg
            );
        } else {
            this.apiService.createSite(this.site).subscribe(
                () => {
                    this.router.navigate([this.completeUrl]);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Site created',
                        detail: 'The site was created',
                        key: 'mainToast'
                    });
                },
                (errors: APIError) => this.siteErrors = errors.msg
            );
        }
    }

    public cancel() {
        this.router.navigate([this.completeUrl]);
    }

    public confirmDelete() {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete this site?',
            accept: () => this.apiService.deleteSite(this.site.id).subscribe(
                () => this.onDeleteSuccess(),
                (error: APIError) => this.onDeleteError(error))
        });
    }

    private onDeleteSuccess() {
        this.router.navigate([this.completeUrl]);
        this.messageService.add({
            severity: 'success',
            summary: 'Site deleted',
            detail: 'The site was deleted',
            key: 'mainToast'
        });
    }

    private onDeleteError(error: APIError) {
        this.messageService.add({
            severity: 'error',
            summary: 'Site delete error',
            detail: `There were error(s) deleting the site: ${error.msg}`,
            key: 'mainToast'
        });
    }
}

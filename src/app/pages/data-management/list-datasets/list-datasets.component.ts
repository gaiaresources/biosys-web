import { Component, OnInit } from '@angular/core';
import { APIError, Project, Dataset } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';

import { Router, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'biosys-data-dataset-list',
    templateUrl: 'list-datasets.component.html',
    styleUrls: [],
})

export class ListDatasetsComponent implements OnInit {
    public breadcrumbItems: any = [];
    public project: Project;
    public datasets: Dataset[] = [];

    constructor(private apiService: APIService, private router: Router, private route: ActivatedRoute) {
    }

    ngOnInit() {
        const params = this.route.snapshot.params;

        const projId: number = Number(params['projId']);

        this.apiService.getProjectById(projId)
            .subscribe(
                (project: Project) => {
                    this.project = project;
                    this.breadcrumbItems.push({label: this.project.name});
                },
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.apiService.getAllDatasetsForProjectID(projId)
            .subscribe(
                (datasets: Dataset[]) => this.datasets = datasets,
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.breadcrumbItems = [
            {label: 'Data Management - Projects', routerLink: ['/data-management/projects']},
        ];
    }
}

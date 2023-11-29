import { Component, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

import { LazyLoadEvent, MessageService, SelectItem } from 'primeng/api';
import { Table } from 'primeng/table';
import * as moment from 'moment/moment';
import { saveAs } from 'file-saver';
import { mergeMap } from 'rxjs/operators';
import { from, forkJoin } from 'rxjs';

import { APIError, Dataset, Record, RecordResponse, User } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { DATASET_TYPE_MAP } from '../../../../biosys-core/utils/consts';
import { AuthService } from '../../../../biosys-core/services/auth.service';
import { Observable } from 'rxjs/internal/Observable';


@Component({
    selector: 'biosys-data-project-list',
    templateUrl: 'view-records.component.html',
    styleUrls: ['view-records.component.css'],
})

export class ViewRecordsComponent implements OnInit {
    private static COLUMN_WIDTH = 240;
    private static CHAR_LENGTH_MULTIPLIER = 8;
    private static PADDING = 50;

    public DATASET_TYPE_MAP: any = DATASET_TYPE_MAP;
    public breadcrumbItems: any = [];
    public projectDropdownItems: SelectItem[] = [{label: 'All Projects', value: null}];
    public projectsMap: any = {};
    public speciesDropdownItems: SelectItem[] = [{label: 'All Species', value: null}];

    public datasets: Dataset[];
    public records: Record[];
    public recordsTableColumnWidths: { [key: string]: number } = {};
    public totalRecords = 0;
    public selectedDataset: Dataset;

    public projectId: number;
    public dateStart: Date;
    public dateEnd: Date;
    public validatedOnly = true;
    public includeLocked = false;
    public speciesName: string;
    public fileType = 'csv';

    public canChangeLockedState = false;
    public lockRecordsOnExport = false;
    public isLocking = false;

    private recordParams: any = {};

    @ViewChild('recordsTable')
    public table: Table;

    constructor(private apiService: APIService, private authService: AuthService,
                private messageService: MessageService, private sanitizer: DomSanitizer) {
    }

    ngOnInit() {
        // projects and datasets
        forkJoin([
            this.apiService.getProjects(),
            this.apiService.getDatasets()
        ]).subscribe(
            (data: any) => {
                const projects = data[0];
                this.datasets = data[1];
                projects.forEach(project => this.projectsMap[project.id] = project.name);
                this.addProjectNameToDatasets();
                this.projectDropdownItems = this.projectDropdownItems.concat(
                    projects.map(project => ({
                        'label': project.name,
                        'value': project.id
                    }))
                );
            },
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.apiService.getSpecies().subscribe(
            (species: string[]) => this.speciesDropdownItems =
                this.speciesDropdownItems.concat(species.map(s => ({'label': s, 'value': s}))),
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.authService.getCurrentUser().subscribe(
            (user: User) => {
                this.canChangeLockedState = user.is_admin || user.is_data_engineer;
            }
        );

        this.breadcrumbItems = [
            {label: 'View and Export Records'},
        ];
    }

    public filter() {
        this.records = null;

        const datasetParams: any = {};
        this.recordParams = {};

        if (this.projectId) {
            datasetParams['project'] = this.projectId;
        }

        if (this.dateStart) {
            datasetParams['record__datetime__gte'] = this.recordParams['datetime__gte'] =
                this.dateStart.toISOString();
        }

        if (this.dateEnd) {
            // set time to 23h59m59s to include the whole day in search
            this.dateEnd.setHours(23, 59, 59);
            datasetParams['record__datetime__lte'] = this.recordParams['datetime__lte'] =
                this.dateEnd.toISOString();
        }

        if (this.validatedOnly) {
            datasetParams['record__validated'] = this.recordParams['validated'] = true;
        }

        if (!this.includeLocked) {
            datasetParams['record__locked'] = this.recordParams['locked'] = false;
        }

        if (this.speciesName) {
            datasetParams['record__species_name'] = this.recordParams['species_name'] = this.speciesName;
        }

        this.apiService.getDatasets(datasetParams).subscribe(
            (datasets: Dataset[]) => {
                this.datasets = datasets;
                this.addProjectNameToDatasets();
            },
            (error: APIError) => console.log('error.msg', error.msg)
        );

        if (this.selectedDataset) {
            this.recordParams['dataset__id'] = this.selectedDataset.id;
            if (this.table) {
                this.table.clear();
            }
        }
    }

    public selectDataset() {
        this.filter();
    }

    public reset() {
        this.projectId = null;
        this.dateStart = null;
        this.dateEnd = null;
        this.speciesName = null;

        this.filter();
    }

    public loadRecordsLazy(event: LazyLoadEvent) {
        const params = JSON.parse(JSON.stringify(this.recordParams));

        if (event.first !== undefined && event.first > -1) {
            params['offset'] = event.first;
        }
        if (event.rows) {
            params['limit'] = event.rows;
        }
        if (event.sortField) {
            params['ordering'] = (event.sortOrder && event.sortOrder < 0) ? '-' + event.sortField : event.sortField;
        }

        if (this.dateStart) {
            params['datetime__gte'] = this.dateStart.toISOString();
        }

        if (this.dateEnd) {
            params['datetime__lte'] = this.dateEnd.toISOString();
        }

        if (this.speciesName) {
            params['record__species_name'] = this.speciesName;
        }

        this.apiService.getRecordsByDatasetId(this.selectedDataset.id, params)
            .subscribe(
                (data: RecordResponse) => {
                    this.records = data.results;
                    this.totalRecords = data.count;
                    this.recordsTableColumnWidths = {};
                },
                (error: APIError) => console.log('error.msg', error.msg)
            );
    }

    public export() {
        const exportObservable: Observable<object> = this.apiService.exportRecords(this.dateStart, this.dateEnd,
            this.speciesName, this.selectedDataset.id, this.fileType, this.validatedOnly, this.includeLocked);

        const saveBlob = function (blob: Blob) {
            const timeStamp = moment().format('YYYY-MM-DD-HHmmss');
            const extension = this.fileType;
            const fileName = `export_${timeStamp}.${extension}`;
            saveAs(blob, fileName);
        }.bind(this);

        if (this.lockRecordsOnExport) {
            const lockingObservalble = this.apiService.getRecordsByDatasetId(this.selectedDataset.id,
                JSON.parse(JSON.stringify(this.recordParams))).pipe(
                mergeMap((records: Record[]) => from(records).pipe(
                    mergeMap((record: Record) => this.apiService.updateRecordLocked(record.id, true))
                ))
            );

            this.isLocking = true;

            forkJoin([exportObservable, lockingObservalble]).subscribe(
                (results: [Blob, any]) => saveBlob(results[0]),
                (error: APIError) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Export error',
                        detail: `There were error(s) when exporting / locking: ${error.msg}`,
                        key: 'mainToast'
                    });
                    this.isLocking = false;
                },
                () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Export success',
                        detail: `There records were successfully exported and have now been locked`,
                        key: 'mainToast'
                    });

                    this.isLocking = false;
                    this.filter();
                }
            );
        } else {
            exportObservable.subscribe(
                (blob: Blob) => saveBlob(blob),
                (error: APIError) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Export error',
                        detail: `There were error(s) when exporting: ${error.msg}`,
                        key: 'mainToast'
                    });
                }
            );
        }
    }

    public changeFilteredRecordsLockedState(locked: boolean) {
        const params = JSON.parse(JSON.stringify(this.recordParams));

        this.isLocking = true;
        this.apiService.getRecordsByDatasetId(this.selectedDataset.id, params).pipe(
            // map((recordResponse: RecordResponse) => recordResponse.results),
            mergeMap((records: Record[]) => from(records).pipe(
                mergeMap((record: Record) => this.apiService.updateRecordLocked(record.id, locked))
            ))
        ).subscribe({
            error: (error: APIError) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Locking error',
                    detail: `There were error(s) when locking: ${error.msg}`,
                    key: 'mainToast'
                });
                this.isLocking = false;
            },
            complete: () => this.isLocking = false
        });
    }

    public getRecordsTableWidth(): SafeStyle {
        if (!Object.keys(this.recordsTableColumnWidths).length) {
            return this.sanitizer.bypassSecurityTrustStyle('100%');
        }

        const width = Object.keys(this.recordsTableColumnWidths)
            .map((key) => this.recordsTableColumnWidths[key])
            .reduce((a, b) => a + b);

        return this.sanitizer.bypassSecurityTrustStyle(`${width}px`);
    }

    public getRecordsTableColumnWidth(fieldName: string): SafeStyle {
        let width: number;

        if (!this.records || !this.records.length) {
            width = ViewRecordsComponent.COLUMN_WIDTH;
        } else {
            if (!(fieldName in this.recordsTableColumnWidths)) {
                const maxCharacterLength = Math.max(fieldName.length,
                    this.records.map((r) => r.data[fieldName] ? r.data[fieldName].length : 0)
                        .reduce((a, b) => Math.max(a, b)));

                this.recordsTableColumnWidths[fieldName] = maxCharacterLength *
                    ViewRecordsComponent.CHAR_LENGTH_MULTIPLIER + ViewRecordsComponent.PADDING;
            }

            width = this.recordsTableColumnWidths[fieldName];
        }

        return this.sanitizer.bypassSecurityTrustStyle(`${width}px`);
    }

    private addProjectNameToDatasets(): void {
        if (this.datasets && this.projectsMap) {
            this.datasets.forEach(dataset => dataset['projectName'] = this.projectsMap[dataset.project] || '');
        }
    }
}

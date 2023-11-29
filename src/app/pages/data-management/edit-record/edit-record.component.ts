import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { ConfirmationService, SelectItem, MessageService } from 'primeng/api';
import { FileUpload } from 'primeng/fileupload';
import { forkJoin, from, Observable, of } from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';

import * as GeoJSON from 'geojson';
import * as moment from 'moment/moment';

import { APIError, Project, Dataset, Record, RecordMedia } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { pyDateFormatToMomentDateFormat } from '../../../../biosys-core/utils/functions';
import { AMBIGUOUS_DATE_PATTERN } from '../../../../biosys-core/utils/consts';
import { getDefaultValue } from '../../../shared/utils/functions';
import { getExtentFromPoint } from '../../../shared/utils/maputils';


@Component({
    selector: 'biosys-data-edit-record',
    templateUrl: 'edit-record.component.html'
})

export class EditRecordComponent implements OnInit {
    public breadcrumbItems: any = [];
    public recordErrors: any = {};
    public dropdownItems: any = {};

    public record: Record;
    public extent: GeoJSON.BBox;
    public dataset: Dataset;
    public childDataset: Dataset;
    public imagesMetadata: object[] = [];
    public parentRecordId: number;

    @ViewChild(FileUpload)
    public imageUploader;

    private completeUrl: string;

    constructor(private apiService: APIService, private router: Router, private route: ActivatedRoute,
                private confirmationService: ConfirmationService, private messageService: MessageService) {
        this.breadcrumbItems = [
            {label: 'Data Management - Projects', routerLink: ['/data-management/projects']},
        ];
    }

    ngOnInit() {
        const params = this.route.snapshot.params;

        this.parentRecordId = +params['parentRecordId'];

        const projectObservable: Observable<Project> = this.apiService.getProjectById(+params['projId']);
        const datasetObservable: Observable<Dataset> = this.apiService.getDatasetById(+params['datasetId']);

        let recordObservable: Observable<Record>;
        if (params.hasOwnProperty('recordId')) {
            // fetching the record will also fetch its attached media and child dataset (if there are children)
            recordObservable = this.apiService.getRecordById(+params['recordId']).pipe(
                // get record media
                mergeMap((record: Record) =>
                    this.apiService.getRecordMedia(record.id).pipe(
                        tap((media: RecordMedia[]) => this.imagesMetadata = media.map((image: RecordMedia) => ({
                                source: image.file,
                                alt: image.file.substring(image.file.lastIndexOf('/') + 1),
                                title: image.file.substring(image.file.lastIndexOf('/') + 1)
                            }))
                        ),
                        // with resultSelect deprecated, need to return record via map
                        map((media: RecordMedia[]) => record)
                    )
                ),
                // get record children
                mergeMap((record: Record) => {
                    if (record.children && record.children.length) {
                        return this.apiService.getRecordById(record.children[0]).pipe(
                            mergeMap((childRecord: Record) => this.apiService.getDatasetById(childRecord.dataset)),
                            tap((childDataset: Dataset) => this.childDataset = childDataset),
                            // with resultSelect deprecated, need to return record via map
                            map((childDataset: Dataset) => record)
                        );
                    } else {
                        return of(record);
                    }
                })
            );
        } else {
            recordObservable = of(<Record>{
                dataset: +params['datasetId']
            });
        }

        forkJoin([projectObservable, datasetObservable, recordObservable]).subscribe(
            (result: [Project, Dataset, Record]) => {
                const project = result[0];
                const dataset = result[1];
                const record = result[2];

                this.breadcrumbItems.push({
                        label: project.name,
                        routerLink: [`/data-management/projects/${project.id}/datasets`]
                    }, {
                        label: dataset.name,
                        routerLink: [`/data-management/projects/${project.id}/datasets/${dataset.id}`]
                    },
                    {label: record.id ? 'Edit Record' : 'Create Record'}
                );

                if (record.geometry) {
                    this.extent = getExtentFromPoint(record.geometry as GeoJSON.Point);
                } else if (dataset.extent) {
                    this.extent = dataset.extent;
                } else if (project.extent) {
                    this.extent = project.extent;
                }

                this.completeUrl = params['completeUrl'] || `/data-management/projects/${project.id}/datasets/${dataset.id}`;

                // if record is new, add blank data (potentially with default values)
                if (!record.id) {
                    const data: any = {};
                    for (const field of dataset.data_package.resources[0].schema.fields) {
                        data[field['name']] = getDefaultValue(field);
                    }

                    record.data = data;
                }

                this.dataset = dataset;
                this.record = this.formatRecord(record);
            }
        );
    }

    public getDropdownOptions(fieldName: string, options: string[]): SelectItem[] {
        if (!(fieldName in this.dropdownItems)) {
            this.dropdownItems[fieldName] = options.map(option => ({'label': option, 'value': option}));
        }

        return this.dropdownItems[fieldName];
    }

    public onFeatureMapGeometryChanged(geometry: GeoJSON.GeometryObject) {
        this.apiService.recordGeometryToData(this.dataset.id, geometry, this.record.data)
            .subscribe(
                (geometryAndData: any) => {
                    const recordCopy = JSON.parse(JSON.stringify(this.record));
                    recordCopy.data = geometryAndData.data;
                    recordCopy.geometry = geometryAndData.geometry;
                    this.extent = getExtentFromPoint(geometryAndData.geometry as GeoJSON.Point);
                    this.record = this.formatRecord(recordCopy);
                }
            );
    }

    public onInputChanged() {
        this.apiService.recordDataToGeometry(this.dataset.id, this.record.geometry, this.record.data)
            .subscribe(
                (geometryAndData: any) => {
                    const recordCopy = JSON.parse(JSON.stringify(this.record));
                    recordCopy.data = geometryAndData.data;
                    recordCopy.geometry = geometryAndData.geometry;
                    this.extent = getExtentFromPoint(geometryAndData.geometry as GeoJSON.Point);
                    this.record = this.formatRecord(recordCopy);
                }
            );
    }

    public save() {
        // need to use a copy because there may be Date objects within this.selectedRecord which are bound
        // to calendar elements which must remain dates
        const recordCopy = JSON.parse(JSON.stringify(this.record));

        // convert Date types back to string in field's specified format (or DD/MM/YYYY if unspecified)
        for (const field of this.dataset.data_package.resources[0].schema.fields) {
            if (field.type === 'date' && recordCopy.data[field.name]) {
                recordCopy.data[field.name] = moment(recordCopy.data[field.name]).format(pyDateFormatToMomentDateFormat(field.format));
            }
        }

        if ('id' in recordCopy) {
            this.apiService.updateRecord(recordCopy.id, recordCopy)
                .subscribe(
                    () => this.onSaveSuccess(),
                    (error: APIError) => this.onSaveError(error)
                );
        } else {
            this.apiService.createRecord(recordCopy)
                .subscribe(
                    () => this.onSaveSuccess(),
                    (error: APIError) => this.onSaveError(error)
                );
        }
    }

    public confirmDelete() {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete this record?',
            accept: () => this.apiService.deleteRecord(this.record.id).subscribe(
                () => this.onDeleteSuccess(),
                (error: APIError) => this.onDeleteError(error))
        });
    }

    public cancel() {
        this.router.navigate([this.completeUrl]);
    }

    public onUploadMedia(event: any) {
        // galleria component only runs change detection of images if the whole array is re-assigned (as opposed to just
        // appended to)
        const newImagesMetadata = JSON.parse(JSON.stringify(this.imagesMetadata));

        from(event.files).pipe(
            mergeMap((file: any) => this.apiService.uploadRecordMediaBinary(this.record.id, file))
        ).subscribe({
            next: (image: RecordMedia) => newImagesMetadata.push({
                source: image.file,
                alt: image.file.substring(image.file.lastIndexOf('/') + 1),
                title: image.file.substring(image.file.lastIndexOf('/') + 1)
            }),
            complete: () => {
                this.imageUploader.clear();
                this.imagesMetadata = newImagesMetadata;
            }
        });
    }

    private onSaveSuccess() {
        const isNewRecord = this.record.hasOwnProperty('id');

        this.messageService.add({
            severity: 'success',
            summary: `Record ${isNewRecord ? 'created' : 'updated'}`,
            detail: `The record was successfully ${isNewRecord ? 'created' : 'updated'}`,
            key: 'mainToast'
        });

        this.router.navigate([this.completeUrl, {'recordSaved': true}]);
    }

    private onSaveError(error: any) {
        this.recordErrors = error.msg.data.map((err: string) => err.split('::')).reduce((acc: any, cur: any) => {
                acc[cur[0]] = cur[1];
                return acc;
            },
            {}
        );

        this.messageService.add({
            severity: 'error',
            summary: 'Record save error',
            detail: 'There were error(s) saving the record',
            key: 'mainToast'
        });
    }

    private onDeleteSuccess() {
        this.router.navigate([this.completeUrl, {'recordDeleted': true}]);
    }

    private onDeleteError(error: APIError) {
        this.messageService.add({
            severity: 'error',
            summary: 'Record delete error',
            detail: `There were error(s) deleting the record: ${error.msg}`,
            key: 'mainToast'
        });
    }

    private formatRecord(record: Record) {
        // convert date fields to Date type because calendar element in form expects a Date
        for (const field of this.dataset.data_package.resources[0].schema.fields) {
            if (field.type === 'date' && record.data[field.name]) {
                // If date in DD?MM?YYYY format (where ? is any single char), convert to American (as Chrome, Firefox
                // and IE expect this when creating Date from a string
                let dateString: string = record.data[field.name];

                // use '-' rather than '_' in case '_' is used as the separator
                dateString = dateString.replace(/_/g, '-');

                const regexGroup: string[] = dateString.match(AMBIGUOUS_DATE_PATTERN);
                if (regexGroup) {
                    dateString = regexGroup[2] + '/' + regexGroup[1] + '/' + regexGroup[3];
                }
                record.data[field.name] = new Date(dateString);
            }
        }

        return record;
    }
}

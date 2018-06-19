import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { ConfirmationService, SelectItem, Message, FileUpload } from 'primeng/primeng';
import * as moment from 'moment/moment';

import { APIError, Project, Dataset, Record, Media } from '../../../../biosys-core/interfaces/api.interfaces';
import { APIService } from '../../../../biosys-core/services/api.service';
import { pyDateFormatToMomentDateFormat } from '../../../../biosys-core/utils/functions';
import { AMBIGUOUS_DATE_PATTERN } from '../../../../biosys-core/utils/consts';

import { DEFAULT_GROWL_LIFE } from '../../../shared/utils/consts';
import { from } from 'rxjs/observable/from';
import { mergeMap } from 'rxjs/operators';


@Component({
    moduleId: module.id,
    selector: 'biosys-data-edit-record',
    templateUrl: 'edit-record.component.html'
})

export class EditRecordComponent implements OnInit {
    public DEFAULT_GROWL_LIFE: number = DEFAULT_GROWL_LIFE;

    public breadcrumbItems: any = [];
    public messages: Message[] = [];
    public recordErrors: any = {};
    public dropdownItems: any = {};

    public record: Record;
    public dataset: Dataset;
    public childDataset: Dataset;
    public imagesMetadata: object[] = [];
    public parentRecordId: number;

    @ViewChild(FileUpload)
    public imageUploader;

    private completeUrl: string;

    constructor(private apiService: APIService, private router: Router, private route: ActivatedRoute,
                private confirmationService: ConfirmationService) {
    }

    ngOnInit() {
        let params = this.route.snapshot.params;

        let projId: number = Number(params['projId']);
        let datasetId: number = Number(params['datasetId']);
        this.parentRecordId = Number(params['parentRecordId']);
        this.completeUrl = params['completeUrl'];

        this.apiService.getProjectById(projId).subscribe(
            (project: Project) => this.breadcrumbItems.splice(1, 0, {
                label: project.name,
                routerLink: ['/data/projects/' + projId + '/datasets']
            }),
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.apiService.getDatasetById(datasetId).subscribe(
            (dataset: Dataset) => {
                this.dataset = dataset;
                this.breadcrumbItems.splice(1, 0, {
                    label: dataset.name,
                    routerLink: ['/data/projects/' + projId + '/datasets/' + datasetId]
                });

                if ('recordId' in params) {
                    const recordId = +params['recordId'];

                    // TODO: refactor inner subscriptions into mergeMap
                    this.apiService.getRecordById(recordId).subscribe(
                        (record: Record) => {
                            this.record = this.formatRecord(record);
                            if (record.children && record.children.length) {
                                this.apiService.getRecordById(record.children[0]).subscribe(
                                    (childRecord: Record) => this.apiService.getDatasetById(childRecord.dataset).
                                        subscribe((childDataset: Dataset) => this.childDataset = childDataset)
                                )
                            }
                        },
                        (error: APIError) => console.log('error.msg', error.msg)
                    );

                    this.apiService.getRecordMedia(recordId).subscribe(
                        (media: Media[]) => this.imagesMetadata = media.map((image: Media) => ({
                            source: image.file,
                            alt: image.file.substring(image.file.lastIndexOf('/') + 1),
                            title: image.file.substring(image.file.lastIndexOf('/') + 1)
                        }))
                    );
                } else {
                    let data: any = {};
                    for (let datum of this.dataset.data_package.resources[0].schema.fields) {
                        data[datum['name']] = '';
                    }

                    this.record = <Record> {
                        dataset: this.dataset.id,
                        data: data
                    };
                }
            },
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.breadcrumbItems = [
            {label: 'Enter Records - Projects', routerLink: ['/data/projects']},
            {label: 'recordId' in params ? 'Edit Record' : 'Create Record'}
        ];
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
                let recordCopy = JSON.parse(JSON.stringify(this.record));
                recordCopy.data = geometryAndData.data;
                recordCopy.geometry = geometryAndData.geometry;
                this.record = this.formatRecord(recordCopy);
            },
            (error: APIError) => {}
        );
    }

    public onInputChanged(event) {
        this.apiService.recordDataToGeometry(this.dataset.id, this.record.geometry, this.record.data)
        .subscribe(
            (geometryAndData: any) => {
                let recordCopy = JSON.parse(JSON.stringify(this.record));
                recordCopy.data = geometryAndData.data;
                recordCopy.geometry = geometryAndData.geometry;
                this.record = this.formatRecord(recordCopy);
            },
            (error: APIError) => {}
        );
    }

    public save(event: any) {
        // need to use a copy because there may be Date objects within this.selectedRecord which are bound
        // to calendar elements which must remain dates
        const recordCopy = JSON.parse(JSON.stringify(this.record));

        // convert Date types back to string in field's specified format (or DD/MM/YYYY if unspecified)
        for (let field of this.dataset.data_package.resources[0].schema.fields) {
            if (field.type === 'date' && recordCopy.data[field.name]) {
                recordCopy.data[field.name] = moment(recordCopy.data[field.name]).
                    format(pyDateFormatToMomentDateFormat(field.format));
            }
        }

        if ('id' in recordCopy) {
            this.apiService.updateRecord(recordCopy.id, recordCopy)
            .subscribe(
                (record: Record) => this.onSaveSuccess(record),
                (error: APIError) => this.onSaveError(error)
            );
        } else {
            this.apiService.createRecord(recordCopy)
            .subscribe(
                (record: Record) => this.onSaveSuccess(record),
                (error: APIError) => this.onSaveError(error)
            );
        }
    }

    public confirmDelete(event: any) {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete this record?',
            accept: () => this.apiService.deleteRecord(this.record.id).subscribe(
                (record: Record) => this.onDeleteSuccess(this.record),
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
            next: (image: Media) => newImagesMetadata.push({
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

    private onSaveSuccess(record: Record) {
        this.router.navigate([this.completeUrl, {'recordSaved': true}]);
    }

    private onSaveError(error: any) {
        this.recordErrors = error.msg.data.map((err: string) => err.split('::')).reduce((acc: any, cur: any) => {
                acc[cur[0]] = cur[1];
                return acc;
            },
            {}
        );

        this.messages.push({
            severity: 'error',
            summary: 'Record save error',
            detail: 'There were error(s) saving the record'
        });
    }

    private onDeleteSuccess(record: Record) {
        this.router.navigate([this.completeUrl, {'recordDeleted': true}]);
    }

    private onDeleteError(error: any) {
        this.messages.push({
            severity: 'error',
            summary: 'Record delete error',
            detail: 'There were error(s) deleting the record'
        });
    }

    private formatRecord(record: Record) {
        // convert date fields to Date type because calendar element in form expects a Date
        for (let field of this.dataset.data_package.resources[0].schema.fields) {
            if (field.type === 'date' && record.data[field.name]) {
                // If date in DD?MM?YYYY format (where ? is any single char), convert to American (as Chrome, Firefox
                // and IE expect this when creating Date from a string
                let dateString: string = record.data[field.name];

                // use '-' rather than '_' in case '_' is used as the separator
                dateString = dateString.replace(/_/g, '-');

                let regexGroup: string[] = dateString.match(AMBIGUOUS_DATE_PATTERN);
                if (regexGroup) {
                    dateString = regexGroup[2] + '/' + regexGroup[1] + '/' + regexGroup[3];
                }
                record.data[field.name] = new Date(dateString);
            }
        }

        return record;
    }
}

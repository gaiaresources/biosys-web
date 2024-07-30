import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { ConfirmationService, LazyLoadEvent, MessageService, SelectItem } from 'primeng/api';
import { Table } from 'primeng/table';
import * as moment from 'moment/moment';

import { APIError, Dataset, Record, RecordResponse, User } from '../../../biosys-core/interfaces/api.interfaces';
import { pyDateFormatToMomentDateFormat } from '../../../biosys-core/utils/functions';
import { APIService } from '../../../biosys-core/services/api.service';
import { AuthService } from '../../../biosys-core/services/auth.service';
import { AMBIGUOUS_DATE_PATTERN } from '../../../biosys-core/utils/consts';


@Component({
    selector: 'biosys-edit-records-table',
    templateUrl: './edit-records-table.component.html',
    styleUrls: ['./edit-records-table.component.css']
})
export class EditRecordsTableComponent {
    private static DATETIME_FORMAT = 'DD/MM/YYYY H:mm:ss';
    private static FIXED_COLUMNS_TOTAL_WIDTH = 1400;
    private static COLUMN_WIDTH = 240;
    private static CHAR_LENGTH_MULTIPLIER = 8;
    private static DATE_FIELD_FIXED_CHARACTER_COUNT = 8;
    private static PADDING = 70;

    public selectedRecords: object[];
    public recordsTableColumnWidths: { [key: string]: number } = {};
    public flatRecords: object[];
    public totalRecords = 0;
    public dropdownItems: any = {};
    public canChangeLockedState = false;

    @Input()
    public pageState: object;

    @Input()
    public set dataset(dataset: Dataset) {
        if (dataset) {
            this._dataset = dataset;

            if (sessionStorage.getItem('pageState' + this.dataset.id) !== null) {
                this.pageState = JSON.parse(sessionStorage.getItem('pageState' + this.dataset.id));
            }

            // force initial lazy load
            this.reloadRecords();
        }
    }

    @Input()
    public parentRecord: Record;

    @Output()
    public recordChanged = new EventEmitter<Record>();

    @Output()
    public recordsDeleted = new EventEmitter();

    @Output()
    public pageStateChange = new EventEmitter<object>();

    @ViewChild(Table)
    public recordsDatatable: Table;

    private _dataset: Dataset;
    private previousRowData: any;

    constructor(private apiService: APIService, private router: Router, private sanitizer: DomSanitizer,
                private confirmationService: ConfirmationService, authService: AuthService,
                private messageService: MessageService) {
        authService.getCurrentUser().subscribe(
            (user: User) => this.canChangeLockedState = user.is_admin || user.is_data_engineer
        );
    }

    public getEditRecordRoute(recordId) {
        const isChild = !!this.parentRecord;
        const endPoint = isChild ? 'child-record' : 'record';
        const datasetPath = `/data-management/projects/${this._dataset.project}/datasets/${this._dataset.id}`;
        const path = `${datasetPath}/${endPoint}/${recordId}`;
        const params = {};
        if (isChild) {
            params['parentRecordId'] = this.parentRecord.id;
        }
        let completeUrl = datasetPath;
        if (isChild) {
            // should point back to the edit parent url
            completeUrl = `/data-management/projects/${this._dataset.project}/datasets/${this.parentRecord.dataset}/record/
                ${this.parentRecord.id}`;
        }
        params['completeUrl'] = completeUrl;
        return [path, params];
    }

    public get dataset() {
        return this._dataset;
    }

    public checkColumnEditable(fieldName: string) {
        return (fieldName === 'Reason for Invalidation') ? false : true;
    }

    public reloadRecords() {
        // reload table page without resetting pagination/ordering/search params unlike reset()
        this.recordsDatatable.onLazyLoad.emit(this.recordsDatatable.createLazyLoadMetadata());
    }

    public loadRecordsLazy(event: LazyLoadEvent) {
        const params: object = {};

        if (event.first !== undefined && event.first > -1) {
            params['offset'] = event.first;
        }
        if (event.rows) {
            params['limit'] = event.rows;
        }
        if (event.sortField) {
            params['ordering'] = (event.sortOrder && event.sortOrder < 0) ? '-' + event.sortField : event.sortField;
        }
        if (event.globalFilter) {
            params['search'] = event.globalFilter;
        }

        if (this.parentRecord && this.parentRecord.children) {
            // Note: the server doesn't support the default query param serialization for an array (repeated key: &id__in=1&id__in=2...)
            // the server supports only comma separated list: &id__in=1,2,3
            params['id__in'] = this.parentRecord.children.join();
        }

        this.apiService.getRecordsByDatasetId(this._dataset.id, params)
            .subscribe(
                (data: RecordResponse) => {
                    this.flatRecords = this.formatFlatRecords(data.results);
                    this.totalRecords = data.count;
                    this.recordsTableColumnWidths = {};
                },
                (error: APIError) => console.log('error.msg', error.msg)
            );
    }

    public getFieldType(field: object): string {
        if (field['type'] === 'date' || field['type'] === 'datetime') {
            return 'datetime';
        } else if (field.hasOwnProperty('constraints') && field['constraints'].hasOwnProperty('enum')) {
            return 'select';
        } else {
            return 'text';
        }
    }

    public onPageChange(event) {
        this.pageState['rowOffset'] = event.first;
        this.pageState['rowLimit'] = event.rows;

        this.pageStateChange.emit(this.pageState);
    }

    public onRecordValidatedChanged(checked: boolean, id: number) {
        this.apiService.updateRecordValidated(id, checked).subscribe((record: Record) =>
            this.flatRecords.filter(
                (flatRecord: object) => flatRecord['_id'] === id)[0]['_validated'] = record.validated
        );
    }

    public onRecordLockedChanged(checked: boolean, id: number) {
        this.apiService.updateRecordLocked(id, checked).subscribe((record: Record) =>
            this.flatRecords.filter(
                (flatRecord: object) => flatRecord['_id'] === id)[0]['_locked'] = record.locked
        );
    }

    public onRowEditInit(event: any) {
        this.previousRowData = JSON.parse(JSON.stringify(event.data));
    }

    public onRowEditComplete(event: any) {
        const data: any = JSON.parse(JSON.stringify(event.data));
        const id: number = data._id;

        for (const key of ['_created', '_file_name', '_geometry', '_id', '_last_modified', '_row', '_validated', '_locked']) {
            delete data[key];
        }

        // convert Date types back to string in field's specified format (or DD/MM/YYYY if unspecified)
        for (const field of this._dataset.data_package.resources[0].schema.fields) {
            if ((field.type === 'date' || field.type === 'datetime') && data[field.name]) {
                data[field.name] = moment(data[field.name]).format(pyDateFormatToMomentDateFormat(field.format));
            }
        }

        this.apiService.updateRecordDataField(id, data, true).subscribe(
            (record: Record) => {
                this.recordChanged.emit(record);
            },
            () => {
                // revert data
                if (this.previousRowData) {
                    const flatRecord = this.flatRecords.filter((fr: object) => fr['_id'] === id)[0];
                    for (const prop in this.previousRowData) {
                        if (this.previousRowData.hasOwnProperty(prop)) {
                            flatRecord[prop] = this.previousRowData[prop];
                        }
                    }
                }
            }
        );
    }

    public getDropdownOptions(fieldName: string, options: string[]): SelectItem[] {
        if (!(fieldName in this.dropdownItems)) {
            this.dropdownItems[fieldName] = options.map(option => ({'label': option, 'value': option}));
        }

        return this.dropdownItems[fieldName];
    }

    public add() {
        this.router.navigate([`/data-management/projects/${this.dataset.project}/datasets/${this.dataset.id}/create-record/`]);
    }

    public confirmDeleteSelectedRecords() {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete selected records?',
            accept: () => {
                this.apiService.deleteRecords(this._dataset.id, this.selectedRecords.map(sr => sr['_id']))
                    .subscribe(
                        () => this.onDeleteRecordsSuccess(),
                        (error: APIError) => this.onDeleteRecordError(error)
                    );
            }
        });
    }

    public confirmDeleteAllRecords() {
        this.confirmationService.confirm({
            message: 'Are you sure that you want to delete all records for this dataset?',
            accept: () => this.apiService.deleteAllRecords(this._dataset.id).subscribe(
                () => this.onDeleteRecordsSuccess(),
                (error: APIError) => this.onDeleteRecordError(error)
            )
        });
    }

    public getRecordsTableWidth(): SafeStyle {
        if (!Object.keys(this.recordsTableColumnWidths).length) {
            return this.sanitizer.bypassSecurityTrustStyle('100%');
        }

        const width = Object.keys(this.recordsTableColumnWidths)
            .map((key) => this.recordsTableColumnWidths[key])
            .reduce((a, b) => a + b) + EditRecordsTableComponent.FIXED_COLUMNS_TOTAL_WIDTH;

        return this.sanitizer.bypassSecurityTrustStyle(`${width}px`);
    }

    public getRecordsTableColumnWidth(fieldName: string): SafeStyle {
        let width: number;

        if (!this.flatRecords || this.flatRecords.length === 0) {
            width = EditRecordsTableComponent.COLUMN_WIDTH;
        } else {
            if (!(fieldName in this.recordsTableColumnWidths)) {
                const maxCharacterLength = Math.max(fieldName.length,
                    this.flatRecords
                        .map((r) => r[fieldName] ? (r[fieldName] instanceof Date ?
                            EditRecordsTableComponent.DATE_FIELD_FIXED_CHARACTER_COUNT : r[fieldName].length) : 0)
                        .reduce((a, b) => Math.max(a, b)));

                this.recordsTableColumnWidths[fieldName] = maxCharacterLength *
                    EditRecordsTableComponent.CHAR_LENGTH_MULTIPLIER + EditRecordsTableComponent.PADDING;
            }

            width = this.recordsTableColumnWidths[fieldName];
        }

        return this.sanitizer.bypassSecurityTrustStyle(`${width}px`);
    }

    private formatFlatRecords(records: Record[]): object[] {
        const flatRecords = records.map((r: Record) => Object.assign({
            _id: r.id,
            _validated: r.validated,
            _locked: r.locked,
            _file_name: r.source_info ? r.source_info.file_name : 'Manually created',
            _row: r.source_info ? r.source_info.row : '',
            _created: moment(r.created).format(EditRecordsTableComponent.DATETIME_FORMAT),
            _last_modified: moment(r.last_modified).format(EditRecordsTableComponent.DATETIME_FORMAT),
            _geometry: r.geometry
        }, r.data));

        for (const field of this._dataset.data_package.resources[0].schema.fields) {
            if (field.type === 'date') {
                for (const record of flatRecords) {
                    // If date in DD?MM?YYYY format (where ? is any single char), convert to American
                    // (as Chrome, Firefox and IE expect this when creating Date from a string
                    let dateString: string = record[field.name];

                    // use '-' rather than '_' in case '_' is used as the separator
                    dateString = dateString.replace(/_/g, '-');

                    const regexGroup: string[] = dateString.match(AMBIGUOUS_DATE_PATTERN);
                    if (regexGroup) {
                        dateString = regexGroup[2] + '/' + regexGroup[1] + '/' + regexGroup[3];
                    }
                    record[field.name] = new Date(dateString);
                }
            }
        }

        return flatRecords;
    }

    private onDeleteRecordsSuccess() {
        // reload table page without resetting pagination/ordering/search params unlike reset()
        this.recordsDatatable.onLazyLoad.emit(this.recordsDatatable.createLazyLoadMetadata());

        this.recordsDeleted.emit();

        this.messageService.add({
            severity: 'success',
            summary: 'Record(s) deleted',
            detail: 'The record(s) was deleted',
            key: 'mainToast'
        });
    }

    private onDeleteRecordError(error: APIError) {
        this.messageService.add({
            severity: 'error',
            summary: 'Record delete error',
            detail: `There were error(s) deleting the site(s):  + ${error.msg}`,
            key: 'mainToast'
        });
    }
}

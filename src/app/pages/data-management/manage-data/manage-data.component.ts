import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import * as GeoJSON from 'geojson';
import 'leaflet.markercluster';
import '../../../../lib/leaflet.latlng-graticule';
import '../../../../lib/leaflet.loading';

import { APIService } from '../../../../biosys-core/services/api.service';
import { AuthService } from '../../../../biosys-core/services/auth.service';
import { APIError, Project, Dataset, Record } from '../../../../biosys-core/interfaces/api.interfaces';

import { FileUploaderComponent } from '../../../shared/fileuploader/file-uploader.component';
import {
    DEFAULT_CENTER, DEFAULT_MARKER_ICON, DEFAULT_ROW_LIMIT, DEFAULT_ZOOM, getDefaultBaseLayer, getGeometryBoundsFromExtent,
    getOverlayLayers
} from '../../../shared/utils/maputils';
import { EditRecordsTableComponent } from '../../../shared/edit-records-table/edit-records-table.component';

// https://stackoverflow.com/questions/69485778/new-typescript-version-does-not-include-window-navigator-mssaveblob
declare global {
    interface Navigator {
        msSaveBlob?: (blob: any, defaultName?: string) => boolean;
    }
}

@Component({
    moduleId: module.id,
    selector: 'biosys-data-dataset-list',
    templateUrl: 'manage-data.component.html',
    styleUrls: ['manage-data.component.css'],
})
export class ManageDataComponent implements OnInit, OnDestroy {
    @ViewChild(EditRecordsTableComponent)
    public editRecordsTableComponent: EditRecordsTableComponent;

    @ViewChild(FileUploaderComponent)
    public uploader: FileUploaderComponent;

    public breadcrumbItems: any = [];
    public projId: number;
    public datasetId: number;
    public dataset: Dataset;
    public uploadURL: string;
    public isUploading = false;
    public uploadCreateSites = false;
    public uploadDeleteExistingRecords = false;

    public pageState: any = {
        mapZoom: DEFAULT_ZOOM,
        mapPosition: DEFAULT_CENTER,
        rowOffset: 0,
        rowLimit: DEFAULT_ROW_LIMIT
    };

    private map: L.Map;
    private markers: L.MarkerClusterGroup;
    private loading: L.Loading;
    private markersByRecordId: object;

    constructor(private apiService: APIService, private  authService: AuthService, private router: Router,
                private route: ActivatedRoute, private messageService: MessageService) {
    }

    public ngOnInit() {
        const params = this.route.snapshot.params;

        this.projId = +params['projId'];
        this.datasetId = +params['datasetId'];

        forkJoin([this.apiService.getProjectById(this.projId), this.apiService.getDatasetById(this.datasetId)]).subscribe(
            (result: [Project, Dataset]) => {
                const project = result[0];
                this.dataset = result[1];

                this.breadcrumbItems.push({
                    label: project.name,
                    routerLink: ['/data-management/projects/' + this.projId + '/datasets']
                }, {
                    label: this.dataset.name
                });

                if (this.dataset.type !== 'generic') {
                    if (this.dataset.extent) {
                        this.initMap(getGeometryBoundsFromExtent(this.dataset.extent));
                    } else if (project.extent) {
                        this.initMap(getGeometryBoundsFromExtent(project.extent));
                    } else {
                        this.initMap();
                    }

                    this.loadRecordMarkers();
                }
            },
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.uploadURL = this.apiService.getRecordsUploadURL(this.datasetId);

        this.breadcrumbItems = [
            {label: 'Data Management - Projects', routerLink: '/data-management/projects'}
        ];

        if (params.hasOwnProperty('recordSaved')) {
            this.messageService.add({
                severity: 'success',
                summary: 'Record saved',
                detail: 'The record was saved',
                key: 'mainToast'
            });
        } else if (params.hasOwnProperty('recordDeleted')) {
            this.messageService.add({
                severity: 'success',
                summary: 'Record deleted',
                detail: 'The record was deleted',
                key: 'mainToast'
            });
        }
    }

    public ngOnDestroy() {
        if (this.map) {
            this.pageState.mapZoom = this.map.getZoom();
            this.pageState.mapPosition = this.map.getCenter();
            this.map.remove();
        }

        sessionStorage.setItem('pageState' + this.datasetId, JSON.stringify(this.pageState));
    }

    private initMap(bounds?: L.LatLngBounds) {
        let mapOptions = {
            layers: [getDefaultBaseLayer()]
        };

        // if there is no bounds from project, use default zoom / center
        if (!bounds) {
            mapOptions = Object.assign(mapOptions, {
                zoom: this.pageState.mapZoom,
                center: this.pageState.mapPosition
            });
        }

        this.map = L.map('map', mapOptions);

        if (bounds) {
            this.map.fitBounds(bounds);
        }

        this.markers = L.markerClusterGroup();
        this.markers.addTo(this.map);

        L.control.layers(null, getOverlayLayers()).addTo(this.map);

        L.control.mousePosition({emptyString: '', lngFirst: true, separator: ', '}).addTo(this.map);

        L.latlngGraticule().addTo(this.map);

        this.loading = L.loading({
            labelText: 'Loading Records'
        }).addTo(this.map);

        L.control.scale({imperial: false, position: 'bottomright'}).addTo(this.map);
    }

    private recordToLatLng(record: Record): L.LatLng {
        let result;
        if (record.geometry) {
            const coord: GeoJSON.Position = (record.geometry as GeoJSON.Point).coordinates as GeoJSON.Position;
            result = L.GeoJSON.coordsToLatLng([coord[0], coord[1]]);
        }
        return result;
    }

    private loadRecordMarkers() {
        if (this.dataset.type === 'generic') {
            return;
        }

        this.loading.start();

        this.apiService.getRecordsByDatasetId(this.datasetId, {fields: ['id', 'geometry']})
            .subscribe(
                (records: Record[]) => {
                    this.markers.clearLayers();
                    this.markersByRecordId = {};

                    for (const record of records) {
                        if (record.geometry) {
                            const marker: L.Marker = L.marker(this.recordToLatLng(record),
                                {icon: DEFAULT_MARKER_ICON});
                            const popupContent: string = '<p class="m-0">Record ID: <strong>' + record.id + '</strong></p>' +
                                '<p class="mt-1"><a href="/data-management/projects/' + this.projId + '/datasets/' + this.datasetId +
                                '/record/' + record.id + '">Edit Record</a></p>';

                            marker.bindPopup(popupContent);
                            marker.on('mouseover', function () {
                                this.openPopup();
                            });
                            this.markers.addLayer(marker);
                            this.markersByRecordId[record.id] = marker;
                        }
                    }
                },
                (error: APIError) => {
                    console.log('error.msg', error.msg);
                    this.loading.stop();
                },
                () => this.loading.stop()
            );
    }

    public onRecordChanged(record: Record) {
        const marker = this.markersByRecordId[record.id];
        marker.setLatLng(this.recordToLatLng(record));
        this.markers.refreshClusters([marker]);
    }

    public onRecordsDeleted() {
        this.loadRecordMarkers();
    }

    public onUpload(event: any) {
        this.parseAndDisplayResponse(event);
        this.isUploading = false;

        this.editRecordsTableComponent.reloadRecords();

        this.loadRecordMarkers();
    }

    public onBeforeUpload(event: any) {
        this.isUploading = true;
        event.formData.append('create_site', this.uploadCreateSites);
        event.formData.append('delete_previous', this.uploadDeleteExistingRecords);
    }

    public onUploadError(event: any) {
        if (event.error.status === 400) {
            this.parseAndDisplayResponse(event);
        } else {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: `${event.error.status}: ${event.error.message}`,
                key: 'uploadRecordsErrors'
            });
        }
        this.isUploading = false;

        this.editRecordsTableComponent.reloadRecords();

        this.loadRecordMarkers();
    }

    public onUploadSelect() {
        // check file type (the last in the list)
        // use the file list of uploader instead of the file list given in the event so we can add/remove to it.
        const files: File[] = this.uploader.files;
        let file: File = files.pop();
        // strangely on Windows the Blob.type (or file.type here) is empty
        // infer the mime type from the file extension
        if (!file.type) {
            const fileName = file.name;
            let type = 'text/csv'; // assume default
            if (fileName.toLowerCase().endsWith('.xlsx')) {
                type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            }
            // because the type is read-only we cannot set it, we need to create a new File
            // but wait! File constructor is not supported by IE11 and Edge.
            // https://developer.mozilla.org/en-US/docs/Web/API/File
            // Needs to use a pure Blob in this case
            if (typeof File === 'function') {
                file = new File([file], fileName, {type: type});
            } else {
                // but the Blob will not have a file name
                file = new Blob([file], {type: type}) as File;
                if (typeof window.navigator.msSaveBlob !== undefined) {
                    // Edge
                    // add file name?
                    // Taken from https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9551546/
                    window.navigator.msSaveBlob(file, fileName);
                }
            }
        }

        // put back the file in the list
        files.push(file);
    }

    private parseAndDisplayResponse(event: any) {
        let items = [];
        if (event.hasOwnProperty('originalEvent')) {
            items = event.originalEvent.body;
        } else if (event.hasOwnProperty('error')) {
            items = event.error.error;
        }

        const totalRecords = items.length;

        let totalErrors = 0;
        let totalWarnings = 0;

        const uploadErrorMessages = [];
        const uploadWarningMessages = [];

        for (const item of items) {
            if ('errors' in item) {
                for (const errorKey of Object.keys(item['errors'])) {
                    totalErrors += 1;
                    uploadErrorMessages.push({
                        severity: 'error',
                        summary: `Error for ${errorKey} in row ${item['row']}`,
                        detail: item['errors'][errorKey],
                        key: 'uploadRecordsErrors'
                    });
                }
            }
            if ('warnings' in item) {
                for (const warningKey of Object.keys(item['warnings'])) {
                    totalWarnings += 1;
                    uploadWarningMessages.push({
                        severity: 'warn',
                        summary: `Warning for ${warningKey} in row ${item['row']}`,
                        detail: item['warnings'][warningKey],
                        key: 'uploadRecordsWarnings'
                    });
                }
            }
        }

        if (totalErrors > 0) {
            this.messageService.addAll(uploadErrorMessages);

            this.messageService.add({
                severity: 'error',
                summary: 'Error uploading records',
                detail: `There were ${totalErrors} error(s) uploading the records file. See details below.`,
                key: 'mainToast'
            });
        } else if (totalWarnings > 0) {
            this.messageService.addAll(uploadWarningMessages);

            this.messageService.add({
                severity: 'warn',
                summary: 'Records uploaded with some warnings',
                detail: `The records were accepted but there were ${totalWarnings} warning(s). See details below.`,
                key: 'mainToast'
            });
        } else {
            this.messageService.add({
                severity: 'success',
                summary: 'Upload successful',
                detail: `${totalRecords} records were successfully uploaded`,
                key: 'mainToast'
            });
        }
    }
}

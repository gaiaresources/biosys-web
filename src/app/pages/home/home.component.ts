import { Component, OnDestroy, OnInit } from '@angular/core';

import { APIService } from '../../../biosys-core/services/api.service';

import { APIError, Project, Statistic, User } from '../../../biosys-core/interfaces/api.interfaces';

import {
    DEFAULT_CENTER, DEFAULT_MARKER_ICON, DEFAULT_ZOOM, getDefaultBaseLayer, getOverlayLayers
} from '../../shared/utils/maputils';

import * as L from 'leaflet';
import * as GeoJSON from 'geojson';
import 'leaflet-mouse-position';
import '../../../lib/leaflet.latlng-graticule';
import { AuthService } from '../../../biosys-core/services/auth.service';

/**
 * This class represents the lazy loaded HomeComponent.
 */
@Component({
    selector: 'biosys-home',
    templateUrl: 'home.component.html',
    styleUrls: ['home.component.css'],
})

export class HomeComponent implements OnInit, OnDestroy {
    public projects: Project[];
    public statistic: Statistic;
    public user: User;

    private map: L.Map;

    constructor(private apiService: APIService, private authService: AuthService) {
        this.authService.getCurrentUser().subscribe((user: User) => {
            this.user = user;
        });
    }

    ngOnInit(): void {
        this.apiService.getProjects().subscribe(
            (projects: Project[]) => {
                this.projects = projects;
                this.loadProjectMarkers();
            },
            (error: APIError) => console.log('error.msg', error.msg)
        );

        this.apiService.getStatistics()
            .subscribe(
                (statistic: Statistic) => this.statistic = statistic,
                (error: APIError) => console.log('error.msg', error.msg)
            );

        this.map = L.map('map', {
            zoom: DEFAULT_ZOOM,
            center: DEFAULT_CENTER,
            layers: [getDefaultBaseLayer()]
        });

        L.control.layers(null, getOverlayLayers()).addTo(this.map);

        L.control.mousePosition({emptyString: '', lngFirst: true, separator: ', '}).addTo(this.map);

        L.latlngGraticule().addTo(this.map);

        L.control.scale({imperial: false, position: 'bottomright'}).addTo(this.map);
    }

    ngOnDestroy(): void {
        this.map.remove();
    }

    public onMapReady(map: L.Map) {
        this.map = map;
    }

    private loadProjectMarkers() {
        for (const project of this.projects) {
            if (project.centroid) {
                const coord: GeoJSON.Position = project.centroid.coordinates as GeoJSON.Position;
                const marker: L.Marker = L.marker(L.GeoJSON.coordsToLatLng([coord[0], coord[1]]),
                    {icon: DEFAULT_MARKER_ICON});
                let popupContent: string = '<p class="m-0"><strong>' + project.name + '</strong></p>';
                if (project.description) {
                    popupContent += '<p class="mt-1 mb-0">' + project.description + '</p>';
                }
                if (this.user && project.custodians.indexOf(this.user.id) > -1) {
                    popupContent += '<p class="mt-1"><a href="/administration/projects/edit-project/' + project.id +
                        '">Project Details</a></p>';
                }
                marker.bindPopup(popupContent);
                marker.on('mouseover', function () {
                    this.openPopup();
                });
                marker.addTo(this.map);
            }
        }
    }
}

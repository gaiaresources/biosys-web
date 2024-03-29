import {
    OnInit, Component, Directive, ContentChildren, Input, Output, QueryList, OnChanges,
    EventEmitter, SimpleChange, OnDestroy
} from '@angular/core';
import {
    DEFAULT_CENTER,
    DEFAULT_MARKER_ICON,
    DEFAULT_ZOOM,
    getDefaultBaseLayer,
    getGeometryBoundsFromExtent,
    getOverlayLayers
} from '../utils/maputils';
import * as L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-mouse-position';
import '../../../lib/leaflet.latlng-graticule';

@Directive({
    selector: 'biosys-marker'
})
export class MarkerDirective {
    @Input() geometry: GeoJSON.Point;
    @Input() popupText: string;
}

@Component({
    selector: 'biosys-featuremap',
    templateUrl: 'featuremap.component.html',
    styleUrls: ['featuremap.component.css'],
})
export class FeatureMapComponent implements OnInit, OnChanges, OnDestroy {
    @Input() public drawFeatureTypes: string[] = [];
    @Input() public isEditing: boolean;
    @Input() public geometry: GeoJSON.Geometry;
    @Input() public bounds: GeoJSON.BBox;
    @Output() public geometryChanged =
        new EventEmitter<GeoJSON.Point | GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Polygon | GeoJSON.MultiPolygon>();

    @ContentChildren(MarkerDirective)
    set markers(markers: QueryList<MarkerDirective>) {
        markers.forEach((marker: MarkerDirective) => {
            if (marker.geometry) {
                const coord: GeoJSON.Position = marker.geometry.coordinates as GeoJSON.Position;
                const leafletMarker: L.Marker = L.marker(L.GeoJSON.coordsToLatLng([coord[0], coord[1]]),
                    {icon: this.extraMarkerIcon});
                leafletMarker.bindPopup(marker.popupText);
                leafletMarker.on('mouseover', function () {
                    this.openPopup();
                });
                this.map.addLayer(leafletMarker);
            }
        });
    }

    public layersControlOptions: any = {
        position: 'bottomleft'
    };

    private extraMarkerIcon: L.Icon = L.icon({
        iconUrl: 'assets/img/extra-marker-icon.png',
        shadowUrl: 'css/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    private drawOptions: any;

    private map: L.Map;
    private drawControl: L.Control.Draw;
    private drawnFeatures: L.FeatureGroup = L.featureGroup();
    private drawnFeatureType: string;

    private initialised: boolean;

    constructor() {
        this.initialised = false;
    }

    ngOnInit() {
        this.drawOptions = {
            position: 'bottomright',
            draw: {
                polyline: this.drawFeatureTypes.indexOf('LINE') > -1,
                polygon: this.drawFeatureTypes.indexOf('POLYGON') > -1,
                rectangle: this.drawFeatureTypes.indexOf('POLYGON') > -1,
                circle: false,
                marker: this.drawFeatureTypes.indexOf('POINT') > -1 ? {
                    icon: DEFAULT_MARKER_ICON
                } : false
            },
            edit: {
                featureGroup: this.drawnFeatures
            }
        };

        this.initialised = true;

        this.map = L.map('map', {
            zoom: DEFAULT_ZOOM,
            center: DEFAULT_CENTER,
            layers: [getDefaultBaseLayer()]
        });

        if (this.bounds) {
            this.map.fitBounds(getGeometryBoundsFromExtent(this.bounds));
        }

        L.control.layers(null, getOverlayLayers()).addTo(this.map);

        L.control.mousePosition({emptyString: '', lngFirst: true, separator: ', '}).addTo(this.map);

        L.latlngGraticule().addTo(this.map);

        L.control.scale({imperial: false, position: 'bottomright'}).addTo(this.map);

        this.map.addLayer(this.drawnFeatures);
        this.map.on('draw:created', (e: any) => this.onFeatureCreated(e));
        this.map.on('draw:edited', () => this.onFeatureEdited());

        this.drawControl = new L.Control.Draw(this.drawOptions);

        if (this.isEditing) {
            this.map.addControl(this.drawControl);
        }
    }

    ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
        if (changes['geometry']) {
            this.drawnFeatures.clearLayers();
            if (this.geometry) {
                if (this.geometry.type === 'LineString') {
                    const polyline: L.Polyline = L.polyline(L.GeoJSON.coordsToLatLngs(this.geometry.coordinates));
                    this.drawnFeatures.addLayer(polyline);
                    this.drawnFeatureType = 'polyline';
                } else if (this.geometry.type === 'Polygon') {
                    const coords: GeoJSON.Position[] = this.geometry.coordinates[0] as GeoJSON.Position[];
                    const polygon: L.Polygon = L.polygon(L.GeoJSON.coordsToLatLngs(coords));
                    this.drawnFeatures.addLayer(polygon);
                    this.drawnFeatureType = 'polygon';
                } else if (this.geometry.type === 'Point') {
                    const coord: GeoJSON.Position = this.geometry.coordinates as GeoJSON.Position;
                    const marker: L.Marker = L.marker(L.GeoJSON.coordsToLatLng([coord[0], coord[1]]),
                        {icon: DEFAULT_MARKER_ICON});
                    this.drawnFeatures.addLayer(marker);
                    this.drawnFeatureType = 'point';
                }
            }
        }

        if (changes['bounds']) {
            if (this.initialised) {
                if (this.bounds) {
                    this.map.fitBounds(getGeometryBoundsFromExtent(this.bounds));
                }
            }
        }

        if (changes['isEditing']) {
            if (this.initialised) {
                if (this.isEditing) {
                    this.map.addControl(this.drawControl);
                } else {
                    this.map.removeControl(this.drawControl);
                }
            }
        }
    }

    ngOnDestroy(): void {
        this.map.remove();
    }

    public getFeatureGeometry(): GeoJSON.Point | GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Polygon | GeoJSON.MultiPolygon {
        const geom: GeoJSON.Point | GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Polygon | GeoJSON.MultiPolygon = null;

        if (this.drawnFeatures.getLayers().length > 0) {
            if (this.drawnFeatureType === 'polygon' || this.drawnFeatureType === 'rectangle') {
                return (<L.Polygon>this.drawnFeatures.getLayers()[0]).toGeoJSON().geometry;
            } else if (this.drawnFeatureType === 'polyline') {
                return (<L.Polyline>this.drawnFeatures.getLayers()[0]).toGeoJSON().geometry;
            } else if (this.drawnFeatureType === 'marker' || this.drawnFeatureType === 'point') {
                return (<L.CircleMarker>this.drawnFeatures.getLayers()[0]).toGeoJSON().geometry;
            }
        }

        return geom;
    }

    private onFeatureCreated(e: any) {
        this.drawnFeatures.clearLayers();
        this.drawnFeatures.addLayer(e.layer);
        this.drawnFeatureType = e.layerType;

        this.geometryChanged.emit(this.getFeatureGeometry());
    }

    private onFeatureEdited() {
        this.geometryChanged.emit(this.getFeatureGeometry());
    }
}

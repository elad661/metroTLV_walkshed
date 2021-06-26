'use strict'
const LRT_NAMES = {
    /* needed because source data has hebrew names but RTL text often confuses vscode, so defining English consts helps */
    GREEN: "ירוק",
    RED: "אדום",
    PURPLE: "סגול",
    BROWN: "חום",
};
const BASE_LAYERS = {
    metro: {
        name_EN: "Metro",
        name_HE: "מטרו",
        sources: [
            {
                url: "data/tlv_metro_isochrones_unmerged.geojson",
                type: "unmerged_isochrones"
            },
            {
                url: "data/tlv_metro_lines.geojson",
                type: "lines",
                color_rules: {
                    property_name: "NAME",
                    M1: "#c48d55",
                    M2: "#14a6f1",
                    M3: "#fea2bb"
                }
            },
            {
                url: "data/tlv_metro_stations.geojson",
                type: "stations",
                color_rules: {
                    property_name: "LINE",
                    "M1-south": "#c48d55",
                    "M1-north": "#c48d55",
                    M2: "#14a6f1",
                    M3: "#fea2bb"
                }
            },
        ]
    },
    lrt: {
        // brown line is also part of the LRT layer
        name_EN: "LRT",
        name_HE: 'רק"ל',
        sources: [
            {
                url: "data/tlv_lrt_isochrones_unmerged.geojson",
                type: "unmerged_isochrones"
            },
            {
                url: "data/tlv_lrt_lines.geojson",
                type: "lines",
                color_rules: {
                    property_name: "NAME",
                    [LRT_NAMES.RED]: "#d63229",
                    [LRT_NAMES.GREEN]: "#35a56a",
                    [LRT_NAMES.PURPLE]: "#9f307d",
                    [LRT_NAMES.BROWN]: "#ae6322",
                }
            },
            {
                url: "data/tlv_lrt_stations.geojson",
                type: "stations",
                color_rules: {
                    property_name: "LINE",
                    [LRT_NAMES.RED]: "#d63229",
                    [LRT_NAMES.GREEN]: "#35a56a",
                    [LRT_NAMES.PURPLE]: "#9f307d",
                    [LRT_NAMES.BROWN]: "#ae6322",
                }

            },
        ]
    }
};
const MERGED_ISOCHRONE_LAYERS = {
    lrt: 'data/tlv_lrt_isochrones_merged.geojson',
    metro: 'data/tlv_metro_isochrones_merged.geojson',
    lrt_metro: 'data/tlv_metro_lrt_isochrones_merged.geojson',
    brown: 'data/tlv_brown_isochrones_merged.geojson',
    brown_lrt: 'data/tlv_lrt_brown_isochrones_merged.geojson',
    brown_lrt_metro: 'data/tlv_metro_lrt_brown_isochrones_merged.geojson',
    brown_metro: 'data/tlv_brown_metro_isochrones_merged.geojson'
};

const MAPBOX_TYPES = {
    unmerged_isochrones: "fill",
    stations: "circle",
    lines: "line",
};

class LayerManager {
    constructor(map) {
        this.map = map;
        this.enabledLayers = new Set(['lrt']);
        this._syncCheckboxState();
        this._loadLayers();
        this._registerEventHandlers();
    }

    _loadLayers() {
        Object.entries(MERGED_ISOCHRONE_LAYERS).forEach(([key, url]) => {
            const id = `${key}_merged_isochrones`;
            this.map.addSource(id, {
                type: 'geojson',
                data: url,
            });
            this.map.addLayer({
                id,
                type: 'fill',
                source: id,
                layout: {
                    visibility: this._getCurrentIsochroneLayer() === key ? 'visible' : 'none',
                },
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.4,
                },
            });
        });

        Object.entries(BASE_LAYERS).forEach(([key, layer]) => {
            layer.sources.forEach((source) => {
                const id = `${key}_${source.type}`;
                const sourceDef = {
                    type: 'geojson',
                    data: source.url,
                }
                if (source.type === 'stations') {
                    sourceDef.promoteId = 'OBJECTID';
                }
                this.map.addSource(id, sourceDef);
                const colorProp = source.type === 'lines' ? 'line-color' : 'circle-color';
                const colorMap = [];
                const paint = {}
                if (source.color_rules) {
                    Object.entries(source.color_rules).forEach(([key, value]) => { if (key != 'property_name') { colorMap.push(key, value); }})
                    paint[colorProp] =  ['match', ['string', ['get', source.color_rules.property_name]], ...colorMap, 'black'];
                }

                const layout = {
                    visibility: this.enabledLayers.has(key) ? 'visible' : 'none',
                };

                switch (source.type) {
                    case 'unmerged_isochrones':
                        paint['fill-opacity'] = 0;
                    break;
                    case 'lines':
                        paint['line-width'] = 2;
                        paint['line-opacity'] = 0.9;
                        break;
                    case 'stations':
                        paint['circle-stroke-width'] = [
                            'case',
                            ['boolean', ['feature-state', 'hover'], false],
                            3,
                            0
                        ];
                        break;
                }
                const layerProps = {
                    id,
                    type: MAPBOX_TYPES[source.type],
                    source: id,
                    minzoom: source.type === 'stations' ? 12 : 0,
                    layout,
                    paint,
                };
                if (key === 'lrt') {
                    layerProps.filter = this._getBrownLineFilter(source.type);
                }
                this.map.addLayer(layerProps);
            });
        });
    }

    _getCurrentIsochroneLayer() {
        return Array.from(this.enabledLayers).sort().join('_');
    }

    _registerEventHandlers() {
        document.querySelectorAll('#layer_selection input').forEach((node) => {
            node.addEventListener('change', (event) => {
                const layerKey = event.target.dataset.layer;
                if (this.enabledLayers.has(layerKey)){
                    this.enabledLayers.delete(layerKey);
                } else {
                    this.enabledLayers.add(layerKey);
                }
                this.syncLayerVisibility();
            });
        });
    }

    _getBrownLineFilter(sourceType) {
        if (this.enabledLayers.has('brown') && this.enabledLayers.has('lrt')) {
            // both lrt and brown line enabled? no need for filter
            return null;
        }
        let filterField;
        switch (sourceType) {
            case 'lines':
                filterField = 'NAME'
                break;
            case 'stations':
            case 'unmerged_isochrones':
                filterField = 'LINE'
                break;

        }
        const filterOp = this.enabledLayers.has('brown') ? '==' : '!=';
        return [filterOp, ['get', filterField], 'חום']
    }

    enableLayer(layer) {
        this.enabledLayers.add(layer);
        this.syncLayerVisibility();
    }

    disableLayer(layer) {
        this.enabledLayers.remove(layer);
        this.syncLayerVisibility();
    }

    _syncCheckboxState() {
        document.querySelectorAll('#layer_selection input').forEach((node) => {
            const layerKey = node.dataset.layer;
            node.checked = this.enabledLayers.has(layerKey);
        });
    }

    _getLayerVisibility(key) {
        let visibility = this.enabledLayers.has(key) ? 'visible' : 'none';
        if (key === 'lrt' && this.enabledLayers.has('brown')) {
            // brown line is included in the LRT layer, even though it's BRT
            visibility = 'visible';
        }
        return visibility;
    }

    syncLayerVisibility() {
        Object.entries(BASE_LAYERS).forEach(([key, layer]) => {
            layer.sources.forEach((source) => {
                const layerId = `${key}_${source.type}`;
                this.map.setLayoutProperty(layerId, 'visibility', this._getLayerVisibility(key));
                if (key === 'lrt') {
                    this.map.setFilter(layerId, this._getBrownLineFilter(source.type), { validate: false });
                }
            });
        });
        Object.keys(MERGED_ISOCHRONE_LAYERS).forEach((key) => {
            const id = `${key}_merged_isochrones`;
            const visibility = this._getCurrentIsochroneLayer() === key ? 'visible' : 'none';
            this.map.setLayoutProperty(`${key}_merged_isochrones`, 'visibility', visibility);
        });
    }

}

class InfoPopup {
    constructor(map) {
        this.popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            maxWidth: '300px',
        });
        this.isShown = false;
        this.map = map;
        this.showPopup = this.showPopup.bind(this);
        this.hidePopup = this.hidePopup.bind(this);
        this.movePopup = this.movePopup.bind(this);

        Object.keys(MERGED_ISOCHRONE_LAYERS).forEach((layer) => {
            map.on('mouseenter', `${layer}_merged_isochrones`, this.showPopup);
            map.on('mouseleave', `${layer}_merged_isochrones`, this.hidePopup);
            map.on('mousemove', `${layer}_merged_isochrones`, this.movePopup);
        });

        this.hoverFeatures = [];
    }

    getPopupContents(point) {
        const features = this.map.queryRenderedFeatures(point);
        const stations = []
        // collect station features, to be sorted by time
        features.forEach((feature) => {
            if (!feature.source.includes('unmerged_isochrones')) {
                return; // skip irrelvant layers
            }
            const properties = { ...feature.properties, source: feature.source };
            stations.push(properties)
        });
        stations.sort((a, b) => a.time - b.time);

        // build contents
        const seenStations = [];
        const seenTimes = new Set([]);
        const newHoverFeatures = [];
        const container = document.createElement('div');
        let ul;
        stations.forEach((station) => {
            const stationKey = `${station.LINE}-${station.NAME}`;
            if (!seenStations.includes(stationKey)) {
                if (!seenTimes.has(station.time)) {
                    if (ul) {
                        container.appendChild(ul);
                    }
                    ul = document.createElement('ul');
                    const h2 = document.createElement('h2');
                    h2.textContent = `${station.time} דקות`;
                    container.appendChild(h2);
                    seenTimes.add(station.time);
                }
                seenStations.push(stationKey);
                const li = document.createElement('li');

                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                const colorRules = BASE_LAYERS[station.source.split('_')[0]].sources.find((item) => item.type === 'stations').color_rules;
                svg.setAttribute('width', "16px");
                svg.setAttribute('height', "16px");
                svg.setAttribute('aria-hidden', 'true');
                svg.innerHTML = `<circle r="45%" cx="50%" cy="50%" fill="${ colorRules[station.LINE]}">`;

                li.appendChild(svg);

                const cleanLine = station.LINE.split('-')[0];
                const span = document.createElement('span');
                span.textContent = `${cleanLine} - ${station.NAME}`;
                li.appendChild(span);

                ul.appendChild(li);
                newHoverFeatures.push({ id: station.OBJECTID, source: `${station.source.split('_')[0]}_stations` });
            }
        });

        container.appendChild(ul);

        this.hoverFeatures.forEach((feature) => {
            if (!newHoverFeatures.find((newFeature) => feature.id === newFeature.id && feature.source === newFeature.source)) {
                this.map.setFeatureState(feature, { hover: false })
            }
        });
        newHoverFeatures.forEach((feature) => {
            if (!this.hoverFeatures.find((oldFeature) => feature.id === oldFeature.id  && feature.source === oldFeature.source)) {
                this.map.setFeatureState(feature, { hover: true });
            }
        });
        this.hoverFeatures = newHoverFeatures;
        return container.outerHTML;
    }

    movePopup(e) {
        if (this.isShown) {
            this.popup.setLngLat(e.lngLat).setHTML(this.getPopupContents(e.point));
        }
    }

    showPopup(e) {
        this.map.getCanvas().style.cursor = 'pointer';

        this.popup.setLngLat(e.lngLat).setHTML(this.getPopupContents(e.point)).addTo(this.map);
        this.isShown = true;
    }
    hidePopup() {
        this.map.getCanvas().style.cursor = '';
        this.popup.remove();
        this.isShown = false;
        this.hoverFeatures.forEach((feature) => this.map.setFeatureState(feature, { hover: false }));
        this.hoverFeatures = [];
    }
}

function init() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiZWxhZGFsZmFzc2EiLCJhIjoiY2psOGF4eHY0MGQ2NjNrbXQyOXFmamlkbCJ9.j2ECgxf01pIEQvcreLeFWQ';
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v10',
        center: [34.775113, 32.075341],
        zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl());
    mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js');
    mapboxgl.prewarm();
    map.on('load', () => {
        window.layerManager = new LayerManager(map);
        window.InfoPopup = new InfoPopup(map);
    });
    window.myMap = map;
    document.querySelector('#desclaimer button').addEventListener('click', () => {
        document.getElementById('desclaimer_bg').remove();
    });
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init());
} else {
    // in the case DOMContentLoaded might fire before this script could run
    init();
}
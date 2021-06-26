# MetroTLV Walkshed

## Visualizing the service area of the Tel Aviv Metropolitian Area Mass Transit System

### ויזואליזציית איזור השירות של מתע"ן גוש דן

See it in action at https://eladalfassa.com/metroTLV_walkshed

Visualizing the service area using mapbox-gl-js. service area computed using osmnx, see `generate-isochrones.ipynb` for details.

`data/` includes both generated geojson files, and original routes+station data downloaded from https://geo.mot.gov.il and convereted to GeoJSON using qgis.

The fronted app is written in vanilla javascript, and will only run on modern browsers.

For more information, see https://rightofway.blog/metro-walkshed.html
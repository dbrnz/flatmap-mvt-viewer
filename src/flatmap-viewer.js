/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import 'dat.gui/build/dat.gui.css';

//==============================================================================

// Load our stylesheet last so we can overide styling rules

import '../static/flatmap-viewer.css';

//==============================================================================

import {loadJSON, mapEndpoint} from './endpoints.js';
import {parser} from './annotation.js';
import {StyleSheet} from './stylesheet.js';
import {UserInteractions} from './interactions.js';

import * as utils from './utils.js';

//==============================================================================

class FlatMap
{
   /**
    * Maps are not created directly but instead are created and loaded by
    * :meth:`MapManager.LoadMap`.
    */
    constructor(container, mapDescription, resolve)
    {
        this._id = mapDescription.id;
        this._instanceId = `${mapDescription.id}-${mapDescription.number}`;
        this._source = mapDescription.source;
        this._created = mapDescription.created;
        this._describes = mapDescription.describes;
        this._resolve = resolve;

        this._idToAnnotation = new Map();
        this._urlToAnnotation = new Map();
        this._metadata = mapDescription.metadata;
        for (const [featureId, metadata] of Object.entries(mapDescription.metadata)) {
            const ann = parser.parseAnnotation(metadata.annotation);
            if ('error' in metadata && !('error' in ann)) {
                ann.error = metadata.error;
            }
            ann.label = metadata.label;
            ann.layer = metadata.layer;
            ann.queryable = 'geometry' in metadata
                          && metadata.geometry.includes('Polygon');
            this.addAnnotation_(featureId, ann);
        }

        // Stylesheet loading is deferred until `finalise_()` as this is an asynchronous
        // process

        this._styleSheet = null;

        // Set base of source URLs in map's style

        for (const [id, source] of Object.entries(mapDescription.style.sources)) {
            if (source.url) {
                source.url = this.urlFor(source.url);
            }
            if (source.tiles) {
                const tiles = []
                for (const tileUrl of source.tiles) {
                    tiles.push(this.urlFor(tileUrl));
                }
                source.tiles = tiles;
            }
        }

        // Save the map description as our options

        this._options = mapDescription.options;

        // Set options for the Mapbox map

        const mapboxOptions = {
            style: mapDescription.style,
            container: container,
            attributionControl: false
        };

        if ('debug' in mapDescription.options) {
            mapboxOptions.hash = true;
        }
        if ('max-zoom' in mapDescription.options) {
            mapboxOptions.maxZoom = mapDescription.options['max-zoom'];
        }
        if ('min-zoom' in mapDescription.options) {
            mapboxOptions.minZoom = mapDescription.options['min-zoom'];
        }
        if ('zoom' in mapDescription.options) {
            mapboxOptions.zoom = mapDescription.options['zoom'];
        }

        // Create the map

        this._map = new mapboxgl.Map(mapboxOptions);

        // Don't wrap around at +/-180 degrees

        this._map.setRenderWorldCopies(false);

        // Do we want a fullscreen control?

        if (mapDescription.options.fullscreenControl === true) {
            this._map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        }

        // Add navigation controls and disable rotation

        this._map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');
        this._map.dragRotate.disable();
        this._map.touchZoomRotate.disableRotation();

        // Show tile boundaries when debugging

        if ('debug' in mapDescription.options) {
            this._map.showTileBoundaries = true;
        }

        // Finish initialisation when all sources have loaded

        this._userInteractions = null;
        this._map.on('load', this.finalise_.bind(this));
    }

    async finalise_()
    //===============
    {
        // Load stylesheets/theme for map

        this._styleSheet = await StyleSheet.new(this);

        // Layer sources have now loaded so finish setting up

        this._userInteractions = new UserInteractions(this, ui => {
            if ('state' in this._options) {
                // This is to ensure the layer switcher has been fully initialised...
                setTimeout(() => {
                    ui.setState(this._options.state);
                    this._resolve(this);
                }, 200);
            } else {
                this._resolve(this);
            }
        });
    }

    /**
     * Load patterns/textures referenced in style rules.
     */
    loadPatternImage_(url)
    //====================
    {
        return new Promise((resolve, reject) => {
            this._map.loadImage(url, (error, image) => {
                if (error) reject(error);
                else resolve(image);
            });
        });
    }

    async addPattern(rulesUrl, id, path)
    //==================================
    {
        const url = path.startsWith('/') ? this.urlFor(path)
                                         : new URL(path, rulesUrl);
        const patternImage = await this.loadPatternImage_(url);

        this._map.addImage(id, patternImage);
    }

    urlFor(localPath)
    //===============
    {
        if (localPath.startsWith('/')) {
            return `${mapEndpoint()}flatmap/${this._id}${localPath}`; // We don't want embedded `{` and `}` characters escaped
        } else if (!localPath.startsWith('http://') && !localPath.startsWith('https://')) {
            console.log(`Invalid URL (${localPath}) in map's sources`);
        }
        return localPath;
    }

    /**
     * The taxon identifier of the species described by the map.
     *
     * @type string
     */
    get describes()
    //=============
    {
        return this._describes;
    }

    /**
     * The map's creation time.
     *
     * @type string
     */
    get created()
    //===========
    {
        return this._created;
    }

    /**
     * The map's identifier.
     *
     * @type string
     */
    get id()
    //======
    {
        return this._id;
    }

    /**
     * An identifier for this instance of the map within the viewer.
     *
     * @type string
     */
    get instanceId()
    //==============
    {
        return this._instanceId;
    }

    get annotatable()
    //===============
    {
        return this._options.annotatable === true;
    }

    get annotations()
    //===============
    {
        return this._idToAnnotation;
    }

    get layers()
    //==========
    {
        return this._options.layers;
    }

    get map()
    //=======
    {
        return this._map;
    }

    get selectedFeatureLayerName()
    //============================
    {
        return this._userInteractions.selectedFeatureLayerName;
    }

    get styleSheet()
    //==============
    {
        return this._styleSheet
    }

    fitBounds()
    //=========
    {
        if ('bounds' in this._options) {
            this._map.fitBounds(this._options['bounds'])
        }
    }

    modelsForFeature(featureId)
    //=========================
    {
        const ann = this._idToAnnotation.get(featureId);
        return ann ? ann.models : [];
    }

    featureIdForUrl(url)
    //==================
    {
        const ann = this._urlToAnnotation.get(url);
        return (ann) ? ann.featureId : null;
    }

    layerIdForUrl(url)
    //=================
    {
        const ann = this._urlToAnnotation.get(url);
        return (ann) ? ann.layer : null;
    }

    getAnnotation(featureId)
    //======================
    {
        return this._idToAnnotation.get(featureId);
    }

    annotationUrl(ann)
    //================
    {
        return `${this._source}/${ann.layer}/${ann.id}`;
    }

    addAnnotation_(featureId, ann)
    //============================
    {
        const url = this.annotationUrl(ann);
        ann.url = url;
        ann.featureId = featureId;
        this._idToAnnotation.set(featureId, ann);
        this._urlToAnnotation.set(url, ann);
    }

    delAnnotation_(featureId, ann)
    //============================
    {
        const url = this.annotationUrl(ann);
        this._idToAnnotation.delete(featureId);
        this._urlToAnnotation.delete(url);
    }

    uniqueAnnotation(ann)
    //===================
    {
        const url = this.annotationUrl(ann);
        const storedAnn = this._urlToAnnotation.get(url);
        return (storedAnn === undefined || storedAnn.id === ann.id);
    }

    async setAnnotation(featureId, ann)
    //=================================
    {
        let updateAnnotations = true;
        const mapboxFeature = utils.mapboxFeature(ann.layer, featureId);
        if (featureId in this._metadata) {
            if (ann.text === '') {
                delete this._metadata[featureId];
                this.delAnnotation_(featureId, ann);
                this._map.removeFeatureState(mapboxFeature);
            } else if (ann.text !== this._metadata[featureId].annotation) {
                if (ann.layer !== this._metadata[featureId].layer) {
                    console.log(`Annotation layer mismatch: ${ann} and ${this._metadata[featureId]}`);
                }
                const oldAnn = this.getAnnotation(featureId);
                if (oldAnn
                 && oldAnn.id !== ann.id
                 && oldAnn.error !== 'duplicate-id') {
                    const url = this.annotationUrl(oldAnn);
                    this._urlToAnnotation.delete(url);
                }
                this.addAnnotation_(featureId, ann);
                this._metadata[featureId].annotation = ann.text;
            } else {
                updateAnnotations = false;
            }
        } else {
            if (ann.text !== '') {
                this._metadata[featureId] = {
                    annotation: ann.text,
                    geometry: ann.queryable ? 'Polygon' : 'LineString',
                    layer: ann.layer
                }
                this.addAnnotation_(featureId, ann);
                this._map.setFeatureState(mapboxFeature, { 'annotated': true });
            } else {
                updateAnnotations = false;
            }
        }

        if ('error' in ann) {
            this._metadata[featureId].error = ann.error;
            this._map.setFeatureState(mapboxFeature, { 'annotation-error': true });
        } else {
            if (featureId in this._metadata) {
                delete this._metadata[featureId].error;
            }
            this._map.removeFeatureState(mapboxFeature, 'annotation-error');
        }

        if (updateAnnotations) {
            const postAnnotations = await fetch(mapEndpoint(`flatmap/${this.id}/metadata`), {
                headers: { "Content-Type": "application/json; charset=utf-8" },
                method: 'POST',
                body: JSON.stringify(this._metadata)
            });
            if (!postAnnotations.ok) {
                const errorMsg = `Unable to update metadata for '${this.id}' map`;
                console.log(errorMsg);
                alert(errorMsg);
            }
        }
    }

    resize()
    //======
    {
        // Resize our map

        this._map.resize();
    }

    fullLayerId(layerId)
    //==================
    {
        return `${this._instanceId}/${layerId}`;
    }

    getIdentifier()
    //=============
    {
        // Return identifiers for reloading the map

        return {
            describes: this._describes,
            source: this._source
        };
    }

    getState()
    //========
    {
        return (this._userInteractions !== null) ? this._userInteractions.getState() : {};
    }

    setState(state)
    //=============
    {
        if (this._userInteractions !== null) {
            this._userInteractions.setState(state);
        }
    }
}

//==============================================================================

/**
 * A manager for FlatMaps.
 * @example
 * const mapManager = new MapManger();
 */
export class MapManager
{
    /* Create a MapManager */
    constructor()
    {
        this._initialised = false;
        this._initialisingMutex = new utils.Mutex();

        this._mapIndex = null;
        this._mapNumber = 0;
    }

    async ensureInitialised_()
    //========================
    {
        return await this._initialisingMutex.dispatch(async () => {
            if (!this._initialised) {
                this._mapIndex = await loadJSON('');
                this._initialised = true;
            }
        });
    }

    findMap_(identifier)
    //==================
    {
        return new Promise(async(resolve, reject) => {
            await this.ensureInitialised_();
            resolve(this.lookupMap_(identifier));
        });
    }

    latestMap_(mapDescribes)
    //======================
    {
        let latestMap = null;
        let lastCreatedTime = '';
        for (const map of this._mapIndex) {
            if (mapDescribes === map.describes
             || mapDescribes === map.id
             || mapDescribes === map.source) {
                if ('created' in map) {
                    if (lastCreatedTime < map.created) {
                        lastCreatedTime = map.created;
                        latestMap = map;
                    }
                } else {
                    return map;
                }
            }
        }
        return latestMap;
    }

    lookupMap_(identifier)
    //====================
    {
        let mapDescribes = null;
        if (typeof identifier === 'object') {
            if ('source' in identifier) {
                const flatmap = this.latestMap_(identifier.source);
                if (flatmap !== null) {
                    return flatmap;
                }
            }
            if ('describes' in identifier) {
                mapDescribes = identifier.describes;
            }
        } else {
            mapDescribes = identifier;
        }
        return this.latestMap_(mapDescribes);
    }

   /**
    * Load and display a FlatMap.
    *
    * @arg identifier {string|Object} A string or object identifying the map to load. If a string its
    *                                 value can be either the map's ``id``, assigned at generation time,
    *                                 or a taxon identifier of the species that the map represents. The
    *                                 latest version of a map is loaded unless it has been identified
    *                                 by ``source`` (see below).
    * @arg identifier.describes {string} The taxon identifier of the map. This is specified as metadata
    *                                    in the map's source file.)
    * @arg identifier.source {string} The URL of the source file from which the map has
    *                                 been generated. If given then this exact map will be
    *                                 loaded.
    * @arg container {string} The id of the HTML container in which to display the map.
    * @arg options {Object} Configurable options for the map.
    * @arg options.annotatable {boolean} Allow features on a map to be annotated (this
    *                                    requires the map server to run in ``annotate``
    *                                    mode and is only for authoring).
    * @arg options.debug {boolean} Enable debugging mode (currently only shows the map's
    *                              position in the web page's URL).
    * @example
    * const humanMap1 = mapManager.loadMap('humanV1', 'div-1');
    *
    * const humanMap2 = mapManager.loadMap('NCBITaxon:9606', 'div-2');
    *
    * const humanMap3 = mapManager.loadMap({describes: 'NCBITaxon:9606'}, 'div-3');
    *
    * const humanMap4 = mapManager.loadMap(
    *                     {source: 'https://models.physiomeproject.org/workspace/585/rawfile/650adf9076538a4bf081609df14dabddd0eb37e7/Human_Body.pptx'},
    *                     'div-4');
    */
    loadMap(identifier, container, options={})
    //========================================
    {
        return new Promise(async(resolve, reject) => {
            try {
                const map = await this.findMap_(identifier);
                if (map === null) {
                    reject(new Error(`Unknown map for ${JSON.stringify(identifier)}`));
                };

                // Load the maps index file (its options)

                const mapOptions = await loadJSON(`flatmap/${map.id}/`);

                if (map.id !== mapOptions.id) {
                    throw new Error(`Map '${map.id}' has wrong ID in index`);
                }

                // Update the loaded options with any local configuration

                for (const [name, value] of Object.entries(options)) {
                    mapOptions[name] = value;
                }

                // Set layer data if the layer just has an id specified

                for (let n = 0; n < mapOptions.layers.length; ++n) {
                    const layer = mapOptions.layers[n];
                    if (typeof layer === 'string') {
                        mapOptions.layers[n] = {
                            id: layer,
                            description: layer.charAt(0).toUpperCase() + layer.slice(1),
                            selectable: true
                        };
                    }
                }

                // Get the map's style file

                const mapStyle = await loadJSON(`flatmap/${map.id}/style`);

                // Get the map's metadata

                const metadata = await loadJSON(`flatmap/${map.id}/metadata`);

                // Display the map

                this._mapNumber += 1;
                const flatmap = new FlatMap(container, {
                    id: map.id,
                    source: map.source,
                    describes: map.describes,
                    style: mapStyle,
                    options: mapOptions,
                    metadata: metadata,
                    number: this._mapNumber
                }, resolve);

                return flatmap;

            } catch (err) {
                reject(err);
            }
        });
    }
}

//==============================================================================

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

import {default as turfArea} from '@turf/area';
import {default as turfBBox} from '@turf/bbox';
import * as turf from '@turf/helpers';

//==============================================================================

import {AnnotationControl, Annotator} from './annotation.js';
import {ContextMenu} from './contextmenu.js';
import {LayerManager} from './layers.js';
import {LayerSwitcher} from './layerswitcher.js'
import {MessagePasser} from './messages.js';
import {QueryInterface} from './query.js';
import {ToolTip} from './tooltip.js';

import * as utils from './utils.js';

//==============================================================================

function tooltip(valuesList)
{
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'flatmap-feature-tooltip';
    for (const value of valuesList) {
        const valueElement = document.createElement('div');
        valueElement.className = 'flatmap-feature-property';
        valueElement.textContent = value;
        tooltipElement.appendChild(valueElement);
    }
    return tooltipElement;
}

//==============================================================================

export class UserInteractions
{
    constructor(flatmap, userInterfaceLoadedCallback=null)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._userInterfaceLoadedCallback =  userInterfaceLoadedCallback;
        this._queryInterface = new QueryInterface(flatmap);

        this._selectedFeature = null;
        this._highlightedFeatures = [];

        this._inQuery = false;
        this._modal = false;

        // Fit the map to our window

        flatmap.fitBounds();

        // Add a control to enable annotation if option set

        if (flatmap.annotatable) {
            this._annotator = new Annotator(flatmap, this);
        }

        // To pass messages with other applications

        this._messagePasser = new MessagePasser(flatmap.instanceId, json => this.processMessage_(json));

         // Manage our layers

        this._layerManager = new LayerManager(flatmap);

        // Add the map's layers

        // Layers have an id, either layer-N or an assigned name
        // Some layers might have a description. These are the selectable layers,
        // unless they are flagged as `no-select`
        // Selectable layers have opacity 0 unless active, in which case they have opacity 1.
        // `no-select` layers have opacity 0.5
        // Background layer has opacity 0.2

        const layersById = new Map();
        const layerBackgroundIds = [];
        for (const layer of flatmap.layers) {
            layer.backgroundLayers = [];
            layersById.set(layer.id, layer);
        }
        for (const layer of flatmap.layers) {
            if (layer.background_for) {
                const l = layersById.get(layer.background_for);
                l.backgroundLayers.push(layer);
                layerBackgroundIds.push(layer.id);
            }
        }
        for (const layer of flatmap.layers) {
            if (layerBackgroundIds.indexOf(layer.id) < 0) {
//                this._layerManager.addLayer(layer);
            }
        }

        // Style all features on every layer...
        //     For all features in layer
        //         setFeatureState(feature, { style: Style(layer, feature)} )
        //         NB. "feature-state" is only for paint properties that support
        //         data-driven styling...
        //         fill-opacity, fill-color, fill-outline-color, fill-pattern
        //         line-opacity, line-color, line-width

        for (const layer of flatmap.layers) {
            if (!layer.background_for) {
                this._layerManager.addLayer(layer);
            }
        }

        // Add a layer switcher if we have more than one selectable layer

        this._layerSwitcher = null;
        if (this._layerManager.selectableLayerCount > 1) {
            this._layerSwitcher = new LayerSwitcher(flatmap, 'Select system',
                                                    this.layerSwitcherActiveCallback_.bind(this));
            this._map.addControl(this._layerSwitcher);
        } else if (this._layerManager.selectableLayerCount === 1) {
            const selectableLayerId = this._layerManager.lastSelectableLayerId;
            this.activateLayer_(selectableLayerId);
            this._messagePasser.broadcast('flatmap-activate-layer', selectableLayerId);
        }

        // Display a tooltip at the mouse pointer

        this._tooltip = new ToolTip(flatmap);
        this._map.on('mousemove', this.mouseMoveEvent_.bind(this));

        // Display a context menu on right-click

        this._lastContextTime = 0;
        this._contextMenu = new ContextMenu(flatmap, this.contextMenuClosed_.bind(this));
        this._map.on('contextmenu', this.contextMenuEvent_.bind(this));

        // Display a context menu with a touch longer than 0.5 second

        this._lastTouchTime = 0;
        this._map.on('touchstart', (e) => { this._lastTouchTime = Date.now(); });
        this._map.on('touchend', (e) => {
            if (Date.now() > (this._lastTouchTime + 500)) {
                this.contextMenuEvent_(e);
            }
        });

        // Handle mouse click events

        this._map.on('click', this.clickEvent_.bind(this));

        if (this._layerSwitcher === null
         && this._userInterfaceLoadedCallback !== null) {
            this._userInterfaceLoadedCallback(this);
            this._userInterfaceLoadedCallback = null;
        }
    }

    layerSwitcherActiveCallback_(layerSwitcher)
    //=========================================
    {
        if (this._userInterfaceLoadedCallback !== null) {
            this._userInterfaceLoadedCallback(this);
            this._userInterfaceLoadedCallback = null;
        }
    }

    getState()
    //========
    {
        // Return the map's centre, zoom, and active layers
        // Can only be called when the map is fully loaded
        return {
            center: this._map.getCenter().toArray(),
            zoom: this._map.getZoom(),
            layers: this.activeLayerIds_
        };
    }

    setState(state)
    //=============
    {
        // Restore the map to a saved state

        if ('layers' in state) {
            // We tell the layer manager the required state of a layer
            // and its controller will broadcast activation/deactivation messages
            for (const layerId of this.activeLayerIds_) {
                this._layerSwitcher.setState(layerId, false);
            }
            for (name of state.layers) {
                this._layerSwitcher.setState(this._flatmap.mapLayerId(name), true);
            }
        }
        const options = {};
        if ('center' in state) {
            options['center'] = state.center;
        }
        if ('zoom' in state) {
            options['zoom'] = state.zoom;
            options['around'] = [0, 0];
        }
        if (Object.keys(options).length > 0) {
            this._map.jumpTo(options);
        }
    }

    get annotating()
    //==============
    {
        return this._flatmap.annotatable && this._annotator.enabled;
    }

    get activeLayerIds_()
    //===================
    {
        return this._layerManager.activeLayerIds;
    }

    activateActiveLayers()
    //====================
    {
        for (const id of this.activeLayerIds_) {
            this.activateLayer_(id);
        }
    }

    activateLayer_(fullLayerId)
    //=========================
    {
        this._layerManager.activate(fullLayerId, this.annotating);
    }

    deactivateLayer_(fullLayerId)
    //===========================
    {
        this._layerManager.deactivate(fullLayerId);
    }

    processMessage_(msg)
    //==================
    {
        if (msg.action === 'flatmap-activate-layer') {
            this.activateLayer_(msg.resource);
        } else if (msg.action === 'flatmap-deactivate-layer') {
            this.deactivateLayer_(msg.resource);
        } else if (msg.action === 'flatmap-query-results') {
            let modelList = [];
            for (const featureUrl of msg.resource) {
                const featureId = this._flatmap.featureIdForUrl(featureUrl);
                if (featureId) {
                    const ann = this._flatmap.getAnnotation(featureId);
                    const feature = utils.mapboxFeature(ann.layer, featureId);
                    this._map.setFeatureState(feature, { "highlighted": true });
                    this._highlightedFeatures.push(feature);
                    if (ann.queryable) {
                        modelList = modelList.concat(ann.models);
                    }
                }
            }
            if ('type' in msg.data
              && msg.data.type === 'nodes'
              && modelList.length > 0) {
                this.queryData_([... new Set(modelList)]);
            }
            this._inQuery = false;
            this._map.getCanvas().style.cursor = '';
        }
    }

    selectFeature_(feature)
    //=====================
    {
        this.unselectFeatures_(false);
        this._map.setFeatureState(feature, { "selected": true })
        this._selectedFeature = feature;
    }

    unselectFeatures_(reset=true)
    //===========================
    {
        if (this._selectedFeature !== null) {
            this._map.removeFeatureState(this._selectedFeature, "selected");
            if (reset) {
                this._selectedFeature = null;
            }
        }
    }

    get selectedFeatureLayerName()
    //============================
    {
        if (this._selectedFeature !== null) {
            const layerId = this._selectedFeature.layer.id;
            if (layerId.includes('-')) {
                return layerId.split('-').slice(0, -1).join('-')
            } else {
                return layerId;
            }
        }
        return null;
    }

    unhighlightFeatures_(reset=true)
    //==============================
    {
        for (const feature of this._highlightedFeatures) {
            this._map.removeFeatureState(feature, "highlighted");
        }
        this._highlightedFeatures = [];
    }

    activeFeaturesAtEvent_(event)
    //===========================
    {
        // Get the features covering the event's point that are in the active layers

        return this._map.queryRenderedFeatures(event.point).filter(f => {
            return (this.activeLayerIds_.indexOf(f.sourceLayer) >= 0)
                && ('id' in f.properties);
            }
        );
    }

    smallestAnnotatedPolygonFeature_(features)
    //========================================
    {
        // Get the smallest feature from a list of features

        let smallestArea = 0;
        let smallestFeature = null;
        for (const feature of features) {
            if (feature.geometry.type.includes('Polygon')
             && (this.annotating || this._map.getFeatureState(feature)['annotated'])) {
                const polygon = turf.geometry(feature.geometry.type, feature.geometry.coordinates);
                const area = turfArea(polygon);
                if (smallestFeature === null || smallestArea > area) {
                    smallestFeature = feature;
                    smallestArea = area;
                }
            }
        }
        return smallestFeature;
    }

    smallestAnnotatedPolygonAtEvent_(event)
    //=====================================
    {
        // Get the smallest polygon feature covering the event's point

        return this.smallestAnnotatedPolygonFeature_(this.activeFeaturesAtEvent_(event));
    }

    showTooltip_(position, feature)
    //=============================
    {
        let result = false;
        const id = feature.properties.id;
        const ann = this._flatmap.getAnnotation(id);
        this.selectFeature_(feature);
        if (this.annotating) {
            if (ann) {
                const error = ('error' in ann) ? ann.error : '';
                this._tooltip.show(position, tooltip([ann.featureId, ann.label, ...ann.text.split(/\s+/), error]));
            } else {
                this._tooltip.show(position, tooltip([id, this._map.getFeatureState(feature)['annotated']]));
            }
            result = true;
        } else if (ann) {
            const models = ann.models;
            if (models.length) {
                this._tooltip.show(position, tooltip([ann.label ? ann.label: models[0]]));
                result = true;
            } else if (this._layerManager.layerQueryable(ann.layer)) {
                result = true;
            }
        }
        if (result && !this._inQuery) {
            this._map.getCanvas().style.cursor = 'pointer';
        }
        return result;
    }

    mouseMoveEvent_(event)
    //====================
    {
        if (this._modal) {
            return;
        }
        const features = this.activeFeaturesAtEvent_(event);
        let feature = this.smallestAnnotatedPolygonFeature_(features);
        if (feature === null && this.annotating && features.length) {
            feature = features[0];
        }

        if (feature === null || !this.showTooltip_(event.lngLat, feature)) {
            if (!this._inQuery) {
                this._map.getCanvas().style.cursor = '';
            }
            this._tooltip.hide();
            this.unselectFeatures_();
        }
    }

    contextMenuEvent_(event)
    //======================
    {
        event.preventDefault();

        // Chrome on Android sends both touch and contextmenu events
        // so ignore duplicate

        if (Date.now() < (this._lastContextTime + 100)) {
            return;
        }
        this._lastContextTime = Date.now();

        const features = this.activeFeaturesAtEvent_(event);
        let feature = this.smallestAnnotatedPolygonFeature_(features);
        if (feature === null && this.annotating && features.length) {
            feature = features[0];
        }

        if (feature !== null) {
            const id = feature.properties.id;
            const ann = this._flatmap.getAnnotation(id);
            this.selectFeature_(feature);
            this._tooltip.hide();
            const items = [];
            if (ann) {
                if (ann.models.length > 0) {
                    items.push({
                        id: id,
                        prompt: `Search for knowledge about node`,
                        action: this.query_.bind(this, 'data')
                    });
                }
                if (this._layerManager.layerQueryable(ann.layer)) {
                    items.push({
                        id: id,
                        prompt: 'Find edges connected to node',
                        action: this.query_.bind(this, 'edges')
                    });
                    items.push({
                        id: id,
                        prompt: 'Find nodes and edges connected to node',
                        action: this.query_.bind(this, 'nodes')
                    });
                }
            }
            if (this.annotating) {
                if (items.length) {
                    items.push('-');
                }
                items.push({
                    id: id,
                    prompt: 'Annotate',
                    action: this.annotate_.bind(this, feature.geometry.type.includes('Polygon'))
                });
            }
            if (items.length) {
                items.push('-');
            }
            items.push({
                id: id,
                prompt: 'Zoom to...',
                action: this.zoomTo_.bind(this, feature)
            });
            if (items.length) {
                this._modal = true;
                this._contextMenu.show(event.lngLat, items);
                return;
            }
        }
    }

    contextMenuClosed_(event)
    //=======================
    {
        this._modal = false;
    }

    annotate_(queryableFeature, event)
    //================================
    {
        this._contextMenu.hide();
        this._annotator.editAnnotation(event.target.getAttribute('id'),
                                       queryableFeature,
                                       () => { this._modal = false; });
    }

    zoomTo_(feature)
    //==============
    {
        this._contextMenu.hide();
        let bbox = feature.properties.bbox;
        if (bbox) {
            // Bounding box is defined in GeoJSON

            bbox = bbox.split(',');
        } else {
            // Get the bounding box of the current polygon. This won't neccessary
            // be the full feature because of tiling

            const polygon = turf.geometry(feature.geometry.type, feature.geometry.coordinates);
            bbox = turfBBox(polygon);
        }
        this._map.fitBounds(bbox, {
            padding: 30,
            animate: false
        });
    }

    queryData_(modelList)
    //===================
    {
        if (modelList.length > 0) {
            this._messagePasser.broadcast('query-data', modelList, {
                describes: this._flatmap.describes
            });
        }
    }

    query_(type, event)
    //=================
    {
        this.unhighlightFeatures_();
        this._contextMenu.hide();
        const featureId = event.target.getAttribute('id');
        if (type === 'data') {
            this.queryData_(this._flatmap.modelsForFeature(featureId));
        } else {
            const ann = this._flatmap.getAnnotation(featureId);
            this._queryInterface.query(type, ann.url, ann.models);
            this._map.getCanvas().style.cursor = 'progress';
            this._inQuery = true;
        }
        this._modal = false;
    }

    clickEvent_(event)
    //================
    {
        this._layerSwitcher.close();
        const feature = this.smallestAnnotatedPolygonAtEvent_(event);
        if (feature !== null) {
            const featureId = feature.properties.id;
            this.selectFeature_(feature);
            this.queryData_(this._flatmap.modelsForFeature(featureId));
        }
        this.unhighlightFeatures_();
    }
}

//==============================================================================

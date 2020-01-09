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

import * as style from './styling.js';
import * as utils from './utils.js';

//==============================================================================

const FEATURE_SOURCE_ID = 'features';

//==============================================================================

class MapFeatureLayer
{
    constructor(map, layer, features)
    {
        this._map = map;
        this._id = layer.id;
        this._styleLayerIds = [];

        const patternedFeatures = [];
        for (const feature of features) {
            const mapFeature = utils.mapFeature(layer.id, feature.id);

            for (let [key, value] of Object.entries(feature.style)) {
                if (feature.type === 'Polygon') {
                    if (key === 'pattern') {
                        patternedFeatures.push({
                            'id': feature.id,
                            'pattern': value
                        })
                    }
                }
                if (key === 'colour') {
                    this._map.setFeatureState(mapFeature, { 'color': value });
                }

            }
        }

        this.addStyleLayer_(style.FeaturePatternLayer.style, patternedFeatures);
        this.addStyleLayer_(style.FeatureFillLayer.style, patternedFeatures);

        this._borderLayerId = this.addStyleLayer_(style.FeatureBorderLayer.style);
        this._lineLayerId = this.addStyleLayer_(style.FeatureLineLayer.style);

    }

    get id()
    //======
    {
        return this._id;
    }

    get topStyleLayerId()
    //===================
    {
        return this._styleLayerIds[0];
    }

    addStyleLayer_(styleFunction, options={})
    //=======================================
    {
        const styleLayer = styleFunction(FEATURE_SOURCE_ID, this._id, options);
        this._map.addLayer(styleLayer);
        this._styleLayerIds.push(styleLayer.id);
        return styleLayer.id;
    }

    setBorderProperties_(layerActive=false, annotating=false)
    //=======================================================
    {
        this._map.setPaintProperty(this._borderLayerId, 'line-color',
                                   style.borderColour(layerActive, annotating));
        this._map.setPaintProperty(this._borderLayerId, 'line-opacity',
                                   style.borderOpacity(layerActive, annotating));
        this._map.setPaintProperty(this._borderLayerId, 'line-width',
                                   style.FeatureBorderLayer.lineWidth(layerActive, annotating));
    }

    setLineProperties_(layerActive=false, annotating=false)
    //=====================================================
    {
        this._map.setPaintProperty(this._lineLayerId, 'line-color',
                                   style.lineColour(layerActive, annotating));
        this._map.setPaintProperty(this._lineLayerId, 'line-opacity',
                                   style.lineOpacity(layerActive, annotating));
        this._map.setPaintProperty(this._lineLayerId, 'line-width',
                                   style.FeatureLineLayer.lineWidth(layerActive, annotating));
    }

    activate(annotating=false)
    //========================
    {
        for (const l of this._backgroundLayers) {
            l.activate();
        }
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 1);
        this.setBorderProperties_(true, annotating);
        this.setLineProperties_(true, annotating);
    }

    deactivate()
    //==========
    {
        for (const l of this._backgroundLayers) {
            l.deactivate();
        }
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity', 0);
        this.setBorderProperties_();
        this.setLineProperties_();
    }

    move(beforeLayer)
    //===============
    {
        const beforeTopStyleLayerId = beforeLayer ? beforeLayer.topStyleLayerId : undefined;
        for (const styleLayerId of this._styleLayerIds) {
            this._map.moveLayer(styleLayerId, beforeTopStyleLayerId);
        }
    }
}

//==============================================================================

class MapImageLayer
{
    constructor(map, layer, topId='')
    {
        this._map = map;
        this._id = layer.id;
        if (topId === '') {
            this._imageLayerId = `${layer.id}-image`;
        } else {
            this._imageLayerId = `${topId}-${layer.id}-image`;
        }
        this._map.addLayer(style.ImageLayer.style(this._imageLayerId, `${layer.id}-image`,
                                                  style.PAINT_STYLES['background-opacity']));
    }

    get id()
    //======
    {
        return this._id;
    }

    get imageLayerId()
    //================
    {
        return this._imageLayerId;
    }

    activate()
    //========
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity',
                                   style.PAINT_STYLES['layer-background-opacity']);
    }

    deactivate()
    //==========
    {
        this._map.setPaintProperty(this._imageLayerId, 'raster-opacity',
                                   style.PAINT_STYLES['background-opacity']);
    }

    move(beforeLayer)
    //===============
    {
    }
}

//==============================================================================

export class LayerManager
{
    constructor(flatmap, switcher=false)
    {
        this._flatmap = flatmap;
        this._map = flatmap.map;
        this._layers = new Map;
        this._mapLayers = new Map;
        this._activeLayers = [];
        this._activeLayerNames = [];
        this._selectableLayerId = '';
        this._selectableLayerCount = 0;
    }

    get activeLayerNames()
    //====================
    {
        return this._activeLayerNames;
    }

    addLayer(layer, features)
    //=======================
    {
        this._mapLayers.set(layer.id, layer);

        const featureLayer = new MapFeatureLayer(this._map, layer, features);
        const layerId = this._flatmap.mapLayerId(layer.id);
        this._layers.set(layerId, featureLayer);

        if (layer.selectable) {
            this._selectableLayerId = layerId;
            this._selectableLayerCount += 1;
        }
    }

    get layers()
    //==========
    {
        return this._layers;
    }

    get selectableLayerCount()
    //========================
    {
        return this._selectableLayerCount;
    }

    get lastSelectableLayerId()
    //=========================
    {
        return this._selectableLayerId;
    }

    layerQueryable(layerName)
    //========================
    {
        const layer = this._mapLayers.get(layerName);
        return layer['queryable-nodes'];
    }

    activate(layerId, annotating=false)
    //=================================
    {
        const layer = this._layers.get(layerId);
        if (layer !== undefined) {
            layer.activate(annotating);
            if (this._activeLayers.indexOf(layer) < 0) {
                this._activeLayers.push(layer);
                this._activeLayerNames.push(layer.id);
            }
        }
    }

    deactivate(layerId)
    //=================
    {
        const layer = this._layers.get(layerId);
        if (layer !== undefined) {
            layer.deactivate();
            const index = this._activeLayers.indexOf(layer);
            if (index >= 0) {
                delete this._activeLayers[index];
                this._activeLayers.splice(index, 1);
                delete this._activeLayerNames[index];
                this._activeLayerNames.splice(index, 1);
            }
        }
    }

    makeUppermost(layerId)
    //====================
    {
        // position before top layer
    }

    makeLowest(layerId)
    //=================
    {
        // position after bottom layer (before == undefined)
    }


    lower(layerId)
    //============
    {
        // position before second layer underneath...
    }

    raise(layerId)
    //============
    {
        // position before layer above...
    }
}

//==============================================================================

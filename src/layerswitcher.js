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

import * as dat from 'dat.gui';

//==============================================================================

import {MessagePasser} from './messages.js';

//==============================================================================

class LayerControl
{
    constructor(flatmap)
    {
        //  To broadcast an 'flatmap-activate-layer LAYER_ID' message
        this._messagePasser = new MessagePasser(`${flatmap.uniqueId}-layerswitcher`, json => {});

        this._layerIdToController = new Map();
        this._layerIdToDescription = new Map();
        for (const layer of flatmap.layers) {
            if (layer.selectable && layer.description !== '') {
                const layerId = flatmap.mapLayerId(layer.id);
                this[layer.description] = layer.selected;
                this._layerIdToDescription.set(layerId, layer.description);
                if (layer.selected) {
                    this._messagePasser.broadcast('flatmap-activate-layer', layerId);
                }
            }
        }
    }

    addToGui(gui)
    //===========
    {
        for (const [layerId, description] of this._layerIdToDescription.entries()) {
            const controller = gui.add(this, description);
            controller.onChange(this.checkboxChanged.bind(this, layerId));
            this._layerIdToController.set(layerId, controller);
        }
    }

    checkboxChanged(layerId, checked)
    //===============================
    {
        if (checked) {
            this._messagePasser.broadcast('flatmap-activate-layer', layerId);
        } else {
            this._messagePasser.broadcast('flatmap-deactivate-layer', layerId);
        }
    }

    setState(layerId, checked)
    //========================
    {
        const controller = this._layerIdToController.get(layerId);
        if (controller) {
            controller.setValue(checked);
        }
    }
}


//==============================================================================

export class LayerSwitcher
{
    constructor(flatmap, prompt='Select layer', controlAddedCallback=null)
    {
        this._flatmap = flatmap;
        this._layerControl = null;
        this._controlAddedCallback = controlAddedCallback;
    }

    onAdd(map)
    //========
    {
        this._gui = new dat.GUI({ autoPlace: false });

        this._layerControl = new LayerControl(this._flatmap);
        this._layerControl.addToGui(this._gui);
        this._gui.close();

        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        this._container.appendChild(this._gui.domElement);

        if (this._controlAddedCallback !== null) {
            this._controlAddedCallback(this);
        }

        return this._container;
    }

    onRemove()
    //========
    {
        this._gui.destroy();
        this._container.parentNode.removeChild(this._container);
    }

    getDefaultPosition()
    //==================
    {
        return 'top-left';
    }

    setState(layerId, checked)
    //========================
    {
        if (this._layerControl !== null) {
            this._layerControl.setState(layerId, checked);
        }
    }

    close()
    //=====
    {
        this._gui.close();
    }
}

//==============================================================================

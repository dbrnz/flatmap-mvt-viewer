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
limitations under the Licen

******************************************************************************/

'use strict';

//==============================================================================

import {loadJSON} from './endpoints.js';

//==============================================================================

export class ModelOntologies
{
    static async new(flatmap)
    //=======================
    {
        const ontologies = new ModelOntologies();
        await ontologies.initialize_();
        return ontologies;
    }

    async initialize_()
    //=================
    {
        const uberon = await loadJSON('ontology/uberon.json');

        for (const [key, properties] of Object.entries(uberon)) {
            ModelOntologies._entities.set(key, new Entity(key, properties));
        }
    }

    static getEntity(key)
    {
        return ModelOntologies._entities.get(key);
    }
}

ModelOntologies._entities = new Map();

//==============================================================================

class Entity
{
    constructor(type, properties)
    {
        this._type = type;
        this._label = properties['label'];
        this._part_of = [];
        for (const part_of of properties['part_of']) {
            this._part_of.push(part_of)
        }
        this._is_a = [];
        for (const is_a of properties['is_a']) {
            this._is_a.push(is_a)
        }
    }

    /**
     * The entity's label.
     *
     * @type string
     */
    get label()
    //=========
    {
        return this._label;
    }

    /**
     * Get style rules associated with an entity's super classes.
     *
     * @type Object
     */
    superStyle(stylesheet)
    //====================
    {
        const styling = new Style();

        for (const type of this._part_of) {
            styling.merge(stylesheet.styling(`.${type}`));
        }

        for (const type of this._is_a) {
            styling.merge(stylesheet.styling(`.${type}`));
        }

        return styling;
    }
}

//==============================================================================

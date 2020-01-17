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

export class MapFeature
{
    constructor(layerId, feature, annotation)
    {
        this._layerId = layerId;
        this._id = feature.id;
        this._type = feature.type;

        if (annotation != null) {
            this._annotated = true;
            this._styleId = `#${annotation.id}`;
            this._models = annotation.models;
            if ('error' in annotation) {
                this._annotationError = true;
                console.log(`Annotation error, ${annotation.layer}: ${annotation.error} (${annotation.text})`);
            } else {
                this._error = false;
            }
        } else {
            this._annotated = false;
            this._styleId = null;
            this._models = [];
        }
    }

    get annotated()
    //=============
    {
        return this._annotated;
    }

    get id()
    //======
    {
        return this._id;
    }

    get models()
    //==========
    {
        return this._models;
    }

    get styleId()
    //===========
    {
        return this._styleId;
    }

    get type()
    //========
    {
        return this._type;
    }

}

//==============================================================================

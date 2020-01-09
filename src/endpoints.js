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

const MAP_ENDPOINT = 'https://mapcore-demo.org/flatmaps/';

//==============================================================================

export function mapEndpoint(relativePath='')
//==========================================
{
    const url = new URL(relativePath, MAP_ENDPOINT);
    return url.href;
}

//==============================================================================

export async function loadJSON(relativePath)
//=============================================
{
    const url = mapEndpoint(relativePath);
    const response = await fetch(url, {
        headers: { "Accept": "application/json; charset=utf-8" },
        method: 'GET'
    });
    if (!response.ok) {
        throw new Error(`Cannot access ${url}`);
    }
    return response.json();
}

//==============================================================================

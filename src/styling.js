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

export const PAINT_STYLES = {
    'background-opacity': 0.3,
    'layer-background-opacity': 0.5,
    'fill-color': '#fff',
    'border-stroke-width': 0.5,
    'line-stroke-opacity': 0,
    'line-stroke-width': 0.5
};

//==============================================================================

export function borderColour(layerActive=false, annotating=false)
{
    return [
        'case',
        ['boolean', ['feature-state', 'annotation-error'], false], 'pink',
        ['boolean', ['feature-state', 'highlighted'], false], 'green',
        'blue'
    ];
}

export function borderOpacity(layerActive=false, annotating=false)
{
    if (layerActive) {
        return annotating ? 1 : [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 1,
            ['boolean', ['feature-state', 'highlighted'], false], 1,
            ['boolean', ['feature-state', 'annotated'], false], 1,
            0
        ];
    } else {
        return 0;
    }
}

//==============================================================================

export function lineColour(layerActive=false, annotating=false)
{
    return [
        'case',
        ['boolean', ['feature-state', 'annotation-error'], false], 'pink',
        ['boolean', ['feature-state', 'highlighted'], false], 'green',
        'red'
    ];
}

export function lineOpacity(layerActive=false, annotating=false)
{
    if (layerActive) {
        return annotating ? 1 : [
            'case',
            ['boolean', ['feature-state', 'annotation-error'], false], 0.8,
            ['boolean', ['feature-state', 'highlighted'], false], 0.4,
            ['boolean', ['feature-state', 'selected'], false], 0,
            ['boolean', ['feature-state', 'annotated'], false], 0,
            0
        ];
    } else {
        return 0;
    }
}

//==============================================================================

class LineWidth
{
    static scale(width, annotating=false)   // width at zoom 3
    {
        return [
            "let", "linewidth", [
                'case',
                ['boolean', ['feature-state', 'annotation-error'], false], 4*width,
                ['boolean', ['feature-state', 'highlighted'], false], 2*width,
                ['boolean', ['feature-state', 'selected'], false], 3*width,
                ['boolean', ['feature-state', 'annotated'], false], width,
                annotating ? width : 0
            ],
            ["interpolate",
            ["exponential", 1.4],
            ["zoom"],
            3, ["var", "linewidth"],
            10, [ "*", 10, ["var", "linewidth"]]
            ]
        ];
    }
}

//==============================================================================

function lineWidth_(width, layerActive=false, annotating=false)
{
    if (layerActive) {
        return LineWidth.scale(width, annotating)
    }
    else {
        return 0;
    }
}

//==============================================================================

export class FeatureBorderLayer
{
    static style(sourceId, sourceLayer)
    {
        return {
            'id': `${sourceLayer}-border`,
            'source': sourceId,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'Polygon'
            ],
            'paint': {
                'line-color': borderColour(),
                'line-opacity': borderOpacity(),
                'line-width': lineWidth_(PAINT_STYLES['border-stroke-width'])
            }
        };
    }

    static lineWidth(layerActive=false, annotating=false)
    {
        return lineWidth_(PAINT_STYLES['border-stroke-width'], layerActive, annotating);
    }
}

//==============================================================================

export class FeatureFillLayer
{
    static style(sourceId, sourceLayer, texturedFeatures)
    {
        let filter = [
            '==',
            '$type',
            'Polygon'
        ];

        if (texturedFeatures.length !== 0) {
            filter = [
                'all',
                [
                    '==',
                    '$type',
                    'Polygon'
                ]
            ];
            const idFilter = ['!in', 'id'];
            for (const feature of texturedFeatures) {
                idFilter.push(feature.id);
            }
            filter.push(idFilter);
        }

        return {
            'id': `${sourceLayer}-fill`,
            'source': sourceId,
            'source-layer': sourceLayer,
            'type': 'fill',
            'filter': filter,
            'paint': {
                'fill-color': [
                    'case', [ '!=', ['feature-state', 'color'], null],
                        ['feature-state', 'color'],
                        PAINT_STYLES['fill-color'],
                    ],
            }
        };
    }
}

//==============================================================================

export class FeaturePatternLayer
{
    static style(sourceId, sourceLayer, texturedFeatures)
    {
        if (texturedFeatures.length === 0) {
            return null;
        }

        const fillPattern = ['match', ['get', 'id']];
        const filter = [
            'all',
            [
                '==',
                '$type',
                'Polygon'
            ]
        ];
        const idFilter = ['in', 'id'];
        for (const feature of texturedFeatures) {
            fillPattern.push(feature.id);
            fillPattern.push(feature.texture);
            idFilter.push(feature.id);
        }
        filter.push(idFilter);
        fillPattern.push('');

        return {
            'id': `${sourceLayer}-pattern`,
            'source': sourceId,
            'source-layer': sourceLayer,
            'type': 'fill',
            'filter': filter,
            'paint': {
                'fill-pattern': fillPattern,
            }
        };
    }
}

//==============================================================================

export class FeatureLineLayer
{
    static style(sourceId, sourceLayer)
    {
        return {
            'id': `${sourceLayer}-line`,
            'source': sourceId,
            'source-layer': sourceLayer,
            'type': 'line',
            'filter': [
                '==',
                '$type',
                'LineString'
            ],
            'paint': {
                'line-color': 'green', /* [
                    'case', [ '!=', ['feature-state', 'color'], null],
                        ['feature-state', 'color'],
                        PAINT_STYLES['fill-color'],
                    ],
//                lineColour(), */
                'line-opacity': 1, // lineOpacity(),
                'line-width': lineWidth_(PAINT_STYLES['line-stroke-width'])
            }
        };
    }

    static lineWidth(layerActive=false, annotating=false)
    {
        return lineWidth_(PAINT_STYLES['line-stroke-width'], layerActive, annotating);
    }
}

//==============================================================================

export class ImageLayer
{
    static style(id, source_id, opacity=0)
    {
        return {
            'id': id,
            'source': source_id,
            'type': 'raster',
            'paint': {
                'raster-opacity': opacity
            }
        };
    }
}

//==============================================================================

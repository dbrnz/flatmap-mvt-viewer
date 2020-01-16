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

// CSS parser from https://github.com/cwdoh/cssparser.js
const cssparser = require('cssparser/lib/cssparser.js');

//==============================================================================

// TODO: Implement inheritance and initial values as per
//       https://www.w3.org/TR/css-cascade-4

//==============================================================================

const DEFAULT_STYLESHEET = './static/themes/default.css';

//==============================================================================


//==============================================================================

export class StyleSheet
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._parser = new cssparser.Parser();
        this._rulesMap = new Map();
    }

    static async new(flatmap)
    //=======================
    {
        const styleSheet = new StyleSheet(flatmap);
        await styleSheet.initialize_();
        return styleSheet;
    }

    async initialize_()
    //=================
    {
        await this.fetchStyleRules_(DEFAULT_STYLESHEET);
        // TODO: load any map specific style rules...
    }

    async fetchStyleRules_(url)
    //=========================
    {
        let responseUrl = '';

        return fetch(url)
                    .then(response => {
                        responseUrl = response.url;
                        return response.text();
                    })
                    .catch(error => console.error('Error fetching stylesheet:', error))
                    .then(text => this.addStyleRules_(responseUrl, text));
    }

    addDeclarations_(selector, declarationList)
    //=========================================
    {
        let properties = null;
        if (this._rulesMap.has(selector)) {
            properties = this._rulesMap.get(selector);
        } else {
            properties = new Map();
            this._rulesMap.set(selector, properties);
        }

        for (const declaration of declarationList) {
            properties.set(declaration.property, declaration.value);
        }
    }

    async addTextures_(url, declarationList)
    //======================================
    {
        for (const declaration of declarationList) {
            const textureUrl = declaration.value;
            if (textureUrl.startsWith('url(') && textureUrl.endsWith(')')) {
                await this._flatmap.addTexture(url, declaration.property, textureUrl.slice(5, -2));
            } else {
                console.log(`Invalid texture Url: ${textureUrl}`);
            }
        }
    }

    async addStyleRules_(url, cssText)
    //================================
    {
        if (cssText.trim() === '') return;

        const ast = this._parser.parse(cssText);
        const rules =  ast.toDeepJSON();
        if (rules.type === 'STYLESHEET') {
            for (let rule of rules.value) {
                if (rule.type === 'QUALIFIED_RULE'
                 && rule.value.type === 'DECLARATION_LIST') {
                    const declarations = rule.value.value
                    for (let selector of rule.selectors) {
                        if (selector === '::textures') {
                            this.addTextures_(url, declarations);
                        } else {
                            await this.addDeclarations_(selector, declarations);
                        }
                    }
                }
            }
        }
    }

    styling(selector)
    //===============
    {
        // TODO: We need to cache where possible...

        let colour = (selector.type === 'Polygon') ? 'blue' : 'green';
        if ('classes' in selector) {
            colour = '#F88';
        }

        let styling = {};

        styling['colour'] = colour;

        if (selector.id === 'oval') {
            styling['pattern'] = 'texture';
        }

        }
        return styling;
    }

    }




        }


    }
}

//==============================================================================

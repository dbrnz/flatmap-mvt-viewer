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

class PropertiesMap
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._properties = new Map();
    }

    set(rulesUrl, declaration)
    //========================
    {
        const property = declaration.property;
        const value = declaration.value;

        if (property === 'pattern') {
            if (value.type === 'SEQUENCE'
             && value.value.length === 2) {
                const patternId = value.value[0];
                this._flatmap.addPattern(rulesUrl, patternId, value.value[1].slice(1, -1));
                this._properties.set(property, patternId);
            } else {
                console.log("Invalid 'pattern' value");
            }
        } else {
            this._properties.set(property, value);
        }
    }
}

//==============================================================================

export class StyleSheet
{
    constructor(flatmap)
    {
        this._flatmap = flatmap;
        this._parser = new cssparser.Parser();
        this._rulesMap = new Map();
    }

    static async create(flatmap)
    //==========================
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

    addDeclarations_(rulesUrl, selector, declarationList)
    //==================================================
    {
        let properties = null;
        if (this._rulesMap.has(selector)) {
            properties = this._rulesMap.get(selector);
        } else {
            properties = new PropertiesMap(this._flatmap);
            this._rulesMap.set(selector, properties);
        }

        for (let declaration of declarationList) {
            properties.set(rulesUrl, declaration);
        }
    }

    addStyleRules_(url, cssText)
    //==========================
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
                        this.addDeclarations_(url, selector, declarations);
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

/*
        for (let rule of this._styleRules) {
            if (rule.matches(selector)) {
                const style = rule.styling;
                if (style.type === 'DECLARATION_LIST') {
                    for (let declaration of style.value) {
                        styling[declaration.property.value] = declaration.value;
                    }
                }
            }
        }
*/
        return styling;
    }
}

//==============================================================================

export function tokensToString(tokens)
{
    if (!tokens) {
        return '';
    } else if (tokens instanceof Array) {
        let text = [];
        for (let t of tokens) {
            text.push(tokensToString(t));
        }
        return text.join(', ');
    } else if (tokens.type === 'SEQUENCE') {
        let text = [];
        for (let t of tokens.value) {
            text.push(tokensToString(t));
        }
        return text.join(' ');
    } else if (tokens.type === 'FUNCTION') {
        return `${tokens.name.value}(TODO...)`;
    } else if (['DIMENSION', 'PERCENTAGE'].indexOf(tokens.type) >= 0) {
        return `${tokens.value}${tokens.unit}`;
    } else {
        return tokens.value;
    }
}

//==============================================================================

export function styleAsString(styling, name, defaultValue='')
{
    const text = tokensToString(styling[name]);

    return text ? text : defaultValue;
}

//==============================================================================

export function parseColour(diagram, tokens)
{
    if (tokens.type === "FUNCTION") {
        const name = tokens.name.value;
        if (["radial-gradient", "linear-gradient"].indexOf(name) < 0) {
            throw new exception.StyleError(tokens, "Unknown colour gradient");
        }
        const gradientType = name.substr(0, 6);
        let stopColours = [];
        if ('parameters' in tokens) {
            const parameters = tokens.parameters;
            if (parameters instanceof Array) {
                let colour, stop;
                for (let token of parameters) {
                    if (token.type === 'SEQUENCE') {
                        colour = parseColourValue(token.value[0]);
                        if (token.value[1].type === "PERCENTAGE") {
                            stop = token.value[1].value;
                        } else {
                            throw new exception.StyleError(tokens, "Gradient stop percentage expected");
                        }
                    } else {
                        colour = parseColourValue(token);
                        stop = null;
                    }
                    stopColours.push([colour, stop]);
                }
            }
        }
        return diagram.svgFactory.gradient(gradientType, stopColours);
    }
    return parseColourValue(tokens);
}

//==============================================================================

export function parseColourValue(tokens)
{
    if (['HASH', 'ID'].indexOf(tokens.type) >= 0) {
        return tokens.value;
    }
    throw new exception.StyleError(tokens, "Colour expected");
}

//==============================================================================

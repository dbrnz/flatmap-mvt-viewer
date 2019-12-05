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
const cssparser = require('cssparser');

// Specificity from https://github.com/keeganstreet/specificity
const SPECIFICITY = require('specificity');

//==============================================================================

// TODO: Implement inheritance and initial values as per
//       https://www.w3.org/TR/css-cascade-4

//==============================================================================

const DEFAULT_STYLESHEET = './static/themes/default.css';

//==============================================================================

class StyleRule
{
    constructor(selector, styling, position)
    {
        this._selector = selector;
        this._styling = styling;
        this._specificity = SPECIFICITY.calculate(selector)[0]['specificityArray'];
        this._position = position;
    }

    get styling()
    {
        return this._styling;
    }

    compare(other)
    {
        const order = SPECIFICITY.compare(this._specificity, other._specificity);
        if (order != 0) {
            return order;
        } else {
            return (this._position > this._position) ?  1
                 : (this._position < this._position) ? -1
                 :  0;
        }
    }

    matches(feature)   // feature has `id`, `(Uberon) class` and `geometry`
    {

    }
}

//==============================================================================

export class StyleSheet
{
    constructor()
    {
        this._parser = new cssparser.Parser();
        this._styleRules = [];
        this._sequence = 0;
    }

    loadDefaultStylesheet()
    //=====================
    {
        return this.fetchStyleRules_(DEFAULT_STYLESHEET);
    }

    addStyleRules_(cssText)
    //=====================
    {
        if (cssText.trim() === '') return;

        const ast = this._parser.parse(cssText);
        const rules = ast._props_.value;
        for (let rule of rules) {
            const selectors = cssparser.toSimple(rule._props_.selectors);
            let styling = cssparser.toAtomic(rule._props_.value);
            for (let selector of selectors) {
                this._styleRules.push(new StyleRule(selector,
                                                    styling,
                                                    this._sequence));
                this._sequence += 1;
            }
        }

        this._styleRules.sort(function(a, b) => return a.compare(b));
    }

    async fetchStyleRules_(url)
    //=========================
    {
        // Note: `fetch()` is a Promise

        return fetch(url)
                    .then(response => response.text())
                    .catch(error => console.error('Error getting stylesheet:', error))
                    .then(text => {
                        this.addStyleRules_(text);
                    });
    }

    styling(feature)
    //==============
    {
        let styling = {};
        for (let rule of this._styleRules) {
            if (rule.matches(feature)) {
                const style = rule.styling;
                if (style.type === 'DECLARATION_LIST') {
                    for (let declaration of style.value) {
                        styling[declaration.property.value] = declaration.value;
                    }
                }
            }
        }
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

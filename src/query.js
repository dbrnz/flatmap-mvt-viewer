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

const N3 = require('n3');
import {newEngine} from '@comunica/actor-init-sparql';

//==============================================================================

import {mapEndpoint} from './endpoints.js';
import {MessagePasser} from './messages.js';

//==============================================================================

export class QueryInterface
{
    constructor(mapId)
    {
        this._mapId = mapId;
        this._store = new N3.Store();
        this._parser = new N3.Parser();
        this.loadStore_().then(() => {
            this._engine = newEngine();
            // Only now are we ready to start accepting queries...
            this._messagePasser = new MessagePasser('query-interface', json => {});
        }, err => console.log(err));
    }

    async loadStore_()
    //================
    {
        return new Promise(async(resolve, reject) => {
            const response = await fetch(mapEndpoint(`flatmap/${this._mapId}/annotations`), {
                 method: 'GET'
            });
            if (!response.ok) {
                reject(new Error(`Missing RDF for ${this._mapId} map...`));
            } else {
                const rdf = await response.text();
                this._parser.parse(rdf, (error, quad, prefixes) => {
                    if (error) {
                        console.log('RDF error:', error);
                    } else if (quad) {
                        this._store.addQuad(quad);
                    } else {
                        resolve(prefixes);
                    }
                });
            }
        });
    }


    async query(type, resource, models)
    //=================================
    {
        let sparql = null;

        if (type === 'edges') {
            if (models.length > 0) {
                sparql = `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
SELECT ?node ?edge ?node2 WHERE {
    { ?edge a flatmap:Edge .
      ?edge ?route ?node .
      ?node obo:RO_0003301 ?entity .
      <${resource}> obo:RO_0003301 ?entity .
    } UNION {
      ?node2 obo:RO_0003301 ?entity .
      <${resource}> obo:RO_0003301 ?entity .
    }
}`;
      } else {
          sparql = `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
SELECT ?edge WHERE { ?edge ?route <${resource}> }`;
            }
        } else if (type === 'nodes') {
            if (models.length > 0) {
                sparql = `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
SELECT ?node2 ?node1 ?edge1 ?node3 WHERE {
    { ?edge1 ?route2 ?node2 .
      ?edge1 a flatmap:Edge .
      ?edge1 ?route1 ?node1 .
      ?node1 obo:RO_0003301 ?entity .
      <${resource}> obo:RO_0003301 ?entity .
    } UNION {
      ?node3 obo:RO_0003301 ?entity .
      <${resource}> obo:RO_0003301 ?entity .
    }
}`;
            } else {
                sparql = `PREFIX flatmap: <http://celldl.org/ontologies/flatmap/>
SELECT ?node2 ?edge2 WHERE {
    ?edge2 ?route2 ?node2 .
    ?edge2 a flatmap:Edge .
    ?edge2 ?route1 <${resource}> .
}`;
            }
        }
        if (sparql) {
// also see https://github.com/comunica/jQuery-Widget.js/blob/master/src/ldf-client-worker.js
            try {
                const features = [];
                this._engine.query(sparql, {
                    sources: [{
                        type: 'rdfjsSource',
                        value: this._store
                    }]
                })
                .then(result => {
                    result.bindingsStream.on('data', data => {
                        for (const d of data.values()) {
                            features.push(d.value);
                        }
                    });
                    result.bindingsStream.on('end', () => {
                        if (features.length > 0) {
                            features.push(resource);
                        }
                        // We remove any duplicates before broadcasting the results array
                        this._messagePasser.broadcast('flatmap-query-results', [... new Set(features)], {type: type});
                    });
                    result.bindingsStream.on('error', (err) => {
                        console.log(err);
                        this._messagePasser.broadcast('flatmap-query-results', []);
                    });
                })
                .catch(err => {
                    console.log(err);
                    this._messagePasser.broadcast('flatmap-query-results', []);
                });
            } catch (err) {
                console.log(err);
                this._messagePasser.broadcast('flatmap-query-results', []);
            }
        }
    }
}

//==============================================================================

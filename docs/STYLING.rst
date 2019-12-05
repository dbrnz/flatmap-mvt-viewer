===================
Style Specification
===================

* Global
* Taxon id
* Layer class
* Layer id
* Object superclass(es)
* Object class (Uberon id)

* CSS style of selectors rules and properties??

    - Selectors:

        + .UBERON_ID
        + #IDENTIFIER

    - Properties:

        + color
        + opacity
        + texture

        + stroke-color
        + stroke-dash
        + stroke-opacity
        + stroke-width

* Textures:

    - name identifies source PNG file

* Find Uberon superclasses via ``part-of`` and ``is-a``.
* Check for style rules on superclasses.
* What has precedence? ``part-of`` or ``is-a``??

    - part-of


* ``part-of`` is ``BFO:0000050`` (http://purl.obolibrary.org/obo/BFO_0000050)
* ``has-part`` is ``BFO:0000051`` (http://purl.obolibrary.org/obo/BFO_0000051)
* ``is-a`` is ``rdfs:subClassOf``

::

    UBERON:0000388 part-of UBERON:0001051 part-of UBERON:0001042 part-of UBERON:0001004
    epiglottis             hypopharynx            chordate               respiratory
                                                  pharynx                system


Example
=======

::

    .UBERON_1 {
        color: blue;
        texture: rough;
    }
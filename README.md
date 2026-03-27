# openbpt-typed-pn-variants-modeler

A modeler for various typed Petri net variants presented in literature. Currently supported types are:

- [t-PNID](https://journals.sagepub.com/doi/10.3233/FI-2009-0095) (typed Petri nets with Identifiers) with inhibitor arcs
- [OCPN](https://journals.sagepub.com/doi/abs/10.3233/FI-2020-1946) (Object-centric Petri nets)
- [OPID](https://link.springer.com/chapter/10.1007/978-3-031-61057-8_1) (Object-centric Petri nets with Identifiers) with the exact synchronization extension presented for [DOPID](https://link.springer.com/chapter/10.1007/978-3-031-94571-7_11) (Data-aware Object-centri Petri nets with Identifiers)

The modeler is based on the [openbpt-modeler-petri-net](https://github.com/bptlab/openbpt-modeler-petri-net) modeler, which makes use of the wonderful [diagram-js](https://github.com/bpmn-io/diagram-js) library and took inspiration from [bpmn-js](https://github.com/bpmn-io/bpmn-js), [object-diagram-js](https://github.com/timKraeuter/object-diagram-js) and [fcm-js](https://github.com/bptlab/fCM-design-support).

## Development Setup

1. Clone this repository: ``git clone git@github.com:bptlab/openbpt-typed-pn-variants-modeler.git``
2. Navigate into the created directory
3. Run ``npm install``
4. Run ``npm link``
5. Clone the [development repository](https://github.com/bptlab/openbpt-modeler-dev/tree/openbpt-typed-pn-variants-modeler): ``git clone git@github.com:bptlab/openbpt-modeler-dev.git``
6. Navigate into the created directory
7. Checkout the `openbpt-typed-pn-variants-modeler` branch
8. Run ``npm install``
9. Run ``npm link openbpt-typed-pn-variants-modeler``

To start the modeler, run
1. ``npm run watch`` in this repository to automatically compile changes to js (relevant for changes to .ts files)
2. ``npm run dev`` in the development repo's directory.

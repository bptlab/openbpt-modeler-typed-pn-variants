# State-aware OPID discovery

Discovers an OPID from a state-aware OCEL 2.0 log, as written by the event log generation in state-aware mode (`--mode=state-aware`, with `--log-silent` to discover silent transitions). The result is modeler XML, written with the moddle's `toXML` like the modeler's `saveXML`, so it opens directly in the modeler.

## Usage

```ts
import {
  discoverOpid,
  simpleLayout,
} from "@bptlab/state-aware-ocpm/state-aware-opid-discovery";

const { net, layout, xml, warnings } = await discoverOpid(ocelXml, {
  layout: simpleLayout, // optional: any LayoutAlgorithm (see Layout)
});
```

The library does not touch the file system; `xml` is the file content. The CLI writes the file and prints a summary of the net. Run it from the repository root:

```
npx ts-node state-aware-opid-discovery/cli.ts <log.ocel.xml> [--out=<file>]

  --out=<file>  where to write the OPID (default: <log name>.opid.xml in the current directory)
```

For example: `npx ts-node state-aware-opid-discovery/cli.ts state-aware-opid-discovery/test_logs/Simple_link.ocel.xml`.

`npm run discover-opid -- <log.ocel.xml>` works too (paths relative to the repository root). In PowerShell, quote the separator (`npm run discover-opid '--' …`).

Logs that cannot be used throw a `DiscoveryInputError` whose message is meant for the user. Examples are unreadable XML, a log without `state transition` values, two events at the same time, or two state transitions of one object at the same time. Oddities the discovery works around are returned (and printed) as warnings.

`test_logs/` holds state-aware logs of the nets with the same names in `../event-log-generation/example_nets/`, for comparing a discovered net with its source.

## Algorithm

**Reading the log.** Object types without a `linkedTypes` attribute are data-class types; the others are link types. A link object's members are the objects of data-class types it is related to (O2O). Times are compared as instants. An _occurrence_ is either an event, with its related objects, or a time point that has state transitions but no event (a silent firing), with all objects that have a state transition then.

1. **Data classes:** one per data-class type, in declaration order (also for types without objects), named after the type, with value type `ID`. The alias is the shortest prefix that no other data class name starts with (case-sensitive), e.g. `Or` and `Of` for Order and Offer. If there is none, the alias is the full name, e.g. `Item` next to `Items`.
2. **Signatures:** the signature of an occurrence is the set of (object type, source states, target states) of its objects, read from their `state transition` value at the occurrence's time.
3. **Transitions:** one per distinct event type and signature, named after the event type, and one silent transition per distinct signature of the silent time points. They are ordered by first occurrence.
4. **Places:** one per object type and state that any object of the type was in (consumed from or produced into), labeled with the state. Places of different object types may share a label.
   - The color is the type's data class. For a link type, it is the data classes named in the `linkedTypes` value of its first object; if objects disagree, there is a warning.
   - Colors are sorted by name, like in the modeler.
5. **Arcs:** an input arc from every place in the source states of a transition's signature and an output arc to every place in its target states, one per place and direction.
6. **Variables:** they come from the transition's first occurrence.
   - Each object of a data-class type moves from its source places to its target places. These include the link places of the link objects it is a member of, also when the object itself only moves as part of a link.
   - Every distinct (data class, source places, target places) becomes a variable, in order of first appearance (event relationship order; link members in link order).
   - Per data class, the first variable is named after the data class alias, the next ones `<alias>1`, `<alias>2`, …, skipping names already used in the transition.
   - A variable is _generated_ if it has no source places.
   - It binds a set of objects if any occurrence of the transition moves several objects this way. Then every arc with this variable gets the variable's data class as `variableType`.
   - A variable becomes an inscription element (data class, variable name, generated) on every arc to or from one of its places. The elements are sorted by data class name, like in the modeler.

Not discovered yet: exact synchronization, inhibitor arcs, and the initial marking (the net has no tokens).

### Warnings and limits

- A later occurrence of a transition that moves objects differently from the first one gets a warning; the variables follow the first occurrence.
- An arc can have only one variable type. If set variables of two data classes share an arc, the first by name wins and there is a warning.
- An arc that carries two variables of the same data class, or no variable at all, gets a warning.
- The modeler's simulation creates one object per generated variable, so a generated variable that binds a set of objects (e.g. a transition that creates several items at once) cannot be replayed as such.
- State and type names are separated by ", " in the log and not escaped (see `../ocel/stateAware.ts`). Place names that contain ", " or "}, {" cannot be read back unambiguously.

## Layout

The layout is exchangeable: a `LayoutAlgorithm` takes the discovered net and returns a `NetLayout` with the bounds of every place and transition, the waypoints of every arc, and optionally label bounds. The modeler positions missing labels itself. Pass it as `discoverOpid(xml, { layout })`.

`layout/geometry.ts` has what layouts share:

- the modeler's shape sizes (from `vendor/util/constants.js`)
- cropping arcs at circle and rectangle borders
- the modeler's default label positions

The default `simpleLayout` is layered, left to right:

- A node's layer is its breadth-first distance from the nodes without incoming arcs. Cycles without entry start new searches.
- Nodes are stacked in the order they were reached, and each layer is centered vertically.
- Arcs are straight. An input and an output arc between the same place and transition are drawn apart so both are visible.

## Structure

| Folder / file | Contents                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | `discoverOpid` (XML in, XML out) and the exports                                                                                                                                             |
| `types.ts`    | The discovered net: data classes, places, transitions with signature and variables, arcs                                                                                                     |
| `log/`        | Reads the state-aware view of the log: link types, state transitions by time, link members, occurrences                                                                                      |
| `discovery/`  | The algorithm steps (`dataClasses.ts`, `places.ts`, `transitions.ts` for signatures, `arcs.ts` for variables and arcs) and `discoverNet.ts`, which runs them                                 |
| `layout/`     | `LayoutAlgorithm` interface, shared geometry, `simpleLayout`                                                                                                                                 |
| `export/`     | Builds the moddle tree (`../vendor/moddle`) with the ids and names of the modeler's empty diagram (`model_1`, …) and readable ids (`Place_1`, `Transition_1`, …), and writes it with `toXML` |
| `output/`     | Text summary for the CLI                                                                                                                                                                     |

Reading OCEL XML (`parseOcelXml`, via `@xmldom/xmldom`) and the state-aware value format live in `../ocel/`, shared with the event log generation.

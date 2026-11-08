# Event log generation

Simulates a typed Petri net (XML as written by `saveXML`) from its initial marking, records the sequence of transition firings with their bindings, and turns it into an OCEL 2.0 log (XML).

## Usage

```ts
import { generateEventLog } from "@bptlab/state-aware-ocpm/event-log-generation";

const { simulation, log, ocelXml } = await generateEventLog(xml, 5, {
  // all optional:
  maxObjectsPerType: { Order: 3 },
  seed: 42,
  mode: "default", // log mode: "default" or "state-aware"
  logSilentTransitions: false, // state-aware mode: also log silent firings
  startTime: "2025-01-01T00:00:00Z", // time of the first firing
  timeStepSeconds: 60, // time between firings
  generateLog: true, // false: only simulate (log and ocelXml are undefined)
}); // prints the firings by default
```

The library does not touch the file system; `ocelXml` is the file content. The CLI (Node, via the `ts-node` dev dependency) writes the file. npm runs it from the repository root, so relative paths, including the default output file, are relative to the root:

```
npm run generate-log -- <net.xml> <MAX_OBJECTS> [seed] [options]

  --max-per-type="Order:3,Item:2"  maximum number of created objects per object type
  --out=<file>                   where to write the log (default: <net name>.ocel.xml in the current directory)
  --no-log                       only simulate, do not create a log
  --mode=default                 log mode: default or state-aware
  --log-silent                   state-aware mode: also log silent firings
  --start-time=<ISO 8601>        time of the first firing (default 2025-01-01T00:00:00Z)
  --time-step=<seconds>          time between firings (default 60)
  --tokens                       also print the consumed (-) and produced (+) tokens of each firing
```

For example: `npm run generate-log -- event-log-generation/example_nets/Simple_link.xml 5 42 --mode=state-aware`.

Each run prints its seed; passing it again reproduces the run.

Invalid input (unreadable XML, unknown or ambiguous object type, negative or non-integer limits) throws an `EventLogInputError` whose message is meant for the user; the CLI prints it.

## Object limits

- `maxObjects` (`MAX_OBJECTS`) is required and limits all created objects together. It always applies.
- `maxObjectsPerType` optionally limits single object types, keyed by data class name or id. Types that are not listed are only limited by `maxObjects`.
- A transition is only enabled if its next firing keeps the total and the limit of every object type it creates within bounds.
- Only objects created during the simulation count; objects of the initial marking do not.
- The run stops after `effectiveMaxObjects * 100` firings. `effectiveMaxObjects` is the sum of the per-type limits if every data class of the net has one and the sum is lower than `maxObjects`; otherwise it is `maxObjects`.

## How the simulation works

1. Parse the XML with the moddle and build the net and its initial marking.
2. Compute the valid bindings of every transition.
3. Repeat:
   - pick an enabled transition uniformly (independent of its number of bindings),
   - pick one of its binding patterns uniformly, then the values: one per normal variable, a uniformly chosen non-empty subset for variable arcs (`x[]`), all values for exact synchronization,
   - fire it and record the firing,
   - recompute only the transitions that read (through an input or inhibitor arc) from a place whose tokens changed. Transitions that create objects are disabled once their next firing would exceed an object limit.
4. Stop when no transition is enabled or after `effectiveMaxObjects * 100` firings (see [Object limits](#object-limits)).

Silent transitions are recorded with `isSilent: true` and count toward the firing limit.

## OCEL 2.0 log

The XML follows Section 7 of the [OCEL 2.0 specification](https://www.ocel-standard.org/2.1/ocel20_specification.pdf), with the sections in the order object-types, event-types, objects, events. Objects are grouped by object type, in the order of `<object-types>`, and so are the relationships within each event and object (by the type of the related object); within a type, the order of the mode is kept. Firing number _n_ happens at `startTime + (n - 1) * timeStepSeconds`; silent firings never get an event but advance the clock.

A mode decides what is logged and how (`ocel/modes/`, shared naming and object ids in `modes/shared.ts`). The **default mode** (`mode: "default"`):

- **Object types:** one per data class, named by its name, or by its id if another data class has the same name.
- **Event types:** one per distinct label of the non-silent transitions. Transitions with the same label share an event type; unnamed ones use their id.
- **Events:** one per non-silent firing (`e1`, `e2`, …), related to every distinct object in its binding, including objects the firing creates.
- **Objects:** the simulation's identifiers (e.g. `Order_1`), grouped by object type and in order of first appearance within a type. If the initial marking uses the same identifier for two data classes, those objects are named `<object type>:<identifier>`.
- **Object-to-object relationships:** within a token on a link place (a place with several data classes), each object is related to every other one, each pair once. This covers all link-place tokens of the initial marking (read before the simulation starts, so their objects are in the log even if no event touches them) and the link-place tokens consumed or produced by non-silent firings.
- Qualifiers are empty (`qualifier=""`) and there are no attributes (`<attributes/>`).

Note: pm4py's OCEL 2.0 importer drops objects that no event refers to (and their object-to-object relationships), so objects that only occur in untouched initial link tokens do not show up there.

The **state-aware mode** (`mode: "state-aware"`) also logs links as objects and records how objects move between places:

- **Object types:** one per data class, named as in the default mode, then one per distinct set of data classes of the link places, named `Link<type1>x<type2>…` with the data classes in declaration order (e.g. `LinkOrderxItem`). Every object type has a `state transition` attribute, link types also `linkedTypes` (both `string`).
- **Event types:** as in the default mode.
- **Events:** one per non-silent firing (`e1`, `e2`, …), related to every object that gets a state transition in it: the objects it moves between places with one data class and the link objects it consumes or produces. An object of the binding that the firing only touches through link tokens is not related to the event; it is reached through its link objects.
- **Objects:** objects of logged bindings, with ids as in the default mode, and link objects.
- **Link objects** (`l1`, `l2`, …, skipping ids in use): a link is a token on a link place, identified by its link type and the objects it links. It exists while at least one of its tokens is on a link place; moving it between link places keeps the link object, but producing the same objects again after its last token was consumed creates a new one. A new link object gets a `linkedTypes` value (e.g. `<attribute name="linkedTypes" time="…">Order, Item</attribute>`) and is related to each object it links, and each of them to it; linked objects are not related to each other directly. The links of the initial marking (and their objects) are logged up front, at the time of the first firing. A link created by an unlogged silent firing gets its link object when a logged firing first touches it.
- **State transitions:** in each logged firing, an object gets a `state transition` value at the firing's time: `({p1, p2}, {p3})`, the places it was consumed from and the places it was produced into, `{}` for none. No value is logged if both sets are empty. Objects only count places with one data class, link objects only link places. Places are named by their name, or by their id if they have none or share it with another place.
- **Silent firings:** with `logSilentTransitions: true` (CLI `--log-silent`), they are logged like other firings (objects, link objects, relationships, state transitions) but get no event. By default nothing is logged for them. The default mode ignores this option.
- Qualifiers are empty (`qualifier=""`) and events have no attributes.

Note: as no event refers to them, pm4py's importer also drops objects that only ever occur in link places (see above).

## Structure

| Folder        | Contents                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/`      | Net, marking, binding and log types                                                                                                                                                                  |
| `parsing/`    | XML → net and initial marking (the only code that uses the moddle, from `../vendor/moddle`)                                                                                                          |
| `semantics/`  | Enablement, bindings and firing. Ports of the modeler's `lib/simulation/binding-utils/` and of `executeBinding` in `lib/simulation/context-pads/FireTransitionHandler.js` / `FireTransitionUtils.js` |
| `simulation/` | Main loop, random choices, object ids, object limits, enabled-transition tracking                                                                                                                    |
| `ocel/`       | OCEL 2.0 log model, log modes (`modes/`), clock and XML writer                                                                                                                                       |
| `output/`     | Text output                                                                                                                                                                                          |

The port was compared against the modeler's original functions on the example nets (simulated runs and random markings): bindings, consumed tokens and produced tokens were identical.

## Differences from the modeler's token game

- **Inhibitor arcs are read from their place in either direction.** The modeler lets an arc be drawn transition → place and then toggled to inhibitor (as in `example_nets/Simple_inhibitor.xml`), and renders it like a place → transition inhibitor. The modeler's simulation only looks at a transition's incoming arcs, so it ignores such an inhibitor.
- **Subsets for variable arcs are uniform.** The modeler adds each value with probability 1/2 and falls back to the last value if none was picked; this redraws instead.
- The structural check runs once per transition instead of on every enablement check.
- Inscription elements are matched to the place's data classes by data class, not by position (equivalent, since the modeler keeps both lists sorted by name).

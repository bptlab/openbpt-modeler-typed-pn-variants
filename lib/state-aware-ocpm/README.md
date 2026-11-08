# State-aware OCPM

State-aware object-centric process mining for typed Petri nets (t-PNID, OCPN, OPID/DOPID), as modeled with the [OpenBPT typed Petri net modeler](https://github.com/bptlab/openbpt-modeler-typed-pn-variants).

| Folder                        | Contents                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `event-log-generation/`       | Simulates a net and turns the run into an OCEL 2.0 log. See [its README](event-log-generation/README.md).      |
| `state-aware-opid-discovery/` | Not started yet.                                                                                               |
| `vendor/`                     | Unchanged copy of the modeler's moddle schema, used to read net XML. See [vendor/README.md](vendor/README.md). |

## Setup

Requires Node.js.

```
npm install
```

## Commands

- `npm run generate-log -- <net.xml> <MAX_OBJECTS> [seed] [options]`: simulate a net and write its OCEL 2.0 log (options in [event-log-generation/README.md](event-log-generation/README.md)). Example: `npm run generate-log -- event-log-generation/example_nets/Simple_link.xml 5 42`.
- `npm run typecheck`: type-check without writing output.
- `npm run build`: compile to `dist/` (ES modules with type declarations, for bundlers). The entry point is `@bptlab/state-aware-ocpm/event-log-generation`.
- `npm run lint` / `npm run lint:fix`: ESLint with Prettier as a rule.
- `npm run format`: Prettier.

There is no test suite. The CLI prints the seed of each run, and the same seed gives the same output.

## License

MIT, see [LICENSE](LICENSE).

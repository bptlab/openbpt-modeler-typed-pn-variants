# State-aware OCPM

State-aware object-centric process mining for typed Petri nets (t-PNID, OCPN, OPID/DOPID), as modeled with the [OpenBPT typed Petri net modeler](https://github.com/bptlab/openbpt-modeler-typed-pn-variants).

| Folder                        | Contents                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `event-log-generation/`       | Simulates a net and turns the run into an OCEL 2.0 log. See [its README](event-log-generation/README.md).                |
| `state-aware-opid-discovery/` | Discovers an OPID from a state-aware OCEL 2.0 log. See [its README](state-aware-opid-discovery/README.md).               |
| `ocel/`                       | Shared OCEL 2.0 code: log model, XML reader and writer, the state-aware attribute format.                                |
| `vendor/`                     | Unchanged copy of the modeler's moddle schema, used to read and write net XML. See [vendor/README.md](vendor/README.md). |

## Setup

Requires Node.js.

```
npm install
```

## Commands

Run from the repository root:

- `npx ts-node event-log-generation/cli.ts <net.xml> <MAX_OBJECTS> [seed] [options]`: simulate a net and write its OCEL 2.0 log (options in [event-log-generation/README.md](event-log-generation/README.md)). Example: `npx ts-node event-log-generation/cli.ts event-log-generation/example_nets/Simple_link.xml 5 42 --mode=state-aware --log-silent`.
- `npx ts-node state-aware-opid-discovery/cli.ts <log.ocel.xml> [--out=<file>]`: discover an OPID from a state-aware log and write it as modeler XML. Example: `npx ts-node state-aware-opid-discovery/cli.ts state-aware-opid-discovery/test_logs/Simple_link.ocel.xml`.
- The same as npm scripts: `npm run generate-log -- …` and `npm run discover-opid -- …`. In PowerShell, quote the separator (`npm run generate-log '--' …`), otherwise PowerShell drops it and npm takes the options for itself.
- `npm run typecheck`: type-check without writing output.
- `npm run build`: compile to `dist/` (ES modules with type declarations, for bundlers). The entry points are `@bptlab/state-aware-ocpm/event-log-generation` and `@bptlab/state-aware-ocpm/state-aware-opid-discovery`.
- `npm run lint` / `npm run lint:fix`: ESLint with Prettier as a rule.
- `npm run format`: Prettier.

There is no test suite. The log generation prints the seed of each run, and the same seed gives the same output. The discovery is deterministic, and `state-aware-opid-discovery/test_logs/` holds logs of the example nets to compare discovered nets with their sources.

## License

MIT, see [LICENSE](LICENSE).

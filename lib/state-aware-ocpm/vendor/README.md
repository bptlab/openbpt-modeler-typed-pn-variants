# Vendored modeler files

Unchanged copies of files from [openbpt-modeler-typed-pn-variants](https://github.com/bptlab/openbpt-modeler-typed-pn-variants) (MIT), so that net XML written by the modeler can be read without depending on the modeler package.

| Here                                  | In the modeler                     |
| ------------------------------------- | ---------------------------------- |
| `moddle/CustomModdle.js`, `index.js`  | `lib/moddle/`                      |
| `moddle/resources/modelSchema.js`     | `lib/moddle/resources/`            |
| `moddle/resources/diagramSchema.js`   | `lib/moddle/resources/`            |
| `moddle/resources/dc.json`            | `lib/moddle/resources/`            |
| `util/constants.js`                   | `lib/util/constants.js`            |

Copied at modeler commit `415f0c1` (✨ Add support for silent transitions). The folder layout mirrors the modeler's `lib/`, so the relative imports between the files work unchanged.

Left out: `lib/moddle/resources/customTypes.d.ts` and `modelSchemaTypes.d.ts`. They declare global types for the modeler's own simulation code and are not used here.

**Do not edit these files here.** ESLint and Prettier skip this folder. When the modeler's schema changes, copy the files again and update the commit above. For example, with the modeler checked out next to this repository:

```
M=../openbpt-typed-pn-variants-modeler
cp $M/lib/moddle/CustomModdle.js $M/lib/moddle/index.js vendor/moddle/
cp $M/lib/moddle/resources/modelSchema.js $M/lib/moddle/resources/diagramSchema.js $M/lib/moddle/resources/dc.json vendor/moddle/resources/
cp $M/lib/util/constants.js vendor/util/
```

/**
 * Exact synchronization: a variable arc marked as exact must consume all tokens of its place
 * that belong to the bound objects. Port of the modeler's `binding-utils/exactSynchro.ts`.
 *
 * Variable keys of the resulting patterns get a suffix: `:exact` (all values must be used)
 * or `:subset` (any non-empty subset may be used).
 */
import type { BindingKey, BindingPattern } from "../types/binding";
import type { ObjectId } from "../types/net";
import { groupTokensByNonVariableKeys } from "./linking";
import type { ArcReadInfoDict, ValuesPerKey } from "./types";

interface SynchronizedEntry {
  key: BindingKey;
  isExactSync: boolean;
  values: ObjectId[];
}

export function checkExactSynchroConstraints(
  exactSyncingDict: ArcReadInfoDict,
  validInputBindings: BindingPattern[],
): BindingPattern[] {
  const exactSyncingArcs = Object.entries(exactSyncingDict);
  if (exactSyncingArcs.length === 0) {
    return validInputBindings;
  }

  const tokenDictPerArc: Array<{
    arcId: string;
    groupedTokens: { [groupKey: string]: BindingPattern };
    valuesPerKey: ValuesPerKey;
  }> = exactSyncingArcs.map(([arcId, info]) => ({
    arcId,
    groupedTokens: groupTokensByNonVariableKeys(
      Object.keys(info.valuesPerKey),
      info.tokens,
    ),
    valuesPerKey: info.valuesPerKey,
  }));

  const synchedInputBindings: BindingPattern[] = [];

  for (const inputBinding of validInputBindings) {
    const currentSynchedBinding: SynchronizedEntry[] = [];

    // Check the binding against every exact-synchronization arc ...
    for (const tokenDict of tokenDictPerArc) {
      let countAny = 0;
      let countAll = 0;
      for (const arcBinding of Object.values(tokenDict.groupedTokens)) {
        for (const key of Object.keys(arcBinding)) {
          const tokenValues = arcBinding[key];
          const bindingValues = inputBinding[key] ?? [];
          countAny += tokenValues.some((v) => bindingValues.includes(v))
            ? 1
            : 0;
          countAll += tokenValues.every((v) => bindingValues.includes(v))
            ? 1
            : 0;
        }
      }
      if (countAny === 0 || (countAny > 0 && countAny !== countAll)) {
        // Not or only partially included: skip this arc
        continue;
      }
      for (const [key, tokenValues] of Object.entries(inputBinding)) {
        if (key.endsWith(":false")) {
          currentSynchedBinding.push({
            key,
            isExactSync: false,
            values: tokenValues,
          });
          continue;
        }
        const syncedValues = (tokenDict.valuesPerKey[key] ?? []).filter((v) =>
          tokenValues.includes(v),
        );
        const unsyncedValues = tokenValues.filter(
          (v) => !syncedValues.includes(v),
        );
        if (syncedValues.length > 0) {
          currentSynchedBinding.push({
            key,
            isExactSync: true,
            values: syncedValues,
          });
        }
        if (unsyncedValues.length > 0) {
          currentSynchedBinding.push({
            key,
            isExactSync: false,
            values: unsyncedValues,
          });
        }
      }
    }

    // ... and merge the results per key.
    const groupedByKey: { [key: string]: SynchronizedEntry[] } = {};
    for (const entry of currentSynchedBinding) {
      if (!groupedByKey[entry.key]) {
        groupedByKey[entry.key] = [];
      }
      groupedByKey[entry.key].push(entry);
    }

    const synchedBinding: BindingPattern = {};
    for (const [key, entries] of Object.entries(groupedByKey)) {
      const exactEntries = entries.filter((e) => e.isExactSync);
      const nonExactEntries = entries.filter((e) => !e.isExactSync);

      if (exactEntries.length > 0) {
        // The exact entry with the most values
        const maxEntry = exactEntries.reduce((prev, curr) =>
          curr.values.length > prev.values.length ? curr : prev,
        );
        if (maxEntry.values.length > 0) {
          synchedBinding[key + ":exact"] = maxEntry.values;
        }
      } else if (nonExactEntries.length > 0) {
        // The non-exact entry with the fewest values
        const minEntry = nonExactEntries.reduce((prev, curr) =>
          curr.values.length < prev.values.length ? curr : prev,
        );
        if (minEntry.values.length > 0) {
          synchedBinding[key + ":subset"] = minEntry.values;
        }
      }
    }
    if (Object.keys(synchedBinding).length > 0) {
      synchedInputBindings.push({ ...synchedBinding });
    }
  }

  return synchedInputBindings;
}

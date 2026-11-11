import { getPartsFromDataClassKey } from "./helpers";
import { groupTokensByNonVariableDataclasses } from "./linkingLogic";

/**
 * Exact synchronization: a variable arc marked as exact must consume whole groups of tokens
 * from its place.
 *
 * The tokens of the place are grouped by the arc's non-variable data class keys; without
 * them, all tokens form one group. A binding consumes from the groups whose non-variable
 * keys it binds, e.g. the items of the bound order. It is valid only if, for every exact
 * arc, it consumes from at least one group and binds all values of the variable keys of
 * each of these groups. Groups of other objects do not matter, even if they share a value
 * with a bound group (e.g. an employee that also works on another task).
 *
 * Variable keys of the resulting bindings get a suffix: `:exact` (all values must be used)
 * or `:subset` (any non-empty subset may be used).
 */
export function checkExactSynchroConstraints(
  exactSynchingArcPlaceInfoDict: ArcPlaceInfoDict,
  validInputBindings: BindingPerDataClass[],
): BindingPerDataClass[] {
  let synchedInputBindings: BindingPerDataClass[] = [];
  let tokenDictPerArc: {
    arcId: string;
    groupedTokens: GroupedTokens;
  }[] = [];

  const exactSynchroArcPlaceInfos = Object.entries(
    exactSynchingArcPlaceInfoDict,
  );

  if (exactSynchroArcPlaceInfos.length === 0) {
    return validInputBindings;
  }

  for (const [arcId, arcPlaceInfo] of exactSynchroArcPlaceInfos) {
    const groupedTokens = groupTokensByNonVariableDataclasses(
      Object.keys(arcPlaceInfo.dataClassInfoDict),
      arcPlaceInfo.tokens,
    );
    tokenDictPerArc.push({ arcId, groupedTokens });
  }

  // For each input Binding ...
  bindings: for (const inputBinding of validInputBindings) {
    let currentSynchedBinding: BindingPerDataClassWithSynchro[] = [];
    const isBound = (dataClassKey: string, values: string[]) =>
      values.every((value) =>
        (inputBinding[dataClassKey] ?? []).includes(value),
      );

    // ... check all exact synchro arcs ...
    for (const tokenDict of tokenDictPerArc) {
      // The groups the binding consumes from: it binds the values of their non-variable keys
      const boundGroups = Object.values(tokenDict.groupedTokens).filter(
        (group) =>
          Object.entries(group).every(
            ([dataClassKey, values]) =>
              getPartsFromDataClassKey(dataClassKey).isVariable ||
              isBound(dataClassKey, values),
          ),
      );
      // ... each of which it must consume whole; otherwise, exclude the binding
      const isConsumedWhole = (group: BindingPerDataClass) =>
        Object.entries(group).every(
          ([dataClassKey, values]) =>
            !getPartsFromDataClassKey(dataClassKey).isVariable ||
            isBound(dataClassKey, values),
        );
      if (boundGroups.length === 0 || !boundGroups.every(isConsumedWhole)) {
        continue bindings;
      }

      const groupValues: BindingPerDataClass = {};
      for (const group of boundGroups) {
        for (const [dataClassKey, values] of Object.entries(group)) {
          groupValues[dataClassKey] = [
            ...(groupValues[dataClassKey] ?? []),
            ...values,
          ];
        }
      }

      for (const [dataClassKey, tokenValues] of Object.entries(inputBinding)) {
        if (dataClassKey.endsWith(":false")) {
          currentSynchedBinding.push({
            DataClassKey: dataClassKey,
            isExactSync: false,
            values: tokenValues,
          });
          continue;
        }
        const syncedValues = (groupValues[dataClassKey] ?? []).filter((value) =>
          tokenValues.includes(value),
        );
        const unsynchedValues = tokenValues.filter(
          (value) => !syncedValues.includes(value),
        );
        if (syncedValues.length > 0) {
          currentSynchedBinding.push({
            DataClassKey: dataClassKey,
            isExactSync: true,
            values: syncedValues,
          });
        }
        if (unsynchedValues.length > 0) {
          currentSynchedBinding.push({
            DataClassKey: dataClassKey,
            isExactSync: false,
            values: unsynchedValues,
          });
        }
      }
    }

    // ... and merge the results.
    let synchedBindings: BindingPerDataClass = {};
    const groupedByKey: { [key: string]: BindingPerDataClassWithSynchro[] } =
      {};

    for (const entry of currentSynchedBinding) {
      if (!groupedByKey[entry.DataClassKey]) {
        groupedByKey[entry.DataClassKey] = [];
      }
      groupedByKey[entry.DataClassKey].push(entry);
    }

    for (const [dataClassKey, entries] of Object.entries(groupedByKey)) {
      const exactSyncEntries = entries.filter((e) => e.isExactSync);
      const nonExactSyncEntries = entries.filter((e) => !e.isExactSync);

      if (exactSyncEntries.length > 0) {
        // Pick the one with the largest values array
        const maxEntry = exactSyncEntries.reduce((prev, curr) =>
          curr.values.length > prev.values.length ? curr : prev,
        );
        if (maxEntry.values.length > 0) {
          synchedBindings[dataClassKey + ":exact"] = maxEntry.values;
        }
      } else if (nonExactSyncEntries.length > 0) {
        // Pick the one with the smallest values array
        const minEntry = nonExactSyncEntries.reduce((prev, curr) =>
          curr.values.length < prev.values.length ? curr : prev,
        );
        if (minEntry.values.length > 0) {
          synchedBindings[dataClassKey + ":subset"] = minEntry.values;
        }
      }
    }
    if (Object.keys(synchedBindings).length > 0) {
      synchedInputBindings.push({ ...synchedBindings });
    }
  }

  return synchedInputBindings;
}

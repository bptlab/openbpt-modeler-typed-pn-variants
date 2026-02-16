import { getLinkPartFromDataClassKey } from "./helpers";
import { groupTokensByNonVariableDataclasses } from "./linkingLogic";

export function checkExactSynchroConstraints(
  exactSynchingArcPlaceInfoDict: ArcPlaceInfoDict,
  validInputBindings: BindingPerDataClass[],
): BindingPerDataClass[] {
  let synchedInputBindings: BindingPerDataClass[] = [];
  let tokenDictPerArc: { arcId: string, groupedTokens: GroupedTokens, dataClassInfoDict: DataClassInfoDict }[] = [];

  const exactSynchroArcPlaceInfos = Object.entries(exactSynchingArcPlaceInfoDict);

  if (exactSynchroArcPlaceInfos.length === 0) {
    return validInputBindings;
  }

  for (const [arcId, arcPlaceInfo] of exactSynchroArcPlaceInfos) {
    const groupedTokens = groupTokensByNonVariableDataclasses(
      Object.keys(arcPlaceInfo.dataClassInfoDict).map(
        (dataClassKey) => getLinkPartFromDataClassKey(dataClassKey),
      ),
      arcPlaceInfo.tokens,
    );
    tokenDictPerArc.push({ arcId, groupedTokens, dataClassInfoDict: arcPlaceInfo.dataClassInfoDict });
  }

  // For each input Binding ...
  for (const inputBinding of validInputBindings) {
    let currentSynchedBinding: BindingPerDataClassWithSynchro[] = [];
    // ... check all exact synchro arcs ...
    for (const tokenDict of tokenDictPerArc) {
      let countAny = 0;
      let countAll = 0;
      for (const arcBinding of Object.values(tokenDict.groupedTokens)) {
        for (const dataClassKey of Object.keys(arcBinding)) {
          const tokenValues = arcBinding[dataClassKey];
          const bindingValues = inputBinding[dataClassKey] ?? [];
          countAny += tokenValues.some((tokenValue) =>
            bindingValues.includes(tokenValue),
          ) ? 1 : 0;
          countAll += tokenValues.every((tokenValue) =>
            bindingValues.includes(tokenValue),
          ) ? 1 : 0;
        }
      }
      if (countAny === 0 || (countAny > 0 && countAny !== countAll)) {
        // Not or partially included, exclude binding
        continue;
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
        const syncedValues = (tokenDict.dataClassInfoDict[dataClassKey] ?? []).filter(value => tokenValues.includes(value));
        const unsynchedValues = tokenValues.filter((value => !syncedValues.includes(value)));
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
    const groupedByKey: { [key: string]: BindingPerDataClassWithSynchro[] } = {};

    for (const entry of currentSynchedBinding) {
      if (!groupedByKey[entry.DataClassKey]) {
        groupedByKey[entry.DataClassKey] = [];
      }
      groupedByKey[entry.DataClassKey].push(entry);
    }

    for (const [dataClassKey, entries] of Object.entries(groupedByKey)) {
      const exactSyncEntries = entries.filter(e => e.isExactSync);
      const nonExactSyncEntries = entries.filter(e => !e.isExactSync);

      if (exactSyncEntries.length > 0) {
        // Pick the one with the largest values array
        const maxEntry = exactSyncEntries.reduce((prev, curr) =>
          curr.values.length > prev.values.length ? curr : prev
        );
        if (maxEntry.values.length > 0) {
          synchedBindings[dataClassKey + ":exact"] = maxEntry.values;
        }
      }
      if (nonExactSyncEntries.length > 0) {
        // Pick the one with the smallest values array
        const minEntry = nonExactSyncEntries.reduce((prev, curr) =>
          curr.values.length < prev.values.length ? curr : prev
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

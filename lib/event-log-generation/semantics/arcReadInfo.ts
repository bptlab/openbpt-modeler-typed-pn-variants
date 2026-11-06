/**
 * Reads what the incoming arcs of a transition see in the current marking.
 * Port of the modeler's `binding-utils/arcPlaceInfoLogic.ts`.
 */
import type { BindingPattern } from "../types/binding";
import type { Marking } from "../types/marking";
import type { NetArc } from "../types/net";
import {
  bindingKey,
  combinationKey,
  dataClassIdOfKey,
  tokensEqual,
} from "./keys";
import type {
  ArcReadInfo,
  ArcReadInfoDict,
  KeyedToken,
  ValuesPerKey,
} from "./types";

/**
 * Builds the read info for all incoming arcs (input and inhibitor).
 * Non-inhibitor arcs over the same set of binding keys are merged into the first one, keeping
 * only the tokens present in all of them.
 *
 * @returns `[all arcs (merged), exact-synchronization arcs (unmerged copies)]`
 */
export function buildArcReadInfoDict(
  incomingArcs: readonly NetArc[],
  marking: Marking,
): [ArcReadInfoDict, ArcReadInfoDict] {
  const arcReadInfoDict: ArcReadInfoDict = {};
  const exactSyncingDict: ArcReadInfoDict = {};
  const arcIdPerCombination: { [combination: string]: string } = {};

  for (const arc of incomingArcs) {
    const info = buildArcReadInfo(arc, marking);

    // Never merge inhibitor arcs
    if (info.isInhibitorArc) {
      arcReadInfoDict[arc.id] = info;
      continue;
    }

    if (info.isExactSyncing) {
      exactSyncingDict[arc.id] = { ...info };
    }

    const combination = combinationKey(Object.keys(info.valuesPerKey));
    const existingArcId = arcIdPerCombination[combination];
    if (!existingArcId) {
      arcIdPerCombination[combination] = arc.id;
      arcReadInfoDict[arc.id] = info;
    } else {
      const existing = arcReadInfoDict[existingArcId];
      existing.tokens = existing.tokens.filter((token) =>
        info.tokens.some((other) => tokensEqual(token, other)),
      );
      existing.valuesPerKey = valuesPerKeyFromTokens(existing.tokens);
    }
  }

  return [arcReadInfoDict, exactSyncingDict];
}

function valuesPerKeyFromTokens(tokens: readonly KeyedToken[]): ValuesPerKey {
  const valuesPerKey: ValuesPerKey = {};
  for (const token of tokens) {
    for (const [key, value] of Object.entries(token)) {
      if (!valuesPerKey[key]) {
        valuesPerKey[key] = [];
      }
      if (!valuesPerKey[key].includes(value)) {
        valuesPerKey[key].push(value);
      }
    }
  }
  return valuesPerKey;
}

/** Re-keys the tokens of the arc's place by the arc's binding keys. */
function buildArcReadInfo(arc: NetArc, marking: Marking): ArcReadInfo {
  const valuesPerKey: ValuesPerKey = {};
  for (const element of arc.inscription) {
    if (element.dataClassId && element.variableName) {
      const isVariable = arc.variableTypeId === element.dataClassId;
      valuesPerKey[
        bindingKey(element.dataClassId, element.variableName, isVariable)
      ] = [];
    }
  }

  const keys = Object.keys(valuesPerKey);
  const tokens: KeyedToken[] = [];
  for (const token of marking.get(arc.placeId) ?? []) {
    const keyedToken: KeyedToken = {};
    for (const [dataClassId, value] of Object.entries(token)) {
      for (const key of keys) {
        if (dataClassIdOfKey(key) !== dataClassId) continue;
        keyedToken[key] = value;
        if (!valuesPerKey[key].includes(value)) {
          valuesPerKey[key].push(value);
        }
      }
    }
    tokens.push(keyedToken);
  }

  return {
    arcId: arc.id,
    placeId: arc.placeId,
    tokens,
    isInhibitorArc: arc.kind === "inhibitor",
    isLinkingPlace: keys.length > 1,
    isExactSyncing: arc.isExactSynchronization,
    valuesPerKey,
  };
}

/** Candidate values per binding key, collected from all non-linking, non-inhibitor arcs. */
export function getBindingPatternFromNonLinkingArcs(
  arcReadInfoDict: ArcReadInfoDict,
): BindingPattern {
  const pattern: BindingPattern = {};
  for (const info of Object.values(arcReadInfoDict)) {
    if (info.isLinkingPlace || info.isInhibitorArc) continue;

    for (const [key, values] of Object.entries(info.valuesPerKey)) {
      if (pattern[key]) {
        pattern[key].push(...values);
      } else {
        pattern[key] = [...values];
      }
    }
  }
  return pattern;
}

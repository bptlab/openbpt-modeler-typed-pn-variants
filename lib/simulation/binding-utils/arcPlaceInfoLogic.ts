import {
  createDataClassCombinationKeyFromDict,
  getDataClassFromKey,
  getDataClassKey,
  tokensEqual,
} from "./helpers";

/**
 * Builds a dictionary mapping arc IDs to their corresponding `ArcPlaceInfo` objects.
 * For each incoming arc, generates its `ArcPlaceInfo` and checks for existing data class combinations.
 * If a combination is new, adds the arc and its info to the dictionary.
 * If a combination already exists, merges tokens into the existing `ArcPlaceInfo` and updates its data class info.
 *
 * @param incomingArcs - An array of `Arc` objects to process.
 * @returns A tuple `[ArcPlaceInfoDict, ArcPlaceInfoDict]` where the first dictionary contains merged arc info for all relevant arcs, and the second dictionary contains arc info for exact-syncing arcs only.
 */
export function buildArcPlaceInfoDict(incomingArcs: Arc[]): [ArcPlaceInfoDict, ArcPlaceInfoDict] {
  const arcPlaceInfoDict: ArcPlaceInfoDict = {};
  const exactSynchingArcPlaceInfoDict: ArcPlaceInfoDict = {};
  const existingDataClassCombinations: { [key: string]: string } = {};
  for (const arc of incomingArcs) {
    const arcPlaceInfo = buildArcPlaceInfo(arc);

    // Never merge inhibitor arcs
    if (arcPlaceInfo.isInhibitorArc) {
      arcPlaceInfoDict[arc.id] = arcPlaceInfo;
      continue;
    }

    // For exact synchro arcs, also keep track of them in a separate dictionary for later use in checking ExactSubsetSynchro constraints
    if (arcPlaceInfo.isExactSyncing) {
      exactSynchingArcPlaceInfoDict[arc.id] = Object.assign({}, arcPlaceInfo);
    }

    const dataClassCombination = createDataClassCombinationKeyFromDict(
      arcPlaceInfo.dataClassInfoDict,
    );
    if (!existingDataClassCombinations[dataClassCombination]) {
      existingDataClassCombinations[dataClassCombination] = arc.id;
      arcPlaceInfoDict[arc.id] = arcPlaceInfo;
    } else {
      // Merge tokens into existing ArcPlaceInfo
      const existingArcId = existingDataClassCombinations[dataClassCombination];
      arcPlaceInfoDict[existingArcId].tokens = arcPlaceInfoDict[
        existingArcId
      ].tokens.filter((token) =>
        arcPlaceInfo.tokens.some((existingToken) =>
          tokensEqual(token, existingToken),
        ),
      );
      arcPlaceInfoDict[existingArcId].dataClassInfoDict =
        buildDataClassInfoDict(
          arcPlaceInfoDict[existingArcId].tokens,
        );
    }
  }
  return [arcPlaceInfoDict, exactSynchingArcPlaceInfoDict];
}

/**
 * Builds a dictionary mapping data class IDs to their corresponding `DataClassInfo` objects,
 * aggregating token values from the provided array of tokens. If an existing dictionary is supplied,
 * its `isVariable` and `alias` properties are preserved for matching data class IDs.
 *
 * Each token is expected to contain key-value pairs, where keys represent data class identifiers.
 * The function uses `getDataClassFromKey` to resolve the data class from each key.
 * For each data class, unique token values are collected into the `tokenValues` array.
 *
 * @param tokens - An array of `Token` objects containing key-value pairs for data classes.
 * @param existingDataClassInfoDict - An optional dictionary of existing `DataClassInfo` objects,
 *   used to preserve `isVariable` and `alias` properties for data classes already present.
 * @returns A dictionary mapping data class IDs to their aggregated `DataClassInfo` objects.
 */
function buildDataClassInfoDict(
  tokens: Token[],
): { [dataClassKey: string]: string[] } {
  const dataClassInfoDict: { [dataClassKey: string]: string[] } = {};

  for (const token of tokens) {
    for (const [dataClassKey, value] of Object.entries(token)) {
      if (!dataClassInfoDict[dataClassKey]) {
        dataClassInfoDict[dataClassKey] = [];
      }
      if (!dataClassInfoDict[dataClassKey].includes(value)) {
        dataClassInfoDict[dataClassKey].push(value);
      }
    }
  }

  return dataClassInfoDict;
}

/**
 * Builds an `ArcPlaceInfo` object containing detailed information about the relationship
 * between an arc and its associated place, including marking tokens, data class info,
 * variable class, and arc properties.
 *
 * @param arc - The arc object for which to build place information.
 * @returns An `ArcPlaceInfo` object with the following properties:
 * - `arcId`: The unique identifier of the arc.
 * - `placeId`: The unique identifier of the associated place.
 * - `tokens`: An array of custom token objects representing the marking of the place.
 * - `isInhibitorArc`: Indicates if the arc is an inhibitor arc.
 * - `isLinkingPlace`: Indicates if the place links multiple data classes.
 * - `variableClass`: The data class used as a variable in the arc inscription, if any.
 * - `dataClassInfoDict`: A dictionary mapping data class IDs to their info, including
 *   variable status, alias, and token values.
 *
 * The function processes the marking tokens of the place, extracts data class information,
 * determines variable classes from arc inscriptions, and constructs a custom marking
 * representation for further simulation or analysis.
 */
function buildArcPlaceInfo(arc: Arc): ArcPlaceInfo {
  const arcObject = arc.businessObject;
  const place: Place = arcObject.source as Place;
  const isInhibitorArc: boolean = arcObject?.isInhibitorArc || false;
  const isExactSyncing: boolean = arcObject?.isExactSynchronization || false;

  const dataClassInfoDict: {
    [dataClassKey: string]: string[];
  } = {};

  let variableClass: DataClass | undefined = arc.businessObject.variableType;
  const inscriptionElements =
    arc.businessObject.inscription?.inscriptionElements ?? [];
  for (const element of inscriptionElements) {
    const dataClass = element.dataClass;
    const variableName = element.variableName;
    if (dataClass?.id && variableName) {
      const isVariable = variableClass === dataClass;
      dataClassInfoDict[
        getDataClassKey(
          dataClass.id,
          variableName,
          isVariable,
        )] = [];
    }
  }

  const marking = place.marking ?? [];
  const customMarking: Token[] = [];
  for (const token of marking) {
    const tokenObj: Token = {};
    const tokenValues = token.values ?? [];
    for (const { dataClass, value } of tokenValues) {
      Object.keys(dataClassInfoDict).filter((dataClassKey) =>
        getDataClassFromKey(dataClassKey).id === dataClass.id
      ).forEach((dataClassKey) => {
        tokenObj[dataClassKey] = value;
        if (!dataClassInfoDict[dataClassKey].includes(value)) {
          dataClassInfoDict[dataClassKey].push(value);
        }
      }
      );
    }
    customMarking.push(tokenObj);
  }

  return {
    arcId: arc.id,
    placeId: place.id,
    tokens: customMarking,
    isInhibitorArc: isInhibitorArc,
    isLinkingPlace: Object.keys(dataClassInfoDict).length > 1,
    isExactSyncing: isExactSyncing,
    variableClass: variableClass,
    dataClassInfoDict: dataClassInfoDict,
  };
}

/**
 * Extracts and aggregates token values for each data class from non-linking arcs in the provided arc-place information dictionary.
 *
 * Iterates through all entries in the `arcPlaceInfoDict`, skipping those marked as linking places.
 * For each non-linking place, it collects token values for each data class, identified by a unique key
 * generated from the data class ID, alias, and variable status. Token values are accumulated per data class.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information objects.
 * @returns An object mapping each unique data class key to an array of token values aggregated from non-linking arcs.
 */
export function getBindingPerDataClassFromNonLinkingArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): BindingPerDataClass {
  const bindingCandidatesPerDataClass: BindingPerDataClass = {};
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (arcPlaceInfo.isLinkingPlace || arcPlaceInfo.isInhibitorArc) continue;

    for (const [dataClassKey, tokenValues] of Object.entries(
      arcPlaceInfo.dataClassInfoDict,
    )) {
      bindingCandidatesPerDataClass[dataClassKey]
        ? bindingCandidatesPerDataClass[dataClassKey].push(...tokenValues)
        : (bindingCandidatesPerDataClass[dataClassKey] = [...tokenValues]);
    }
  }
  return bindingCandidatesPerDataClass;
}

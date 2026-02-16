/**
 * Compares two Token objects for equality.
 *
 * A Token is defined as a record where each key is a dataClassKey and the value is a token value.
 * The function checks if both tokens have the same set of keys and that each corresponding value is equal.
 *
 * @param tokenA - The first Token object to compare.
 * @param tokenB - The second Token object to compare.
 * @returns `true` if both tokens have identical keys and values; otherwise, `false`.
 */
export function tokensEqual(tokenA: Token, tokenB: Token): boolean {
  // Assuming the new Token implementation is: type Token = Record<string, string>
  // where the key is a dataClassKey and the value is the token value.

  const tokenAKeys = Object.keys(tokenA);
  const tokenBKeys = Object.keys(tokenB);

  return tokenAKeys.length !== tokenBKeys.length
    ? false
    : tokenAKeys.every(
        (key) => tokenB.hasOwnProperty(key) && tokenA[key] === tokenB[key],
      );
}

/**
 * Determines whether two tokens overlap based on a set of specified data class keys.
 *
 * This function checks if, for every key in `dataClassKeys`, both `tokenA` and `tokenB` have the key,
 * and the values for that key are strictly equal in both tokens. If any key is missing or the values differ,
 * the function returns `false`. Otherwise, it returns `true`.
 *
 * @param tokenA - The first token object to compare.
 * @param tokenB - The second token object to compare.
 * @param dataClassKeys - An array of string keys to check for overlap between the two tokens.
 * @returns `true` if all specified keys exist in both tokens and their values are equal; otherwise, `false`.
 */
export function tokensOverlap(
  tokenA: Token,
  tokenB: Token,
  dataClassKeys: string[],
): boolean {
  for (const key of dataClassKeys) {
    if (!(key in tokenA) || !(key in tokenB) || tokenA[key] !== tokenB[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Generates a unique key for a data class based on its identifier, alias, and variable status.
 *
 * @param id - The unique identifier for the data class.
 * @param alias - The alias or alternative name for the data class.
 * @param isVariable - Indicates whether the data class represents a variable.
 * @returns A string key in the format `${id}:${alias}:${isVariable}`.
 */
export function getDataClassKey(
  id: string,
  alias: string,
  isVariable: boolean,
): string {
  return `${id}:${alias}:${isVariable}`;
}

/**
 * Extracts the base data class identifier without variable flag.
 * @param dataClassKey - Full key like "DataClass_2:I:false" or "DataClass_2:I:true"
 * @returns Base key like "DataClass_2:I"
 */
export function getBaseDataClassKey(dataClassKey: string): string {
  // Remove the last part (":true" or ":false")
  const parts = dataClassKey.split(":");
  if (parts.length >= 2) {
    return parts.slice(0, -1).join(":");
  }
  return dataClassKey;
}

/**
 * Generates a unique string key representing a combination of data classes.
 *
 * The key is constructed by iterating over the entries of the provided `dataClassInfoDict`,
 * sorting them by their keys, and concatenating each entry's `dataClassId`, `alias`, and
 * `isVariable` property, separated by colons. Each entry is delimited by a double colon (`::`).
 * The trailing delimiter is removed from the final key.
 *
 * @param dataClassInfoDict - An object mapping data class IDs to their corresponding `DataClassInfo`.
 * @returns A string key uniquely identifying the combination of data classes and their properties.
 */
export function createDataClassCombinationKeyFromDict(dataClassInfoDict: {
  [dataClassKey: string]: string[];
}): string {
  let key: string = "";
  for (const dataClassKey of Object.keys(
    dataClassInfoDict,
  ).sort()) {
    key += dataClassKey + "::";
  }
  return key.endsWith("::") ? key.slice(0, -2) : key;
}

/**
 * Generates a unique string key representing a combination of data classes.
 *
 * The key is constructed by iterating over the entries of the provided `dataClassInfoDict`,
 * sorting them by their keys, and concatenating each entry's `dataClassId`, `alias`, and
 * `isVariable` property, separated by colons. Each entry is delimited by a double colon (`::`).
 * The trailing delimiter is removed from the final key.
 *
 * @param dataClassInfoDict - An object mapping data class IDs to their corresponding `DataClassInfo`.
 * @returns A string key uniquely identifying the combination of data classes and their properties.
 */
export function createDataClassCombinationKeyFromLink(link: Link): string {
  let key: string = "";
  for (const linkElement of [...link].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    key +=
      getDataClassKey(
        linkElement.id,
        linkElement.alias,
        linkElement.isVariable,
      ) + "::";
  }
  return key.endsWith("::") ? key.slice(0, -2) : key;
}

/**
 * Extracts a `DataClass` object from a string key.
 *
 * The key is expected to be a colon-separated string in the format `"id:alias:isVariableStr"`.
 * Only the `id` and `alias` parts are used to construct the returned object.
 *
 * @param dataClassKey - The colon-separated string representing the data class.
 * @returns An object containing the `id` and `alias` extracted from the key.
 */
export function getDataClassFromKey(dataClassKey: string): DataClass {
  const [id, alias, isVariableStr] = dataClassKey.split(":");
  return { id, alias };
}

export function getLinkPartFromDataClassKey(dataClassKey: string): { id: string; alias: string; isVariable: boolean } {
  const [id, alias, isVariableStr] = dataClassKey.split(":");
  return { id: id, alias: alias, isVariable: isVariableStr === "true" };
}

/**
 * Returns the set of all incoming dataClassKeys excluding inhibitor arcs.
 *
 * @param arcPlaceInfoDict - A dictionary mapping arc-place identifiers to their corresponding information, including tokens and inhibitor status.
 * @returns A complete set of dataClassKeys.
 */
export function getAllDataClassKeysFromArcs(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): Set<string> {
  return new Set(
    Object.values(arcPlaceInfoDict)
      .flatMap((arcPlaceInfo) =>
        Object.keys(arcPlaceInfo.dataClassInfoDict)
      ),
  );
}

/**
 * Flattens a binding from { dataClassKey: [values] } to [{ dataClassKey: value }]
 * @param {BindingPerDataClass} binding - Binding with array values per data class
 * @returns {Array} Array of single key-value objects for execution
 */
export function flattenBinding(
  binding: BindingPerDataClass,
): Array<{ [dataClassKey: string]: string }> {
  const flattened: { [dataClassKey: string]: string }[] = [];
  for (const [dataClassKey, values] of Object.entries(binding)) {
    values.forEach((value) => {
      flattened.push({ [dataClassKey]: value });
    });
  }
  return flattened;
}

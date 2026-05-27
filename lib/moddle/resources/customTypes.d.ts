/**
 * Represents information about a data class, including its variable status, alias, and associated token values.
 *
 * @property isVariable - Indicates whether the data class is a variable.
 * @property alias - A string alias for the data class.
 * @property tokenValues - An array of token values associated with the data class.
 */
interface DataClassInfo {
  isVariable: boolean;
  alias: string;
  tokenValues: TokenValue["value"][];
}

interface DataClassInfoDict {
  [dataClassKey: string]: TokenValue["value"][];
}

/**
 * Represents information about the relationship between an arc and a place in a Petri net model.
 *
 * @property arcId - The unique identifier of the arc.
 * @property placeId - The unique identifier of the place.
 * @property tokens - An array of tokens associated with the arc-place connection.
 * @property isInhibitorArc - Indicates whether the arc is an inhibitor arc.
 * @property isLinkingPlace - Indicates whether the place serves as a linking place.
 * @property variableClass - The variable data class associated with this arc-place connection, if any.
 * @property dataClassInfoDict - A dictionary mapping data class IDs to their corresponding information.
 */
interface ArcPlaceInfo {
  arcId: string;
  placeId: string;
  tokens: Token[];
  isInhibitorArc: boolean;
  isLinkingPlace: boolean;
  isExactSyncing: boolean;
  variableClass: DataClass | undefined;
  dataClassInfoDict: DataClassInfoDict;
}

/**
 * A dictionary mapping arc IDs to their corresponding {@link ArcPlaceInfo} objects.
 *
 * Each key in the dictionary is a unique string identifier for an arc,
 * and the value is the associated information about the place connected to that arc.
 */
interface ArcPlaceInfoDict {
  [arcId: string]: ArcPlaceInfo;
}

/**
 * Represents a mapping from a data class key to its corresponding string value.
 *
 * Each property key in the `Token` type is a string representing a data class identifier,
 * and its value is a string associated with that key.
 */
type Token = { [DataClassKey: string]: string };

/**
 * Represents a link as an array data class keys.
 */
type Link = string[];

/**
 * Represents a mapping from a data class combination key to an array of `Token` objects.
 * Each key corresponds to a unique combination of data classes, and the associated value is a list of tokens relevant to that combination.
 */
type TokenPerLink = { [dataClassCombinationKey: string]: Token[] };

/**
 * Represents a mapping between data class keys and their associated bindings.
 *
 * Each key in the object corresponds to a specific data class, and the value is an array of strings
 * representing the bindings related to that data class.
 */
type BindingPerDataClass = { [DataClassKey: string]: string[] };

type GroupedTokens = { [dataClassCombinationKey: string]: BindingPerDataClass };

type BindingPerDataClassWithSynchro = {
  DataClassKey: string;
  isExactSync: boolean;
  values: string[];
};

import {
  createDataClassCombinationKeyFromDict,
  createDataClassCombinationKeyFromLink,
  getDataClassKey,
  getLinkPartFromDataClassKey,
  tokensOverlap,
} from "./helpers";

/**
 * Finds and returns the largest (non-overlapping and non-subset) links from the given arc-place information dictionary.
 *
 * This function performs the following steps:
 * 1. Retrieves all links from the provided `arcPlaceInfoDict` and deduplicates them.
 * 2. Iteratively merges overlapping links into single links, ensuring that each link is a union of overlapping elements.
 * 3. Removes any links that are strict subsets of other links, leaving only the largest unique links.
 *
 * @param arcPlaceInfoDict - The dictionary containing arc-place information used to generate links.
 * @returns A tuple containing:
 *   - An array of the largest links (after merging and subset removal).
 *   - An array of all deduplicated links before merging.
 */
export function getBiggestLinks(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): [Link[], Link[]] {
  const allLinks: Link[] = deduplicateLinks(getAllLinks(arcPlaceInfoDict));
  let tempLinks = [...allLinks];

  // Iteratively merge overlapping links
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < tempLinks.length; i++) {
      for (let j = i + 1; j < tempLinks.length; j++) {
        if (linksOverlap(tempLinks[i], tempLinks[j])) {
          const mergedLink = mergeLinks(tempLinks[i], tempLinks[j]);
          // Remove the two links and add the merged one
          tempLinks.splice(j, 1);
          tempLinks.splice(i, 1, mergedLink);
          merged = true;
          break outer;
        }
      }
    }
  }

  // Remove subset links
  const biggestLinks = tempLinks.filter(
    (link, idx, arr) =>
      !arr.some(
        (other, otherIdx) =>
          otherIdx !== idx &&
          link.every((l) =>
            other.some(
              (ol) =>
                ol.id === l.id &&
                ol.alias === l.alias &&
                ol.isVariable === l.isVariable,
            ),
          ) &&
          other.length > link.length,
      ),
  );

  return [biggestLinks, allLinks];
}

/**
 * Retrieves all links from the provided `ArcPlaceInfoDict`.
 *
 * Iterates over each entry in the dictionary, and for those marked as linking places,
 * constructs a `Link` array containing objects with `id`, `alias`, and `isVariable` properties
 * for each data class in the place. Returns an array of all such links.
 *
 * @param arcPlaceInfoDict - A dictionary mapping place identifiers to their corresponding `ArcPlaceInfo` objects.
 * @returns An array of `Link` arrays, each representing the data class links for a linking place.
 */
function getAllLinks(arcPlaceInfoDict: ArcPlaceInfoDict): Link[] {
  const allLinks: Link[] = [];
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;
    const link: Link = [];
    for (const dataClassKey of Object.keys(
      arcPlaceInfo.dataClassInfoDict,
    )) {
      link.push(getLinkPartFromDataClassKey(dataClassKey));
    }
    allLinks.push(link);
  }
  return allLinks;
}

/**
 * Removes duplicate links from an array, treating links as equal if they contain the same set of elements,
 * regardless of order. Two links are considered duplicates if they have the same length and their elements,
 * identified by a unique key generated from `id`, `alias`, and `isVariable`, form identical sets.
 *
 * @param links - An array of `Link` objects to deduplicate.
 * @returns A new array containing only unique links, with duplicates removed.
 */
function deduplicateLinks(links: Link[]): Link[] {
  const uniqueLinks: Link[] = [];
  // Helper to compare two links for set equality (order-insensitive)
  function linksAreEqual(linkA: Link, linkB: Link): boolean {
    if (linkA.length !== linkB.length) return false;
    const aSet = new Set(
      linkA.map((l) => getDataClassKey(l.id, l.alias, l.isVariable)),
    );
    const bSet = new Set(
      linkB.map((l) => getDataClassKey(l.id, l.alias, l.isVariable)),
    );
    if (aSet.size !== bSet.size) return false;
    for (const item of aSet) {
      if (!bSet.has(item)) return false;
    }
    return true;
  }
  // Remove duplicates (order-insensitive)
  for (const link of links) {
    if (!uniqueLinks.some((existing) => linksAreEqual(existing, link))) {
      uniqueLinks.push(link);
    }
  }
  return uniqueLinks;
}

/**
 * Determines whether two arrays of links have any overlapping elements based on their unique data class keys.
 *
 * @param linkA - The first array of `Link` objects to compare.
 * @param linkB - The second array of `Link` objects to compare.
 * @returns `true` if there is at least one link in `linkB` that shares the same data class key as a link in `linkA`; otherwise, `false`.
 */
function linksOverlap(linkA: Link, linkB: Link): boolean {
  const aSet = new Set(
    linkA.map((l) => getDataClassKey(l.id, l.alias, l.isVariable)),
  );
  return linkB.some((l) =>
    aSet.has(getDataClassKey(l.id, l.alias, l.isVariable)),
  );
}

/**
 * Merges two arrays of `Link` objects into a single array, removing duplicates based on a unique key
 * generated from each link's `id`, `alias`, and `isVariable` properties.
 *
 * If a duplicate is found between `linkA` and `linkB`, the link from `linkB` will overwrite the one from `linkA`.
 *
 * @param linkA - The first array of `Link` objects to merge.
 * @param linkB - The second array of `Link` objects to merge.
 * @returns A new array containing the merged `Link` objects with duplicates removed.
 */
function mergeLinks(linkA: Link, linkB: Link): Link {
  const map = new Map<string, Link[0]>();
  for (const l of linkA) {
    map.set(getDataClassKey(l.id, l.alias, l.isVariable), l);
  }
  for (const l of linkB) {
    map.set(getDataClassKey(l.id, l.alias, l.isVariable), l);
  }
  return Array.from(map.values());
}

/**
 * Generates a mapping of tokens per link from the provided arc-place information dictionary.
 *
 * Iterates through each entry in the `arcPlaceInfoDict`, and for entries marked as linking places,
 * creates a key based on the data class combination. It then collects all tokens associated with
 * that linking place under the generated key.
 *
 * @param arcPlaceInfoDict - A dictionary containing information about arc places, keyed by their identifiers.
 * @returns A `TokenPerLink` object mapping each data class combination key to an array of tokens associated with that link.
 */
export function getTokenPerLink(
  arcPlaceInfoDict: ArcPlaceInfoDict,
): TokenPerLink {
  const tokenPerLink: TokenPerLink = {};
  for (const arcPlaceInfo of Object.values(arcPlaceInfoDict)) {
    if (!arcPlaceInfo.isLinkingPlace) continue;
    const key = createDataClassCombinationKeyFromDict(
      arcPlaceInfo.dataClassInfoDict,
    );
    tokenPerLink[key] = [];
    for (const token of arcPlaceInfo.tokens) {
      tokenPerLink[key].push(token);
    }
  }
  return tokenPerLink;
}

/**
 * Retrieves possible bindings for a given link by analyzing associated links, tokens, and non-linking arc constraints.
 *
 * This function performs the following steps:
 * 1. Finds all links associated with the provided link.
 * 2. Determines the largest set of tokens that cover all dataclasses in the link.
 * 3. Groups tokens by unique combinations of non-variable dataclasses.
 * 4. Constructs bindings for the link, filtering candidates based on non-linking arc constraints.
 * 5. Returns only bindings where all dataclasses have at least one candidate value.
 *
 * @param link - The link for which to retrieve bindings.
 * @param allLinks - All available links in the simulation.
 * @param tokenPerLink - A mapping from link keys to their associated tokens.
 * @param bindingPerDataClassFromNonLinkingArcs - Constraints from non-linking arcs, mapping dataclass keys to allowed values.
 * @returns An array of bindings, each mapping dataclass keys to arrays of candidate values that satisfy all constraints.
 */
export function getBindingsForLink(
  link: Link,
  allLinks: Link[],
  tokenPerLink: TokenPerLink,
  bindingPerDataClassFromNonLinkingArcs: BindingPerDataClass,
): BindingPerDataClass[] {
  // get all links associated with the current link
  const associatedLinks: Link[] = allLinks.filter((l) =>
    l.some((le) =>
      link.some(
        (ce) =>
          le.id === ce.id &&
          le.alias === ce.alias &&
          le.isVariable === ce.isVariable,
      ),
    ),
  );

  // Step 1: get biggest link tokens (tokens that have values for all dataclasses in the link)
  const biggestLinkTokens: Token[] = [];
  if (associatedLinks.length === 1) {
    biggestLinkTokens.push(
      ...tokenPerLink[createDataClassCombinationKeyFromLink(link)],
    );
  } else {
    biggestLinkTokens.push(...getLinkToken(associatedLinks, tokenPerLink));
  }
  // group tokens by unique links of non variable dataclasses
  const groupedTokens = groupTokensByNonVariableDataclasses(
    link,
    biggestLinkTokens,
  );

  // Step 2: create bindings for the link
  const bindings: BindingPerDataClass[] = [];

  for (const binding of Object.values(groupedTokens)) {
    // filter binding to only include candidates from non-linking arcs
    const filteredBinding: BindingPerDataClass = {};
    for (const [dataClassKey, values] of Object.entries(binding)) {
      filteredBinding[dataClassKey] = values.filter(
        (v) =>
          (bindingPerDataClassFromNonLinkingArcs[dataClassKey] &&
            bindingPerDataClassFromNonLinkingArcs[dataClassKey].includes(v)) ||
          !bindingPerDataClassFromNonLinkingArcs[dataClassKey],
      );
    }
    // If any dataClassKey has an empty array, skip this binding
    if (Object.values(filteredBinding).some((arr) => arr.length === 0)) {
      continue;
    }
    bindings.push(filteredBinding);
  }
  return bindings;
}

/**
 * Merges tokens associated with a list of links by iteratively combining them based on overlapping data class keys.
 *
 * @param associatedLinks - An array of `Link` objects to be merged. The function modifies this array by removing processed links.
 * @param tokenPerLink - An object mapping data class combination keys (generated from links) to arrays of `Token` objects.
 * @returns An array of `Token` objects representing the merged result of all associated links.
 *
 * @remarks
 * - The function starts with the first link and its associated tokens, then repeatedly finds overlaps with remaining links,
 *   merges the links and their tokens, and removes processed links from the array.
 * - The merging process relies on helper functions: `createDataClassCombinationKeyFromLink`, `getFirstOverlap`, `mergeLinks`, and `mergeLinkToken`.
 * - If no overlap is found (`overlapIndex === -1`), the function currently does nothing for that iteration.
 */
function getLinkToken(
  associatedLinks: Link[],
  tokenPerLink: TokenPerLink,
): Token[] {
  let mergedToken: Token[] = [];
  let mergedLink: Link = [];
  let overlapDataClassKeys: string[] = [];
  let overlapIndex: number | null = null;

  mergedLink = associatedLinks[0];
  mergedToken = tokenPerLink[createDataClassCombinationKeyFromLink(mergedLink)];
  associatedLinks.splice(0, 1);

  while (associatedLinks.length > 0) {
    [overlapIndex, overlapDataClassKeys] = getFirstOverlap(
      mergedLink,
      associatedLinks,
    );
    if (overlapIndex === -1) {
    }
    const linkToMerge = associatedLinks[overlapIndex];
    mergedLink = mergeLinks(mergedLink, linkToMerge);
    mergedToken = mergeLinkToken(
      mergedToken,
      tokenPerLink[createDataClassCombinationKeyFromLink(linkToMerge)],
      overlapDataClassKeys,
    );
    associatedLinks.splice(overlapIndex, 1);
  }

  return mergedToken;
}

/**
 * Finds the first overlap between a given link and an array of links.
 *
 * Iterates through the provided `links` array and compares the set of data class keys
 * generated from the input `link` and each link in the array. If any overlap is found,
 * returns the index of the overlapping link and an array of the overlapping keys.
 *
 * @param link - The link to compare against the array of links.
 * @param links - An array of links to check for overlaps.
 * @returns A tuple containing the index of the first overlapping link and an array of overlapping keys.
 *          If no overlap is found, returns [-1, []].
 */
function getFirstOverlap(link: Link, links: Link[]): [number, string[]] {
  for (let i = 0; i < links.length; i++) {
    const aKeys = new Set(
      link.map((l) => getDataClassKey(l.id, l.alias, l.isVariable)),
    );
    const bKeys = new Set(
      links[i].map((l) => getDataClassKey(l.id, l.alias, l.isVariable)),
    );
    const overlap = Array.from(aKeys).filter((key) => bKeys.has(key));
    if (overlap.length > 0) {
      return [i, overlap];
    }
  }
  return [-1, []];
}

/**
 * Merges two arrays of `Token` objects by combining tokens that overlap based on specified data class keys.
 *
 * For each pair of tokens from `linkTokensA` and `linkTokensB`, if they overlap according to the `tokensOverlap`
 * function and the provided `overlapDataClassKeys`, a new token is created by merging all key-value pairs from both tokens.
 * Keys from `tokenA` take precedence, and only non-overlapping keys from `tokenB` are added.
 *
 * @param linkTokensA - The first array of `Token` objects to merge.
 * @param linkTokensB - The second array of `Token` objects to merge.
 * @param overlapDataClassKeys - The list of keys used to determine if two tokens overlap.
 * @returns An array of merged `Token` objects where overlaps were found.
 */
function mergeLinkToken(
  linkTokensA: Token[],
  linkTokensB: Token[],
  overlapDataClassKeys: string[],
): Token[] {
  const mergedLinkTokens: Token[] = [];

  for (const tokenA of linkTokensA) {
    for (const tokenB of linkTokensB) {
      if (tokensOverlap(tokenA, tokenB, overlapDataClassKeys)) {
        // Merge tokens: combine all key-value pairs, starting with tokenA
        const mergedToken: Token = { ...tokenA };

        // Add non-overlapping keys from tokenB
        for (const key of Object.keys(tokenB)) {
          if (!(key in mergedToken)) {
            mergedToken[key] = tokenB[key];
          }
        }
        mergedLinkTokens.push(mergedToken);
      }
    }
  }

  return mergedLinkTokens;
}

/**
 * Groups tokens by combinations of non-variable dataclasses defined in the given link.
 *
 * For each token, constructs a group key based on the values of all non-variable link elements.
 * Tokens sharing the same combination of non-variable dataclass values are grouped together.
 * The resulting object maps each unique group key to a binding object, where each key is a dataclass key
 * and the value is an array of token values for variable dataclasses, or a single-element array for non-variable dataclasses.
 *
 * @param link - An array of link elements describing the dataclasses and whether they are variables.
 * @param tokens - An array of tokens to be grouped according to the non-variable dataclasses in the link.
 * @returns An object mapping each unique combination of non-variable dataclass values (as a string key)
 *          to a binding object, which maps dataclass keys to arrays of token values.
 */
export function groupTokensByNonVariableDataclasses(
  link: Link,
  tokens: Token[],
): { [dataClassCombinationKey: string]: BindingPerDataClass } {
  const groupedTokens: { [key: string]: BindingPerDataClass } = {};
  for (const token of tokens) {
    let groupKey = "";
    for (const linkElement of link) {
      if (!linkElement.isVariable) {
        const dataClassKey = getDataClassKey(
          linkElement.id,
          linkElement.alias,
          linkElement.isVariable,
        );
        groupKey += `${dataClassKey}:${token[dataClassKey]}::`;
      }
    }
    groupKey = groupKey.endsWith("::") ? groupKey.slice(0, -2) : groupKey;
    if (!groupedTokens[groupKey]) {
      groupedTokens[groupKey] = {};
      for (const linkElement of link) {
        const dataClassKey = getDataClassKey(
          linkElement.id,
          linkElement.alias,
          linkElement.isVariable,
        );
        groupedTokens[groupKey][dataClassKey] = linkElement.isVariable
          ? []
          : [token[dataClassKey]];
      }
    }
    for (const linkElement of link) {
      if (linkElement.isVariable) {
        const dataClassKey = getDataClassKey(
          linkElement.id,
          linkElement.alias,
          linkElement.isVariable,
        );
        groupedTokens[groupKey][dataClassKey].push(token[dataClassKey]);
      }
    }
  }
  return groupedTokens;
}

/**
 * Computes the cartesian product of arrays of binding candidates, merging each combination into a single binding object.
 *
 * @param bindingCandidatesPerLink - An array where each element is an array of `BindingPerDataClass` objects,
 *   representing possible bindings for each link.
 * @returns An array of `BindingPerDataClass` objects, each representing a unique combination of bindings across all links.
 *
 * @remarks
 * - If `bindingCandidatesPerLink` is empty, returns an empty array.
 * - Each resulting binding is created by merging objects from each input array.
 */
export function cartesianProductBindings(
  bindingCandidatesPerLink: BindingPerDataClass[][],
): BindingPerDataClass[] {
  if (bindingCandidatesPerLink.length === 0) return [];
  return bindingCandidatesPerLink.reduce(
    (acc, curr) => {
      const result: BindingPerDataClass[] = [];
      for (const a of acc) {
        for (const b of curr) {
          result.push({ ...a, ...b });
        }
      }
      return result;
    },
    [{}],
  );
}

/**
 * Returns a set of data class keys from `bindingPerDataClassFromNonLinkingArcs` that are not present in any of the provided `biggestLinks`.
 *
 * Iterates over each data class key and checks if it is used in any link element within the `biggestLinks` array.
 * If a data class key is not found in any link, it is added to the resulting set.
 *
 * @param bindingPerDataClassFromNonLinkingArcs - An object mapping data class keys to their bindings from non-linking arcs.
 * @param biggestLinks - An array of links, where each link is an array of link elements.
 * @returns A set of data class keys that are not present in any of the provided links.
 */
export function getDataClassesNotInLinks(
  bindingPerDataClassFromNonLinkingArcs: BindingPerDataClass,
  biggestLinks: Link[],
): Set<string> {
  const dataClassesNotInLinks: Set<string> = new Set();
  for (const dataClassKey of Object.keys(
    bindingPerDataClassFromNonLinkingArcs,
  )) {
    let usedInLink = false;
    for (const link of biggestLinks) {
      for (const linkElement of link) {
        const linkDataClassKey = getDataClassKey(
          linkElement.id,
          linkElement.alias,
          linkElement.isVariable,
        );
        if (dataClassKey === linkDataClassKey) {
          usedInLink = true;
          break;
        }
      }
      if (usedInLink) break;
    }
    if (!usedInLink) {
      dataClassesNotInLinks.add(dataClassKey);
    }
  }
  return dataClassesNotInLinks;
}


/**
 * Bindings through linking places (places colored with several data classes, whose tokens
 * relate object ids to each other). Port of the modeler's `binding-utils/linkingLogic.ts`.
 */
import type { BindingKey, BindingPattern } from "../types/binding";
import { combinationKey, parseBindingKey, tokensOverlap } from "./keys";
import type {
  ArcReadInfoDict,
  KeyedToken,
  KeyLink,
  TokensPerLink,
} from "./types";

/**
 * Merges the links of all linking places until no two links overlap.
 *
 * @returns `[merged links, all distinct links before merging]`
 */
export function getBiggestLinks(
  arcReadInfoDict: ArcReadInfoDict,
): [KeyLink[], KeyLink[]] {
  const allLinks = deduplicateLinks(getAllLinks(arcReadInfoDict));
  const tempLinks = [...allLinks];

  // Iteratively merge overlapping links
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < tempLinks.length; i++) {
      for (let j = i + 1; j < tempLinks.length; j++) {
        if (linksOverlap(tempLinks[i], tempLinks[j])) {
          const mergedLink = mergeLinks(tempLinks[i], tempLinks[j]);
          tempLinks.splice(j, 1);
          tempLinks.splice(i, 1, mergedLink);
          merged = true;
          break outer;
        }
      }
    }
  }

  // Remove links that are strict subsets of others
  const biggestLinks = tempLinks.filter(
    (link, index, links) =>
      !links.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          link.every((key) => other.includes(key)) &&
          other.length > link.length,
      ),
  );

  return [biggestLinks, allLinks];
}

function getAllLinks(arcReadInfoDict: ArcReadInfoDict): KeyLink[] {
  const allLinks: KeyLink[] = [];
  for (const info of Object.values(arcReadInfoDict)) {
    if (!info.isLinkingPlace) continue;
    allLinks.push(Object.keys(info.valuesPerKey));
  }
  return allLinks;
}

/** Removes links with the same set of keys (order-insensitive). */
function deduplicateLinks(links: readonly KeyLink[]): KeyLink[] {
  const linksAreEqual = (linkA: KeyLink, linkB: KeyLink): boolean => {
    if (linkA.length !== linkB.length) return false;
    const setA = new Set(linkA);
    const setB = new Set(linkB);
    if (setA.size !== setB.size) return false;
    for (const key of setA) {
      if (!setB.has(key)) return false;
    }
    return true;
  };

  const uniqueLinks: KeyLink[] = [];
  for (const link of links) {
    if (!uniqueLinks.some((existing) => linksAreEqual(existing, link))) {
      uniqueLinks.push(link);
    }
  }
  return uniqueLinks;
}

function linksOverlap(linkA: KeyLink, linkB: KeyLink): boolean {
  const setA = new Set(linkA);
  return linkB.some((key) => setA.has(key));
}

function mergeLinks(linkA: KeyLink, linkB: KeyLink): KeyLink {
  return Array.from(new Set([...linkA, ...linkB]));
}

/** The tokens of each linking place, keyed by the place's key combination. */
export function getTokensPerLink(
  arcReadInfoDict: ArcReadInfoDict,
): TokensPerLink {
  const tokensPerLink: TokensPerLink = {};
  for (const info of Object.values(arcReadInfoDict)) {
    if (!info.isLinkingPlace) continue;
    tokensPerLink[combinationKey(Object.keys(info.valuesPerKey))] = [
      ...info.tokens,
    ];
  }
  return tokensPerLink;
}

/**
 * The binding patterns for one merged link:
 * 1. join the tokens of all linking places that belong to the link,
 * 2. group the joined tokens by their values for the normal (non-variable) keys,
 * 3. keep only values also offered by the non-linking arcs (if they bind the key),
 * 4. drop groups in which a key has no value left.
 */
export function getBindingsForLink(
  link: KeyLink,
  allLinks: readonly KeyLink[],
  tokensPerLink: TokensPerLink,
  nonLinkingPattern: BindingPattern,
): BindingPattern[] {
  const associatedLinks = allLinks.filter((other) =>
    other.some((key) => link.includes(key)),
  );

  const biggestLinkTokens: KeyedToken[] = [];
  if (associatedLinks.length === 1) {
    biggestLinkTokens.push(...tokensPerLink[combinationKey(link)]);
  } else {
    biggestLinkTokens.push(...getLinkTokens(associatedLinks, tokensPerLink));
  }

  const groupedTokens = groupTokensByNonVariableKeys(link, biggestLinkTokens);

  const bindings: BindingPattern[] = [];
  for (const binding of Object.values(groupedTokens)) {
    const filteredBinding: BindingPattern = {};
    for (const [key, values] of Object.entries(binding)) {
      const allowed = nonLinkingPattern[key];
      filteredBinding[key] = values.filter(
        (value) => (allowed && allowed.includes(value)) || !allowed,
      );
    }
    if (Object.values(filteredBinding).some((values) => values.length === 0)) {
      continue;
    }
    bindings.push(filteredBinding);
  }
  return bindings;
}

/** Joins the tokens of several overlapping links on their shared keys. */
function getLinkTokens(
  associatedLinks: readonly KeyLink[],
  tokensPerLink: TokensPerLink,
): KeyedToken[] {
  const remaining = [...associatedLinks];
  let mergedLink = remaining[0];
  let mergedTokens = tokensPerLink[combinationKey(mergedLink)];
  remaining.splice(0, 1);

  while (remaining.length > 0) {
    const [overlapIndex, overlapKeys] = getFirstOverlap(mergedLink, remaining);
    if (overlapIndex === -1) {
      // Cannot happen: all associated links belong to one merged (connected) link.
      throw new Error("Linked places could not be joined.");
    }
    const linkToMerge = remaining[overlapIndex];
    mergedLink = mergeLinks(mergedLink, linkToMerge);
    mergedTokens = mergeLinkTokens(
      mergedTokens,
      tokensPerLink[combinationKey(linkToMerge)],
      overlapKeys,
    );
    remaining.splice(overlapIndex, 1);
  }

  return mergedTokens;
}

function getFirstOverlap(
  link: KeyLink,
  links: readonly KeyLink[],
): [number, BindingKey[]] {
  const keys = Array.from(new Set(link));
  for (let i = 0; i < links.length; i++) {
    const otherKeys = new Set(links[i]);
    const overlap = keys.filter((key) => otherKeys.has(key));
    if (overlap.length > 0) {
      return [i, overlap];
    }
  }
  return [-1, []];
}

/** Joins two token lists: every pair agreeing on the overlap keys becomes one token. */
function mergeLinkTokens(
  tokensA: readonly KeyedToken[],
  tokensB: readonly KeyedToken[],
  overlapKeys: readonly BindingKey[],
): KeyedToken[] {
  const merged: KeyedToken[] = [];
  for (const tokenA of tokensA) {
    for (const tokenB of tokensB) {
      if (tokensOverlap(tokenA, tokenB, overlapKeys)) {
        const mergedToken: KeyedToken = { ...tokenA };
        for (const key of Object.keys(tokenB)) {
          if (!(key in mergedToken)) {
            mergedToken[key] = tokenB[key];
          }
        }
        merged.push(mergedToken);
      }
    }
  }
  return merged;
}

/**
 * Groups tokens by their values for the normal keys of the link. Within a group, normal
 * keys hold their single value and variable keys collect the values of all tokens.
 */
export function groupTokensByNonVariableKeys(
  link: KeyLink,
  tokens: readonly KeyedToken[],
): { [groupKey: string]: BindingPattern } {
  const groupedTokens: { [groupKey: string]: BindingPattern } = {};
  for (const token of tokens) {
    const groupKey = link
      .filter((key) => !parseBindingKey(key).isVariable)
      .map((key) => `${key}:${token[key]}`)
      .join("::");

    if (!groupedTokens[groupKey]) {
      groupedTokens[groupKey] = {};
      for (const key of link) {
        groupedTokens[groupKey][key] = parseBindingKey(key).isVariable
          ? []
          : [token[key]];
      }
    }
    for (const key of link) {
      if (parseBindingKey(key).isVariable) {
        groupedTokens[groupKey][key].push(token[key]);
      }
    }
  }
  return groupedTokens;
}

/** All combinations that take one pattern from each list, merged into one pattern each. */
export function cartesianProductBindings(
  bindingCandidatesPerLink: readonly BindingPattern[][],
): BindingPattern[] {
  if (bindingCandidatesPerLink.length === 0) return [];
  return bindingCandidatesPerLink.reduce<BindingPattern[]>(
    (accumulated, current) => {
      const result: BindingPattern[] = [];
      for (const a of accumulated) {
        for (const b of current) {
          result.push({ ...a, ...b });
        }
      }
      return result;
    },
    [{}],
  );
}

/** Keys bound by the non-linking arcs that do not occur in any link. */
export function getKeysNotInLinks(
  nonLinkingPattern: BindingPattern,
  biggestLinks: readonly KeyLink[],
): Set<BindingKey> {
  const keysNotInLinks = new Set<BindingKey>();
  for (const key of Object.keys(nonLinkingPattern)) {
    if (!biggestLinks.some((link) => link.includes(key))) {
      keysNotInLinks.add(key);
    }
  }
  return keysNotInLinks;
}

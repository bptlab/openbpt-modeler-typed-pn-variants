/**
 * Computes the valid bindings of a transition in a marking.
 * Port of `getValidInputBindings` in the modeler's `binding-utils/bindingUtils.ts`.
 */
import type { BindingPattern } from "../types/binding";
import type { Marking } from "../types/marking";
import type { NetTransition } from "../types/net";
import {
  buildArcReadInfoDict,
  getBindingPatternFromNonLinkingArcs,
} from "./arcReadInfo";
import { checkExactSynchroConstraints } from "./exactSync";
import { filterBindingsByInhibitors, getNonInhibitorArcs } from "./inhibitor";
import {
  cartesianProductBindings,
  getBiggestLinks,
  getBindingsForLink,
  getKeysNotInLinks,
  getTokensPerLink,
} from "./linking";
import { hasAvailableTokensForAllArcs } from "./structure";

/**
 * Returns the valid binding patterns of the transition; it is enabled if there is at least one.
 *
 * Unlike the modeler, this does not repeat the structural check on every call: it never
 * changes during a simulation, so callers run `checkStructure` once and skip transitions
 * that fail it.
 */
export function getValidBindingPatterns(
  transition: NetTransition,
  marking: Marking,
): BindingPattern[] {
  // Step 1: read the incoming arcs
  const [arcReadInfoDict, exactSyncingDict] = buildArcReadInfoDict(
    transition.incoming,
    marking,
  );

  // Early return: a non-inhibitor arc has no tokens
  if (!hasAvailableTokensForAllArcs(arcReadInfoDict)) {
    return [];
  }

  // Step 2: links between data classes established by linking places
  const nonInhibitorArcs = getNonInhibitorArcs(arcReadInfoDict);
  const [biggestLinks, allLinks] = getBiggestLinks(nonInhibitorArcs);
  const tokensPerLink = getTokensPerLink(nonInhibitorArcs);

  // Step 3: compute bindings
  const nonLinkingPattern =
    getBindingPatternFromNonLinkingArcs(nonInhibitorArcs);

  let validInputBindings: BindingPattern[];
  if (biggestLinks.length === 0) {
    // Step 3.1: no links, only the non-linking arcs bind (empty pattern without incoming arcs)
    validInputBindings = [nonLinkingPattern];
  } else {
    // Step 3.2: bindings per link, combined with the keys outside of all links
    const bindingCandidatesPerLink: BindingPattern[][] = biggestLinks.map(
      (link) =>
        getBindingsForLink(link, allLinks, tokensPerLink, nonLinkingPattern),
    );

    const keysNotInLinks = getKeysNotInLinks(nonLinkingPattern, biggestLinks);
    if (keysNotInLinks.size > 0) {
      const patternForKeysNotInLinks: BindingPattern = {};
      keysNotInLinks.forEach((key) => {
        patternForKeysNotInLinks[key] = nonLinkingPattern[key];
      });
      bindingCandidatesPerLink.push([patternForKeysNotInLinks]);
    }
    validInputBindings = cartesianProductBindings(bindingCandidatesPerLink);
  }

  // Step 4: remove bindings blocked by inhibitor arcs
  const filteredInputBindings = filterBindingsByInhibitors(
    validInputBindings,
    arcReadInfoDict,
  );

  // Step 5: exact synchronization (adds ":exact" / ":subset" to the keys if it applies)
  return checkExactSynchroConstraints(exactSyncingDict, filteredInputBindings);
}

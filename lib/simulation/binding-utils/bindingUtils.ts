import { filter } from "min-dash";
import {
  buildArcPlaceInfoDict,
  getBindingPerDataClassFromNonLinkingArcs,
} from "./bindingUtilsArcPlaceInfoLogic";
import {
  hasAvailableTokensForAllArcs,
  isStructurallyIncorrect,
} from "./bindingUtilsEarlyReturnLogic";
import { checkExactSynchroConstraints } from "./bindingUtilsExactSynchro";
import {
  getNonInhibitorArcs,
  filterBindingsByInhibitors
} from "./bindingUtilsInhibitorLogic";
import {
  cartesianProductBindings,
  getBiggestLinks,
  getBindingsForLink,
  getDataClassesNotInLinks,
  getTokenPerLink,
} from "./bindingUtilsLinkingLogic";
import { json } from "stream/consumers";

export function getValidInputBindings(
  transition: Transition,
): BindingPerDataClass[] {
  // Early return: structural incorrect
  if (isStructurallyIncorrect(transition.incoming, transition.outgoing)[0]) {
    // console.log(`Transition ${transition.id} has unbound output variables.`);
    return [];
  }

  // Step 1: build arcPlaceInfoDict and tokenStructure
  const arcPlaceInfoDict = buildArcPlaceInfoDict(transition.incoming);

  //console.log(`Transition ${transition.id} arcPlaceInfoDict: ${JSON.stringify(arcPlaceInfoDict)}`);

  // Early return: missing tokens in non-inhibitor arcs
  if (!hasAvailableTokensForAllArcs(arcPlaceInfoDict)) {
    // console.log(`Transition ${transition.id} has missing tokens in non-inhibitor arcs.`);
    return [];
  }

  // Step 2: get biggest exclusive links, link tokens per place, placeId per dataClass alias
  const nonInhibitorArcs = getNonInhibitorArcs(arcPlaceInfoDict);

  const [biggestLinks, allLinks] = getBiggestLinks(nonInhibitorArcs);
  const tokenPerLink = getTokenPerLink(nonInhibitorArcs);

  // Step 3: compute bindings
  const bindingPerDataClassFromNonLinkingArcs =
    getBindingPerDataClassFromNonLinkingArcs(nonInhibitorArcs);

  //console.log(`Transition ${transition.id} biggest links: ${JSON.stringify(tokenPerLink)}`);

  let validInputBindings: BindingPerDataClass[];

  if (biggestLinks.length == 0) {
    // Step 3.1: no links exist, return only bindings from non-linking arcs
    // if there are no incoming arcs, return empty binding
    validInputBindings = [bindingPerDataClassFromNonLinkingArcs];
  } else {
    // Step 3.2: links exist, return only bindings that satisfy the links
    const bindingCandidatesPerLink: BindingPerDataClass[][] = [];

    for (const link of biggestLinks) {
      // each bindingCandidatesPerLink is a BindingPerDataClass for one link
      // and only contains bindings for data classes used in that link
      const bindingCandidate = getBindingsForLink(
        link,
        allLinks,
        tokenPerLink,
        bindingPerDataClassFromNonLinkingArcs,
      );
      bindingCandidatesPerLink.push(bindingCandidate);
    }

    // lastly, push all token of arcs which data classes are not used in any link
    const dataClassesNotInLinks = getDataClassesNotInLinks(
      bindingPerDataClassFromNonLinkingArcs,
      biggestLinks,
    );

    if (dataClassesNotInLinks.size > 0) {
      const bindingForNonLinkingDataClasses: BindingPerDataClass = {};
      dataClassesNotInLinks.forEach((dataClassKey) => {
        bindingForNonLinkingDataClasses[dataClassKey] =
          bindingPerDataClassFromNonLinkingArcs[dataClassKey];
      });
      bindingCandidatesPerLink.push([bindingForNonLinkingDataClasses]);
    }
    // Create Cartesian product of all bindingCandidatesPerLink
    validInputBindings = cartesianProductBindings(bindingCandidatesPerLink);
  }

  console.log(`Transition ${transition.id} has ${JSON.stringify(validInputBindings)} valid input bindings before filtering by inhibitors and checking ExactSubsetSynchro constraints.`);

  // Step 4: eliminate bindings blocked by inhibitors
  const filteredInputBindings = filterBindingsByInhibitors(
    validInputBindings,
    arcPlaceInfoDict,
  );

  // Step 5: check for ExactSubsetSynchro constraint
  // This also always enlarges the dataClassKeys to four components
  const synchedInputBindings = checkExactSynchroConstraints(
    arcPlaceInfoDict,
    filteredInputBindings,
  );

  console.log(`Transition ${transition.id} has ${JSON.stringify(synchedInputBindings)} valid input bindings.`);

  return synchedInputBindings;
}

export function transitionIsEnabled(transition: Transition): boolean {
  const bindings = getValidInputBindings(transition);
  return !!bindings.length;
}

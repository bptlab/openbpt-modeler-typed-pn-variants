/**
 * Checks that do not need the full binding computation.
 * Port of the modeler's `binding-utils/earlyReturnLogic.ts`.
 */
import type { NetArc, NetTransition, PetriNet } from "../types/net";
import { bindingKey } from "./keys";
import type { ArcReadInfoDict } from "./types";

export interface StructuralCheck {
  isIncorrect: boolean;
  message: string;
}

interface NamedPlace {
  id: string;
  name: string;
}

/**
 * A transition is structurally incorrect (and can never fire) if, ignoring inhibitor arcs:
 * - an arc has no data class in its inscription,
 * - a place is connected to it by more than one incoming or more than one outgoing arc, or
 * - an output variable (that is not generated) is not bound by any input arc.
 *
 * This depends only on the net, so it is checked once per transition before simulating.
 */
export function checkStructure(
  transition: NetTransition,
  net: PetriNet,
): StructuralCheck {
  const incomingArcs = transition.incoming.filter(
    (arc) => arc.kind !== "inhibitor",
  );
  // Inhibitor arcs are always attached as incoming arcs, so all outgoing arcs count.
  const outgoingArcs = transition.outgoing;

  const sources: NamedPlace[] = [];
  const targets: NamedPlace[] = [];
  let hasArcsWithoutDataClass = false;

  const collectKeys = (
    arcs: readonly NetArc[],
    isOutgoing: boolean,
  ): Set<string> => {
    const keys = new Set<string>();
    for (const arc of arcs) {
      const place = {
        id: arc.placeId,
        name: net.places.get(arc.placeId)?.name ?? "",
      };
      (isOutgoing ? targets : sources).push(place);

      if (arc.inscription.length === 0) {
        hasArcsWithoutDataClass = true;
        continue;
      }
      for (const element of arc.inscription) {
        if (element.isGenerated) continue;
        const alias = net.dataClasses.get(element.dataClassId)?.alias ?? "";
        keys.add(
          bindingKey(
            element.dataClassId,
            element.variableName || alias,
            arc.variableTypeId === element.dataClassId,
          ),
        );
      }
    }
    return keys;
  };

  const inputKeys = collectKeys(incomingArcs, false);
  const outputKeys = collectKeys(outgoingArcs, true);

  const duplicateTargets = targets.filter(
    (target, index) => targets.findIndex((t) => t.id === target.id) !== index,
  );
  const duplicateSources = sources.filter(
    (source, index) => sources.findIndex((s) => s.id === source.id) !== index,
  );
  const unboundOutputKeys = Array.from(outputKeys).filter(
    (key) => !inputKeys.has(key),
  );

  const isIncorrect =
    hasArcsWithoutDataClass ||
    duplicateTargets.length > 0 ||
    duplicateSources.length > 0 ||
    unboundOutputKeys.length > 0;

  return {
    isIncorrect,
    message: isIncorrect
      ? createStructuralIncorrectnessMessage(
          hasArcsWithoutDataClass,
          duplicateSources,
          duplicateTargets,
          unboundOutputKeys,
        )
      : "This transition is structurally correct.",
  };
}

/** Every non-inhibitor incoming arc has at least one token to read. */
export function hasAvailableTokensForAllArcs(
  arcReadInfoDict: ArcReadInfoDict,
): boolean {
  return Object.values(arcReadInfoDict).every(
    (info) => info.isInhibitorArc || info.tokens.length > 0,
  );
}

function createStructuralIncorrectnessMessage(
  hasArcsWithoutDataClass: boolean,
  duplicateSources: NamedPlace[],
  duplicateTargets: NamedPlace[],
  unboundOutputKeys: string[],
): string {
  const label = (place: NamedPlace) =>
    place.name.length > 0 ? place.name : place.id;
  const reasons: string[] = [];

  if (hasArcsWithoutDataClass) {
    reasons.push("an arc has no data class");
  }
  if (duplicateSources.length > 0) {
    const names = Array.from(new Set(duplicateSources.map(label)));
    reasons.push(`multiple incoming arcs from [${names.join(", ")}]`);
  }
  if (duplicateTargets.length > 0) {
    const names = Array.from(new Set(duplicateTargets.map(label)));
    reasons.push(`multiple outgoing arcs towards [${names.join(", ")}]`);
  }
  if (unboundOutputKeys.length > 0) {
    const variables = unboundOutputKeys.map((key) => {
      const [, variableName, isVariable] = key.split(":");
      return isVariable === "true" ? `${variableName}[]` : variableName;
    });
    reasons.push(`unbound output variables: ${variables.join(", ")}`);
  }

  return `This transition can structurally never be fired: ${reasons.join("; ")}.`;
}

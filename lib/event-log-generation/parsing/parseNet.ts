import createModdle from "../../moddle";
import modelSchema from "../../moddle/resources/modelSchema";
import { EventLogInputError } from "../errors";
import type { Marking, ObjectToken } from "../types/marking";
import type {
  NetArc,
  NetArcKind,
  NetDataClass,
  NetInscriptionElement,
  NetPlace,
  NetTransition,
  PetriNet,
} from "../types/net";
import type {
  ModdleArc,
  ModdleDataClass,
  ModdleElement,
  ModdleParseResult,
  ModdlePlace,
  ModdleTransition,
} from "./moddleTypes";

export interface ParsedNet {
  net: PetriNet;
  initialMarking: Marking;
  /** Problems found while reading the XML. Affected elements are skipped. */
  warnings: string[];
}

// The XML prefix (e.g. "tpn") is taken from the moddle schema, so this folder only depends on the moddle.
const PREFIX: string = modelSchema.prefix;
const typeName = (name: string): string => `${PREFIX}:${name}`;

/**
 * Reads a Petri net XML (as written by `saveXML`) into the internal net structure and
 * its initial marking. The diagram (layout) part of the file is ignored.
 */
export async function parseNet(xml: string): Promise<ParsedNet> {
  let parseResult: ModdleParseResult;
  try {
    parseResult = (await createModdle().fromXML(
      xml,
      typeName("Definitions"),
    )) as ModdleParseResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new EventLogInputError(`The XML could not be read: ${reason}`);
  }
  const { rootElement, warnings: moddleWarnings } = parseResult;

  // Files written by the modeler carry attributes the schema does not declare (e.g. `type`);
  // moddle keeps them and only warns, so those warnings are left out.
  const warnings = moddleWarnings
    .map((warning) => warning.message ?? String(warning))
    .filter((message) => !message.startsWith("unknown attribute"))
    .map((message) => `XML: ${message}`);

  const model = rootElement.model;
  if (!model) {
    throw new EventLogInputError("The XML does not contain a model.");
  }

  const dataClasses = new Map<string, NetDataClass>();
  const ensureDataClass = (dataClass: ModdleDataClass): NetDataClass => {
    let existing = dataClasses.get(dataClass.id);
    if (!existing) {
      existing = {
        id: dataClass.id,
        name: dataClass.name || dataClass.id,
        alias: dataClass.alias ?? "",
      };
      dataClasses.set(dataClass.id, existing);
    }
    return existing;
  };

  for (const declaration of model.declarations ?? []) {
    if (declaration.$instanceOf(typeName("DataClass"))) {
      ensureDataClass(declaration as ModdleDataClass);
    }
  }

  const places = new Map<string, NetPlace>();
  const transitions = new Map<string, NetTransition>();
  const initialMarking: Marking = new Map();
  const arcs: ModdleArc[] = [];

  for (const element of model.modelElements ?? []) {
    if (element.$instanceOf(typeName("Place"))) {
      const place = element as ModdlePlace;
      places.set(place.id, {
        id: place.id,
        name: place.name,
        color: (place.color ?? [])
          .filter(Boolean)
          .map((dataClass) => ensureDataClass(dataClass).id),
      });
      initialMarking.set(
        place.id,
        readTokens(place, ensureDataClass, warnings),
      );
    } else if (element.$instanceOf(typeName("Transition"))) {
      const transition = element as ModdleTransition;
      transitions.set(transition.id, {
        id: transition.id,
        name: transition.name,
        isSilent: transition.isSilent ?? false,
        incoming: [],
        outgoing: [],
      });
    } else if (element.$instanceOf(typeName("Arc"))) {
      arcs.push(element as ModdleArc);
    }
  }

  // Arcs are attached after all nodes are known, keeping document order (like the importer).
  for (const moddleArc of arcs) {
    const arc = readArc(moddleArc, ensureDataClass, warnings);
    if (!arc) continue;

    const transition = transitions.get(arc.transitionId);
    if (!transition || !places.has(arc.placeId)) {
      warnings.push(`Arc ${arc.id}: unknown place or transition, skipped.`);
      continue;
    }
    if (arc.kind === "output") {
      transition.outgoing.push(arc);
    } else {
      transition.incoming.push(arc);
    }
  }

  return {
    net: { dataClasses, places, transitions },
    initialMarking,
    warnings,
  };
}

function readTokens(
  place: ModdlePlace,
  ensureDataClass: (dataClass: ModdleDataClass) => NetDataClass,
  warnings: string[],
): ObjectToken[] {
  return (place.marking ?? []).map((token) => {
    const objectToken: { [dataClassId: string]: string } = {};
    for (const tokenValue of token.values ?? []) {
      if (!tokenValue.dataClass || tokenValue.value == null) {
        warnings.push(
          `Place ${place.id}: token ${token.id} has a value without data class or id, ignored.`,
        );
        continue;
      }
      objectToken[ensureDataClass(tokenValue.dataClass).id] = String(
        tokenValue.value,
      );
    }
    return objectToken;
  });
}

function readArc(
  arc: ModdleArc,
  ensureDataClass: (dataClass: ModdleDataClass) => NetDataClass,
  warnings: string[],
): NetArc | undefined {
  const { source, target } = arc;
  let placeId: string;
  let transitionId: string;
  let direction: "toTransition" | "toPlace";

  if (isOfType(source, "Place") && isOfType(target, "Transition")) {
    placeId = source.id;
    transitionId = target.id;
    direction = "toTransition";
  } else if (isOfType(source, "Transition") && isOfType(target, "Place")) {
    placeId = target.id;
    transitionId = source.id;
    direction = "toPlace";
  } else {
    warnings.push(
      `Arc ${arc.id}: does not connect a place and a transition, skipped.`,
    );
    return undefined;
  }

  let kind: NetArcKind;
  if (arc.isInhibitorArc) {
    kind = "inhibitor";
  } else {
    kind = direction === "toTransition" ? "input" : "output";
  }

  const inscription: NetInscriptionElement[] = [];
  for (const element of arc.inscription?.inscriptionElements ?? []) {
    if (!element.dataClass) {
      warnings.push(
        `Arc ${arc.id}: inscription element ${element.id} has no data class, ignored.`,
      );
      continue;
    }
    inscription.push({
      dataClassId: ensureDataClass(element.dataClass).id,
      variableName: element.variableName,
      isGenerated: element.isGenerated ?? false,
    });
  }

  return {
    id: arc.id,
    kind,
    placeId,
    transitionId,
    variableTypeId: arc.variableType
      ? ensureDataClass(arc.variableType).id
      : undefined,
    isExactSynchronization: arc.isExactSynchronization ?? false,
    inscription,
  };
}

function isOfType(
  element: ModdleElement | undefined,
  name: string,
): element is ModdleElement {
  return !!element && element.$instanceOf(typeName(name));
}

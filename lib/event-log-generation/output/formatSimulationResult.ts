import type {
  BoundVariable,
  PlaceTokens,
  SimulationResult,
  TransitionFiring,
} from "../types/log";

export interface FormatOptions {
  /** Also list the consumed and produced tokens of each firing. */
  showTokens?: boolean;
}

const TERMINATION_TEXT: Record<SimulationResult["terminationReason"], string> =
  {
    noEnabledTransitions: "no transition is enabled",
    maxEventsReached: "the event limit was reached",
  };

/** Renders the firing sequence as readable text, one line per firing. */
export function formatSimulationResult(
  result: SimulationResult,
  options: FormatOptions = {},
): string {
  const typeLimits = result.objectsPerType
    .filter((type) => type.max !== undefined)
    .map((type) => `${type.dataClassName} ${type.max}`);
  const limitsText =
    typeLimits.length > 0 ? `, per type: ${typeLimits.join(", ")}` : "";
  const lines: string[] = [
    `Simulation (seed ${result.seed}, MAX_OBJECTS ${result.maxObjects}${limitsText}, event limit ${result.maxEvents})`,
  ];

  const labels = result.firings.map(transitionLabel);
  const labelWidth = Math.max(0, ...labels.map((label) => label.length));
  const stepWidth = String(result.firings.length).length + 1;

  result.firings.forEach((firing, index) => {
    const step = `#${firing.step}`.padEnd(stepWidth);
    const binding = firing.binding.map(formatVariable).join(", ");
    lines.push(`  ${step}  ${labels[index].padEnd(labelWidth)}  ${binding}`);
    if (options.showTokens) {
      const indent = " ".repeat(stepWidth + 4);
      lines.push(`${indent}- ${formatPlaceTokens(firing.consumed)}`);
      lines.push(`${indent}+ ${formatPlaceTokens(firing.produced)}`);
    }
  });

  // Per type: "created/max", or just "created" if only MAX_OBJECTS limits the type.
  const perType = result.objectsPerType
    .filter((type) => type.max !== undefined || type.created > 0)
    .map((type) =>
      type.max === undefined
        ? `${type.dataClassName} ${type.created}`
        : `${type.dataClassName} ${type.created}/${type.max}`,
    );
  const perTypeText = perType.length > 0 ? ` (${perType.join(", ")})` : "";
  lines.push(
    `Stopped after ${result.firings.length} firings: ${TERMINATION_TEXT[result.terminationReason]}. ` +
      `Objects created: ${result.createdObjectCount} of ${result.effectiveMaxObjects}${perTypeText}.`,
  );

  if (result.neverEnabledTransitions.length > 0) {
    lines.push("Transitions that can never fire:");
    for (const transition of result.neverEnabledTransitions) {
      lines.push(`  ${transition.name || transition.id}: ${transition.reason}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    result.warnings.forEach((warning) => lines.push(`  ${warning}`));
  }

  return lines.join("\n");
}

function transitionLabel(firing: TransitionFiring): string {
  const name = firing.transition.name || firing.transition.id;
  return firing.transition.isSilent ? `[silent] ${name}` : name;
}

function formatVariable(variable: BoundVariable): string {
  const name = variable.isVariable
    ? `${variable.variableName}[]`
    : variable.variableName;
  const values = variable.isVariable
    ? `{${variable.values.join(", ")}}`
    : variable.values.join(", ");
  const suffix = variable.origin === "generated" ? " (new)" : "";
  return `${name}=${values}${suffix}`;
}

function formatPlaceTokens(places: readonly PlaceTokens[]): string {
  if (places.length === 0) return "(none)";
  return places
    .map((place) => {
      const tokens = place.tokens
        .map((token) => `(${Object.values(token).join(", ")})`)
        .join(" ");
      return `${place.placeName || place.placeId}: ${tokens}`;
    })
    .join("; ");
}

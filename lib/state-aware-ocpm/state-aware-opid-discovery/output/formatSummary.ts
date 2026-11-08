import type { DiscoveredNet, DiscoveredVariable } from "../types";

/**
 * A text overview of a discovered net: its data classes, places per object type, and per
 * transition its signature and variables. Variables that bind several objects end in
 * `[]`; generated ones are marked "new".
 */
export function formatDiscoverySummary(net: DiscoveredNet): string {
  const placeLabels = new Map(net.places.map(({ id, label }) => [id, label]));
  const dataClassNames = new Map(
    net.dataClasses.map(({ id, name }) => [id, name]),
  );
  const set = (states: readonly string[]) => `{${states.join(", ")}}`;
  const placeSet = (placeIds: readonly string[]) =>
    set(placeIds.map((id) => placeLabels.get(id) ?? id));

  const placesPerType = new Map<string, string[]>();
  for (const { objectType, label } of net.places) {
    placesPerType.set(objectType, [
      ...(placesPerType.get(objectType) ?? []),
      label,
    ]);
  }

  const lines = [
    `Discovered ${count(net.dataClasses.length, "data class", "data classes")}, ${count(net.places.length, "place")}, ${count(net.transitions.length, "transition")} and ${count(net.arcs.length, "arc")}.`,
    `Data classes: ${net.dataClasses.map(({ name, alias }) => `${name} (${alias})`).join(", ")}`,
    "Places:",
    ...Array.from(
      placesPerType,
      ([objectType, labels]) => `  ${objectType}: ${labels.join(", ")}`,
    ),
    "Transitions:",
  ];

  const variable = (v: DiscoveredVariable) =>
    `${v.name}${v.isMultiple ? "[]" : ""} (${[
      dataClassNames.get(v.dataClassId) ?? v.dataClassId,
      ...(v.isGenerated ? ["new"] : []),
    ].join(", ")}): ${placeSet(v.from)} -> ${placeSet(v.to)}`;

  for (const transition of net.transitions) {
    const occurrences = transition.isSilent
      ? `${count(transition.occurrenceCount, "time point")} without event`
      : count(transition.occurrenceCount, "event");
    lines.push(
      `  ${transition.isSilent ? "silent" : transition.name} (${transition.id}, ${occurrences})`,
      `    signature: ${transition.signature
        .map(
          ({ objectType, from, to }) =>
            `${objectType} ${set(from)} -> ${set(to)}`,
        )
        .join("; ")}`,
      ...transition.variables.map((v) => `    ${variable(v)}`),
    );
  }
  return lines.join("\n");
}

/** `1 place`, `2 places` */
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

import type { StateAwareLog } from "../log/readStateAwareLog";
import type { DiscoveredDataClass } from "../types";
import type { NextId } from "./ids";

/**
 * One data class per object type that is not a link type, in declaration order (also
 * for types without objects), named after the type.
 */
export function discoverDataClasses(
  log: StateAwareLog,
  nextId: NextId,
): DiscoveredDataClass[] {
  const names = log.objectTypes.filter((type) => !log.linkTypes.has(type));
  return names.map((name) => ({
    id: nextId("DataClass"),
    name,
    alias: shortestUniquePrefix(
      name,
      names.filter((other) => other !== name),
    ),
  }));
}

/**
 * The shortest prefix of `name` that none of `others` starts with (case-sensitive), or
 * `name` itself if there is none, e.g. for "Item" next to "Items".
 */
export function shortestUniquePrefix(
  name: string,
  others: readonly string[],
): string {
  for (let length = 1; length < name.length; length++) {
    const prefix = name.slice(0, length);
    if (!others.some((other) => other.startsWith(prefix))) return prefix;
  }
  return name;
}

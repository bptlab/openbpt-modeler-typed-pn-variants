/** Hands out readable ids `<prefix>_1`, `<prefix>_2`, … per prefix. */
export type NextId = (prefix: string) => string;

export function createIdGenerator(): NextId {
  const counters = new Map<string, number>();
  return (prefix) => {
    const counter = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, counter);
    return `${prefix}_${counter}`;
  };
}

/**
 * Compares names the way the modeler sorts place colors and inscription elements
 * (`sortByName` in the modeler's declarations panel): case-insensitive.
 */
export function compareNames(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
}

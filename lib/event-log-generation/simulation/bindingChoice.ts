import { parseBindingKey, withoutSynchronization } from "../semantics/keys";
import type { BindingPattern, ConcreteBinding } from "../types/binding";
import type { ObjectId } from "../types/net";
import { pickRandom, type RandomSource } from "./random";

/**
 * Picks a concrete binding from a pattern, as the modeler's random firing does:
 * - normal variable: one candidate, uniformly,
 * - variable-arc variable with `:exact`: all candidates,
 * - other variable-arc variable: a uniformly chosen non-empty subset of the candidates.
 *
 * (The modeler adds each candidate with probability 1/2 and falls back to the last one if
 * none was taken, which favors that candidate. This redraws instead.)
 */
export function chooseConcreteBinding(
  pattern: BindingPattern,
  random: RandomSource,
): ConcreteBinding {
  const binding: ConcreteBinding = {};
  for (const [key, candidates] of Object.entries(pattern)) {
    const { isVariable, synchronization } = parseBindingKey(key);
    const values = Array.from(new Set(candidates));

    let chosen: ObjectId[];
    if (!isVariable) {
      chosen = values.length > 0 ? [pickRandom(random, values)] : [];
    } else if (synchronization === "exact") {
      chosen = values;
    } else {
      chosen = randomNonEmptySubset(values, random);
    }

    const targetKey = withoutSynchronization(key);
    binding[targetKey] = [...(binding[targetKey] ?? []), ...chosen];
  }
  return binding;
}

function randomNonEmptySubset(
  values: readonly ObjectId[],
  random: RandomSource,
): ObjectId[] {
  if (values.length === 0) return [];
  let subset: ObjectId[];
  do {
    subset = values.filter(() => random() < 0.5);
  } while (subset.length === 0);
  return subset;
}

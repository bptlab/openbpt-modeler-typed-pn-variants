import { getValidBindingPatterns } from "../semantics/bindings";
import type { BindingPattern } from "../types/binding";
import type { Marking } from "../types/marking";
import type { NetTransition } from "../types/net";
import type { ObjectBudget } from "./objectBudget";

/**
 * Keeps track of the enabled transitions and their binding patterns.
 *
 * After a firing, only transitions that read from a place whose tokens changed (through an
 * input or inhibitor arc) are recomputed; the bindings of all other transitions cannot have
 * changed. Separately, transitions that create objects are disabled once their next firing
 * would exceed the object budget.
 */
export class EnabledTransitions {
  private readonly patternsById = new Map<string, BindingPattern[]>();
  private readonly enabledIds = new Set<string>();
  /** Place id → transitions that read from it. */
  private readonly readersByPlace = new Map<string, NetTransition[]>();
  private readonly objectCreatingTransitions: NetTransition[];

  /**
   * @param transitions the transitions that can fire at all (structurally correct), in net order
   */
  constructor(
    private readonly transitions: readonly NetTransition[],
    private readonly marking: Marking,
    private readonly budget: ObjectBudget,
  ) {
    for (const transition of transitions) {
      for (const arc of transition.incoming) {
        const readers = this.readersByPlace.get(arc.placeId) ?? [];
        if (!readers.includes(transition)) {
          readers.push(transition);
        }
        this.readersByPlace.set(arc.placeId, readers);
      }
    }
    this.objectCreatingTransitions = transitions.filter(
      (transition) => budget.objectsCreatedBy(transition) > 0,
    );
    transitions.forEach((transition) => this.recompute(transition));
  }

  /** The enabled transitions, in net order. */
  list(): NetTransition[] {
    return this.transitions.filter((transition) =>
      this.enabledIds.has(transition.id),
    );
  }

  patternsOf(transition: NetTransition): BindingPattern[] {
    return this.patternsById.get(transition.id) ?? [];
  }

  /** Updates the enabled set after `fired` fired (and `budget` recorded its objects). */
  afterFiring(fired: NetTransition, createdObjects: number): void {
    // The tokens of the fired transition's input and output places changed.
    const changedPlaceIds = new Set<string>();
    for (const arc of [...fired.incoming, ...fired.outgoing]) {
      if (arc.kind !== "inhibitor") {
        changedPlaceIds.add(arc.placeId);
      }
    }

    const affected = new Set<NetTransition>();
    for (const placeId of changedPlaceIds) {
      for (const reader of this.readersByPlace.get(placeId) ?? []) {
        affected.add(reader);
      }
    }
    affected.forEach((transition) => this.recompute(transition));

    if (createdObjects > 0) {
      for (const transition of this.objectCreatingTransitions) {
        if (!this.budget.allows(transition)) {
          this.disable(transition);
        }
      }
    }
  }

  private recompute(transition: NetTransition): void {
    // The budget only shrinks, so a transition over budget never needs its bindings again.
    if (!this.budget.allows(transition)) {
      this.disable(transition);
      return;
    }
    const patterns = getValidBindingPatterns(transition, this.marking);
    this.patternsById.set(transition.id, patterns);
    if (patterns.length > 0) {
      this.enabledIds.add(transition.id);
    } else {
      this.enabledIds.delete(transition.id);
    }
  }

  private disable(transition: NetTransition): void {
    this.patternsById.set(transition.id, []);
    this.enabledIds.delete(transition.id);
  }
}

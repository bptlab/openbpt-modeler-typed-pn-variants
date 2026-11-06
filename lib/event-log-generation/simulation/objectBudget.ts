import { getGeneratedVariables } from "../semantics/firing";
import type { NetTransition } from "../types/net";
import type { ResolvedObjectLimits } from "./objectLimits";

/**
 * Limits the objects created during the simulation. A transition may fire only if, after
 * the firing, neither the total (`maxObjects`) nor the limit of any object type it creates
 * would be exceeded. Transitions that create no objects are never limited.
 */
export class ObjectBudget {
  private createdTotal = 0;
  private readonly createdPerType = new Map<string, number>();
  /** Transition id → data class id → objects created per firing. */
  private readonly objectsPerFiring = new Map<string, Map<string, number>>();

  constructor(private readonly limits: ResolvedObjectLimits) {}

  get createdCount(): number {
    return this.createdTotal;
  }

  createdCountOf(dataClassId: string): number {
    return this.createdPerType.get(dataClassId) ?? 0;
  }

  /** Number of objects one firing of the transition creates (fixed by the net). */
  objectsCreatedBy(transition: NetTransition): number {
    let total = 0;
    this.objectTypesCreatedBy(transition).forEach((count) => (total += count));
    return total;
  }

  allows(transition: NetTransition): boolean {
    let total = 0;
    for (const [dataClassId, count] of this.objectTypesCreatedBy(transition)) {
      total += count;
      const max = this.limits.maxObjectsPerType.get(dataClassId);
      if (max !== undefined && this.createdCountOf(dataClassId) + count > max) {
        return false;
      }
    }
    return this.createdTotal + total <= this.limits.maxObjects;
  }

  record(createdObjects: ReadonlyArray<{ dataClassId: string }>): void {
    for (const { dataClassId } of createdObjects) {
      this.createdTotal += 1;
      this.createdPerType.set(
        dataClassId,
        this.createdCountOf(dataClassId) + 1,
      );
    }
  }

  private objectTypesCreatedBy(transition: NetTransition): Map<string, number> {
    let perType = this.objectsPerFiring.get(transition.id);
    if (!perType) {
      perType = new Map();
      for (const dataClassId of getGeneratedVariables(transition).values()) {
        perType.set(dataClassId, (perType.get(dataClassId) ?? 0) + 1);
      }
      this.objectsPerFiring.set(transition.id, perType);
    }
    return perType;
  }
}

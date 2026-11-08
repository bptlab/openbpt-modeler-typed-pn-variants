import type { NetDataClass, ObjectId } from "../types/net";

/**
 * Creates fresh object ids of the form `<DataClassName>_<n>`, counting per data class and
 * skipping ids that are already in use (same scheme as the modeler's `IdentifierService`).
 */
export class ObjectIdGenerator {
  private readonly usedIds: Set<ObjectId>;
  private readonly nextCounterByClass = new Map<string, number>();

  constructor(existingIds: Iterable<ObjectId>) {
    this.usedIds = new Set(existingIds);
  }

  next(dataClass: NetDataClass): ObjectId {
    let counter = this.nextCounterByClass.get(dataClass.id) ?? 1;
    let candidate: ObjectId;
    do {
      candidate = `${dataClass.name}_${counter++}`;
    } while (this.usedIds.has(candidate));

    this.nextCounterByClass.set(dataClass.id, counter);
    this.usedIds.add(candidate);
    return candidate;
  }
}

import { MODELER_PREFIX } from "../../util/constants";

export default function IdentifierService(elementRegistry) {
  // injector-provided registry to inspect current tokens on the diagram
  this.elementRegistry = elementRegistry;

  // Internal list of identifiers
  this.objectIdentifiers = [];

  // reservations keyed by id string -> { id, dataClassId }
  this._reservations = new Map();

  // per-dataClass counter cache to avoid scanning every time
  this._nextCounterByClass = {};

  this.getIdentifiers = () => {
    return Array.from(this.objectIdentifiers);
  };

  this.setIdentifiers = (ids) => {
    this.objectIdentifiers = Array.from(ids || []);
    // reset counters so they will be reseeded when next needed
    this._nextCounterByClass = {};
  };

  this.addIdentifier = (id) => {
    if (!this.objectIdentifiers.includes(id)) {
      this.objectIdentifiers.push(id);
    }
  };

  // gather existing identifiers from internal list and from currently present tokens
  this._collectExistingIds = () => {
    const ids = new Set(this.objectIdentifiers || []);

    if (
      this.elementRegistry &&
      typeof this.elementRegistry.forEach === "function"
    ) {
      try {
        this.elementRegistry.forEach((element) => {
          if (element.type === `${MODELER_PREFIX}:Place`) {
            const marking = element.businessObject?.marking || [];
            marking.forEach((token) => {
              (token.values || []).forEach((v) => {
                if (v && v.value !== undefined && v.value !== null) {
                  ids.add(String(v.value));
                }
              });
            });
          }
        });
      } catch (e) {
        // defensively ignore any iteration errors
        console.warn(
          "IdentifierService: failed to collect ids from elementRegistry",
          e,
        );
      }
    }

    return ids;
  };

  // Helper to safely escape strings for regex usage
  const _escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

  // Reserve an identifier for a dataClass. Returns a reservation token object
  // which must be committed or revoked later.
  this.reserveIdentifier = (dataClass) => {
    const classId = dataClass.id || dataClass.name;

    // seed next counter if missing
    if (this._nextCounterByClass[classId] == null) {
      // compute max existing numeric suffix for this class
      const existing = Array.from(this._collectExistingIds()).filter((id) =>
        new RegExp(`^${_escapeRegex(dataClass.name)}_(\\\\d+)$`).test(id),
      );
      let maxId = 0;
      existing.forEach((id) => {
        const match = id.match(
          new RegExp(`^${_escapeRegex(dataClass.name)}_(\\\\d+)$`),
        );
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxId) maxId = num;
        }
      });
      this._nextCounterByClass[classId] = maxId + 1;
    }

    let candidate = null;
    // loop until we find a candidate not present in current ids or reservations
    do {
      candidate = `${dataClass.name}_${this._nextCounterByClass[classId]++}`;
    } while (
      this._collectExistingIds().has(candidate) ||
      Array.from(this._reservations.values()).some((r) => r.id === candidate)
    );

    const token = { id: candidate, dataClassId: classId };
    // store reservation keyed by id for stability
    this._reservations.set(token.id, token);
    return token;
  };

  // Commit a previously reserved identifier token. Adds it to the known ids.
  this.commitReservation = (token) => {
    if (!token) return;
    const entry = this._reservations.get(token.id || token);
    if (!entry) return;
    this.addIdentifier(entry.id);
    this._reservations.delete(entry.id);
  };

  // Revoke a reservation (e.g., on undo) so the id can be reused later.
  this.revokeReservation = (token) => {
    if (!token) return;
    this._reservations.delete(token.id || token);
  };

  // Backwards-compatible generateUniqueId that reserves and commits immediately
  this.generateUniqueId = (dataClass) => {
    const token = this.reserveIdentifier(dataClass);
    this.commitReservation(token);
    return token.id;
  };
}

IdentifierService.$inject = ["elementRegistry"];

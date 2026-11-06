/**
 * In-memory model of an OCEL 2.0 log, following Section 7 ("XML Format") of the OCEL 2.0
 * specification. Times are ISO 8601 strings, e.g. "2025-01-01T00:00:00Z".
 */

/** The value types the OCEL 2.0 standard allows for attributes. */
export type OcelAttributeType =
  | "string"
  | "time"
  | "integer"
  | "float"
  | "boolean";

export interface OcelAttributeDefinition {
  name: string;
  type: OcelAttributeType;
}

/** An object type or an event type, with the attributes its objects or events may carry. */
export interface OcelType {
  name: string;
  attributes: OcelAttributeDefinition[];
}

/** An event-to-object or object-to-object relationship. */
export interface OcelRelationship {
  objectId: string;
  qualifier: string;
}

export interface OcelEventAttribute {
  name: string;
  value: string;
}

/** An object attribute value, valid from `time` until a later value of the same attribute. */
export interface OcelObjectAttribute {
  name: string;
  time: string;
  value: string;
}

export interface OcelEvent {
  id: string;
  type: string;
  time: string;
  attributes: OcelEventAttribute[];
  /** Event-to-object (E2O) relationships. */
  relationships: OcelRelationship[];
}

export interface OcelObject {
  id: string;
  type: string;
  attributes: OcelObjectAttribute[];
  /** Object-to-object (O2O) relationships. */
  relationships: OcelRelationship[];
}

export interface OcelLog {
  objectTypes: OcelType[];
  eventTypes: OcelType[];
  objects: OcelObject[];
  events: OcelEvent[];
}

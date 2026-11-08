import type { ObjectId } from "./net";

/**
 * Identifies one variable of a transition: `${dataClassId}:${variableName}:${isVariable}`,
 * where `isVariable` marks a variable arc (`x[]`). The exact-synchronization step may add a
 * fourth part, `:exact` or `:subset`.
 */
export type BindingKey = string;

/**
 * A valid binding as computed by the enablement logic (`BindingPerDataClass` in the modeler).
 * It describes a set of concrete bindings: for each key it lists the candidate object ids.
 * - normal variable (`...:false`): exactly one candidate is used,
 * - variable-arc variable (`...:true`): a non-empty subset is used,
 * - `...:true:exact`: all candidates are used.
 */
export type BindingPattern = { [key: BindingKey]: ObjectId[] };

/**
 * A concrete binding used to fire a transition. Keys always have three parts (no
 * synchronization suffix). Normal variables are bound to exactly one object id.
 */
export type ConcreteBinding = { [key: BindingKey]: ObjectId[] };

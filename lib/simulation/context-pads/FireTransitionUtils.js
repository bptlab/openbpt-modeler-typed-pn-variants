/**
 * Computes the cartesian product of a list of arrays.
 *
 * @param {Array<Array<any>>} valuesList - An array of arrays, each containing possible values for a dimension.
 * @returns {Array<Array<any>>} The cartesian product as an array of arrays, where each inner array is a combination of values.
 */
export function cartesianProduct(valuesList) {
  if (valuesList.length === 1) return valuesList;

  return [
    valuesList.reduce(
      (acc, list) => acc.flatMap((a) => list.map((b) => [...a, b[0]])),
      [[]],
    ),
  ];
}

/**
 * Finds tokens in a given place that match the allowed values specified by arc elements, variable type, and binding.
 *
 * @param {Object} place - The place object containing businessObject and marking information.
 * @param {Object[]>} arcElements - Array of arc element objects used to determine allowed values.
 * @param {Object} variableType - The variable type object with `id` and `alias` properties.
 * @param {Object|Object[]>} binding - The binding(s) mapping data class keys to values.
 * @returns {Object[]>|null} An array of matching token objects if any are found, otherwise `null`.
 */
export function findMatchingToken(place, arcElements, variableType, binding) {
  const marking = place?.businessObject?.marking || [];
  if (!marking.length) return null;
  const bindingArray = Array.isArray(binding) ? binding : [binding];

  // Build a map of allowed vales per color.id: Map<colorId, Set<value>>
  const allowedValuesByColor = new Map();

  arcElements.forEach((el, i) => {
    const color = place?.businessObject?.color?.[i];
    const [isVariable, colorId] = checkIfColorIsVariable(variableType, color);
    if (!colorId || !el.variableName) return;
    const dataClassKey = `${colorId}:${el.variableName}:${isVariable}`;

    bindingArray.forEach((b) => {
      const value = b[dataClassKey];
      if (value === undefined) return;
      const set = allowedValuesByColor.get(colorId) ?? new Set(); // getOrDefault
      set.add(value);
      allowedValuesByColor.set(colorId, set);
    });
  });

  // If no allowed values were found, return early
  if (!allowedValuesByColor.size) return null;

  // Filter tokens: a token matches if ALL its values are in the allowed sets
  const matches = marking.filter((token) => {
    const values = token?.values || [];
    if (!values.length) return false;

    return values.every((tv) => {
      const colorId = tv?.dataClass?.id;
      if (!colorId) return false;

      const allowedSet = allowedValuesByColor.get(colorId);
      return allowedSet ? allowedSet.has(tv.value) : false;
    });
  });

  return matches.length > 0 ? matches : null;
}

/**
 *  Collect values for generated variables on outgoing arcs.
 *  Reserves identifiers for generated variables.
 *
 * @param {Array} outgoingArcs - Transition outgoing arcs
 * @param {Object} identifierService - Service providing reserveIdentifier / generateUniqueId
 * @returns {{generatedBinding: Object, reservations: Array}} - Generated binding and reservations
 */
export function generateValuesForBinding(outgoingArcs, identifierService) {
  const generatedVariables = new Map(); // variableName -> color
  const reservations = [];
  const generatedBinding = {};

  for (const arc of outgoingArcs || []) {
    const elements = arc.businessObject.inscription?.inscriptionElements || [];
    const targetPlace = arc.target;

    elements.forEach((el, i) => {
      if (!el.isGenerated) return;
      if (!el.variableName) return;
      if (generatedVariables.has(el.variableName)) return; // keep first occurrence

      const color = targetPlace?.businessObject?.color?.[i];
      if (!color) return;

      generatedVariables.set(el.variableName, color);
    });
  }

  for (const [variableName, color] of generatedVariables.entries()) {
    const dataClassKey = `${color.id}:${variableName}:false`; // only non-variable data classes can be generated
    try {
      const token = identifierService.reserveIdentifier(color);
      reservations.push(token);
      generatedBinding[dataClassKey] = token.id;
    } catch (e) {
      generatedBinding[dataClassKey] =
        identifierService.generateUniqueId(color);
    }
  }

  return { generatedBinding, reservations };
}

/**
 * Extracts and maps token values from a given binding based on inscription elements, variable type, and color.
 *
 * @param {Object} place - The place object, typically containing an `id` property.
 * @param {Object[]} inscriptionElements - Array of inscription element objects to process.
 * @param {Object} variableType - The variable type object, expected to have `id` and `alias` properties.
 * @param {Object} color - The color object, expected to have `id` and `alias` properties.
 * @param {Object|Object[]} bindings - The binding(s) containing token values, can be a single object or an array of objects.
 * @param {Object} generatedBinding - An object containing generated binding values, keyed by variable name.
 * @returns {Object[]} An array of mapped value objects, each mapping the color id to its corresponding value.
 */
export function getTokenValueMapFromBinding(
  place,
  inscriptionElements,
  variableType,
  color,
  bindings,
  generatedBinding,
) {
  const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
  const mappedValues = [];

  inscriptionElements.forEach((el) => {
    if (el.dataClass != color) return;

    const [isVariable, colorId] = checkIfColorIsVariable(variableType, color);
    if (!colorId || !el.variableName) return;
    const dataClassKey = `${colorId}:${el.variableName}:${isVariable}`;

    let values;
    if (el.isGenerated) {
      const value = generatedBinding[dataClassKey]; // This is okay, as only non-variable data classes can be generated
      values = value !== undefined ? [value] : [];
    } else {
      values = bindingArray
        .map((b) => b?.[dataClassKey])
        .filter((v) => v !== undefined && v !== null);
    }

    if (!values.length) {
      console.warn(
        `Value for key "${dataClassKey}" not found in binding for place ${place.id}.`,
      );
      return;
    }

    values.forEach((value) => mappedValues.push({ [colorId]: value }));
  });
  return mappedValues;
}

export function deduplicate(mappedValues) {
  const seen = new Set();
  return mappedValues.filter((item) => {
    const key = Object.entries(item)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checkIfColorIsVariable(variableType, color) {
  return [
    variableType?.id === color.id && variableType?.alias === color.alias,
    color.id,
  ];
}

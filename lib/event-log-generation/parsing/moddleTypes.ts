/**
 * Minimal typings for the moddle elements read by the parser. They only list the
 * properties used here (see `moddle/resources/modelSchema.js` for the full schema).
 */

export interface ModdleElement {
  $type: string;
  id: string;
  name?: string;
  $instanceOf(type: string): boolean;
}

export interface ModdleDataClass extends ModdleElement {
  alias?: string;
}

export interface ModdleTokenValue extends ModdleElement {
  dataClass?: ModdleDataClass;
  value?: string;
}

export interface ModdleToken extends ModdleElement {
  values?: ModdleTokenValue[];
}

export interface ModdlePlace extends ModdleElement {
  color?: ModdleDataClass[];
  marking?: ModdleToken[];
}

export interface ModdleTransition extends ModdleElement {
  isSilent?: boolean;
}

export interface ModdleInscriptionElement extends ModdleElement {
  dataClass?: ModdleDataClass;
  variableName?: string;
  isGenerated?: boolean;
}

export interface ModdleArc extends ModdleElement {
  source?: ModdleElement;
  target?: ModdleElement;
  isInhibitorArc?: boolean;
  isExactSynchronization?: boolean;
  variableType?: ModdleDataClass;
  inscription?: { inscriptionElements?: ModdleInscriptionElement[] };
}

export interface ModdleModel extends ModdleElement {
  modelElements?: ModdleElement[];
  declarations?: ModdleElement[];
}

export interface ModdleDefinitions extends ModdleElement {
  model?: ModdleModel;
}

export interface ModdleParseResult {
  rootElement: ModdleDefinitions;
  warnings: Array<{ message?: string }>;
}

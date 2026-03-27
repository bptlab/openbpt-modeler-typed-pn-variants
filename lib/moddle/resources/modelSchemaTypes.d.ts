interface ModelElement {
  id: string;
}

interface Node extends ModelElement {
  name?: string;
}

interface Transition extends Node {
  incoming: Arc[];
  outgoing: Arc[];
}

interface Place extends Node {
  incoming: Arc[];
  outgoing: Arc[];
  marking: any[]; // Array of Token
  color: DataClass[];
}

interface TokenValue {
  dataClass: DataClass;
  value: string;
}

interface Arc extends ModelElement {
  businessObject: {
    source: Node;
    target: Node;
    isInhibitorArc?: boolean;
    variableType?: DataClass;
    inscription: any | null; // TODO: check if can be null
    isExactSynchronization?: boolean;
  };
}

interface DataClass extends ModelElement {
  alias: string;
}

interface Inscription {
  inscriptionElements: InscriptionElement[];
}

interface InscriptionElement {
  dataClass: DataClass;
  variableName: string;
  isGenerated: boolean;
}

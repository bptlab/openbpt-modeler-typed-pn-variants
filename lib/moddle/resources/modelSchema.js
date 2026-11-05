import {
  MODELER_PREFIX,
  MODELER_DI_PREFIX,
  MODELER_NAMESPACE,
} from "../../util/constants";

const modelSchema = {
  name: "Place Transition nets",
  uri: MODELER_NAMESPACE,
  prefix: MODELER_PREFIX,
  xml: {
    tagAlias: "lowerCase",
  },
  types: [
    {
      name: "Schema",
      isAbstract: true,
      properties: [
        {
          name: "id",
          isAttr: true,
          type: "String",
          isId: true,
        },
        {
          name: "name",
          isAttr: true,
          type: "String",
        },
      ],
    },
    {
      name: "ModelElement",
      isAbstract: true,
      superClass: ["Schema"],
    },
    {
      name: "Node",
      isAbstract: true,
      superClass: ["ModelElement"],
    },
    {
      name: "Place",
      superClass: ["Node"],
      properties: [
        {
          name: "marking",
          type: "Token",
          isMany: true,
        },
        {
          name: "color",
          isAttr: true,
          type: "DataClass",
          isMany: true,
          isReference: true,
        },
      ],
    },
    {
      name: "Token",
      superClass: ["ModelElement"],
      properties: [
        {
          name: "values",
          type: "TokenValue",
          isMany: true,
        },
      ],
    },
    {
      name: "TokenValue",
      superClass: ["ModelElement"],
      properties: [
        {
          name: "dataClass",
          isAttr: true,
          type: "DataClass",
          isReference: true,
        },
        {
          name: "value",
          isAttr: true,
          type: "String",
        },
      ],
    },
    {
      name: "Transition",
      superClass: ["Node"],
      properties: [
        {
          name: "isSilent",
          isAttr: true,
          type: "Boolean",
          default: false,
        },
      ],
    },
    {
      name: "Connection",
      isAbstract: true,
      superClass: ["ModelElement"],
    },
    {
      name: "BinaryConnection",
      isAbstract: true,
      superClass: ["Connection"],
      properties: [
        {
          name: "source",
          isAttr: true,
          type: "Node",
          isReference: true,
        },
        {
          name: "target",
          isAttr: true,
          type: "Node",
          isReference: true,
        },
      ],
    },
    {
      name: "Arc",
      superClass: ["BinaryConnection"],
      properties: [
        {
          name: "isInhibitorArc",
          isAttr: true,
          type: "Boolean",
          default: false,
        },
        {
          name: "inscription",
          type: "Inscription",
        },
        {
          name: "variableType",
          isAttr: true,
          type: "DataClass",
          isReference: true,
        },
        {
          name: "isExactSynchronization",
          isAttr: true,
          type: "Boolean",
          default: false,
        },
      ],
    },
    {
      name: "Inscription",
      superClass: ["Declaration"],
      properties: [
        {
          name: "inscriptionElements",
          type: "InscriptionElement",
          isMany: true,
        },
      ],
    },
    {
      name: "InscriptionElement",
      superClass: ["Declaration"],
      properties: [
        {
          name: "dataClass",
          isAttr: true,
          type: "DataClass",
          isReference: true,
        },
        {
          name: "variableName",
          isAttr: true,
          type: "String",
        },
        {
          name: "isGenerated",
          isAttr: true,
          type: "Boolean",
        },
      ],
    },
    {
      name: "Declaration",
      superClass: ["Schema"],
      isAbstract: true,
    },
    {
      name: "DataClass",
      superClass: ["Declaration"],
      properties: [
        {
          name: "alias",
          type: "String",
          isAttr: true,
        },
        {
          name: "valueType",
          type: "String",
          isAttr: true,
        },
      ],
    },
    {
      name: "Model",
      superClass: ["Schema"],
      properties: [
        {
          name: "modelElements",
          type: "ModelElement",
          isMany: true,
        },
        {
          name: "declarations",
          type: "Declaration",
          isMany: true,
        },
      ],
    },
    {
      name: "Definitions",
      superClass: ["Schema"],
      properties: [
        {
          name: "targetNamespace",
          isAttr: true,
          type: "String",
        },
        {
          name: "expressionLanguage",
          default: "http://www.w3.org/1999/XPath",
          isAttr: true,
          type: "String",
        },
        {
          name: "typeLanguage",
          default: "http://www.w3.org/2001/XMLSchema",
          isAttr: true,
          type: "String",
        },
        {
          name: "model",
          type: "Model",
        },
        {
          name: "diagram",
          type: `${MODELER_DI_PREFIX}:Diagram`,
        },
        {
          name: "exporter",
          isAttr: true,
          type: "String",
        },
        {
          name: "exporterVersion",
          isAttr: true,
          type: "String",
        },
      ],
    },
  ],
};

export default modelSchema;

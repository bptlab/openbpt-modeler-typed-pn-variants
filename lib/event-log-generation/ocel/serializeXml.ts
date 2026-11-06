import type {
  OcelEvent,
  OcelLog,
  OcelObject,
  OcelRelationship,
  OcelType,
} from "./types";

interface XmlNode {
  tag: string;
  attributes?: Array<[name: string, value: string]>;
  children?: XmlNode[];
  text?: string;
}

const INDENT = "  ";

/**
 * Writes the log as OCEL 2.0 XML (Section 7 of the OCEL 2.0 specification), with the
 * sections in the order object-types, event-types, objects, events.
 * Objects are grouped by object type, in the order of `<object-types>`, and so are the
 * relationships of each event and object (by the type of the related object). Within a
 * type, the order of the log is kept; anything of an undeclared type comes last.
 * Types, objects and events always get an `<attributes>` element and events an `<objects>`
 * element; objects only get `<objects>` if they have relationships.
 */
export function serializeOcelXml(log: OcelLog): string {
  const { sortObjects, sortRelationships } = createObjectTypeOrder(log);
  const root: XmlNode = {
    tag: "log",
    children: [
      {
        tag: "object-types",
        children: log.objectTypes.map(typeNode("object-type")),
      },
      {
        tag: "event-types",
        children: log.eventTypes.map(typeNode("event-type")),
      },
      {
        tag: "objects",
        children: sortObjects(log.objects).map((object) =>
          objectNode({
            ...object,
            relationships: sortRelationships(object.relationships),
          }),
        ),
      },
      {
        tag: "events",
        children: log.events.map((event) =>
          eventNode({
            ...event,
            relationships: sortRelationships(event.relationships),
          }),
        ),
      },
    ],
  };
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  printNode(root, 0, lines);
  return lines.join("\n") + "\n";
}

/**
 * Sorts objects by their type, and relationships by the type of the related object, in the
 * order of `log.objectTypes`. The sort is stable, so the log's order is kept within a type.
 * Undeclared types, and relationships to objects that are not in the log, come last.
 */
function createObjectTypeOrder(log: OcelLog) {
  const typeRanks = new Map(
    log.objectTypes.map(({ name }, index) => [name, index]),
  );
  const typesOfObjects = new Map(log.objects.map(({ id, type }) => [id, type]));
  const rankOf = (type: string | undefined): number =>
    (type === undefined ? undefined : typeRanks.get(type)) ??
    log.objectTypes.length;

  return {
    sortObjects: (objects: OcelObject[]): OcelObject[] =>
      [...objects].sort((a, b) => rankOf(a.type) - rankOf(b.type)),
    sortRelationships: (
      relationships: OcelRelationship[],
    ): OcelRelationship[] =>
      [...relationships].sort(
        (a, b) =>
          rankOf(typesOfObjects.get(a.objectId)) -
          rankOf(typesOfObjects.get(b.objectId)),
      ),
  };
}

function typeNode(tag: "object-type" | "event-type") {
  return (type: OcelType): XmlNode => ({
    tag,
    attributes: [["name", type.name]],
    children: [
      {
        tag: "attributes",
        children: type.attributes.map((attribute) => ({
          tag: "attribute",
          attributes: [
            ["name", attribute.name],
            ["type", attribute.type],
          ],
        })),
      },
    ],
  });
}

function objectNode(object: OcelObject): XmlNode {
  const children: XmlNode[] = [
    {
      tag: "attributes",
      children: object.attributes.map((attribute) => ({
        tag: "attribute",
        attributes: [
          ["name", attribute.name],
          ["time", attribute.time],
        ],
        text: attribute.value,
      })),
    },
  ];
  if (object.relationships.length > 0) {
    children.push(relationshipsNode(object.relationships));
  }
  return {
    tag: "object",
    attributes: [
      ["id", object.id],
      ["type", object.type],
    ],
    children,
  };
}

function eventNode(event: OcelEvent): XmlNode {
  return {
    tag: "event",
    attributes: [
      ["id", event.id],
      ["type", event.type],
      ["time", event.time],
    ],
    children: [
      {
        tag: "attributes",
        children: event.attributes.map((attribute) => ({
          tag: "attribute",
          attributes: [["name", attribute.name]],
          text: attribute.value,
        })),
      },
      relationshipsNode(event.relationships),
    ],
  };
}

function relationshipsNode(relationships: OcelRelationship[]): XmlNode {
  return {
    tag: "objects",
    children: relationships.map((relationship) => ({
      tag: "relationship",
      attributes: [
        ["object-id", relationship.objectId],
        ["qualifier", relationship.qualifier],
      ],
    })),
  };
}

function printNode(node: XmlNode, depth: number, lines: string[]): void {
  const indent = INDENT.repeat(depth);
  const attributes = (node.attributes ?? [])
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");

  if (node.text !== undefined) {
    lines.push(
      `${indent}<${node.tag}${attributes}>${escapeText(node.text)}</${node.tag}>`,
    );
  } else if (!node.children || node.children.length === 0) {
    lines.push(`${indent}<${node.tag}${attributes}/>`);
  } else {
    lines.push(`${indent}<${node.tag}${attributes}>`);
    node.children.forEach((child) => printNode(child, depth + 1, lines));
    lines.push(`${indent}</${node.tag}>`);
  }
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value)
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

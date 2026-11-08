import { DOMParser, type Element } from "@xmldom/xmldom";
import { OcelFormatError } from "./errors";
import type {
  OcelAttributeDefinition,
  OcelAttributeType,
  OcelEvent,
  OcelLog,
  OcelObject,
  OcelRelationship,
  OcelType,
} from "./types";

const ATTRIBUTE_TYPES: ReadonlySet<string> = new Set<OcelAttributeType>([
  "string",
  "time",
  "integer",
  "float",
  "boolean",
]);

/**
 * Reads OCEL 2.0 XML (Section 7 of the OCEL 2.0 specification) into the log model, the
 * inverse of `serializeOcelXml`. Missing sections and missing `<attributes>` or `<objects>`
 * lists are read as empty, a missing qualifier as "". Element order is kept.
 *
 * @throws OcelFormatError if the XML cannot be parsed, has no `<log>` root, or lacks a
 *   required attribute (e.g. an object without id)
 */
export function parseOcelXml(xml: string): OcelLog {
  // Errors (not only fatal ones) make the XML unreadable. They are collected rather than
  // thrown from the handler, because xmldom would wrap a thrown error in its own message.
  const errors: string[] = [];
  const unreadable = (reason: string) =>
    new OcelFormatError(`The OCEL XML could not be read: ${reason}`);
  let root: Element | null;
  try {
    const document = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") errors.push(message.trim());
      },
    }).parseFromString(xml, "text/xml");
    root = document.documentElement;
  } catch (error) {
    throw unreadable(
      errors[0] ?? (error instanceof Error ? error.message : String(error)),
    );
  }
  if (errors.length > 0) throw unreadable(errors[0]);
  if (!root || root.tagName !== "log") {
    throw new OcelFormatError("The OCEL XML has no <log> root element.");
  }

  return {
    objectTypes: sectionItems(root, "object-types", "object-type").map(
      readType,
    ),
    eventTypes: sectionItems(root, "event-types", "event-type").map(readType),
    objects: sectionItems(root, "objects", "object").map(readObject),
    events: sectionItems(root, "events", "event").map(readEvent),
  };
}

function readType(element: Element): OcelType {
  return {
    name: required(element, "name"),
    attributes: sectionItems(element, "attributes", "attribute").map(
      (attribute): OcelAttributeDefinition => {
        const type = required(attribute, "type");
        if (!ATTRIBUTE_TYPES.has(type)) {
          throw new OcelFormatError(
            `Attribute "${required(attribute, "name")}" of type "${required(element, "name")}" has the unknown type "${type}".`,
          );
        }
        return {
          name: required(attribute, "name"),
          type: type as OcelAttributeType,
        };
      },
    ),
  };
}

function readObject(element: Element): OcelObject {
  return {
    id: required(element, "id"),
    type: required(element, "type"),
    attributes: sectionItems(element, "attributes", "attribute").map(
      (attribute) => ({
        name: required(attribute, "name"),
        time: required(attribute, "time"),
        value: attribute.textContent ?? "",
      }),
    ),
    relationships: readRelationships(element),
  };
}

function readEvent(element: Element): OcelEvent {
  return {
    id: required(element, "id"),
    type: required(element, "type"),
    time: required(element, "time"),
    attributes: sectionItems(element, "attributes", "attribute").map(
      (attribute) => ({
        name: required(attribute, "name"),
        value: attribute.textContent ?? "",
      }),
    ),
    relationships: readRelationships(element),
  };
}

function readRelationships(element: Element): OcelRelationship[] {
  return sectionItems(element, "objects", "relationship").map(
    (relationship) => ({
      objectId: required(relationship, "object-id"),
      qualifier: relationship.getAttribute("qualifier") ?? "",
    }),
  );
}

/** The `<item>` children of the `<section>` child of `parent` (none if it is missing). */
function sectionItems(
  parent: Element,
  section: string,
  item: string,
): Element[] {
  const sectionElement = childElements(parent, section)[0];
  return sectionElement ? childElements(sectionElement, item) : [];
}

function childElements(parent: Element, tagName: string): Element[] {
  const children: Element[] = [];
  for (let node = parent.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === node.ELEMENT_NODE) {
      const child = node as Element;
      if (child.tagName === tagName) children.push(child);
    }
  }
  return children;
}

function required(element: Element, attribute: string): string {
  const value = element.getAttribute(attribute);
  if (value === null) {
    throw new OcelFormatError(
      `<${element.tagName}> is missing the attribute "${attribute}".`,
    );
  }
  return value;
}

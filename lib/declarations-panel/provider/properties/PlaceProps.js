import { MODELER_PREFIX } from "../../../util/constants";
import { is } from "../../../util/Util";
import { useService } from "../../hooks";
import { without, sortBy } from "min-dash";
import { CheckboxEntry } from "@bpmn-io/properties-panel";
import {
  sortByName,
  getDataClasses,
  createDefaultInscriptionElementForClass,
} from "./Util";
import { getInscriptionElement } from "./ArcProps";

export function PlaceProps(props) {
  const { element, elementRegistry } = props;

  if (!is(element, `${MODELER_PREFIX}:Place`)) {
    return [];
  }

  const dataClasses = getDataClasses(elementRegistry);
  return sortByName(dataClasses).map((dataClass) => {
    return {
      id: element.id + "-" + dataClass.id,
      component: ColorProperty,
      dataClass,
    };
  });
}

function ColorProperty(props) {
  const { element, dataClass } = props;
  const commandStack = useService("commandStack");
  const translate = useService("translate");
  const customElementFactory = useService("customElementFactory");
  const debounce = useService("debounceInput");
  const readOnly = useService("simulationModeService").isActive();

  const getValue = (element) => {
    const color = element.businessObject.color;
    return color && color.includes(dataClass);
  };

  const setValue = (value) => {
    let commands = [];
    let color = element.businessObject.color || [];

    if (
      element.businessObject.marking &&
      element.businessObject.marking.length
    ) {
      const currentMarking = element.businessObject.marking;
      const singular = currentMarking.length === 1;
      const confirmation = window.confirm(
        `There ${singular ? "is" : "are"} ${currentMarking.length} token${singular ? "" : "s"} in this place. Updating the color will delete all tokens in this place. Do you wish to proceed?`,
      );
      if (!confirmation) {
        commandStack.execute("element.updateProperties", {
          element,
          properties: {
            color,
          },
        });
        return;
      } else {
        commands.push({
          cmd: "element.updateProperties",
          context: {
            element,
            properties: {
              marking: [],
            },
          },
        });
      }
    }

    if (value) {
      color.push(dataClass);
    } else {
      color = without(color, dataClass);
    }

    color = sortByName(color);
    commands.push({
      cmd: "element.updateProperties",
      context: {
        element,
        properties: {
          color,
        },
      },
    });

    const connectedArcs = [...element.outgoing, ...element.incoming];

    if (connectedArcs.length) {
      connectedArcs.forEach((arc) => {
        let updatedInscriptionElements = [];
        if (
          arc.businessObject.inscription &&
          arc.businessObject.inscription.inscriptionElements
        ) {
          updatedInscriptionElements = [
            ...arc.businessObject.inscription.inscriptionElements,
          ];
        }
        console.log(updatedInscriptionElements);

        // If the dataClass is removed from the color,
        if (!value) {
          // reset the variableType of the arc if it matches the dataClass
          if (arc.businessObject.variableType === dataClass) {
            commands.push({
              cmd: "element.updateProperties",
              context: {
                element: arc,
                properties: {
                  variableType: undefined,
                },
              },
            });
          }
          // and remove the inscription element on the arc for the removed dataClass.
          if (getInscriptionElement(arc, dataClass)) {
            const inscriptionElements =
              arc.businessObject.inscription.inscriptionElements;
            updatedInscriptionElements = inscriptionElements.filter(
              (inscriptionElement) => {
                return inscriptionElement.dataClass !== dataClass;
              },
            );
          }
          // If the dataClass is added to the color,
        } else {
          // create a new inscription element on the arc for the dataClass.
          const newInscriptionElement = createDefaultInscriptionElementForClass(
            dataClass,
            arc.businessObject.inscription,
            customElementFactory,
          );
          updatedInscriptionElements.push(newInscriptionElement);
        }
        updatedInscriptionElements = sortBy(updatedInscriptionElements, (e) =>
          (e.dataClass.name || "").toLowerCase(),
        );
        commands.push({
          cmd: "element.updateModdleProperties",
          context: {
            element: arc,
            moddleElement: arc.businessObject.inscription,
            properties: {
              inscriptionElements: updatedInscriptionElements,
            },
          },
        });
      });
    }

    commandStack.execute("properties-panel.multi-command-executor", commands);
  };

  return CheckboxEntry({
    element,
    id: element.id + "-" + dataClass.id + "-checkbox",
    label: translate(dataClass.name),
    getValue,
    setValue,
    debounce,
    disabled: readOnly,
  });
}

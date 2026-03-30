import { assign } from "min-dash";
import { is } from "../util/Util";
import { MODELER_PREFIX } from "../util/constants";
import { isLabel } from "../modeling/LabelUtil";
import generatedIcons from "../util/generated-icons";
// import { renderCreateTokenModal } from "./TokenModals";

// In the context pad provider, the actions available in the context menu when selecting an element are defined.
export default class CustomContextPadProvider {
  constructor(
    connect,
    contextPad,
    modeling,
    elementFactory,
    customElementFactory,
    create,
    autoPlace,
    popupMenu,
    commandStack,
  ) {
    this._connect = connect;
    this._modeling = modeling;
    this._elementFactory = elementFactory;
    this._customElementFactory = customElementFactory;
    this._create = create;
    this._autoPlace = autoPlace;
    this._popupMenu = popupMenu;
    this._commandStack = commandStack;

    contextPad.registerProvider(this);
  }

  getContextPadEntries(element) {
    const connect = this._connect;
    const modeling = this._modeling;
    const elementFactory = this._elementFactory;
    const customElementFactory = this._customElementFactory;
    const create = this._create;
    const autoPlace = this._autoPlace;
    const commandStack = this._commandStack;

    function removeElement() {
      modeling.removeElements([element]);
    }

    // CustomModelerTodo: Define functions for all entries in the context pad of an element.
    // For example, creating and appending new model elements.
    function startConnect(event, element, autoActivate) {
      connect.start(event, element, autoActivate);
    }

    function appendPlace(event, element) {
      const shape = elementFactory.createShape({
        type: `${MODELER_PREFIX}:Place`,
      });

      autoPlace.append(element, shape, {
        connection: { type: `${MODELER_PREFIX}:Arc` },
      });
    }

    function appendPlaceStart(event) {
      const shape = elementFactory.createShape({
        type: `${MODELER_PREFIX}:Place`,
      });

      create.start(event, shape, { source: element });
    }

    function appendTransition(event, element) {
      const shape = elementFactory.createShape({
        type: `${MODELER_PREFIX}:Transition`,
      });

      autoPlace.append(element, shape, {
        connection: { type: `${MODELER_PREFIX}:Arc` },
      });
    }

    function appendTransitionStart(event) {
      const shape = elementFactory.createShape({
        type: `${MODELER_PREFIX}:Transition`,
      });

      create.start(event, shape, { source: element });
    }

    function toggleInhibitorArc(event, element) {
      modeling.updateProperties(element, {
        isInhibitorArc: !element.businessObject.isInhibitorArc,
        variableType: null,
      });
    }

    // function addToken(event, element) {
    //   renderCreateTokenModal({ x: event.clientX, y: event.clientY }, element, customElementFactory, commandStack);
    // }

    // function removeToken(event, element) {
    //   const marking = element.businessObject.marking;
    //   if (marking && marking > 0) {
    //     updateMarking(element, marking - 1);
    //   }
    // }

    // function updateMarking(element, newMarking) {
    //   modeling.updateProperties(element, { marking: newMarking });
    // }

    const actions = {};

    // CustomModelerTodo: Define the context menu entries for each element type.
    // "group" is the row in which the action will be displayed. Within a row, elements are in the same order as they are assigned to the actions object.
    // "imageUrl" is the icon to be displayed.
    // "title" is the tooltip to be displayed.

    // Transition actions
    if (is(element, `${MODELER_PREFIX}:Transition`)) {
      assign(actions, {
        "append-place": {
          group: "row_1",
          imageUrl: generatedIcons["pn-place"],
          title: "Append place",
          action: {
            click: appendPlace,
            dragstart: appendPlaceStart,
          },
        },
      });
      assign(actions, {
        connect: {
          group: "row_2",
          className: "bpmn-icon-connection",
          title: "Connect",
          action: {
            click: startConnect,
            dragstart: startConnect,
          },
        },
      });
    }

    // Place actions
    if (is(element, `${MODELER_PREFIX}:Place`) && !isLabel(element)) {
      assign(actions, {
        "append-transition": {
          group: "row_1",
          imageUrl: generatedIcons["pn-transition"],
          title: "Append transition",
          action: {
            click: appendTransition,
            dragstart: appendTransitionStart,
          },
        },
      });

      assign(actions, {
        connect: {
          group: "row_2",
          className: "bpmn-icon-connection",
          title: "Connect",
          action: {
            click: startConnect,
            dragstart: startConnect,
          },
        },
      });
    }

    // Arc actions
    if (is(element, `${MODELER_PREFIX}:Arc`) && !isLabel(element)) {
      assign(actions, {
        "toggle-inhibitor-arc": {
          group: "row_0",
          className: element.businessObject.isInhibitorArc
            ? "bpmn-icon-connection"
            : generatedIcons["pn-inhibitor-arc"],
          title: element.businessObject.isInhibitorArc
            ? "Change to regular arc"
            : "Change to inhibitor arc",
          action: {
            click: toggleInhibitorArc,
          },
        },
      });
    }

    // Allow for the deletion of all elements except arc labels
    if (!(is(element, `${MODELER_PREFIX}:Arc`) && isLabel(element))) {
      assign(actions, {
        delete: {
          group: "row_3",
          className: "bpmn-icon-trash",
          title: "Remove",
          action: {
            click: removeElement,
            dragstart: removeElement,
          },
        },
      });
    }

    return actions;
  }
}

CustomContextPadProvider.$inject = [
  "connect",
  "contextPad",
  "modeling",
  "elementFactory",
  "customElementFactory",
  "create",
  "autoPlace",
  "popupMenu",
  "commandStack",
];

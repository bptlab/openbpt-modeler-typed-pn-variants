import { assign } from "min-dash";
import { MODELER_PREFIX } from "../util/constants";
import generatedIcons from "../util/generated-icons";

export default class CustomPaletteProvider {
  constructor(
    palette,
    create,
    elementFactory,
    spaceTool,
    lassoTool,
    handTool,
    globalConnect,
    translate,
  ) {
    this._create = create;
    this._elementFactory = elementFactory;
    this._spaceTool = spaceTool;
    this._lassoTool = lassoTool;
    this._handTool = handTool;
    this._globalConnect = globalConnect;
    this._translate = translate;

    palette.registerProvider(this);
  }

  getPaletteEntries(element) {
    const actions = {};
    const create = this._create;
    const elementFactory = this._elementFactory;
    const spaceTool = this._spaceTool;
    const lassoTool = this._lassoTool;
    const handTool = this._handTool;
    const translate = this._translate;

    function createAction(type, group, imageUrl, title, options) {
      function createListener(event) {
        const shape = elementFactory.createShape(
          assign({ type: type }, options),
        );
        create.start(event, shape);
      }

      return {
        group: group,
        imageUrl: imageUrl,
        title: title,
        action: {
          dragstart: createListener,
          click: createListener,
        },
      };
    }

    assign(actions, {
      // Common editor actions
      "hand-tool": {
        group: "tools",
        className: "bpmn-icon-hand-tool",
        title: translate("Activate the hand tool"),
        action: {
          click: function (event) {
            handTool.activateHand(event);
          },
        },
      },
      "lasso-tool": {
        group: "tools",
        className: "bpmn-icon-lasso-tool",
        title: translate("Activate the lasso tool"),
        action: {
          click: function (event) {
            lassoTool.activateSelection(event);
          },
        },
      },
      "space-tool": {
        group: "tools",
        className: "bpmn-icon-space-tool",
        title: translate("Activate the create/remove space tool"),
        action: {
          click: function (event) {
            spaceTool.activateSelection(event);
          },
        },
      },
      // The light gray horizontal line between tool and modeling palette actions
      "tool-separator": {
        group: "tools",
        separator: true,
      },

      // Modeler-specific actions
      // CustomModelerTodo: Add custom palette actions here, usually for creating elements.
      "create-place": createAction(
        `${MODELER_PREFIX}:Place`,
        "custom-elements",
        generatedIcons["pn-place"],
        translate("Create place"),
      ),
      "create-transition": createAction(
        `${MODELER_PREFIX}:Transition`,
        "custom-elements",
        generatedIcons["pn-transition"],
        translate("Create transition"),
      ),
    });
    return actions;
  }
}

CustomPaletteProvider.$inject = [
  "palette",
  "create",
  "elementFactory",
  "spaceTool",
  "lassoTool",
  "handTool",
  "globalConnect",
  "translate",
];

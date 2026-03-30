import { is } from "../util/Util";
import { isArray } from "min-dash";
import { MODELER_PREFIX } from "../util/constants";

const variableArcReplaceOptions = [
  {
    label: "Replace with non-variable arc",
    actionName: "replace-with-arc",
    className: "bpmn-icon-connection",
    target: {
      type: `${MODELER_PREFIX}:Arc`,
    },
  },
];

const arcReplaceOptions = [
  {
    label: "Replace with variable arc",
    actionName: "replace-with-variable-arc",
    className: "bpmn-icon-connection",
    target: {
      type: `${MODELER_PREFIX}:VariableArc`,
    },
  },
];

export default class ReplaceMenuProvider {
  constructor(
    customElementFactory,
    popupMenu,
    modeling,
    moddle,
    rules,
    translate,
    moddleCopy,
  ) {
    this._customElementFactory = customElementFactory;
    this._popupMenu = popupMenu;
    this._modeling = modeling;
    this._moddle = moddle;
    this._rules = rules;
    this._translate = translate;
    this._moddleCopy = moddleCopy;

    this._popupMenu.registerProvider("tpn-replace", this);
  }

  getPopupMenuEntries(target) {
    const businessObject = target.businessObject;

    if (isArray(target)) {
      return {};
    }

    if (is(businessObject, `${MODELER_PREFIX}:Arc`)) {
      return this._createArcEntries(target);
    }

    return {};
  }

  _createArcEntries(target) {
    const entries = {};
    const self = this;

    if (target.businessObject.variableType) {
      entries["replace-with-arc"] = self._createEntry(
        variableArcReplaceOptions[0],
        target,
        function () {
          self._modeling.updateProperties(target, { variableType: undefined });
        },
      );
    } else {
      entries["replace-with-variable-arc"] = self._createEntry(
        arcReplaceOptions[0],
        target,
        function () {
          self._modeling.updateProperties(target, {
            variableType: "something",
          });
        },
      );
    }

    return entries;
  }

  _createEntry(replaceOption, target, action) {
    const translate = this._translate;

    let label = replaceOption.label;
    if (label && typeof label === "function") {
      label = label(target);
    }

    return {
      label: translate(label),
      className: replaceOption.className,
      action: action,
    };
  }
}

ReplaceMenuProvider.$inject = [
  "customElementFactory",
  "popupMenu",
  "modeling",
  "moddle",
  "rules",
  "translate",
  "moddleCopy",
];

import { is } from "../util/Util";
import { isArray } from "min-dash";
import { MODELER_PREFIX } from "../util/constants";
import generatedIcons from "../util/generated-icons";

export const REPLACE_MENU_ID = "tpn-replace";

export default class ReplaceMenuProvider {
  constructor(popupMenu, modeling, translate) {
    this._modeling = modeling;
    this._translate = translate;

    popupMenu.registerProvider(REPLACE_MENU_ID, this);
  }

  getPopupMenuEntries(target) {
    if (isArray(target)) {
      return {};
    }

    if (is(target, `${MODELER_PREFIX}:Transition`)) {
      return this._createTransitionEntries(target);
    }

    return {};
  }

  // Offer to switch the transition to the respective other (silent/regular) state
  _createTransitionEntries(target) {
    const modeling = this._modeling;
    const translate = this._translate;
    const isSilent = !!target.businessObject.isSilent;

    if (isSilent) {
      return {
        "replace-with-regular-transition": {
          label: translate("Change to regular transition"),
          imageUrl: generatedIcons["pn-transition"],
          action: () => modeling.updateProperties(target, { isSilent: false }),
        },
      };
    }

    return {
      "replace-with-silent-transition": {
        label: translate("Change to silent transition"),
        imageUrl: generatedIcons["pn-silent-transition"],
        action: () => modeling.updateProperties(target, { isSilent: true }),
      },
    };
  }
}

ReplaceMenuProvider.$inject = ["popupMenu", "modeling", "translate"];

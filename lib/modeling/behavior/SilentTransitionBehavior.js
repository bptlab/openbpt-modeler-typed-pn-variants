import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import { getMid } from "diagram-js/lib/layout/LayoutUtil";
import { is } from "../../util/Util";
import {
  MODELER_PREFIX,
  DEFAULT_SHAPE_SIZE,
  SILENT_TRANSITION_SIZE,
} from "../../util/constants";

/**
 * When a transition's isSilent flag changes, resize it to the matching
 * default size (keeping its center) and drop its name if it became silent.
 * Runs inside the same command, so a single undo reverts everything.
 */
export default class SilentTransitionBehavior extends CommandInterceptor {
  constructor(eventBus, modeling) {
    super(eventBus);

    this.postExecute("element.updateProperties", function (event) {
      const { element, properties, oldProperties } = event.context;

      if (
        !is(element, `${MODELER_PREFIX}:Transition`) ||
        !("isSilent" in properties)
      ) {
        return;
      }

      const isSilent = !!properties.isSilent;
      if (isSilent === !!oldProperties.isSilent) {
        return;
      }

      if (isSilent && element.businessObject.name) {
        modeling.updateProperties(element, { name: undefined });
      }

      const size = isSilent ? SILENT_TRANSITION_SIZE : DEFAULT_SHAPE_SIZE;
      const mid = getMid(element);

      modeling.resizeShape(element, {
        x: Math.round(mid.x - size.width / 2),
        y: Math.round(mid.y - size.height / 2),
        width: size.width,
        height: size.height,
      });
    });
  }
}

SilentTransitionBehavior.$inject = ["eventBus", "modeling"];

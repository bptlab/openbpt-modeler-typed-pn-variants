import {
  createToken,
  getTokenValues,
} from "../../declarations-panel/provider/properties/Util";
import { MODELER_PREFIX } from "../../util/constants";
import { RESET_SIMULATION_EVENT, TOGGLE_MODE_EVENT } from "../EventHelper";

const HIGH_PRIORITY = 5000;

export default function Simulator(
  eventBus,
  elementRegistry,
  commandStack,
  customElementFactory,
  identifierService,
) {
  this._eventBus = eventBus;
  this._commandStack = commandStack;
  function getCurrentMarking() {
    // TODO: Fix reference vs copy issue with current marking
    const marking = new Map();
    elementRegistry.forEach((element) => {
      if (element.type === `${MODELER_PREFIX}:Place`) {
        marking.set(
          element.id,
          element.businessObject.marking
            ? element.businessObject.marking.map((token) =>
                // deep clone token values (primitive values expected)
                JSON.parse(JSON.stringify(getTokenValues(token))),
              )
            : [],
        );
      }
    });
    return marking;
  }

  function getInitialObjectIdentifiers() {
    const identifiers = new Set();
    elementRegistry.forEach((element) => {
      if (element.type === `${MODELER_PREFIX}:Place`) {
        const marking = element.businessObject.marking || [];
        marking.forEach((token) => {
          // ensure each token value is added individually
          token.values.forEach((value) => identifiers.add(value.value));
        });
      }
    });
    return Array.from(identifiers);
  }

  function reset() {
    if (this.basemarking !== undefined) {
      // Build a list of commands that clears and recreates the baseline marking
      const commands = [];

      elementRegistry.forEach((element) => {
        if (this.basemarking.has(element.id)) {
          // recreate tokens that were part of the baseline
          const tokensForPlace = [];
          this.basemarking.get(element.id).forEach((values) => {
            const initialTokenValues = element.businessObject.color.map(
              (dataClass) =>
                customElementFactory.create(`${MODELER_PREFIX}:TokenValue`, {
                  dataClass,
                  value: values[dataClass.id],
                }),
            );

            const token = customElementFactory.create(
              `${MODELER_PREFIX}:Token`,
              {
                values: initialTokenValues,
              },
            );

            initialTokenValues.forEach((v) => (v.$parent = token));
            token.$parent = element;

            tokensForPlace.push(token);
          });

          // set the marking to exactly the baseline tokens (do not append)
          commands.push({
            cmd: "element.updateProperties",
            context: {
              element,
              properties: {
                marking: tokensForPlace,
              },
            },
          });
        }
      });

      // execute all reset commands atomically so undo reverts the full reset
      if (commands.length > 0) {
        commandStack.execute(
          "properties-panel.multi-command-executor",
          commands,
        );
      }
    }
  }

  this.basemarking = undefined;
  this.reset = reset;
  this.objectIdentifiers = identifierService.getIdentifiers();

  eventBus.on(RESET_SIMULATION_EVENT, HIGH_PRIORITY, (event) => {
    this.reset();
  });

  eventBus.on(TOGGLE_MODE_EVENT, HIGH_PRIORITY, (event) => {
    const active = event.active;
    if (active) {
      this.basemarking = getCurrentMarking();
      // Initialize identifier service with current identifiers
      identifierService.setIdentifiers(getInitialObjectIdentifiers());
      this.objectIdentifiers = identifierService.getIdentifiers();
      // Clear command stack history so simulation cannot undo pre-simulation edits.
      // NOTE: uses private CommandStack fields; this is a pragmatic choice to
      // isolate simulation commands from modeling history.
      try {
        if (commandStack) {
          if (Array.isArray(commandStack._stack))
            commandStack._stack.length = 0;
          if (typeof commandStack._stackIdx === "number")
            commandStack._stackIdx = -1;
          // notify listeners that the command stack changed
          eventBus.fire({ type: "commandStack.changed" });
        }
      } catch (e) {
        console.warn("Simulator: failed to clear command stack", e);
      }
    } else {
      this.reset();
      this.basemarking = undefined;
      // Clear command stack history when leaving simulation as well so
      // replaying with undo/redo does not step through simulation actions
      // after returning to modeling mode.
      try {
        if (commandStack) {
          if (Array.isArray(commandStack._stack))
            commandStack._stack.length = 0;
          if (typeof commandStack._stackIdx === "number")
            commandStack._stackIdx = -1;
          eventBus.fire({ type: "commandStack.changed" });
        }
      } catch (e) {
        console.warn("Simulator: failed to clear command stack on exit", e);
      }
    }
  });
}

Simulator.$inject = [
  "eventBus",
  "elementRegistry",
  "commandStack",
  "customElementFactory",
  "identifierService",
];

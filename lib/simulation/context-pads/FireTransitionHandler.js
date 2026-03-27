import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import {
  FIRE_TRANSITION_EVENT,
  TRANSITION_FIRED_EVENT,
  TOGGLE_MODE_EVENT,
} from "../EventHelper";
import { getChildById } from "../Utils";
import { getValidInputBindings } from "../binding-utils/bindingUtils";
import { event as domEvent, domify } from "min-dom";
import {
  buildAddTokenCommand,
  buildRemoveTokenCommand,
} from "../../declarations-panel/provider/properties/Util";
import { MODELER_PREFIX } from "../../util/constants";
import createBindingForm from "./FormJsAdapter";
import { without } from "min-dash";
import {
  cartesianProduct,
  findMatchingToken,
  generateValuesForBinding,
  getTokenValueMapFromBinding,
  deduplicate,
} from "./FireTransitionUtils";

export class FireTransitionHandler extends CommandInterceptor {
  constructor(
    eventBus,
    elementRegistry,
    overlays,
    commandStack,
    customElementFactory,
    identifierService,
  ) {
    super(eventBus);
    this._eventBus = eventBus;
    this._elementRegistry = elementRegistry;
    this._overlays = overlays;
    this.identifierService = identifierService;
    this.commandStack = commandStack;
    this.customElementFactory = customElementFactory;

    eventBus.on(FIRE_TRANSITION_EVENT, (context) => {
      this.fireTransition(context);
    });
  }

  async fireTransition(contextOrElement) {
    const context = contextOrElement || {};
    const transition = context.element || contextOrElement;
    const randomRequest = context.random === true;

    let validBindings = getValidInputBindings(transition);
    if (validBindings.length === 0) {
      console.error(
        `Transition ${transition.id} has no valid bindings, cannot fire`,
      );
      return;
    }

    let cleanup; // placeholder

    /**
     *  Execute the given binding: remove tokens from input places and add tokens to output places.
     *
     * @param {Object[]} binding - An array of binding objects mapping dataClassKey -> value.
     */
    const executeBinding = (binding) => {
      const { incoming: incomingArcs, outgoing: outgoingArcs } = transition;
      const placeMarkingUpdates = new Map();

      // Phase 1: Remove tokens from input places
      if (incomingArcs) {
        for (const i of incomingArcs) {
          if (i.businessObject.isInhibitorArc) continue;

          const inscriptionElements =
            i.businessObject.inscription?.inscriptionElements || [];
          const sourcePlaceId = i.businessObject.source.id;
          if (!sourcePlaceId) continue;

          const sourcePlace = getChildById(transition.parent, sourcePlaceId);
          if (!sourcePlace) continue;

          const variableType = i.businessObject?.variableType;

          // Find tokens whose values match the binding constraints for this arc
          const tokensToRemove = findMatchingToken(
            sourcePlace,
            inscriptionElements,
            variableType,
            binding,
          );

          if (tokensToRemove?.length) {
            // Get current marking from updates map or original marking
            const currentMarking =
              placeMarkingUpdates.get(sourcePlace.id) ||
              sourcePlace.businessObject.marking ||
              [];

            // Remove all matching tokens in one pass
            const removeSet = new Set(tokensToRemove);
            const newMarking = currentMarking.filter((t) => !removeSet.has(t));

            placeMarkingUpdates.set(sourcePlaceId, newMarking);
          }
        }
      }

      // Phase 2: Generate new identifier values
      const { generatedBinding, reservations } = generateValuesForBinding(
        outgoingArcs || [],
        this.identifierService,
      );

      // Phase 3: Add tokens to output places
      if (outgoingArcs) {
        for (const o of outgoingArcs) {
          if (o.businessObject.isInhibitorArc) continue;

          const inscriptionElements =
            o.businessObject.inscription?.inscriptionElements || [];
          const targetPlaceId = o.businessObject.target.id;
          if (!targetPlaceId) continue;

          const targetPlace = getChildById(transition.parent, targetPlaceId);
          if (!targetPlace) continue;

          const variableType = o.businessObject?.variableType;

          // Build token values for each color/data class
          const tokenValuesPerColor = (
            targetPlace.businessObject.color || []
          ).map((color) => {
            let mappedValues =
              getTokenValueMapFromBinding(
                targetPlace,
                inscriptionElements,
                variableType,
                color,
                binding,
                generatedBinding,
              ) || [];
            mappedValues = deduplicate(mappedValues);
            return mappedValues.map((mappedValue) => {
              const tokenValue = this.customElementFactory.create(
                `${MODELER_PREFIX}:TokenValue`,
                {
                  dataClass: color,
                  value: mappedValue[color.id],
                },
              );
              return [tokenValue]; // Wrap in array for cartesian product
            });
          });

          // Create tokens from cartesian product of color values
          // (combines one value from each color into multi-color tokens)
          const tokenCombinations = cartesianProduct(tokenValuesPerColor);
          const tokensToAdd = [];

          tokenCombinations.forEach((colorCombination) => {
            colorCombination.forEach((tokenValueArray) => {
              const token = this.customElementFactory.create(
                `${MODELER_PREFIX}:Token`,
                {
                  values: tokenValueArray,
                },
              );
              tokenValueArray.forEach((tv) => (tv.$parent = token));
              token.$parent = targetPlace;

              tokensToAdd.push(token);
            });
          });

          if (tokensToAdd.length > 0) {
            const currentMarking =
              placeMarkingUpdates.get(targetPlaceId) ||
              targetPlace.businessObject.marking ||
              [];
            const newMarking = [...currentMarking, ...tokensToAdd];

            placeMarkingUpdates.set(targetPlaceId, newMarking);
          }
        }
      }

      // Phase 4: Build and execute commands
      const commands = [];

      // Convert place marking updates to commands
      for (const [placeId, newMarking] of placeMarkingUpdates) {
        const place = getChildById(transition.parent, placeId);
        if (!place) {
          console.warn(`Place ${placeId} not found, skipping marking update`);
          continue;
        }

        commands.push({
          cmd: "element.updateProperties",
          context: {
            element: place,
            properties: { marking: newMarking },
          },
        });
      }

      if (reservations?.length > 0) {
        commands.push({
          cmd: "identifier.commit-reservations",
          context: {
            reservations,
            identifierService: this.identifierService,
          },
        });
      }

      // Execute all commands as a single transaction
      try {
        if (commands.length > 0) {
          this.commandStack.execute(
            "properties-panel.multi-command-executor",
            commands,
          );
          this._eventBus.fire(TRANSITION_FIRED_EVENT, {
            transition,
          });
        }
      } catch (e) {
        console.warn("Failed executing fire transition commands", e);
        throw e;
      }

      // Cleanup overlay if not random firing
      if (!randomRequest) cleanup();
    };

    // If a random firing was requested, pick a random valid binding and execute immediately
    if (randomRequest) {
      if (validBindings && validBindings.length > 0) {
        const idx = Math.floor(Math.random() * validBindings.length);
        const binding = validBindings[idx]; // validBindings are BindingPerDataClass[] -> binding is { [DataClassKey: string]: string[] }
        const chosen = [];
        let lastDataClassKey = null;
        for (const [dataClassKey, values] of Object.entries(binding)) {
          const currently_chosen = [];

          const [dataClassId, dataClassAlias, isVariable, synchroType] =
            dataClassKey.split(":");
          const dataClassKeyWithoutSynchro = `${dataClassId}:${dataClassAlias}:${isVariable}`;

          // Non-variable arc/dataclass
          if (isVariable === "false") {
            const value = values[Math.floor(Math.random() * values.length)];
            currently_chosen.push({ [dataClassKeyWithoutSynchro]: value });
          } else {
            values.forEach((value, index) => {
              if (Math.random() > 0.5 || synchroType === "exact") {
                currently_chosen.push({ [dataClassKeyWithoutSynchro]: value });
              }
              if (
                currently_chosen.length === 0 &&
                index === values.length - 1 &&
                lastDataClassKey !== dataClassKeyWithoutSynchro
              ) {
                currently_chosen.push({ [dataClassKeyWithoutSynchro]: value });
              }
            });
          }
          chosen.push(...currently_chosen);

          lastDataClassKey = dataClassKeyWithoutSynchro;
        }
        executeBinding(chosen);
      }
      return;
    } else {
      // Build a small form: one dropdown per variable (union of keys from bindings)
      const variableNames = new Set();
      validBindings.forEach((b) =>
        Object.keys(b).forEach((k) => variableNames.add(k)),
      );
      const vars = Array.from(variableNames);

      const html = domify(`
        <div id="bts-fire-overlay" class="bts-fire-overlay">
          <div class="bts-fire-content">
            <div class="bts-fire-title">Select binding values</div>
            <div class="bts-fire-fields"></div>
            <div class="bts-fire-footer">
              <button class="bts-fire-cancel">Cancel</button>
              <button class="bts-fire-confirm">Fire</button>
            </div>
          </div>
        </div>
      `);

      const fieldsContainer = html.querySelector(".bts-fire-fields");

      // collect possible values per variable from available bindings
      const valueOptions = new Map();
      vars.forEach((v) => valueOptions.set(v, new Set()));
      validBindings.forEach((b) => {
        vars.forEach((v) => {
          if (b[v] !== undefined) {
            const values = Array.isArray(b[v]) ? b[v] : [b[v]];
            // For variable arcs with multiple values, add a stringified version
            if (values.length > 1) {
              valueOptions.get(v).add(JSON.stringify(values.sort()));
            } else {
              valueOptions.get(v).add(String(values[0]));
            }
          }
        });
      });

      const form = await createBindingForm(fieldsContainer, vars, valueOptions);

      // attach overlay now so we can measure label widths
      const overlayId = this._overlays.add(transition, "bts-fire-overlay", {
        position: { top: 0, left: 0 },
        html,
        show: { minZoom: 0.3 },
      });

      // close overlay when simulation mode is toggled off or user clicks outside
      const outsideClickHandler = (ev) => {
        if (!html.contains(ev.target)) {
          cleanup();
        }
      };

      const toggleModeHandler = (evt) => {
        if (!evt.active) cleanup();
      };

      // attach listeners
      document.addEventListener("click", outsideClickHandler);
      try {
        this._eventBus.on &&
          this._eventBus.on(TOGGLE_MODE_EVENT, toggleModeHandler);
      } catch (e) {
        // ignore if event type not used
      }

      cleanup = () => {
        try {
          if (overlayId) this._overlays.remove(overlayId);
        } catch (e) {
          console.warn("Failed removing overlay", e);
        }
        // remove listeners
        document.removeEventListener("keydown", keyHandler);
        document.removeEventListener("click", outsideClickHandler);
        try {
          this._eventBus.off &&
            this._eventBus.off(TOGGLE_MODE_EVENT, toggleModeHandler);
        } catch (e) {
          // ignore
        }
      };

      // keyboard handling
      // placeholder for confirm button reference and updater
      let confirmBtn = null;
      let updateConfirmEnabled = () => {};

      const keyHandler = (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          cleanup();
        } else if (ev.key === "Enter") {
          ev.preventDefault();
          // Don't confirm if the button exists and is disabled
          if (confirmBtn && confirmBtn.disabled) return;
          confirm();
        }
      };

      // add a (none) option and wire dynamic filtering between selects
      // scope selects to the overlay fields container to avoid matching global selects
      const selectNodes = Array.from(
        fieldsContainer.querySelectorAll(
          "select.bts-fire-field-select, select",
        ),
      );

      // ensure each select has a (none) option at top
      selectNodes.forEach((s) => {
        // prevent duplicate none option
        if (!Array.from(s.options).some((o) => o.value === "")) {
          const none = document.createElement("option");
          none.value = "";
          none.text = "(none)";
          s.insertBefore(none, s.firstChild);
        }
      });

      // Check whether a binding is compatible with the current choices
      function isCompatible(choiceMap, candidateBinding) {
        for (const [k, v] of Object.entries(choiceMap)) {
          if (v === "" || v == null) continue;

          if (candidateBinding == null || candidateBinding[k] == null)
            return false;

          const bindingValues = Array.isArray(candidateBinding[k])
            ? candidateBinding[k]
            : [candidateBinding[k]];

          const vv = String(v).trim();

          // Check if the value matches (handle both single values and JSON arrays)
          let matches = false;
          if (bindingValues.length === 1) {
            matches = String(bindingValues[0]).trim() === vv;
          } else {
            // For multi-value bindings, compare as JSON
            matches = JSON.stringify(bindingValues.sort()) === vv;
          }

          if (!matches) return false;
        }
        return true;
      }

      const updateFilters = (changedSelect) => {
        const currentChoices = {};
        selectNodes.forEach((s) => {
          const name =
            s.getAttribute("data-var") ||
            (s.previousElementSibling && s.previousElementSibling.textContent
              ? s.previousElementSibling.textContent.trim()
              : s.getAttribute("data-var"));
          currentChoices[name] = s.value;
        });

        // for each select, compute allowed values based on current choices excluding itself
        selectNodes.forEach((s) => {
          const name =
            s.getAttribute("data-var") ||
            (s.previousElementSibling && s.previousElementSibling.textContent
              ? s.previousElementSibling.textContent.trim()
              : s.getAttribute("data-var"));

          const allowed = new Set();
          validBindings.forEach((b) => {
            // check compatibility with all other selects (excluding this select)
            const otherChoices = { ...currentChoices };
            delete otherChoices[name];
            if (isCompatible(otherChoices, b)) {
              if (b[name] !== undefined) allowed.add(String(b[name]));
            }
          });

          // rebuild options but preserve current selection if still allowed
          const cur = s.value;
          // remove all non-(none) options
          Array.from(s.options).forEach((opt) => {
            if (opt.value === "") return; // keep none
            opt.remove();
          });

          Array.from(allowed)
            .sort()
            .forEach((val) => {
              const o = document.createElement("option");
              o.value = val;
              o.text = val;
              s.appendChild(o);
            });

          // restore selection if possible
          if (
            cur &&
            (cur === "" || Array.from(s.options).some((o) => o.value === cur))
          ) {
            s.value = cur;
          } else {
            s.value = "";
          }
        });

        // update confirm button state after filters changed
        try {
          updateConfirmEnabled();
        } catch (e) {
          console.warn("Failed to update confirm button state", e);
        }
      };

      // Update filters on each select change
      selectNodes.forEach((s) => {
        domEvent.bind(s, "change", () => updateFilters(s));
      });

      // initialize selections
      if (selectNodes.length > 0) {
        if (validBindings.length === 1) {
          // if there's exactly one valid binding, prefill all fields with its values
          const singleBinding = validBindings[0];
          selectNodes.forEach((s) => {
            const name =
              s.previousElementSibling && s.previousElementSibling.textContent
                ? s.previousElementSibling.textContent
                : s.getAttribute("data-var");
            const val =
              singleBinding[name] !== undefined && singleBinding[name] !== null
                ? String(singleBinding[name])
                : "";
            if (val === "") {
              s.value = "";
              return;
            }

            if (!Array.from(s.options).some((o) => o.value === val)) {
              const o = document.createElement("option");
              o.value = val;
              o.text = val;
              s.appendChild(o);
            }
            s.value = val;
          });
          updateFilters();
        } else {
          // Pick first variable non-empty option, others to none
          const first = selectNodes[0];
          const firstOpt = Array.from(first.options).find(
            (o) => o.value !== "",
          );
          if (firstOpt) first.value = firstOpt.value;
          for (let i = 1; i < selectNodes.length; i++)
            selectNodes[i].value = "";
          updateFilters();
        }
      }

      // Focus first input/select for accessibility
      const firstControl = html.querySelector("select, input");
      if (firstControl) firstControl.focus();

      // Wire buttons
      confirmBtn = html.querySelector(".bts-fire-confirm");
      const cancelBtn = html.querySelector(".bts-fire-cancel");
      domEvent.bind(cancelBtn, "click", (ev) => {
        ev.preventDefault();
        cleanup();
      });

      // Enable confirm button when all selects have a non-empty value
      updateConfirmEnabled = () => {
        if (!confirmBtn) return;
        const allBound = selectNodes.every((s) => String(s.value) !== "");
        confirmBtn.disabled = !allBound;
      };

      // Initialize confirm button state
      updateConfirmEnabled();

      const confirm = () => {
        const chosenBinding = form.getValues();
        executeBinding(chosenBinding);
      };

      domEvent.bind(confirmBtn, "click", (ev) => {
        ev.preventDefault();
        confirm();
      });

      // if exactly one binding existed and fields were prefilled, focus confirm for quick fire
      try {
        if (validBindings.length === 1 && confirmBtn) confirmBtn.focus();
      } catch (e) {
        // ignore
      }
      // register key handler after buttons wired to avoid race conditions
      document.addEventListener("keydown", keyHandler);
    }
  }
}

FireTransitionHandler.$inject = [
  "eventBus",
  "elementRegistry",
  "overlays",
  "commandStack",
  "customElementFactory",
  "identifierService",
];

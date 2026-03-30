import { domify, classes as domClasses, event as domEvent } from "min-dom";

import { RESET_SIMULATION_EVENT, TOGGLE_MODE_EVENT } from "../EventHelper";
import generatedIcons from "../../util/generated-icons";

export default function SimulationHistory(
  eventBus,
  tokenSimulationPalette,
  commandStack,
) {
  this._eventBus = eventBus;
  this._tokenSimulationPalette = tokenSimulationPalette;
  this._commandStack = commandStack;

  // track simulation state to avoid undoing commands from before simulation
  this._simulationActive = false;
  this._commandsDuringSimulation = 0;
  // baseline index in the command stack when entering simulation (private API)
  this._baselineStackIdx = null;

  this._init();

  // update enabled state when the command stack changes or when the simulation is reset
  eventBus.on("commandStack.changed", () => {
    const canUndo =
      this._commandStack && typeof this._commandStack.canUndo === "function"
        ? this._commandStack.canUndo()
        : true;
    const canRedo =
      this._commandStack && typeof this._commandStack.canRedo === "function"
        ? this._commandStack.canRedo()
        : false;

    const undoEl =
      this._paletteEntry && this._paletteEntry.querySelector
        ? this._paletteEntry.querySelector('[data-role="undo"]')
        : null;
    const redoEl =
      this._paletteEntry && this._paletteEntry.querySelector
        ? this._paletteEntry.querySelector('[data-role="redo"]')
        : null;

    if (this._simulationActive) {
      // if commandStack exposes private _stackIdx use it to prevent undoing
      // commands before simulation started
      const currentIdx =
        this._commandStack && typeof this._commandStack._stackIdx === "number"
          ? this._commandStack._stackIdx
          : null;

      const allowUndo = (() => {
        if (!canUndo) return false;
        if (currentIdx === null || this._baselineStackIdx === null) {
          // fallback: require at least one recorded command during session
          return this._commandsDuringSimulation > 0;
        }
        return currentIdx > this._baselineStackIdx;
      })();

      const allowRedo = (() => {
        if (!canRedo) return false;
        if (currentIdx === null || this._baselineStackIdx === null) {
          return this._commandsDuringSimulation > 0 && canRedo;
        }
        // allow redo if there is any redo target beyond current (normal canRedo)
        return canRedo;
      })();

      // count commands that happened during the active simulation session
      this._commandsDuringSimulation += 1;

      if (undoEl) {
        if (allowUndo) domClasses(undoEl).remove("disabled");
        else domClasses(undoEl).add("disabled");
      }

      if (redoEl) {
        if (allowRedo) domClasses(redoEl).remove("disabled");
        else domClasses(redoEl).add("disabled");
      }
    } else {
      // normal mode: reflect full command stack state
      if (undoEl) {
        if (canUndo) domClasses(undoEl).remove("disabled");
        else domClasses(undoEl).add("disabled");
      }

      if (redoEl) {
        if (canRedo) domClasses(redoEl).remove("disabled");
        else domClasses(redoEl).add("disabled");
      }
    }
  });

  eventBus.on(RESET_SIMULATION_EVENT, () => {
    const undoEl =
      this._paletteEntry && this._paletteEntry.querySelector
        ? this._paletteEntry.querySelector('[data-role="undo"]')
        : null;
    const redoEl =
      this._paletteEntry && this._paletteEntry.querySelector
        ? this._paletteEntry.querySelector('[data-role="redo"]')
        : null;

    if (undoEl) domClasses(undoEl).add("disabled");
    if (redoEl) domClasses(redoEl).add("disabled");
  });

  // Only allow undo/redo when simulation mode is active
  eventBus.on(TOGGLE_MODE_EVENT, (event) => {
    const active = event && event.active;

    const undoEl =
      this._paletteEntry && this._paletteEntry.querySelector
        ? this._paletteEntry.querySelector('[data-role="undo"]')
        : null;
    const redoEl =
      this._paletteEntry && this._paletteEntry.querySelector
        ? this._paletteEntry.querySelector('[data-role="redo"]')
        : null;

    if (!active) {
      // switching out of simulation: disable and clear counters
      this._simulationActive = false;
      this._commandsDuringSimulation = 0;
      if (undoEl) domClasses(undoEl).add("disabled");
      if (redoEl) domClasses(redoEl).add("disabled");
      return;
    }

    // entering simulation: mark active but do not enable undo/redo until
    // at least one command happens while simulation is active
    this._simulationActive = true;
    this._commandsDuringSimulation = 0;
    // record baseline command stack index if available (private API)
    this._baselineStackIdx =
      this._commandStack && typeof this._commandStack._stackIdx === "number"
        ? this._commandStack._stackIdx
        : null;
    if (undoEl) domClasses(undoEl).add("disabled");
    if (redoEl) domClasses(redoEl).add("disabled");
  });
}

SimulationHistory.prototype._init = function () {
  // create a container with both undo and redo entries
  this._paletteEntry = domify(`
    <div class="bts-entry-group">
      <div class="bts-entry disabled" title="Undo" data-role="undo">
        <img src="${generatedIcons["pn-unfire-transition"]}" alt="Unfire Transition" width="16" height="24"/>
      </div>
      <div class="bts-entry disabled" title="Redo" data-role="redo">
        <img src="${generatedIcons["pn-fire-transition"]}" alt="Fire Transition" width="16" height="24"/>
      </div>
    </div>
  `);

  const undoEl = this._paletteEntry.querySelector('[data-role="undo"]');
  const redoEl = this._paletteEntry.querySelector('[data-role="redo"]');

  domEvent.bind(undoEl, "click", () => {
    if (this._commandStack) this._commandStack.undo();
  });

  domEvent.bind(redoEl, "click", () => {
    if (this._commandStack && typeof this._commandStack.redo === "function")
      this._commandStack.redo();
  });

  this._tokenSimulationPalette.addEntry(this._paletteEntry, 1);
};

SimulationHistory.$inject = [
  "eventBus",
  "tokenSimulationPalette",
  "commandStack",
];

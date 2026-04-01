import { transitionIsEnabled } from "../Utils";

import {
  TOGGLE_MODE_EVENT,
  FIRE_TRANSITION_EVENT,
  RESET_SIMULATION_EVENT,
  TRANSITION_FIRED_EVENT,
} from "../EventHelper";

import { event as domEvent, domify } from "min-dom";
import { MODELER_PREFIX } from "../../util/constants";
import generatedIcons from "../../util/generated-icons";

const LOW_PRIORITY = 500;

const OFFSET_TOP = -15;
const OFFSET_LEFT = -15;

export default function ContextPads(eventBus, elementRegistry, overlays) {
  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;
  this._overlays = overlays;

  this._overlayCache = new Map();
  this._active = false;

  eventBus.on(TOGGLE_MODE_EVENT, LOW_PRIORITY, (context) => {
    const active = context.active;

    this._active = !!active;

    if (active) {
      this.openContextPads();
    } else {
      this.closeContextPads();
    }
  });

  eventBus.on(
    [FIRE_TRANSITION_EVENT, RESET_SIMULATION_EVENT, TRANSITION_FIRED_EVENT],
    LOW_PRIORITY,
    (event) => {
      this._elementRegistry.forEach((element) => {
        this.updateElementContextPads(element);
      });
    },
  );

  // refresh context pads on undo/redo while simulation mode is active
  eventBus.on("commandStack.changed", LOW_PRIORITY, () => {
    if (!this._active) return;
    this._elementRegistry.forEach((element) => {
      this.updateElementContextPads(element);
    });
  });
}

ContextPads.prototype.openContextPads = function () {
  this._elementRegistry.forEach((element) => {
    this.updateElementContextPads(element);
  });
};

ContextPads.prototype._getOverlays = function (hash) {
  return this._overlayCache.get(hash) || [];
};

ContextPads.prototype._addOverlay = function (element, options) {
  const { handlerHash } = options;

  if (!handlerHash) {
    throw new Error("<handlerHash> required");
  }

  const overlayId = this._overlays.add(element, "bts-context-menu", {
    ...options,
    position: {
      top: OFFSET_TOP,
      left: OFFSET_LEFT,
    },
    show: {
      minZoom: 0.5,
    },
  });

  const overlay = this._overlays.get(overlayId);

  const overlayCache = this._overlayCache;

  if (!overlayCache.has(handlerHash)) {
    overlayCache.set(handlerHash, []);
  }

  overlayCache.get(handlerHash).push(overlay);
};

ContextPads.prototype._removeOverlay = function (overlay) {
  const { id, handlerHash } = overlay;

  // remove overlay
  this._overlays.remove(id);

  // remove from overlay cache
  const overlays = this._overlayCache.get(handlerHash) || [];

  const idx = overlays.indexOf(overlay);

  if (idx !== -1) {
    overlays.splice(idx, 1);
  }
};

ContextPads.prototype.updateElementContextPads = function (element) {
  if (element.type === `${MODELER_PREFIX}:Transition`) {
    const handlerHash = element.id;
    const hash = element.id;
    const exisitingOverlay = this._getOverlays(handlerHash).find(
      (o) => o.hash === hash,
    );
    if (exisitingOverlay !== undefined) {
      this._removeOverlay(exisitingOverlay);
    }
    if (transitionIsEnabled(element, false)) {
      this._updateElementContextPads(element);
    }
  }
};

ContextPads.prototype._updateElementContextPads = function (element) {
  const handlerHash = element.id;
  const hash = element.id;
  // const html = domify(`
  //   <div class="bts-context-menu-wrapper">
  //     <div class="bts-context-pad" title="Fire">
  //       <img src="${generatedIcons["pn-fire-transition"]}" alt="Fire Transition" width="16" height="24"/>
  //     </div>
  //     <div class="bts-context-pad" title="Fire random binding">
  //       <span class="pn-icon-fast-fire" title="Fire random binding"></span>
  //     </div>
  //   </div>
  // `);
  const html = domify(`
    <div class="bts-context-menu-wrapper">
      <div class="bts-context-pad" title="Fire random binding">
        <span class="pn-icon-fast-fire" title="Fire random binding"></span>
      </div>
    </div>
  `);

  // bind individual buttons: normal fire vs fast(random) fire
  // select the parent "Fire" context pad div
  // const fireBtn = html.querySelector('.bts-context-pad[title="Fire"]');
  // if (fireBtn) {
  //   domEvent.bind(fireBtn, "click", (event) => {
  //     event.preventDefault();
  //     event.stopPropagation();
  //     this._eventBus.fire(FIRE_TRANSITION_EVENT, { element });
  //   });
  // }

  const fastBtn = html.querySelector(
    '.bts-context-pad[title="Fire random binding"]',
  );
  if (fastBtn) {
    domEvent.bind(fastBtn, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // pass a random flag so the fire handler will immediately pick a random binding
      this._eventBus.fire(FIRE_TRANSITION_EVENT, { element, random: true });
    });
  }

  this._addOverlay(element, {
    hash,
    handlerHash,
    html,
  });
};

ContextPads.prototype.closeContextPads = function () {
  for (const overlays of this._overlayCache.values()) {
    for (const overlay of overlays) {
      this._closeOverlay(overlay);
    }
  }

  this._overlayCache.clear();
};

ContextPads.prototype._closeOverlay = function (overlay) {
  this._overlays.remove(overlay.id);
};

ContextPads.$inject = ["eventBus", "elementRegistry", "overlays"];

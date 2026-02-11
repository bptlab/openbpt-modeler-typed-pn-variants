import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import { is, ifModelElement } from "../util/Util";
import { MODELER_PREFIX } from "../util/constants";
import { isStructurallyIncorrect } from "../simulation/binding-utils/bindingUtilsEarlyReturnLogic";

export default class CustomVerification extends CommandInterceptor {
	constructor(eventBus, overlays, elementRegistry) {
		super(eventBus);

		this._overlays = overlays;
		this._elementRegistry = elementRegistry;
		this._overlayMap = new Map();
		const self = this;

		function verifyInitially(e) {
			const allTransitions = [];
			const elements = self._elementRegistry?._elements;
			if (!elements) return;

			Object.values(elements).forEach((id) => {
				if (is(id.element, `${MODELER_PREFIX}:Transition`)) {
					allTransitions.push(id.element);
				}
			});
			for (const transition of allTransitions) {
				self.verifyStructuralCorrectness(self, transition);
			}
		}

		eventBus.on("import.done", verifyInitially);

		function getTransition(contextArc) {
			const sourceIsTransition = contextArc.source?.type === `${MODELER_PREFIX}:Transition`;
			const targetIsTransition = contextArc.target?.type === `${MODELER_PREFIX}:Transition`;
			if (!sourceIsTransition && !targetIsTransition) return;
			const transition = sourceIsTransition ? contextArc.source : contextArc.target;
			return transition;
		}

		function verifyAfterConnectionUpdate(e) {
			let contextArc = e.context;

			let attempts = 0;
			while (
				attempts < 2 &&
				contextArc.source?.type !== `${MODELER_PREFIX}:Transition` &&
				contextArc.target?.type !== `${MODELER_PREFIX}:Transition`
			) {
				contextArc = contextArc.connection;
				attempts++;
				if (!contextArc) return;
			}

			const transition = getTransition(contextArc);
			if (!transition) return;

			self.verifyStructuralCorrectness(self, transition);
		}

		self.executed([
			"connection.create",
			"connection.delete",
		], ifModelElement(verifyAfterConnectionUpdate));
		self.reverted([
			"connection.create",
			"connection.delete",
		], ifModelElement(verifyAfterConnectionUpdate));

		function verifyAfterElementUpdate(e) {
			let contextArc = e.context.element;
			if (!contextArc?.type || contextArc.type !== `${MODELER_PREFIX}:Arc`) return;

			const transition = getTransition(contextArc);
			if (!transition) return;

			self.verifyStructuralCorrectness(self, transition);
		}

		self.executed([
			"element.updateModdleProperties",
			"element.updateProperties",
			"element.updateLabel",
		], verifyAfterElementUpdate);
		self.reverted([
			"element.updateModdleProperties",
			"element.updateProperties",
			"element.updateLabel",
		], verifyAfterElementUpdate);
	}

	verifyStructuralCorrectness = function (self, transition) {
		const [isIncorrect, message] = isStructurallyIncorrect(transition.incoming, transition.outgoing);

		if (self._overlayMap.has(transition)) {
			self._overlays.remove(self._overlayMap.get(transition));
			self._overlayMap.delete(transition);
		}

		if (isIncorrect) {
			const overlayId = self._overlays.add(transition, {
				position: {
					bottom: -2,
					right: -2,
				},
				html: `
					<div class="structurally-incorrect-overlay" style="cursor: pointer; overflow: visible; font-size: 25;">
						<div class="structurally-incorrect-tooltip">${message}</div>
					<svg width="2em" height="2em" viewBox="0 0 20 20" style="overflow: visible;">
						<circle cx="10" cy="10" r="10" fill="#fff3cd" stroke="#856404" stroke-width="0.15em"/>
						<text x="10" y="15" text-anchor="middle" font-size="1.2em" fill="#856404" font-family="Arial">⚠</text>
					</svg>
					</div>
				`
			});
			self._overlayMap.set(transition, overlayId);
		}
	};
}

CustomVerification.$inject = [
	"eventBus",
	"overlays",
	"elementRegistry",
];

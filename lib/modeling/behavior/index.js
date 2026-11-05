import AdaptiveLabelPositioningBehavior from "./AdaptiveLabelPositioningBehavior";
import LabelBehavior from "./LabelBehavior";
import SilentTransitionBehavior from "./SilentTransitionBehavior";

export default {
  __init__: [
    "adaptiveLabelPositioningBehavior",
    "labelBehavior",
    "silentTransitionBehavior",
  ],
  adaptiveLabelPositioningBehavior: ["type", AdaptiveLabelPositioningBehavior],
  labelBehavior: ["type", LabelBehavior],
  silentTransitionBehavior: ["type", SilentTransitionBehavior],
};

import { isAny, isSilentTransition } from "../../../util/Util";
import {
  TextAreaEntry,
  isTextAreaEntryEdited,
} from "@bpmn-io/properties-panel";
import { useService } from "../../hooks";
import { MODELER_PREFIX } from "../../../util/constants";

export function NameProps(props) {
  const { element } = props;

  // Arcs and silent transitions have no name
  if (
    isAny(element, [`${MODELER_PREFIX}:Arc`]) ||
    isSilentTransition(element)
  ) {
    return [];
  }

  return [
    {
      id: "name",
      component: Name,
      isEdited: isTextAreaEntryEdited,
    },
  ];
}

function Name(props) {
  const { element } = props;

  const modeling = useService("modeling");
  const debounce = useService("debounceInput");
  const translate = useService("translate");
  const readOnly = useService("simulationModeService").isActive();

  // (1) default: name
  const options = {
    element,
    id: "name",
    label: translate("Name"),
    debounce,
    setValue: (value) => {
      modeling.updateProperties(element, {
        name: value,
      });
    },
    getValue: (element) => {
      return element.businessObject.name;
    },
    autoResize: true,
    disabled: readOnly,
  };

  return TextAreaEntry(options);
}

import { domify } from "min-dom";

/**
 * Lightweight adapter to render a binding form using `form-js` when available.
 * Falls back to a simple DOM-based form when `form-js` cannot be loaded.
 *
 * API: createBindingForm(container, vars, valueOptions) -> { getValues(): Object, destroy(): void }
 */
export async function createBindingForm(container, vars, valueOptions) {
  // Try to dynamically require form-js (works in bundlers that support optional dependencies)
  try {
    const mod = require("form-js");
    const FormJS = mod && (mod.default || mod.Form || mod);

    if (typeof FormJS === "function" || typeof FormJS === "object") {
      if (typeof FormJS === "function") {
        try {
          const schema = {
            type: "form",
            components: vars.map((v) => ({ key: v, type: "select", label: v })),
          };

          const form = new FormJS({ container, schema });

          return {
            getValues: () => {
              if (typeof form.get === "function") return form.get();
              if (typeof form.getValues === "function") return form.getValues();
              return {};
            },
            destroy: () => {
              if (typeof form.destroy === "function") form.destroy();
            },
          };
        } catch (e) {
          // fall through to DOM fallback
        }
      }
    }
  } catch (e) {
    // module not present or failed to load -> fall back
  }

  // DOM fallback implementation (synchronous)
  const fields = {}; // Stores either the native <select> or the checkbox container array

  vars.forEach((v) => {
    const wrapper = domify(`<div class="bts-fire-row"></div>`);
    const label = domify(`<label class="bts-fire-label">${v}</label>`);
    const opts = Array.from(valueOptions.get(v) || []).sort();

    if (v.endsWith("[])")) {
      // Create a container layout for the checkbox list
      const checkboxContainer = document.createElement("div");
      checkboxContainer.classList.add("bts-fire-checkbox-list");
      checkboxContainer.setAttribute("data-var", v); // ADDED: Crucial for handler query selection

      // Styling fallback inline to ensure it looks like a scrollable block
      checkboxContainer.style.maxHeight = "150px";
      checkboxContainer.style.overflowY = "auto";
      checkboxContainer.style.border = "1px solid #ccc";
      checkboxContainer.style.padding = "5px";

      opts.forEach((val) => {
        if (val === "") return; // Skip empty option placeholders for checkboxes

        const itemWrapper = document.createElement("div");
        itemWrapper.style.display = "flex";
        itemWrapper.style.alignItems = "center";
        itemWrapper.style.gap = "6px";
        itemWrapper.style.marginBottom = "4px";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.value = val;
        chk.id = `chk-${v}-${val}`;

        const chkLabel = document.createElement("label");
        chkLabel.htmlFor = chk.id;
        chkLabel.textContent = val;
        chkLabel.style.cursor = "pointer";

        itemWrapper.appendChild(chk);
        itemWrapper.appendChild(chkLabel);
        checkboxContainer.appendChild(itemWrapper);
      });

      wrapper.appendChild(label);
      wrapper.appendChild(checkboxContainer);
      container.appendChild(wrapper);

      // Track this variable explicitly as a multi-checkbox field
      fields[v] = { type: "checkboxes", element: wrapper, container: checkboxContainer };
    } else {
      const sel = document.createElement("select");
      sel.classList.add("bts-fire-field-select");
      sel.setAttribute("data-var", v);

      opts.forEach((val) => {
        const o = document.createElement("option");
        o.value = val;
        o.text = val;
        sel.appendChild(o);
      });

      wrapper.appendChild(label);
      wrapper.appendChild(sel);
      container.appendChild(wrapper);

      fields[v] = { type: "select", element: wrapper, target: sel };
    }
  });

  return {
    getValues: () => {
      const out = {};
      for (const v of vars) {
        const field = fields[v];
        if (!field) continue;

        if (field.type === "checkboxes") {
          // Find all checked boxes within this specific field container
          const checkedBoxes = Array.from(field.container.querySelectorAll("input[type='checkbox']:checked"));
          const selected = checkedBoxes.map((chk) => chk.value);

          if (selected.length > 0) out[v] = selected;
        } else {
          // Handle standard single select field
          const val = field.target.value;
          if (val !== "") out[v] = val;
        }
      }
      return out;
    },
    destroy: () => {
      for (const v of vars) {
        const field = fields[v];
        if (field && field.element && field.element.parentNode) {
          field.element.remove();
        }
      }
    },
  };
}

export default createBindingForm;
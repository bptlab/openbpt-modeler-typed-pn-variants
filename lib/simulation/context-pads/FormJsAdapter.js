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
      // Attempt to use a reasonable API if present. As form-js APIs vary, fall back to DOM if we
      // can't detect a render method.
      if (typeof FormJS === "function") {
        // best-effort: instantiate FormJS with container and a simple schema
        try {
          const schema = {
            type: "form",
            components: vars.map((v) => ({ key: v, type: "select", label: v })),
          };

          const form = new FormJS({ container, schema });

          return {
            getValues: () => {
              // try common API methods
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
  // Render predictable markup: wrapper .bts-fire-row, label .bts-fire-label,
  // select .bts-fire-field-select and set data-var on the select.
  const selects = {};
  vars.forEach((v) => {
    const wrapper = domify(`<div class="bts-fire-row"></div>`);
    const label = domify(`<label class="bts-fire-label">${v}</label>`);
    const sel = document.createElement("select");
    sel.classList.add("bts-fire-field-select");
    sel.setAttribute("data-var", v);
    const opts = Array.from(valueOptions.get(v) || []);
    if (v.endsWith("[])")) {
      sel.multiple = true;
      // sel.size = Math.min(Math.max(opts.length, 2), 5); // show 2–5 rows
    }
    opts.sort().forEach((val) => {
      const o = document.createElement("option");
      o.value = val;
      o.text = val;
      sel.appendChild(o);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(sel);
    container.appendChild(wrapper);
    selects[v] = sel;
  });


  return {
    getValues: () => {
      const out = {};
      for (const v of vars) {
        const sel = selects[v];
        if (sel.multiple) {
          // Multi-select: collect all selected values as array
          const selected = Array.from(sel.selectedOptions).map((o) => o.value).filter((val) => val !== "");
          if (selected.length > 0) out[v] = selected;
        } else {
          const val = sel.value;
          if (val !== "") out[v] = val;
        }
      }
      return out;
    },
    destroy: () => {
      for (const v of vars) {
        const sel = selects[v];
        if (sel && sel.parentNode) sel.parentNode.remove();
      }
    },
  };
}

export default createBindingForm;

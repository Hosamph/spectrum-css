import { html, css } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { repeat } from "lit/directives/repeat.js";

import { Template as Divider } from "@spectrum-css/divider/stories/template.js";
import { Template as Icon } from "@spectrum-css/icon/stories/template.js";

import "../index.css";

export const MenuItem = ({
  rootClass,
  label,
  description,
  iconName,
  isHighlighted = false,
  isActive = false,
  isSelected = false,
  isDisabled = false,
  isChecked = false,
  isFocused = false,
  isDrillIn = false,
  isCollapsible = false,
  isOpen = false,
  role = "menuitem",
  items = [],
  size,
  id,
  ...globals
}) => html`
    <li
      class=${classMap({
        [`${rootClass}`]: true,
        "is-highlighted": isHighlighted,
        "is-active": isActive,
        "is-focused": isFocused,
        "is-selected": isSelected,
        "is-disabled": isDisabled,
        [`${rootClass}--drillIn`]: isDrillIn,
        [`${rootClass}--collapsible`]: isCollapsible,
        "is-open": isOpen,
      })}
      id=${ifDefined(id)}
      role=${ifDefined(role)}
      aria-selected=${isSelected ? "true" : "false"}
      aria-disabled=${isDisabled ? "true" : "false"}
      tabindex=${ifDefined(!isDisabled ? "0" : undefined)}>
      ${isCollapsible
        ? Icon({
            ...globals,
            iconName: "ChevronRight100",
            size,
            customClasses: [
              `${rootClass}Icon`,
              "spectrum-Menu-chevron",
            ],
          }) : ''}
      ${iconName
        ? Icon({
            ...globals,
            iconName,
            size,
            customClasses: [
              `${rootClass}Icon`,
              `${rootClass}Icon--workflowIcon`
            ] 
          }) : ''}
      ${isCollapsible
        ? html`<span class="spectrum-Menu-sectionHeading">${label}</span>`
        : html`<span class="${rootClass}Label">${label}</span>`
      }
      ${typeof description != "undefined" 
        ? html`<span class="${rootClass}Description">${description}</span>`
        : ''}
      ${isDrillIn
        ? Icon({
            ...globals,
            iconName: "ChevronRight100",
            size,
            customClasses: [
              `${rootClass}Icon`,
              "spectrum-Menu-chevron",
            ],
          })
        : ''}
      ${isChecked
        ? Icon({
            ...globals,
            iconName: "Checkmark100",
            size,
            customClasses: [
              `${rootClass}Icon`,
              "spectrum-Menu-checkmark",
            ],
          })
        : ''}
      ${isCollapsible && items.length > 0 ? Template({ ...globals, items, isOpen, size }) : ''}
    </li>
  `;

export const MenuGroup = ({
  heading,
  id,
  idx = 0,
  items = [],
  isDisabled = false,
  isSelectable = false,
  subrole,
  size,
  ...globals
}) => html`
    <li
      id=${ifDefined(id)}
      role="presentation">
      ${heading
        ? html`<span
            class="spectrum-Menu-sectionHeading"
            id=${id ?? `menu-heading-category-${idx}`}
            aria-hidden="true"
            >${heading}</span
          >`
        : ""}
      ${Template({
        ...globals,
        role: "group",
        subrole,
        labelledby: id,
        items,
        isDisabled,
        isSelectable,
        size,
      })}
    </li>
  `;

export const Template = ({
  rootClass = "spectrum-Menu",
  labelledby,
  customClasses = [],
  customStyles = {},
  size,
  isDisabled = false,
  isSelectable = false,
  isOpen = false,
  items = [],
  role = "menu",
  subrole = "menuitem",
  id,
  ...globals
}) => {
  return html`
    <ul
      class=${classMap({
        [rootClass]: true,
				[`${rootClass}--size${size?.toUpperCase()}`]: typeof size !== "undefined",
        "is-selectable": isSelectable,
        "is-open": isOpen,
        ...customClasses.reduce((a, c) => ({ ...a, [c]: true }), {}),
      })}
      id=${ifDefined(id)}
      role=${ifDefined(role)}
      aria-labelledby=${ifDefined(labelledby)}
      aria-disabled=${isDisabled ? "true" : "false"}
      style=${styleMap(customStyles)}
    >
      ${repeat(items, (i) => {
        if (i.type === "divider")
          return Divider({
            ...globals,
            tag: "li",
            size: "s",
            customClasses: [`${rootClass}-divider`],
          });
        else if (i.heading) return MenuGroup({ ...i, ...globals, subrole, size });
        else
          return MenuItem({
            ...globals,
            ...i,
            rootClass: `${rootClass}-item`,
            role: subrole,
            size,
          });
      })}
    </ul>
  `;
};

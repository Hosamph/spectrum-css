/*!
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const fallbackProcessor = (selector, prop) => {
	// console.warn(selector, prop);
	// selector = selector.replace(/^:where\((.*?)\)$/, "$1");

	// This regex is designed to pull a component identifier out of a selector, i.e. spectrum-ActionButton
	const matches = selector.match(/^\.([a-z]+-[\A-Z][^-. ]+)/);
	if (matches && matches.length > 0) {
		const [, baseSelector] = matches;
		prop = prop.replace(new RegExp(baseSelector, "gi"), "");
		selector =
			baseSelector + selector.replace(new RegExp(baseSelector, "gi"), "");
	}

	selector = selector.replace(/is-/g, "");

	const selectorParts = selector
		.replace(/\s+/g, "") // remove whitespace
		.replace(/&/g, "") // remove &
		.replace(/,/g, "") // remove commas
		.split("."); // split on class selectors

	return `--${`system-${selectorParts.join("-")}-${prop.substr(2)}`
		.replace(/-+/g, "-")
		.toLowerCase()}`;
};

module.exports = ({
	flatVariables = true,
	selectors = true,
	processIdentifier = (identifierValue, _) => identifierValue,
	getName = fallbackProcessor,
}) => ({
	postcssPlugin: "postcss-splitinator",
	prepare() {
		const selectorMap = {};
		return {
			/** @todo Maybe use this parser when it's released: https://github.com/postcss/postcss-at-rule-parser */
			AtRule(query, { Rule }) {
				if (query.name !== "container" || !query.params) return;

				console.warn(query.params);

				const capture = query.params.match(
					/(?<identifier>\w+)?\(\s*--(.*?)\s*[:=]\s*(.*?)\s*\)/
				);

				console.warn(capture);

				const [, identiferFunc, identifierName, identifierValue] = capture;

				if (!identiferFunc) return;

				const rule = new Rule({
					selector: `.${
						typeof processIdentifier === "function"
							? processIdentifier(identifierValue, identifierName)
							: identifierValue
					}`,
					source: query.source,
				});

				if (flatVariables) {
					query.parent.insertAfter(query, rule);
				}

				query.walkDecls((decl) => {
					if (!decl.prop.startsWith("--")) return;

					// Process rules that match multiple selectors separately to avoid weird var names and edge cases
					// note: this doesn't support :where() and is likely brittle!
					const selectors = decl.parent.selector.split(/\s*,\s*/);
					selectors.forEach((selector) => {
						const variableName = getName(selector, decl.prop);
						const newDecl = decl.clone({
							prop: variableName,
						});
						newDecl.raws.before = "\n  ";

						if (flatVariables) {
							rule.append(newDecl);
						}

						const selectorNode =
							(selectorMap[selector] = selectorMap[selector]) ?? {};

						// Check for fallbacks
						// todo: use valueparser instead of a regex
						const fallbackMatch = decl.value.match(
							/var\(\s*(.*?)\s*,\s*var\(\s*(.*?)\s*\)\)/
						);
						if (fallbackMatch) {
							const [, override, fallback] = fallbackMatch;

							// The final declaration should have the override present
							selectorNode[
								decl.prop
							] = `var(${override}, var(${variableName}))`;

							// The system-level declaration should only have the fallback
							newDecl.value = `var(${fallback})`;
						} else {
							selectorNode[decl.prop] = `var(${variableName})`;
						}
					});
				});

				query.remove();
			},
			Once(root, { Rule, Decl }) {
				if (!selectors) return;
				for (let [selector, props] of Object.entries(selectorMap)) {
					const rule = new Rule({
						selector,
					});

					for (let [prop, value] of Object.entries(props)) {
						const decl = new Decl({
							prop,
							value,
						});
						decl.raws.before = "\n  ";

						rule.append(decl);
					}

					root.append(rule);
				}
			},
		};
	},
});

module.exports.postcss = true;

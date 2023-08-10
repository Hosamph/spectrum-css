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

const path = require("path");

/**
 * @description This is the PostCSS config for our development code; this
 * includes assets **not** in the dist output, such as index.css or themes/*.css
 * @type import('postcss-load-config').ConfigFn
 */
module.exports = (options) => {
	const {
		to = undefined,
		isTheme = false,
		isExpress = false,
		isLegacy = false,
		map = { inline: false },
		/** @todo temporary */
		keepVars = true,
	} = options;

	return {
		...options,
		map,
		plugins: {
			/* --------------------------------------------------- */
			/* ------------------- KEY PROCESSING ---------------- */
			"postcss-use": {}, // @note: when does postcss-use resolve the plugins? at the end?
			"postcss-each": {},
			"postcss-import": {},
			/** @note @inherit: used in *button, icon, modal, picker, popover, quickaction, table, tooltip, underlay */
			"postcss-inherit": {},
			/**
			 * @note custom plugin to transform transforms; might just hardcode these in future
			 * @used accordion, actionbutton, assetlist, breadcrumb, calendar, pagination, slider, treeview
			 **/
			"postcss-transform-logical": {},
			/* --------------------------------------------------- */
			/* ------------------- POLYFILLS --------------------- */
			"postcss-preset-env": {
				/**
				 * @note stage 2 (default); stage 4 === stable
				 * @link https://preset-env.cssdb.org/features/#stage-2
				 */
				stage: 2,
			},
			/* --------------------------------------------------- */
			/* ------------------- ORGANIZE/DEDUPE --------------- */
			/**
			 * @note only used in migrated builds
			 *
			 * @todo could this be broken out into smaller, focused plugins?
			 *
			 * @note processIdentifier: this functions as a kind of style query polyfill
			 * @example @\container style(--spectrum: express) -> .spectrum--express
			 * @link https://blog.logrocket.com/new-css-style-queries/
			 * @link https://developer.chrome.com/blog/style-queries/
			 *
			 * @note noFlatVariables: used for dist/index-base.css
			 * @note noSelectors: used for themes/*.css
			 */
			"@spectrum-tools/postcss-splitinator": !isLegacy
				? {
						processIdentifier: isTheme
							? (identifierValue, identifierName) => {
									if (identifierName !== "system") return;
									if (identifierValue !== "spectrum") {
										return `spectrum--${identifierValue}`;
									}
									return identifierValue;
							  }
							: undefined,
						selectors: !isTheme,
						flatVariables: !(path.basename(to, "css") === "index-base"),
				  }
				: false,
			"postcss-sorting": {
				order: ["custom-properties", "declarations", "at-rules", "rules"],
				"properties-order": "alphabetical",
			},
			"postcss-combine-duplicated-selectors": {},
			/** @note Merges _adjacent_ rules only; hense the sorting is first */
			"postcss-merge-rules": {},
			"postcss-combine-media-query": {},
			/* --------------------------------------------------- */
			/* ------------------- VARIABLE PARSING -------------- */
			/** @note this enables reporting of unused variables in a file */
			"@spectrum-tools/postcss-dropdupedvars": {
				lint: true,
			},
			"@spectrum-tools/postcss-custom-properties-mapping":
				isLegacy && keepVars
					? {
							lint: true,
							/** @todo read in token data */
							globalVariables: {},
					  }
					: false,
			/** @todo do we need this still? */
			"@spectrum-tools/postcss-notnested": isLegacy
				? { replaceWith: ".spectrum" }
				: false,
			"@spectrum-tools/postcss-notnested": isLegacy ? {} : false,
			/**
			 * @note this is only running on updated components in the themes/express.css file
			 * it's somewhat heavy-handed as it will remove the previous selector
			 * @todo do we need this still?
			 */
			// "postcss-combininator": !isLegacy && isExpress ? {} : false,
			/* --------------------------------------------------- */
			/* ------------------- CLEAN-UP TASKS ---------------- */
			"postcss-discard-comments": {
				removeAll: true,
			},
			"postcss-discard-empty": {},
			/* Ensure the license is at the top of the file */
			"postcss-licensing": {
				filename: "COPYRIGHT",
				cwd: __dirname,
				skipIfEmpty: true,
			},
			perfectionist: {
				format: "expanded",
				sourcemap: true,
			},
			/* --------------------------------------------------- */
			/* ------------------- REPORTING --------------------- */
			"postcss-reporter": {
				clearReportedMessages: true,
			},
		},
	};
};

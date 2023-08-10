/*!
Copyright 2023. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * @typedef Options
 * @property {boolean} [lint=false]
 */
/** @type import('postcss').PluginCreator<Options> */
module.exports = ({ lint = false } = {}) => ({
	postcssPlugin: "postcss-dropdupedvars",
	Rule(rule, { result }) {
		const seen = new Map();

		rule.walkDecls((decl) => {
			if (!decl.prop.startsWith("--")) return;

			if (seen.has(decl.prop)) {
				prevDecl = seen.get(decl.prop);
				if (prevDecl) {
					if (lint) {
						decl.warn(result, `Duplicate variable ${decl.prop} identified`, {
							node: prevDecl,
						});
						return;
					}
					prevDecl.remove();
				}
			}

			seen.set(decl.prop, decl);
		});
	},
});

module.exports.postcss = true;

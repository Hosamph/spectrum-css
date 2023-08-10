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

const { readFileSync } = require("fs");
const path = require("path");

/**
 * @description This PostCSS config determines which file
 * to load based on env variable
 * @type import('postcss-load-config').ConfigFn
 */
module.exports = ({
	env = "development",
	file = undefined,
	from = undefined,
	...settings
}) => {
	// An array of folders to the from filepath
	const fromPath = (from && path.dirname(from).split(path.sep)) ?? [];

	// Determine if this is a legacy or migrated build by checking for the tokens dependency
	const componentIdx = fromPath.findIndex((dir) => dir === "components");

	// This fetches the name of the component folder
	const rootPath =
		componentIdx >= 0
			? fromPath.slice(0, componentIdx + 2)
			: process.cwd().split(path.sep);

	const pkgContent = readFileSync(
		path.join(rootPath.join(path.sep), "package.json")
	);

	const pkg = pkgContent ? JSON.parse(pkgContent) : {};

	// Determine whether to use the legacy build process
	settings.isLegacy = !pkg?.peerDependencies?.["@spectrum-css/tokens"];

	// Determine if this is a themes file
	settings.isTheme =
		file?.dirname?.split(path.sep)?.pop() === "themes" ? true : false;

	// Determine if this is an express file within themes
	settings.isExpress = settings.isTheme && from && from.endsWith("express.css");

	// if (env === "development") {
	return require("./postcss.dev.config.js")({
		env,
		from,
		...settings,
	});
	// }

	// return require("./postcss.prod.config.js")({
	// 	env,
	// 	from,
	// 	...settings,
	// });
};

/*!
 * Copyright 2023 Adobe. All rights reserved.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const path = require("path");

const generateFileConfig = require("./utilities/style-dictionary.utils.js");

const StyleDictionary = require("style-dictionary");
const CSSSetsFormatter = require("style-dictionary-sets").CSSSetsFormatter;
const NameKebabTransfom = require("style-dictionary-sets").NameKebabTransfom;
const AttributeSetsTransform =
	require("style-dictionary-sets").AttributeSetsTransform;
const CSSOpenTypeTransform =
	require("style-dictionary-sets").CSSOpenTypeTransform;

StyleDictionary.registerTransform(CSSOpenTypeTransform);
StyleDictionary.registerTransform(NameKebabTransfom);
StyleDictionary.registerTransform(AttributeSetsTransform);
StyleDictionary.registerFormat(CSSSetsFormatter);

StyleDictionary.registerTransform({
	type: "name",
	name: "json/kebab",
	transformer: (token, options) => {
		// We just want to target the first section, not the sets
		// return [options.prefix, token.path[0]].join('-');
		return token.path[0];
	},
});

StyleDictionary.registerFormat({
	type: "value",
	name: "json/sets",
	filter: (token) => !token.path.includes("express"),
	formatter: ({ dictionary, platform, file, options }) => {
		const obj = {};
		dictionary.allProperties.forEach((prop) => {
			if (
				[
					"express",
					"wireframe",
					"light",
					"dark",
					"darkest",
					"desktop",
					"mobile",
				].includes(prop.name)
			)
				return;

			const name = [options.prefix, prop.name].filter(Boolean).join("-");

			if (typeof prop.value === "string") {
				obj[name] = prop.value;
				return;
			}

			if (!prop.value?.sets) {
				console.log(prop.name, prop.value);
				return;
			}

			const sets = prop.value.sets;
			// i.e., light, dark, darkest
			const keys = Object.keys(sets).filter(
				(k) => !["wireframe", "express"].includes(k)
			);

			if (keys.length === 1 && keys[0] === "spectrum") {
				if (typeof sets.spectrum.value === "string") {
					obj[name] = sets.spectrum.value;
					return;
				} else {
					// @todo
					console.log(prop.name, prop.value);
					return;
				}
			}

			obj[name] = {};
			keys.forEach((k) => {
				if (typeof sets[k].value === "string") {
					obj[name][k] = sets[k].value;
					return;
				}

				// const nestedKeys = Object.keys(sets[k].value.sets);
				// @todo if the values of the nested keys are the same, merge them
				obj[name][k] = `{${[options.prefix, sets[k].path[0]]
					.filter(Boolean)
					.join("-")}}`;
			});
		});

		return JSON.stringify(obj, null, 2);
	},
});

/**
 * @note This references the package.json because we want the root folder and
 * not a nested folder which might be returned if the `main` property
 * in the package.json is present.
 */
const tokensPath = require.resolve("@adobe/spectrum-tokens/package.json");
const tokensDir = path.dirname(tokensPath);
const setNames = ["desktop", "mobile", "light", "dark", "darkest"];

module.exports = {
	source: [`${tokensDir}/src/*.json`],
	platforms: {
		CSS: {
			buildPath: "dist/css/",
			transforms: [
				AttributeSetsTransform.name,
				NameKebabTransfom.name,
				CSSOpenTypeTransform.name,
			],
			prefix: "spectrum",
			files: [
				generateFileConfig(),
				...["spectrum", "express"].map((subSystemName) =>
					generateFileConfig({ subSystemName })
				),
				...setNames.map((context) => generateFileConfig({ setName: context })),
				...setNames.map((context) =>
					generateFileConfig({
						setName: context,
						subSystemName: "spectrum",
					})
				),
				...setNames.map((context) =>
					generateFileConfig({
						setName: context,
						subSystemName: "express",
					})
				),
			],
		},
		JSON: {
			buildPath: "dist/json/",
			transforms: [
				AttributeSetsTransform.name,
				"json/kebab",
				CSSOpenTypeTransform.name,
			],
			files: [
				{
					format: "json/sets",
					destination: "spectrum-tokens.json",
					options: {
						prefix: "spectrum",
						showFileHeader: false,
						outputReferences: true,
					},
				},
			],
		},
	},
};

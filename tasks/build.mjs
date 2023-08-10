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

import fs, { promises as fsp } from "fs";
import { dirname, join, relative, extname } from "path";

import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

import fg from "fast-glob";
import postcss from "postcss";
import postcssrc from "postcss-load-config";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { parseCSS, filterVars } from "./parse-css.mjs";

const { _: inputs, verbose = false } = yargs(hideBin(process.argv)).alias(
	"v",
	"verbose"
).argv;

/**
 * @description Run the provided content through PostCSS
 * @param {string} content
 * @param {import("postcss-load-config").ConfigContext} [ctx={}]
 * @returns {Promise<string>}
 */
async function processCSS(content, ctx = {}, cwd = join(__dirname, "../")) {
	// If there's no content, don't bother
	if (!content || content === "") return;

	// Process the CSS; this will use the closest postcss config to the file
	const { plugins, options } = await postcssrc({
		cwd,
		env: process.env.NODE_ENV || "development",
		...ctx,
	}).catch((err) => {
		return Promise.reject(err);
	});

	return postcss(plugins)
		.process(content, {
			...ctx,
			...options,
		})
		.then(async (r) => {
			if (!r) return Promise.reject(`🚨 No result was returned from PostCSS`);

			// Write out the map file, if it was generated
			if (r.map && r.opts && r.opts.to) {
				await writeAssets(r.map.toString(), `${r.opts.to}.map`);
			}

			return r.css;
		});
}

/**
 * @description Read in the provided input files, combine, and run them through PostCSS
 * @param {string[]} inputPaths
 * @param {string} outputPath
 * @param {import("postcss-load-config").ConfigContext} [ctx={}]
 * @returns {Promise<string>}
 */
async function readWriteAssets(inputPaths, outputPath) {
	const files = await fg(inputPaths, {
		allowEmpty: true,
		absolute: true,
	});

	const combined = files
		.map((filepath) => fs.readFileSync(filepath, "utf8"))
		.join("\n\n");

	// If there's no content, our job here is done
	if (!combined || combined === "") return;

	const ext = extname(outputPath).replace(".", "");

	let contents = combined;
	if (ext === "css") {
		contents = await processCSS(combined, {
			to: outputPath,
			from: inputPaths[0] ?? undefined,
		});
	}

	// Write the processed CSS to dist/index-vars.css
	return writeAssets(contents, outputPath);
}

/**
 * @description Write out the provided contents to the provided outputPath
 * @param {string} contents
 * @param {string} outputPath
 * @returns {Promise<string>}
 */
async function writeAssets(contents, outputPath) {
	if (!contents || contents === "") return;

	/** Create the directory first if it doesn't exist */
	if (!fs.existsSync(dirname(outputPath))) {
		fs.mkdirSync(dirname(outputPath), {
			recursive: true,
		});
	}

	/** Write the processed CSS and return the content of the file */
	await fsp
		.writeFile(outputPath, contents, {
			encoding: "utf8",
		})
		.catch((error) => {
			console.warn(error);
		});

	if (verbose) {
		console.log(
			`   ✔ wrote ${relative(join(__dirname, "../"), outputPath)} [${
				contents.length
			} bytes]`
		);
	}

	return Promise.resolve(contents);
}

/**
 * Process CSS variables looking for all class names, variable definitions,
 * and any used variables; for each color stop and scale, filter the variables
 * for those matching the component; check all used variables to find those
 * relevant to only this component; write out the variables to a vars.css file
 * @param {String} source
 * @param {Object} options
 * @param {String} options.pkgName
 * @param {Boolean} options.isLegacy
 * @returns {Promise<{}>}
 */
async function onlyComponentVars(source, options) {
	/**
	 * 5. Process CSS variables looking for all class names, variable definitions, and any used variables
	 * @todo should these be sourced from the combined index-vars.css in dist?
	 */
	const {
		classNames = new Set(),
		varDefinitions = new Map(),
		usedVars = new Set(),
	} = await parseCSS(source);

	/**
	 * 6. For each color stop and scale, filter the variables for those matching the component
	 * This data is used later to report on and document the available variables
	 */
	return {
		...filterVars(usedVars, options),
		classNames,
		varDefinitions,
	};
}

/**
 * Combine content in index.css & themes (if they exist); output as index.css
 * @returns {Promise<string[]>}
 */
async function indexCSS(pkgName, { cwd, isLegacy }) {
	let outputFile = join(cwd, "dist/index.css");
	return readWriteAssets(
		[
			"index.css",
			"skin.css",
			"themes/spectrum.css", // spectrum comes first
			"themes/*.css",
		].map((file) => join(cwd, file)),
		outputFile
	).then(async (contents) => {
		if (!contents || !fs.existsSync(outputFile)) {
			return Promise.reject(`🚨 index.css could not be created`);
		}

		const newFiles = [outputFile];

		// Copy index as index-vars to maintain backwards compat
		try {
			fs.copyFileSync(outputFile, join(cwd, "dist/index-vars.css"));
		} catch (error) {
			return Promise.reject(
				`🚨 Error copying index.css to index-vars.css`,
				error
			);
		}

		outputFile = join(cwd, "dist/index-vars.css");

		if (!fs.existsSync(outputFile)) {
			return Promise.reject(`🚨 index-vars.css could not be created`);
		}

		newFiles.push(outputFile);

		// Use this data to generate our vars.css file
		const { mods, a11y, global, component, varDefinitions, classNames } =
			await onlyComponentVars(contents, {
				pkgName,
				isLegacy,
			});

		/** metadata/mods.md */
		outputFile = join(cwd, "metadata/mods.md");
		if (mods.length > 0) {
			contents = [
				"| Modifiable custom properties |\n| --- |",
				...mods.map((result) => `| \`${result}\` |`),
			].join("\n");

			await writeAssets(contents, outputFile);
			newFiles.push(outputFile);
		} else {
			// If there are no mods, remove the file
			await fsp.rm(outputFile).catch(() => {});
		}

		/** dist/custom-properties.json */
		if (mods.length || a11y.length || global.length || component.length) {
			outputFile = join(cwd, "dist/custom-properties.json");
			contents = JSON.stringify({ mods, a11y, global, component }, null, 2);
			await writeAssets(contents, outputFile);
			newFiles.push(outputFile);
		}

		// If there are no variables used, no need to write out the files
		if (!component || component.length === 0) return Promise.resolve(newFiles);

		/** @todo do we want the first value or the last one? */
		const data = [...varDefinitions.entries()].map(([key, value]) => {
			if (key.startsWith("--highcontrast")) return;
			return `  ${key}: ${value[0]};`;
		});

		contents = await processCSS(
			`${[...classNames].join(",")} {\n${data.join("\n")}\n}`,
			{
				to: join(cwd, "dist/vars.css"),
				from: join(cwd, "index.css"),
			},
			cwd
		);

		if (contents && contents !== "") {
			outputFile = join(cwd, "dist/vars.css");
			await writeAssets(contents, outputFile);
			newFiles.push(outputFile);
		} else {
			// Throw an error if there's no content
			return Promise.reject(`🚨 vars.css could not be created`);
		}

		// if (varAssets.length) {
		// 	newFiles.push(...varAssets);
		// }

		return Promise.resolve(newFiles);
	});
}

async function buildLegacyComponent(pkgName, { cwd }) {
	return indexCSS(pkgName, { cwd, isLegacy: true });
}

async function buildComponent(pkgName, { cwd }) {
	const promises = [indexCSS(pkgName, { cwd, isLegacy: false })];

	/**
	 * 2. Combine styles and themes into an index-base.css
	 */
	const indexBase = readWriteAssets(
		[
			"index.css",
			"themes/spectrum.css", // spectrum comes first
			"themes/*.css",
		].map((file) => join(cwd, file)),
		join(cwd, "dist/index-base.css")
	);

	promises.push(indexBase);

	/**
	 * 3. If this is NOT a legacy component and there are themes, process them individually
	 */
	const themes = await fg(["themes/*.css", "!themes/spectrum.css"], { cwd });

	if (fs.existsSync(join(cwd, "themes/spectrum.css"))) {
		promises.push(
			readWriteAssets(
				["themes/spectrum.css"].map((file) => join(cwd, file)),
				join(cwd, "dist/themes/spectrum.css")
			)
		);
	}

	promises.push(
		...themes.map(async (theme) =>
			readWriteAssets(
				[theme].map((file) => join(cwd, file)),
				join(cwd, "dist", theme)
			)
		)
	);

	/**
	 * 4. Combine theme styles into an index-theme.css with spectrum first
	 */
	const indexTheme = readWriteAssets(
		[
			"themes/spectrum.css", // spectrum comes first
			"themes/*.css",
		].map((file) => join(cwd, file)),
		join(cwd, "dist/index-theme.css")
	);

	promises.push(indexTheme);

	/** Wait for all the promises to conclude */
	await Promise.all(promises);

	return [
		join(cwd, "dist/index.css"),
		join(cwd, "dist/index-vars.css"),
		join(cwd, "metadata/mods.md"),
		join(cwd, "dist/custom-properties.json"),
		join(cwd, "dist/vars.css"),
		join(cwd, "dist/index-base.css"),
		join(cwd, "dist/index-theme.css"),
		...themes.map((theme) => join(cwd, `dist/${theme}`)),
	];
}

/**
 * For now this is running in the context of the package that's being built
 */
async function main(inputs) {
	const nx_vars = Object.keys(process.env).filter((key) =>
		key.startsWith("NX_")
	);

	if (!inputs) {
		if (nx_vars.length === 0) {
			return Promise.reject(
				`🚨 No NX_* environment variables were found. Ensure this script is running in the context of an Nx workspace.`
			);
		}

		if (!process.env.NX_TASK_TARGET_PROJECT) {
			return Promise.reject(
				`🚨 No component name was provided. Ensure this script is running at the root of a component directory.`
			);
		} else {
			inputs = [process.env.NX_TASK_TARGET_PROJECT];
		}
	}

	console.warn(nx_vars.map((key) => `${key}: ${process.env[key]}`).join("\n"));

	const promises = [];
	// Iterate over the provided component names
	for (const pkgName of inputs) {
		const cwd = join(__dirname, "../components", pkgName);

		if (
			!fs.existsSync(cwd) ||
			!fs.statSync(cwd).isDirectory() ||
			!fs.existsSync(join(cwd, "package.json"))
		) {
			console.warn(`⚠️ No component was found at ${cwd}`);
			continue;
		}

		const isLegacy =
			process?.env?.NX_TASK_TARGET_CONFIGURATION === "legacy" ?? false;

		promises.push(
			isLegacy
				? buildLegacyComponent(`@spectrum-css/${pkgName}`, { cwd })
				: buildComponent(`@spectrum-css/${pkgName}`, { cwd })
		);
	}

	return (await Promise.all(promises)).flat();
}

/** Run the main function */
await main(inputs)
	.then((results) => {
		console.log(results);
		process.stdout.write(results.join(" "));
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});

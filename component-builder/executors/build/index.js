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

/**
 * @typedef {string} TokenCategory - the category of the token
 * @typedef {string} Token - the name of the token
 * @typedef {{ [key: TokenCategory]: Map<Token, { fallback: (Token|string)[], file: import('path').PathLike, selector: string }[]> }} TokenMetadata
 * @typedef {Map<TokenCategory, (string|RegExp)[]>} BucketConfig - the rules for assigning tokens to the buckets
 */

const fs = require("fs");
const fsp = fs.promises;
const { join, dirname, extname, relative } = require("path");

const { joinPathFragments, logger } = require("@nx/devkit");

/** @note Using chalk @4.x b/c 5.x is ESM */
const chalk = require("chalk");
const fg = require("fast-glob");
const postcss = require("postcss");
const postcssrc = require("postcss-load-config");
const valueParser = require("postcss-value-parser");
const selectorParser = require("postcss-selector-parser");
const FuzzyMatching = require("fuzzy-matching");
const prettier = require("prettier");
const merge = require("merge-source-map");

const fgConcat = require("./fg-concat");

/**
 * An iterable build executor for Spectrum CSS components that reads in the provided source files,
 * combines them, and runs them through PostCSS to generate the final output.
 *
 * @param {import('./schema.js').ComponentBuilderExecutorOptions} _options
 * @param {import('@nx/devkit').ExecutorContext} context
 * @returns {Promise<{ success: boolean; baseUrl?: string }>}
 */
module.exports = async function spectrumBuildExecutor(_options, context) {
	const { env, sourceFiles, themeFiles, outputPath } = normalizeOptions(
		_options,
		context
	);

	/** @note Randoma is an ESM pkg so we import it dynamically & capture the default */
	const Randoma = await import("randoma").then((m) => m.default);

	/* --- CORE DATA FOR PROCESSING --- */
	const cwd = joinPathFragments(
		context.root,
		context.workspace.projects[context.projectName].root
	);

	/** An object containing paths to all generated assets in this function */
	const outputs = {
		index: join(cwd, outputPath, "index.css"),
		compat: join(cwd, outputPath, "index-vars.css"),
		vars: join(cwd, outputPath, "vars.css"),
		markdown: join(cwd, "metadata/mods.md"),
		customProperties: join(cwd, outputPath, "custom-properties.json"),
		base: join(cwd, outputPath, "index-base.css"),
		themes: join(cwd, outputPath, "index-theme.css"),
	};
	/* --- END --- */

	/* --- INTERPOLATED DATA --- */
	/** NX uses configurations as a way of running tasks in different contexts */
	const isLegacy = context.configurationName === "legacy" ?? false;
	const pkgName = `@spectrum-css/${context.projectName}`;
	/* Generate a random hex color using the package name as a seed */
	const random = new Randoma({ seed: pkgName });
	const hex = random.color(1).hex().toString();

	/* Pretty print the package name for logging */
	const printPkg = chalk.hex(hex)(`[${pkgName}] `);

	const MESSAGE = {
		success: `build complete 🎉`,
		failure: `${chalk.red("❌")} failure`,
	};
	const log = (message) => logger.log(printPkg, message);
	/* --- END --- */

	/* --- UTILITY FUNCTIONS --- */
	/**
	 * @description Print the provided paths in human-readable format
	 * @param {string[]|string} paths
	 * @param {string} cwd
	 * @returns {string}
	 */
	const print = (paths, bytes = 0) => {
		if (typeof paths === "string") paths = [paths];
		return `${paths
			.map((path) => chalk.yellow(relative(cwd, path)))
			.join(", ")}${bytes > 0 ? chalk.gray(` [${bytes} bytes]`) : ""}`;
	};

	/**
	 * Combine provided input paths and return the combined content along with a sourcemap
	 * @description Read in the provided input files, combine, and run them through PostCSS
	 * @param {string[]} inputPaths
	 * @param {string} outputPath
	 * @returns {Promise<string>}
	 */
	async function readWrite(inputPaths, outputPath) {
		if (!inputPaths || !inputPaths.length) return;

		const { content, inputFiles, map } = await fgConcat(
			inputPaths,
			outputPath,
			{ cwd: context.root }
		).catch((e) => Promise.reject(e));

		/** if there are no input files or the files are empty, log that we're skipping it and return */
		if (inputFiles.length === 0 || !content || content.trim() === "") {
			log(`${chalk.gray("-")} skipped ${print(outputPath)}`);
			return Promise.resolve();
		}

		/** More than 1 input file processed? Log that they were combined */
		if (inputFiles.length > 1) {
			log(
				`${chalk.green("✔")} combined ${print(inputFiles)}${
					outputPath ? ` -> ${print(outputPath)}` : ""
				}`
			);
		}

		let contents = content;
		let mapContent = map;

		if (extname(outputPath) === ".css") {
			const ctx = {
				env,
				to: outputPath,
				from: inputPaths[0] ?? undefined,
				cwd,
			};

			const { plugins, options } = await postcssrc(ctx).catch((e) =>
				Promise.reject(e)
			);
			const r = await postcss(plugins)
				.process(content, options)
				.catch((e) => Promise.reject(e));

			/** If the postcss process returns a map, merge it and the fg-concat map */
			if (r.map && r.opts && r.opts.to) {
				const mergedMap = merge(JSON.parse(map), JSON.parse(r.map));
				if (mergedMap) {
					mapContent = JSON.stringify(mergedMap);
				}
			}

			if (r.css) contents = r.css;
		}

		if (mapContent) {
			await write(mapContent, `${outputPath}.map`, { formatter: "json" });
		}

		return write(contents, outputPath, {
			cwd,
			formatter: extname(outputPath) === ".map" ? "json" : undefined,
		});
	}

	/**
	 * @description Write out the provided contents to the provided outputPath
	 * @param {string} contents
	 * @param {string} outputPath
	 * @returns {Promise<string>}
	 */
	async function write(contents, outputPath, { formatter = "css" } = {}) {
		if (!contents || contents === "") {
			/** If there's no content, remove the output asset if it already exists */
			await fsp
				.rm(outputPath)
				.catch(() => {})
				.then(() => {
					logger.debug(`🧹 removed ${print(outputPath)}.`);
				});
			return Promise.resolve("");
		}

		/** Create the directory first if it doesn't exist */
		if (!fs.existsSync(dirname(outputPath))) {
			fs.mkdirSync(dirname(outputPath), {
				recursive: true,
			});
		}

		/**
		 * Remove the file if it already exists; this helps us with cleanup
		 * @todo should I wrap this in the clean flag?
		 */
		if (fs.existsSync(outputPath)) {
			await fsp.rm(outputPath).catch(() => {});
		}

		/** Format the content before writing */
		try {
			contents = prettier.format(contents, { parser: formatter });
		} catch (e) {
			return Promise.reject(e);
		}

		/** Write the processed content and return */
		await fsp
			.writeFile(outputPath, contents, { encoding: "utf8" })
			.catch((e) => Promise.reject(e));

		if (!extname(outputPath).endsWith("map")) {
			log(
				`${chalk.green("✔")} wrote ${print(outputPath)} ${chalk.gray(
					`[${contents.length} bytes]`
				)}`
			);
		}

		return Promise.resolve(contents);
	}
	/* --- END --- */

	/* --- DATA COLLECTORS --- */
	/** Collect errors from concurrent runs in order to report out without failing the entire build */
	const errors = [];
	/** Storing the task promises in an array allows us to run concurrent processes */
	const promises = [];
	/* --- END --- */

	/* --- BUILD --- */
	/** Report to console that building has started */
	log(
		`started build${
			isLegacy ? ` with ${chalk.underline("legacy")} process` : ""
		}`
	);

	/**
	 * Start by processing the core styles and combining them with theme
	 * settings into our main export - index.css; data is read in from all
	 * sources and processed using PostCSS utilities to create multiple
	 * outputs including a vars.css file containing only the variables used.
	 *
	 * @returns {Promise<void>}
	 **/
	const index = async () => {
		const contents = await readWrite(
			[...sourceFiles, ...themeFiles].map((file) => join(cwd, file)),
			outputs.index
		).catch((error) => Promise.reject(error));

		/** If there was a problem creating the combined asset, return now; do not continue processing */
		if (!fs.existsSync(outputs.index) || !contents || contents === "") {
			/** @note it's okay if the rm task fails... */
			await fsp.rm(outputs.compat).catch(() => "");
			return Promise.resolve();
		}

		/**
		 * Process CSS variables looking for all class names, variable definitions,
		 * and noting the variables used in the component (vs. passthroughs for example)
		 * @note we validated that contents is not empty above so we can safely pass it in here
		 */
		const { varDefinitions = new Map(), usedVars = new Set() } =
			parseForCustomProperties(contents);

		/**
		 * For each color stop and scale, filter the variables for
		 * those matching the component; this data is used later to
		 * report on and document the available variables.
		 * @todo incorporate passthroughs
		 */
		const {
			mods = [],
			a11y = [],
			global = [],
			component = [],
		} = filterVars(usedVars, { pkgName });

		const p = [];

		/**
		 * This will generate the metadata/mods.md file for the component
		 * @todo deprecate mods.md after confirming if it's being used externally
		 * because we shouldn't be writing to the source during the build.
		 * If there are no mods, remove the file (if it exists).
		 */
		if (mods.length > 0) {
			p.push(
				write(
					[
						"| Modifiable custom properties |\n| --- |",
						...mods.map((result) => `| \`${result}\` |`),
					].join("\n"),
					outputs.markdown,
					{ formatter: "markdown" }
				)
			);
		} else {
			p.push(fsp.rm(outputs.markdown).catch(() => {}));
		}

		/** dist/custom-properties.json */
		if (mods.length || a11y.length || global.length || component.length) {
			p.push(
				write(
					JSON.stringify({ mods, a11y, global, component }),
					outputs.customProperties,
					{ formatter: "json" }
				)
			);
		} else {
			p.push(fsp.rm(outputs.customProperties).catch(() => {}));
		}

		/**
		 * If there are no variables used, no need to write out the files
		 * so we can return early
		 */
		if (component.length === 0) {
			return Promise.all([
				/** Copy index as index-vars to maintain backwards compatibility */
				fsp.copyFile(outputs.index, outputs.compat),
				...p,
			]);
		}

		/**
		 * Parse the content for all class names and process the CSS
		 * through PostCSS to generate the final output; write out the
		 * resulting CSS to dist/vars.css and any sourcemaps to dist/vars.css.map.
		 *
		 * This is our **vars-only** CSS file.
		 */
		const varsonly = async (content) => {
			const { plugins, options } = await postcssrc({
				env,
				to: outputs.vars,
				from: join(cwd, sourceFiles[0]),
				cwd,
			}).catch((error) => Promise.reject(error));

			const classNames = parseForClasses(content) ?? new Set();
			if (classNames.size === 0) return Promise.resolve();

			const c = `
${[...classNames].join(",")} {
${[...varDefinitions.entries()]
	.map(([key, value]) =>
		!key.startsWith("--highcontrast") ? `  ${key}: ${value[0]};` : ""
	)
	.join("\n")}
}
`;
			/**
			 * Restructure the variable definitions into an array of
			 * key: value pairs for writing out to the vars.css file;
			 * we're also filtering out the high contrast variables and
			 * making use of the first value provided for each variable
			 *
			 * --key: value;
			 *
			 * @todo do we want the last value for each variable?
			 **/
			const r = await postcss(plugins)
				.process(c, options)
				.catch((error) => Promise.reject(error));

			if (r.map && r.opts && r.opts.to) {
				await write(r.map, `${r.opts.to}.map`, { formatter: "json" }).catch(
					(error) => Promise.reject(error)
				);
			}

			return write(css, outputs.vars, { cwd });
		};

		return Promise.all([
			/** Copy index as index-vars to maintain backwards compatibility */
			fsp.copyFile(outputs.index, outputs.compat),
			...p,
			varsonly(contents),
		]).catch((error) => Promise.reject(error));
	};

	promises.push(index());

	/**
	 * Modern steps will run through theme processing as well but legacy
	 * builds do not need to do this because they have alternative theming
	 * methods.
	 **/
	if (!isLegacy) {
		/** Combine styles and themes into an index-base.css */
		const base = readWrite(
			[...sourceFiles, ...themeFiles].map((file) => join(cwd, file)),
			outputs.base
		);

		promises.push(base);

		/** If there are themes, process them individually */
		const themes = fg.sync(themeFiles).map((theme) =>
			readWrite(
				[theme].map((file) => join(cwd, file)),
				join(cwd, outputPath, theme)
			)
		);

		promises.push(...themes);

		/**
		 * 4. Combine theme styles into an index-theme.css with spectrum first
		 */
		const themeSet = readWrite(
			themeFiles.map((file) => join(cwd, file)),
			outputs.themes
		);

		promises.push(themeSet);
	}

	/** Wait for all tasks to complete and report back to the console the results */
	await Promise.all(promises).catch((error) => {
		errors.push(error);
	});
	/* --- END --- */

	/* --- REPORT --- */
	/** Report the failure and log error messages */
	if (errors.length > 0) {
		log(
			`${MESSAGE.failure}${
				errors.length > 0
					? ` with ${errors.length} error${errors.length > 1 ? "s" : ""}`
					: ""
			}`
		);
		errors.map((error) => {
			log(error?.message ?? error);
		});
	} else log(MESSAGE.success);
	/* --- END --- */

	/** Return the build results as a boolean pass/fail and with an output file */
	return Promise.resolve({
		success: errors.length === 0,
		// This field is needed for `@nx/js:node` executor to work.
		outfile: join(cwd, outputPath),
	});
};

/**
 * @todo Verify the option inputs and provide defaults
 * @param {import('./schema.js').ComponentBuilderExecutorOptions} options
 * @param {import('@nx/devkit').ExecutorContext} context
 * @returns {import('./schema.js').ComponentBuilderExecutorOptions & { env: "development" | "production"; }}
 */
function normalizeOptions(options, context) {
	options.env = process.env.NODE_ENV ?? "development";
	if (!options.sourceFiles || options.sourceFiles.length === 0) {
		options.sourceFiles = ["index.css"];
	} else if (typeof options.sourceFiles === "string") {
		options.sourceFiles = [options.sourceFiles];
	}

	if (!options.outputPath) {
		options.outputPath = "dist";
	}

	return options;
}

/**
 * For each color stop and scale, filter the variables for those matching
 * the component; this data is used later to report on and document available
 * variables
 * @param {string} contents
 * @returns {{ defined: Map<string, string[]>, used: Set<string> }}
 */
function parseForCustomProperties(contents) {
	// Pulls out all the variables used in the component
	const defined = new Map();
	const used = new Set();

	postcss.parse(contents).walkDecls((decl) => {
		const value = decl.value.replace(/(\t|\n)/g, "").trim();

		if (decl.prop.startsWith("--")) {
			if (defined.has(decl.prop)) {
				defined.set(decl.prop, [...defined.get(decl.prop), value]);
			} else {
				defined.set(decl.prop, [value]);
			}
		}

		const matches = value.match(/var\(.*?\)/g);
		if (!matches) return;

		matches.forEach((match) => {
			const varName = match
				.replace(/var\(\s*(--[\w\-]+)\s*,?.*?\)/, "$1")
				.trim();
			used.add(varName);
		});
	});

	return { defined, used };
}
/**
 * For each color stop and scale, filter the variables for those matching
 * the component; this data is used later to report on and document available
 * variables
 * @param {string} contents
 * @returns {Set<string>}
 */
function parseForClasses(contents) {
	// Pulls out all the variables used in the component and writes them to dist/vars.css & dist/vars.json
	const classNames = new Set();

	postcss.parse(contents).walkRules((rule) => {
		// Parse the selectors to find all the class names
		selectorParser((selectors) => {
			selectors.walk((s, idx) => {
				if (s.type !== "class") return;
				if (idx > 0) return;
				if (/^spectrum-[A-Z][a-zA-Z]+$/.test(s.value)) {
					classNames.add(`.${s.value}`);
					return false;
				}
			}, true);
		}).processSync(rule.selector);
	});

	return classNames;
}

/**
 * For each color stop and scale, filter the variables for those matching
 * the component; this data is used later to report on and document available
 * variables
 * @param {Set} used
 * @param {Object} options
 * @param {String} options.pkgName
 * @returns {{ mods: string[], a11y: string[], global: string[], component: string[] }}
 */
function filterVars(used, { pkgName }) {
	if (used.size === 0) return { mods: [], a11y: [], global: [], component: [] };

	const mods = [...used].filter((key) => key.startsWith("--mod")) ?? [];
	const a11y =
		[...used].filter((key) => key.startsWith("--highcontrast")) ?? [];

	const global = [...used].filter((key) => {
		if (mods.includes(key) || a11y.includes(key)) return false;
		const componentName = pkgName.split("/").pop().toLowerCase();

		const fm = new FuzzyMatching([componentName]);
		const keyCore = key.replace(/--spectrum-/, "").split("-");

		let corrected = fm.get(keyCore[0], { maxChanges: 1 });
		if (corrected?.value === componentName) return false;

		corrected = fm.get(`${keyCore[0]}-${keyCore[1]}`, { maxChanges: 1 });
		if (corrected?.value === componentName) return false;

		return (
			(key.includes("spectrum-global") ||
				key.includes("spectrum-alias") ||
				key.startsWith("--spectrum-")) ??
			[]
		);
	});

	/**
	 * Check all used variables to find those relevant to only this component
	 */
	const component =
		[...used].filter(
			(key) =>
				!(global.includes(key) || mods.includes(key) || a11y.includes(key))
		) ?? [];

	/* Assign to a set to dedupe values, destructure to array, apply an alphabetical sort */
	return {
		mods: [...new Set(mods)].sort(),
		a11y: [...new Set(a11y)].sort(),
		global: [...new Set(global)].sort(),
		component: [...new Set(component)].sort(),
	};
}

/**
 * Fetches the custom property details from provided CSS content;
 * content is broken down into user-defined buckets
 * @param {string} content - the CSS content
 * @param {BucketConfig} bucketConfig - the rules for assigning tokens to the buckets
 * @param {TokenMetadata} ret - an optional object to add the token metadata to
 * @returns {TokenMetadata}
 */
async function getTokenData({ from, isLegacy } = {}) {
	const bucketConfig = new Map([["props", [/^--/]]]);
	const content = await fgConcat(
		isLegacy ? ["spectrum-global.css", "components/index.css"] : ["index.css"],
		null,
		{
			map: false,
			cwd: isLegacy
				? !isExpress
					? path.dirname(
							require.resolve("@spectrum-css/vars/dist/spectrum-global.css")
					  )
					: path.dirname(
							require.resolve(
								"@spectrum-css/expressvars/dist/spectrum-global.css"
							)
					  )
				: path.dirname(require.resolve("@spectrum-css/tokens/dist/index.css")),
		}
	);
	if (!content) return;

	/**
	 * Initialize the return object; each bucket will be a map keyed by the token name, the value,
	 * is an array of objects containing the fallbacks, selector, and file where the token is used.
	 * @type TokenMetadata
	 */
	let ret = [...bucketConfig.keys()].reduce(
		(acc, key) => ({ ...acc, [key]: new Map() }),
		{}
	);

	/**
	 * Parse the token and determine which bucket to put it in
	 * @param {string} token - the token to parse
	 * @returns {string|undefined} - the bucket key or undefined if no match
	 */
	const getBucketKey = (token) => {
		if (!token || typeof token !== "string") return;
		const bucketName = [...bucketConfig.keys()].find((key) => {
			const regexes = bucketConfig.get(key) ?? [];
			if (!key || regexes.length === 0) return false;
			return regexes.reduce((acc, regex) => {
				if (token.match(regex)) return true;
				return acc;
			}, false);
		});
		if (!bucketName) return;
		return bucketName;
	};

	/**
	 * Need a function to parse the token and determine which bucket to put it in.
	 * @param {Token} token - the token to which the value is assigned
	 * @param {{ selector: string, file: import('path').PathLike, fallback: Token|Token[] }} args - the selector and file where the token is defined
	 * @returns {boolean} - true if the token was added to the bucket
	 */
	const addToBucket = (token, settings = {}) => {
		let key;
		if (!isToken(token) || !(key = getBucketKey(token))) return false;

		// Can't add a value to a bucket if the key or token is missing
		if (!key || !token) return false;

		/* Add to the bucket if it does not yet contain the token */
		if (!ret[key].has(token)) {
			ret[key].set(token, [settings]);
			return true;
		}

		/* If the token already exists, merge the data */
		const argsArray = ret[key].get(token);
		for (const args of argsArray) {
			/* Validate that the objects are identical */
			const shouldUpdate = Object.entries(args)
				.map(([k, v]) => {
					if (settings[k] !== v) return true;
					return false;
				})
				.every((bool) => bool === true);

			if (!shouldUpdate) continue;

			/* Add the value to the list of values */
			ret[key].set(token, [...argsArray, settings]);
			return true;
		}

		return false;
	};

	/**
	 * Determine if a provided node is a var function
	 * @param {import('postcss-value-parser').Node} node - the node to check
	 * @returns {boolean} - true if the node is a var function
	 */
	const isVarFunc = (node) =>
		Boolean(node && node.type === "function" && node.value === "var");

	/**
	 * Determine if a provided string is a token
	 * @param {string} str - the string to check
	 * @returns {boolean} - true if the node is a token string
	 */
	const isToken = (str) => Boolean(str && str.startsWith("--"));

	/**
	 * Determine if a provided string contains a var function
	 * @param {string} str - the string to check
	 * @returns {boolean} - true if the string contains a var function
	 */
	const hasToken = (str) => Boolean(str && str.match(/var\(--/));

	// If a property matches one of the regex, it should always be first in the stack.
	postcss.parse(content, { from }).walkDecls((decl) => {
		/* If the declaration does not contain a token, no need to process */
		if (!isToken(decl.prop) && !hasToken(decl.value)) return;

		/**
		 * Start by checking if the property is a token and if it matches a defined bucket
		 * Note the inline variable assignment for key; this both:
		 * 1. checks if the token belongs in one of the user-provided buckets
		 * 2. captures the bucket key for use inside the loop
		 */
		// @todo should I pre-parse the value into fallbacks or do that in the addToBucket function?
		const foundMatch = addToBucket(decl.prop, {
			selector: rule.selector,
			file: decl.source.input.file,
			fallback: decl.value,
		});

		if (foundMatch) return;

		// Stop processing if there was no match for the property and there are no tokens in the value
		if (!hasToken(decl.value)) return;

		// Next we walk the assigned values to see if any of them are/contains tokens
		valueParser(decl.value).walk((node) => {
			if (!isVarFunc(node)) return;
			let value;
			if (node.nodes.length > 1) {
				const foundNode = node.nodes
					.slice(1)
					?.find((n) => n.type === "word" || isVarFunc(n));
				if (foundNode) value = valueParser.stringify(foundNode);
			}

			if (!isToken(node.nodes[0].value)) return;

			addToBucket(node.nodes[0].value, {
				selector: rule.selector,
				file: decl.source.input.file,
				fallback: value,
			});
		});
	});

	/* Sort the buckets alphabetically */
	for (const key of Object.keys(ret)) {
		ret[key] = new Map([...ret[key]].sort());
	}

	return ret;
}

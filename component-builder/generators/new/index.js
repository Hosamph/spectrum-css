const {
	formatFiles,
	installPackagesTask,
	generateFiles,
	joinPathFragments,
	readProjectConfiguration,
	names,
} = require("@nx/devkit");
const { libraryGenerator } = require("@nx/js");
const _ = require("lodash");

/**
 *
 * @param {import('@nx/devkit').Tree} tree
 * @param {import('./schema').Schema} schema
 * @returns
 */
module.exports = async function newGenerator(tree, schema) {
	const options = normalizeOptions(schema);
	validateOptions(options, tree);

	await libraryGenerator(tree, {
		folder: (val) => _.lowerCase(_.camelCase(val)),
		kebabCase: (val) => _.kebabCase(val),
		pascalCase: (val) => _.upperFirst(_.camelCase(val)),
		camelCase: (val) => _.camelCase(val),
		lowerCase: (val) => _.lowerCase(val),
		parse: (str, sep = "/", start = 0, end = undefined) => {
			if (!str) return;
			const array = str.split(sep);
			return array.slice(start, end).join(sep);
		},
		...options,
	});

	const libraryRoot = readProjectConfiguration(tree, options.name).root;
	console.log("libraryRoot", libraryRoot);

	generateFiles(
		tree, // the virtual file system
		joinPathFragments(__dirname, "./templates"), // path to the file templates
		joinPathFragments(
			libraryRoot,
			"components",
			_.lowerCase(_.camelCase(options.name))
		), // destination path of the files
		options // config object to replace variable in file templates
	);

	await formatFiles(tree);

	return () => {
		installPackagesTask(tree, false, options.directory, "yarn");
	};
};

/**
 * Normalize options and set defaults
 * @param {import('./schema').Schema} options
 * @returns {Schema}
 *
 * @reference https://github.com/nrwl/nx/blob/018d9972eed60a3836b0eb65559cf1913029a4c8/packages/react/src/generators/component/component.ts
 */
function normalizeOptions(options) {
	// const project = getProjects(host).get(options.project);
	const normalized = { ...options };

	normalized.name = names(options.name).fileName;

	const tokenConfig = readProjectConfiguration(tree, "tokens");
	console.log("tokenConfig", tokenConfig);
	normalized.tokens = {
		name: "@spectrum-css/tokens",
		version: "11.3.3",
	};

	return normalized;
}

/**
 * Validate options
 * @param {import('./schema').Schema} options
 * @returns {Schema}
 *
 * @reference https://github.com/nrwl/nx/blob/018d9972eed60a3836b0eb65559cf1913029a4c8/packages/react/src/generators/component/component.ts
 */
function validateOptions(options, host) {
	if (!options.name) {
		throw new Error(`Invalid options, "name" is required.`);
	}

	// Validate if project exists already
	if (
		host.exists(options.name) &&
		!host.isFile(options.name) &&
		host.children(options.name).length > 0
	) {
		throw new Error(
			`${join(host.root, options.name)} is not an empty directory.`
		);
	}
}

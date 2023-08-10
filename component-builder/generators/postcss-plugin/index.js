const {
	formatFiles,
	installPackagesTask,
	generateFiles,
	joinPathFragments,
	readProjectConfiguration,
} = require("@nx/devkit");
const { libraryGenerator } = require("@nx/js");
// const _ = require("lodash");

/**
 *
 * @param {import('@nx/devkit').Tree} tree
 * @param {import('./schema').Schema} schema
 * @returns
 */
module.exports = async function postcssPluginGenerator(tree, schema) {
	const options = await normalizeOptions(tree, schema);
	console.log("options", options);

	await libraryGenerator(tree, options);

	const libraryRoot = readProjectConfiguration(tree, options.name).root;

	generateFiles(
		tree, // the virtual file system
		joinPathFragments(__dirname, "./templates"), // path to the file templates
		libraryRoot, // destination path of the files
		options // config object to replace variable in file templates
	);

	await formatFiles(tree);

	return () => {
		installPackagesTask(tree);
	};
};

/**
 * Validate options and set defaults
 * @param {import('@nx/devkit').Tree} _host
 * @param {import('./schema').Schema} options
 * @returns {Promise<Schema>}
 *
 * @reference https://github.com/nrwl/nx/blob/018d9972eed60a3836b0eb65559cf1913029a4c8/packages/react/src/generators/component/component.ts
 */
async function normalizeOptions(_host, options) {
	// @todo validate if project exists already
	// const project = getProjects(host).get(options.project);
	return options;
}

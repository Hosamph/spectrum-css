const spectrumBuildExecutor = require("./executors/build");

const newGenerator = require("./generators/new");
const postcssPluginGenerator = require("./generators/postcss-plugin");

module.export = { spectrumBuildExecutor, newGenerator, postcssPluginGenerator };

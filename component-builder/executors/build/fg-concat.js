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

const fs = require("fs");
const fsp = fs.promises;
const { relative } = require("path");

const fg = require("fast-glob");
const Concat = require("concat-with-sourcemaps");

/**
 * Fetches the custom property details from provided CSS content;
 * content is broken down into user-defined buckets
 * @param {string|string[]} files - the filepaths to read-in and combine
 * @param {string|undefined} [outputFile] - the path to write the combined content to (optional)
 * @param {{ map: boolean; cwd: string; } & import('fast-glob').Options}
 * @returns {Promise<{ inputFiles: string[]; content: string; map: string; }>}
 */
module.exports = async function (
	files,
	outputFile = undefined,
	{ map = true, cwd, ...fgOpts } = {}
) {
	/** @todo throw a warning here that no files were provided */
	if (!files || !files.length) return Promise.reject(`No files provided.`);

	if (typeof files === "string") files = [files];

	const concat = new Concat(map, outputFile ?? "temp", `\n\n`);

	const foundFiles = [];
	// Running files through fg ensures any globs are expanded
	// and the files are absolute paths
	for (const file of await fg(files, {
		absolute: true,
		...(fgOpts ?? {}),
	})) {
		foundFiles.push(file);
		await fsp
			.readFile(file, "utf-8")
			.then((content) => {
				concat.add(file, `/* Source: ${relative(cwd, file)} */\n${content}`);
			})
			.catch((e) => Promise.reject(e));
	}

	return Promise.resolve({
		/**
		 * Return the fast-glob resolved file list so we know
		 * what files were used to generate the content
		 */
		inputFiles: foundFiles,
		content: concat.content.toString(),
		map: concat.sourceMap,
	});
};

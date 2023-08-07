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
const gulp = require("gulp");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const pugCompiler = require("pug");
const pug = require("gulp-pug");
const data = require("gulp-data");
const yaml = require("js-yaml");
const through = require("through2");
const ext = require("replace-ext");
const logger = require("gulplog");
const colors = require("colors");
const lunr = require("lunr");

const dirs = require("../lib/dirs");
const depUtils = require("../lib/depUtils");

const npmFetch = require("npm-registry-fetch");

let templateData = {
	nav: [],
};

async function buildDocs_forDep(dep) {
	// Drop package org
	dep = dep.split("/").pop();

	const metadata = await fsp
		.readFile(
			path.join(
				__dirname,
				"../../../components/vars/dist/spectrum-metadata.json"
			)
		)
		.then(JSON.parse)
		.catch(console.error);

	const dependencyOrder = await depUtils.getPackageDependencyOrder(
		path.join(dirs.components, dep)
	);

	return new Promise((resolve, reject) => {
		gulp
			.src(
				[path.join(__dirname, "../../../components", dep, "metadata/*.yml")],
				{
					allowEmpty: true,
				}
			)
			.pipe(
				data(async function (file) {
					const componentDeps = [
						...(dependencyOrder.map((dep) => dep.split("/").pop()) ?? []),
						dep,
					];

					const pkg = await fsp
						.readFile(
							path.join(__dirname, "../../../components", dep, "package.json")
						)
						.then(JSON.parse)
						.catch(console.error);

					let docsDeps = [
						"icon",
						"statuslight",
						"link",
						"page",
						"site",
						"typography",
						"tooltip",
						"sidenav",
						"actionbutton",
						"button",
						"textfield",
						"clearbutton",
						"search",
						"menu",
						"fieldlabel",
						"picker",
						"popover",
						"underlay",
						"card",
						"divider",
						"illustratedmessage",
						"accordion",
						"table",
					];

					docsDeps = docsDeps
						.concat(componentDeps)
						?.filter((dep, i) => docsDeps.indexOf(dep) === i);

					let date;
					try {
						const data = await npmFetch.json(pkg.name);
						date = data.time[pkg.version];
						date = new Date(date).toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						});
					} catch (err) {
						date = "Unreleased";
						logger.error(
							`Could not determine date of release for ${pkg.name}@${pkg.version}`
						);
					}

					return {
						util: require(`${dirs.site}/util`),
						dnaVars: metadata,
						...templateData,
						pageURL: path.basename(file.basename, ".yml") + ".html",
						dependencyOrder: docsDeps,
						releaseDate: date,
						pkg,
					};
				})
			)
			.pipe(
				through.obj(function compilePug(file, enc, cb) {
					let component;
					var componentName = file.dirname
						.replace("/metadata", "")
						.split("/")
						.pop();
					try {
						component = yaml.load(String(file.contents));
					} catch (loadError) {
						logger.error(
							"Uh, oh... during buildDocs_forDep, yaml loading failed for"
								.yellow,
							componentName.red
						);
						throw loadError;
					}

					if (!component.id) {
						// Use the example file name
						component.id = path.basename(file.basename, ".yml");
					}
					let templateData = {
						component,
						...(file.data ?? {}),
					};

					file.path = ext(file.path, ".html");

					try {
						const templatePath = path.join(
							__dirname,
							"../../../site/templates/siteComponent.pug"
						);
						let compiled = pugCompiler.renderFile(templatePath, templateData);
						file.contents = Buffer.from(compiled);
					} catch (err) {
						return cb(err);
					}
					cb(null, file);
				})
			)
			.pipe(gulp.dest("dist/"))
			.on("end", resolve)
			.on("error", reject);
	});
}

// Combined
async function buildDocs_individualPackages() {
	const promises = [];
	for (const dep of await depUtils.getFolderDependencyOrder(
		path.join(__dirname, "../../../components/")
	)) {
		promises.push(buildDocs_forDep(dep));
	}
	return Promise.all(promises);
}

function buildSite_generateIndex() {
	return gulp
		.src([`${dirs.components}/*/metadata/*.yml`])
		.pipe(
			(function () {
				let docs = [];
				let store = {};
				let latestFile = null;
				function readYML(file, enc, cb) {
					let componentData;
					try {
						componentData = yaml.load(String(file.contents));
					} catch (err) {
						return cb(err);
					}

					var componentName = file.dirname
						.replace("/metadata", "")
						.split("/")
						.pop();

					if (path.basename(file.basename) === "metadata.yml") {
						file.basename = componentName;
					}

					var fileName = ext(file.basename, ".html");

					docs.push({
						href: fileName,
						name: componentData.name,
						description: componentData.description,
					});

					store[fileName] = {
						href: fileName,
						name: componentData.name,
						component: componentName,
						description: componentData.description,
					};

					latestFile = file;

					cb();
				}

				function endStream(cb) {
					let indexFile = latestFile.clone({ contents: false });
					indexFile.path = path.join(latestFile.base, "index.json");

					let index = lunr(function () {
						this.ref("href");
						this.field("name", { boost: 10 });
						this.field("description");

						docs.forEach(function (doc) {
							this.add(doc);
						}, this);
					});

					// Note: could merge main index here using technique from https://www.garysieling.com/blog/building-a-full-text-index-in-javascript

					indexFile.contents = Buffer.from(JSON.stringify(index));
					this.push(indexFile);

					let storeFile = latestFile.clone({ contents: false });
					storeFile.path = path.join(latestFile.base, "store.json");
					storeFile.contents = Buffer.from(JSON.stringify(store));
					this.push(storeFile);

					cb();
				}

				return through.obj(readYML, endStream);
			})()
		)
		.pipe(gulp.dest("dist/"));
}

function buildSite_getData() {
	let nav = [];
	return gulp
		.src([
			`${dirs.components}/*/metadata.yml`,
			`${dirs.components}/*/metadata/*.yml`,
		])
		.pipe(
			through.obj(function readYML(file, enc, cb) {
				let componentData;
				var componentName = file.dirname
					.replace("/metadata", "")
					.split("/")
					.pop();
				try {
					componentData = yaml.load(String(file.contents));
				} catch (loadError) {
					logger.error(
						"Uh, oh... during buildDocs_getData, yaml loading failed for"
							.yellow,
						componentName.red
					);
					throw loadError;
				}

				if (path.basename(file.basename) === "metadata.yml") {
					file.basename = componentName;
				}

				var fileName = ext(file.basename, ".html");
				nav.push({
					name: componentData.name,
					component: componentName,
					hide: componentData.hide,
					fastLoad: componentData.fastLoad,
					href: fileName,
					description: componentData.description,
				});

				cb(null, file);
			})
		)
		.on("end", () => {
			templateData.nav = nav.sort((a, b) => (a.name <= b.name ? -1 : 1));
		});
}

function buildSite_copyResources() {
	return gulp.src(`${dirs.site}/dist/**`).pipe(gulp.dest("dist/"));
}

function buildSite_copyFreshResources() {
	return gulp.src(`${dirs.site}/resources/**`).pipe(gulp.dest("dist/"));
}

function buildSite_html() {
	return gulp
		.src(`${dirs.site}/*.pug`)
		.pipe(
			data(function (file) {
				return {
					util: require(`${dirs.site}/util`),
					pageURL: path.basename(file.basename, ".pug") + ".html",
					dependencyOrder: [
						"icon",
						"statuslight",
						"link",
						"page",
						"site",
						"typography",
						"tooltip",
						"sidenav",
						"actionbutton",
						"button",
						"textfield",
						"clearbutton",
						"search",
						"menu",
						"fieldlabel",
						"picker",
						"popover",
						"underlay",
						"card",
						"divider",
						"illustratedmessage",
						"accordion",
						"table",
					],
				};
			})
		)
		.pipe(
			pug({
				locals: templateData,
			})
		)
		.pipe(gulp.dest("dist/"));
}

function copySiteWorkflowIcons() {
	return gulp
		.src(
			path.join(
				path.dirname(require.resolve("@adobe/spectrum-css-workflow-icons")),
				"spectrum-icons.svg"
			)
		)
		.pipe(gulp.dest("dist/img/"));
}

exports.buildSite = gulp.parallel(
	buildSite_copyResources,
	gulp.series(buildSite_getData, buildSite_html)
);

let buildDocs = gulp.series(
	buildSite_getData,
	gulp.parallel(
		buildSite_generateIndex,
		buildDocs_individualPackages,
		buildSite_copyResources,
		copySiteWorkflowIcons
	)
);

let build = gulp.series(
	buildSite_getData,
	gulp.parallel(buildDocs, buildSite_html)
);

exports.buildSite_getData = buildSite_getData;
exports.buildSite_copyResources = buildSite_copyResources;
exports.buildSite_copyFreshResources = buildSite_copyFreshResources;
exports.buildSite_pages = gulp.series(buildSite_getData, buildSite_html);
exports.buildSite_html = buildSite_html;
exports.buildDocs_forDep = buildDocs_forDep;
exports.buildDocs = buildDocs;
exports.build = build;

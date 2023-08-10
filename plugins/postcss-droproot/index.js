module.exports = () => ({
	postcssPlugin: "postcss-droproot",
	prepare() {
		return {
			Rule(rule) {
				if (rule.selector === ":root") {
					rule.remove();
				}
			},
		};
	},
});

module.exports.postcss = true;

module.exports = {
	globDirectory: 'dist/',
	globPatterns: [
		'**/*.{js,css,svg,png,html,json}'
	],
	swDest: 'dist/sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};
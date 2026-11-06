/**
 * ESLint config for the n8n community node, mirroring the ruleset n8n's
 * own node-starter template ships with. The `eslint-plugin-n8n-nodes-base`
 * rules are the same checks n8n's verification pipeline runs, keeping a
 * local copy lets us catch rejection triggers before submitting.
 */
module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**'],
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
			},
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				// `documentationUrl-miscased` is built for n8n's first-party
				// docs-slug convention (e.g. `documentationUrl = 'slack'`).
				// Community nodes have no n8n-hosted docs page, so we point
				// at a real external URL, which the companion rule
				// `documentationUrl-not-http-url` explicitly requires. The
				// two rules are mutually exclusive for community nodes; we
				// satisfy `-not-http-url` (a valid HTTPS URL) and disable
				// `-miscased`, whose autofix corrupts external URLs.
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				// These two predate NodeConnectionTypes and demand the string
				// literal 'main', which n8n's current verification scanner
				// (@n8n/eslint-plugin-community-nodes, run by
				// `npx @n8n/scan-community-package`) rejects. The scanner is
				// what decides verification, so it wins.
				'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
				'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			},
		},
	],
};

module.exports = {
	root: true,

	parser: '@typescript-eslint/parser',

	parserOptions: {
		project: './tsconfig.json',
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},

	ignorePatterns: ['dist/**', 'scripts/**', 'node_modules/**', '.eslintrc.js', 'index.js'],

	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				// Community packages use a full docs URL; camelCase slugs only apply to
				// credentials that live in the main n8n repository.
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
};

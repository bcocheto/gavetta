// ESLint 9 (flat config). Sem dependências além do próprio eslint.
const gjsGlobals = {
    global: 'readonly', console: 'readonly', print: 'readonly', log: 'readonly',
    imports: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', URL: 'readonly',
};

export default [
    {
        files: ['**/*.js'],
        languageOptions: {ecmaVersion: 2022, sourceType: 'module', globals: gjsGlobals},
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', {args: 'after-used', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'}],
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-redeclare': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'always'],
        },
    },
];

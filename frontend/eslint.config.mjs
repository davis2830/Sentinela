import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'src/types/generated/**', '.tmp/**', 'node_modules/**'] },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { parser: ts.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { '@typescript-eslint': ts.plugin, 'react-hooks': hooks },
    rules: { ...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error', 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' } },
];

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/** Props whose string values are UI copy (i18n-plan §4.1). */
const COPY_PROPS = new Set(['label', 'title', 'placeholder', 'aria-label', 'subtitle', 'description', 'hint', 'text', 'eyebrow', 'submitLabel'])

/** True when the line holding `node` says `// i18n-ignore` (brand names, symbols). */
function ignored(context, node) {
  return (context.sourceCode.lines[node.loc.start.line - 1] ?? '').includes('i18n-ignore')
}

/** Settle's own rules. */
const settle = {
  rules: {
    'no-jsx-literal-text': {
      meta: {
        type: 'suggestion',
        docs: { description: 'UI copy goes through t() so it can be translated (i18n-plan §4).' },
        schema: [],
        messages: { literal: 'Put this copy in a catalog (src/i18n/en/<ns>.ts) and render it with t().' },
      },
      create(context) {
        const hasWords = (text) => /\p{L}/u.test(text)
        return {
          JSXText(node) {
            if (hasWords(node.value) && !ignored(context, node)) context.report({ node, messageId: 'literal' })
          },
          JSXAttribute(node) {
            const name = node.name.type === 'JSXIdentifier' ? node.name.name : ''
            const value = node.value
            if (!COPY_PROPS.has(name) || !value || value.type !== 'Literal' || typeof value.value !== 'string') return
            if (hasWords(value.value) && !ignored(context, node)) context.report({ node: value, messageId: 'literal' })
          },
        }
      },
    },
  },
}

const LOOKBEHIND_MESSAGE = 'No regex lookbehind in client code: Safari before 16.4 cannot even parse it (server/ may use it).'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '.e2e-build', 'test-results', 'playwright-report', 'blob-report', '.wrangler'] },
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, settle },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Off until Phase 3 extracts each folder's copy (i18n-plan §4.1, rule 8).
      'settle/no-jsx-literal-text': 'off',
    },
  },
  {
    // Code that runs in the browser (and shared/, which the client imports).
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[regex.pattern=/\\(\\?<[=!]/]', message: LOOKBEHIND_MESSAGE },
        { selector: "NewExpression[callee.name='RegExp'] > Literal[value=/\\(\\?<[=!]/]", message: LOOKBEHIND_MESSAGE },
        { selector: "CallExpression[callee.name='RegExp'] > Literal[value=/\\(\\?<[=!]/]", message: LOOKBEHIND_MESSAGE },
        { selector: "NewExpression[callee.name='RegExp'] TemplateElement[value.raw=/\\(\\?<[=!]/]", message: LOOKBEHIND_MESSAGE },
      ],
    },
  },
)

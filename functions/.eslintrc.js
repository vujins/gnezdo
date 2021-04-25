module.exports = {
  root: true,
  env: {
    'es6': true,
    'node': true,
    'jest/globals': true,
  },
  extends: [
    'eslint:recommended',
    'plugin:jest/recommended',
  ],
  plugins: ['jest'],
  rules: {
    'linebreak-style': 0,
  },
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
};

module.exports = {
  root: true,
  env: {
    'es6': true,
    'node': true,
    'jest/globals': true,
  },
  extends: [
    'eslint:recommended',
    'google',
    'plugin:jest/recommended',
  ],
  plugins: ['jest'],
  rules: {
    'linebreak-style': 0,
  },
};

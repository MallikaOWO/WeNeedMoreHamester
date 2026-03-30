/**
 * From tavern_helper_template by 青空莉 (StageDog)
 * https://github.com/StageDog/tavern_helper_template
 * Licensed under Aladdin Free Public License (AFPL)
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: [require('autoprefixer'), require('@tailwindcss/postcss'), require('postcss-minify')],
};

module.exports = config;

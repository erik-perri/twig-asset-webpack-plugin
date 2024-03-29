# Twig Asset Webpack Plugin  [![CI](https://github.com/erik-perri/twig-asset-webpack-plugin/workflows/CI/badge.svg)](https://github.com/erik-perri/twig-asset-webpack-plugin/actions?query=workflow%3ACI)


Webpack plugin to add assets referenced in twig files to the compilation as additional assets so they are included in the generated manifest and available when Twig attempts to find them.

JS and CSS files are excluded by default since additional assets are not processed like entry points.


## Install

```bash
npm install --save-dev twig-asset-webpack-plugin
```

or

```bash
yarn add --dev twig-asset-webpack-plugin
```


## Usage

In your `webpack.config.js`

```javascript
const TwigAssetWebpackPlugin = require('twig-asset-webpack-plugin');

module.exports = {
    // ...
    plugins: [
        new TwigAssetWebpackPlugin({
            assetPath: path.resolve(__dirname, './assets'),
            templatePath: path.resolve(__dirname, './templates'),
        }),
    ]
};
```
When webpack compiles it will now scan `templatePath` for twig files matching `twigFileRegex`.  For each file found it will look for asset includes to add as additional webpack assets.

## Usage with Symfony Encore

In your `webpack.config.js`

```javascript
var TwigAssetWebpackPlugin = require('twig-asset-webpack-plugin');

Encore
    // ...
    // We need to remove the default build prefix from the manifest or
    // when twig attempts to load the asset it will not find it.
    .setManifestKeyPrefix('')
    // ...
    .addPlugin(
        new TwigAssetWebpackPlugin({
            assetPath: path.resolve(__dirname, './assets'),
            templatePath: path.resolve(__dirname, './templates'),
        })
    )
;
```

## API:

### `options.assetPath` (Required)

Type: `String`
Default: `false`

The absolute path to load assets from.  The asset referenced in the twig template should be relative to this path.


### `options.templatePath` (Required)

Type: `String`
Default: `false`

The absolute path to search for twig files in.


### `options.filename`

Type: `String`
Default: `false`

The output filename format.  If not specified the webpack `output.filename` option will be used with `.js` replaced with `.[ext]`.


### `options.excludedAssetTypes`

Type: `array`
Default: `['js', 'css']`

The asset types to ignore when parsing the twig file.


### `options.excludedFromSearch`

Type: `RegExp[]`
Default: `[ /node_modules/ ]`

The file or directory names that should not be searched.


### `options.twigFileRegex`

Type: `RegExp`
Default: `/\.html\.twig$/`

The regex to match against the template filenames.


### `options.assetNameRegExp`

Type: `RegExp`
Default: `/asset\((['"])((?!\1).+)\1\)/g`

The regex to use searching for assets in twig files.


### `options.assetNameRegExpMatch`

Type: `Number`
Default: `2`

The index to pull the file name from the `assetNameRegExp` match.


## License

[MIT](https://opensource.org/licenses/MIT)

const fs = require('fs');
const path = require('path');
const loaderUtils = require('loader-utils');

class TwigAssetWebpackPlugin {
  constructor(options) {
    this.options = Object.assign({}, {
      assetPath: false,
      templatePath: false,
      filename: false,
      excludedAssetTypes: ['js', 'css'],
      twigFileRegex: /\.html\.twig$/,
    }, options);
  }

  // noinspection JSUnusedGlobalSymbols
  apply(compiler) {
    if (!this.options.assetPath || !this.options.templatePath) {
      return;
    }

    compiler.hooks.thisCompilation.tap('TwigAssetWebpackPlugin', (compilation) => {
      // noinspection JSUnresolvedFunction
      compilation.hooks.additionalAssets.tapAsync('TwigAssetWebpackPlugin', (callback) => {
        this.additionalAssets(compilation, callback);
      });
    });
  }

  additionalAssets(compilation, callback) {
    const alreadyHandledAssets = {};
    const { templatePath, twigFileRegex } = this.options;

    this.findTwigFiles(templatePath, twigFileRegex).forEach((twigFile) => {
      let twigFileContent = null;
      try {
        twigFileContent = fs.readFileSync(twigFile, 'utf8');
      } catch (e) {
        compilation.errors.push(new Error(
          `${twigFile}: Failed to read file, ${e.message}`,
        ));
        return;
      }

      TwigAssetWebpackPlugin.findAssetsInContent(twigFileContent).forEach((reqPath) => {
        if (this.options.excludedAssetTypes.includes(reqPath.split('.').pop())) {
          return;
        }

        if (alreadyHandledAssets[reqPath]) {
          return;
        }

        alreadyHandledAssets[reqPath] = true;

        try {
          this.addAssetToCompilation(
            compilation,
            reqPath,
            path.join(this.options.assetPath, reqPath),
          );
        } catch (e) {
          compilation.errors.push(new Error(
            `${twigFile}: ${e.message}`,
          ));
        }
      });
    });

    callback();
  }

  findTwigFiles(searchPath, fileRegex, foundPreviously = []) {
    let foundFiles = [...foundPreviously];

    fs.readdirSync(searchPath).forEach((foundNode) => {
      const foundNodePath = path.join(searchPath, foundNode);
      const foundNodeStats = fs.statSync(foundNodePath);

      if (foundNodeStats.isDirectory()) {
        foundFiles = this.findTwigFiles(foundNodePath, fileRegex, foundFiles);
      } else if (!fileRegex || fileRegex.test(foundNodePath)) {
        foundFiles = [...foundFiles, foundNodePath];
      }
    });

    return foundFiles;
  }

  addAssetToCompilation(compilation, requestedPath, realPath) {
    if (!fs.existsSync(realPath)) {
      throw new Error(`Requested file "${requestedPath}" not found at "${realPath}"`);
    }

    const fileContents = fs.readFileSync(realPath, null /* null = binary */);

    // Generate the file name using loader-utils.
    const interpolationFormat = TwigAssetWebpackPlugin.getInterpolationFormat(
      this.options.filename,
      compilation.options.output.filename,
    );
    let interpolatedFileName = loaderUtils.interpolateName({
      resourcePath: realPath,
    }, interpolationFormat, {
      content: fileContents,
    });

    // Add the requested path to the generated filename.  This is needed so Twig can find the file
    // in manifest.json.
    const requestedDirname = requestedPath.split('/').slice(0, -1).join('/');
    interpolatedFileName = path.join(requestedDirname, interpolatedFileName);

    // Add the file to the compilation assets.
    // noinspection JSUnusedGlobalSymbols
    compilation.assets[interpolatedFileName] = { /* eslint-disable-line no-param-reassign */
      source: () => fileContents,
      size: () => fileContents.length,
    };

    // Call the hooks to let webpack-manifest-plugin know the user-requested file name.  Without
    // this it will include the hashed version as the manifest key.
    compilation.hooks.moduleAsset.call({
      userRequest: requestedPath,
    }, interpolatedFileName);
  }

  static findAssetsInContent(content) {
    const assets = [];
    /**
     * (['"])     Match the start of the quote
     * ((?!\1).+) Match anything that isn't the matched quote character
     */
    const regex = /asset\((['"])((?!\1).+)\1\)/g;
    let match;

    do {
      match = regex.exec(content);
      if (match) {
        assets.push(match[2]);
      }
    } while (match);

    return assets;
  }

  static getInterpolationFormat(specifiedFormat, defaultFormat) {
    let format = specifiedFormat;
    if (!format) {
      format = defaultFormat.replace(/\.js$/i, '.[ext]');
      if (!format.match(/\.\[ext]/i)) {
        format += '.[ext]';
      }
    }

    return format;
  }
}

module.exports = TwigAssetWebpackPlugin;

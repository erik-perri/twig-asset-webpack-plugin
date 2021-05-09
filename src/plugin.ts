import * as fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import loaderUtils from 'loader-utils';

import { AssetLocator, AssetLocatorInterface } from './asset-locator';

export interface TwigAssetWebpackPluginConfig {
  assetPath: string;
  templatePath?: string;
  assetLocator: AssetLocatorInterface;
  filename?: string;
}

type TwigAssetWebpackPluginConfigWithTemplatePath = Partial<TwigAssetWebpackPluginConfig> &
  Required<Pick<TwigAssetWebpackPluginConfig, 'templatePath' | 'assetPath'>>;

type TwigAssetWebpackPluginConfigWithAssetLocator = Partial<TwigAssetWebpackPluginConfig> &
  Required<Pick<TwigAssetWebpackPluginConfig, 'assetLocator' | 'assetPath'>>;

export class TwigAssetWebpackPlugin {
  private readonly PLUGIN_NAME = 'TwigAssetWebpackPlugin';

  private readonly configuration: TwigAssetWebpackPluginConfig;
  private readonly handledAssets: Record<string, string[]> = {};

  public constructor(
    config:
      | TwigAssetWebpackPluginConfigWithTemplatePath
      | TwigAssetWebpackPluginConfigWithAssetLocator
  ) {
    this.checkConfiguration(config);

    this.configuration = {
      ...{
        assetLocator: TwigAssetWebpackPlugin.isConfigWithAssetLocator(config)
          ? config.assetLocator
          : new AssetLocator(config.templatePath),
      },
      ...config,
    };
  }

  public apply(compiler: webpack.Compiler): void {
    const { assetLocator, assetPath } = this.configuration;
    const assetReferences = assetLocator.findAssetReferences();

    compiler.hooks.thisCompilation.tap(this.PLUGIN_NAME, (compilation) => {
      compilation.hooks.chunkAsset.tap(this.PLUGIN_NAME, (chunk) => {
        compilation.chunkGraph.getChunkModules(chunk).forEach((module) => {
          const moduleWithUserRequest = (module as unknown) as {
            userRequest?: string;
          };

          if (moduleWithUserRequest.userRequest) {
            // TODO Handle this better.
            // In order to ignore the entry point properly we force the asset to
            // use the chunk name. We do this so when using a string based entry
            // point ({ entry: './index.js' }), the module name is used instead
            // of the referenced file (main.js instead of index.js). This may
            // cause issues if an entry point is also referenced as an asset.
            const moduleFileId = `${chunk.name}${path.extname(
              moduleWithUserRequest.userRequest
            )}`;

            this.setAssetHandled(
              moduleFileId,
              moduleWithUserRequest.userRequest
            );
          }
        });
      });

      compilation.hooks.processAssets.tap(
        {
          name: this.PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          assetReferences.forEach((requestedAsset) => {
            if (this.isAssetHandled(requestedAsset)) {
              return;
            }

            const requestedAssetPath = path.join(assetPath, requestedAsset);
            if (!fs.existsSync(requestedAssetPath)) {
              compilation.errors.push(
                new webpack.WebpackError(
                  `Failed to add asset "${requestedAsset}", asset not found at "${requestedAssetPath}"`
                )
              );
              return;
            }

            try {
              this.addAssetToCompilation(
                compilation,
                requestedAsset,
                requestedAssetPath
              );

              this.setAssetHandled(requestedAsset, requestedAssetPath);
            } catch (e) {
              compilation.errors.push(
                new webpack.WebpackError(
                  `Failed to add asset "${requestedAsset}", ${e.message}`
                )
              );
            }
          });
        }
      );
    });
  }

  private addAssetToCompilation(
    compilation: webpack.Compilation,
    requestedAsset: string,
    requestedAssetPath: string
  ): void {
    // Generate the file name using loader-utils.
    const interpolationFormat =
      this.configuration.filename ||
      TwigAssetWebpackPlugin.getInterpolationFormatFromCompilation(compilation);

    // null in options means to return a raw data Buffer object
    const fileContents = fs.readFileSync(requestedAssetPath, null);

    const interpolatedFileName = loaderUtils.interpolateName(
      { resourcePath: requestedAssetPath },
      interpolationFormat,
      { content: fileContents }
    );

    // Add the requested path to the generated filename. This is needed so Twig
    // can find the file in manifest.json.
    const requestedPath = requestedAsset.split('/').slice(0, -1).join('/');
    const interpolatedFilePath = path.join(requestedPath, interpolatedFileName);

    // Add the file to the compilation assets.
    compilation.emitAsset(
      interpolatedFilePath,
      new webpack.sources.RawSource(fileContents),
      { sourceFilename: requestedAsset }
    );
  }

  private static getInterpolationFormatFromCompilation(
    compilation: webpack.Compilation
  ): string {
    let format = compilation.compiler.options.output?.filename || '[name].js';

    if (typeof format === 'function') {
      format = format({
        chunkGraph: compilation.chunkGraph,
      }).replace(/\.[a-z]+$/i, '');
    }

    const formatWithoutExtension = format.replace(/\.[a-z]+$/i, '');
    return formatWithoutExtension.match(/\.\[ext]/i)
      ? formatWithoutExtension
      : formatWithoutExtension + '.[ext]';
  }

  private setAssetHandled(requestedPath: string, realPath: string): void {
    if (!this.handledAssets[requestedPath]) {
      this.handledAssets[requestedPath] = [];
    }
    if (this.handledAssets[requestedPath].indexOf(realPath) === -1) {
      this.handledAssets[requestedPath].push(realPath);
    }
  }

  private isAssetHandled(asset: string): boolean {
    return !!this.handledAssets[asset];
  }

  private static isConfigWithAssetLocator(
    config:
      | TwigAssetWebpackPluginConfigWithTemplatePath
      | TwigAssetWebpackPluginConfigWithAssetLocator
  ): config is TwigAssetWebpackPluginConfigWithAssetLocator {
    return config.assetLocator !== undefined;
  }

  private checkConfiguration(
    config:
      | TwigAssetWebpackPluginConfigWithTemplatePath
      | TwigAssetWebpackPluginConfigWithAssetLocator
  ): void {
    const { assetLocator, assetPath, filename, templatePath } = config;

    if (filename && !filename.endsWith('[ext]')) {
      throw new Error(
        `[${this.PLUGIN_NAME}] invalid 'filename' configuration. The format ` +
          `should end with ".[ext]" if you are specifying the filename ` +
          `in the ${this.PLUGIN_NAME} constructor.`
      );
    }

    if (!templatePath && !assetLocator) {
      throw new Error(
        `[${this.PLUGIN_NAME}] missing 'templatePath' or 'assetLocator' configuration`
      );
    }

    if (templatePath && !fs.existsSync(templatePath)) {
      throw new Error(
        `[${this.PLUGIN_NAME}] templates path "${templatePath}" does not exist`
      );
    }

    if (!assetPath) {
      throw new Error(
        `[${this.PLUGIN_NAME}] missing 'assetPath' configuration`
      );
    }

    if (!fs.existsSync(assetPath)) {
      throw new Error(
        `[${this.PLUGIN_NAME}] assets path "${assetPath}" does not exist`
      );
    }
  }
}

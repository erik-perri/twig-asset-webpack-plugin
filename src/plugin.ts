import * as fs from 'fs';
import path from 'path';
import webpack, { Plugin } from 'webpack';
import loaderUtils from 'loader-utils';

import { AssetLocator, AssetLocatorInterface } from './asset-locator';

export interface TwigAssetWebpackPluginConfig {
  assetsPath: string;
  templatesPath?: string;
  assetLocator: AssetLocatorInterface;
  filename?: string;
}

type TwigAssetWebpackPluginConfigWithTemplatePath = Partial<TwigAssetWebpackPluginConfig> &
  Required<Pick<TwigAssetWebpackPluginConfig, 'templatesPath' | 'assetsPath'>>;

type TwigAssetWebpackPluginConfigWithAssetLocator = Partial<TwigAssetWebpackPluginConfig> &
  Required<Pick<TwigAssetWebpackPluginConfig, 'assetLocator' | 'assetsPath'>>;

export class TwigAssetWebpackPlugin implements Plugin {
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
          : new AssetLocator(config.templatesPath),
      },
      ...config,
    };
  }

  public apply(compiler: webpack.Compiler): void {
    const { assetLocator } = this.configuration;
    const assetReferences = assetLocator.findAssetReferences();

    compiler.hooks.thisCompilation.tap(this.PLUGIN_NAME, (compilation) => {
      compilation.hooks.chunkAsset.tap(this.PLUGIN_NAME, (chunk) => {
        chunk._modules.forEach((module) => {
          const moduleWithUserRequest = (module as unknown) as {
            userRequest?: string;
          };

          if (moduleWithUserRequest.userRequest) {
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

      compilation.hooks.additionalAssets.tap(this.PLUGIN_NAME, () => {
        this.addAssetsToCompilation(compilation, assetReferences);
      });
    });
  }

  private addAssetsToCompilation(
    compilation: webpack.compilation.Compilation,
    assets: string[]
  ): void {
    const { assetsPath } = this.configuration;

    assets.forEach((requestedAsset) => {
      if (this.isAssetHandled(requestedAsset)) {
        return;
      }

      const requestedAssetPath = path.join(assetsPath, requestedAsset);

      try {
        this.addAssetToCompilation(
          compilation,
          requestedAsset,
          requestedAssetPath
        );

        this.setAssetHandled(requestedAsset, requestedAssetPath);
      } catch (e) {
        compilation.errors.push(
          new Error(`Failed to add asset "${requestedAsset}", ${e.message}`)
        );
      }
    });
  }

  private addAssetToCompilation(
    compilation: webpack.compilation.Compilation,
    requestedAsset: string,
    requestedAssetPath: string
  ): void {
    if (!fs.existsSync(requestedAssetPath)) {
      throw new Error(
        `File "${requestedAsset}" not found at "${requestedAssetPath}"`
      );
    }

    // Generate the file name using loader-utils.
    const interpolationFormat =
      this.configuration.filename ||
      TwigAssetWebpackPlugin.getInterpolationFormatFromCompilation(compilation);

    // null in options means to return a raw data Buffer object
    const fileContents = fs.readFileSync(requestedAssetPath, null);

    const interpolatedFileName = loaderUtils.interpolateName(
      { resourcePath: requestedAssetPath } as webpack.loader.LoaderContext,
      interpolationFormat,
      { content: fileContents }
    );

    // Add the requested path to the generated filename. This is needed so Twig
    // can find the file in manifest.json.
    const requestedPath = requestedAsset.split('/').slice(0, -1).join('/');
    const interpolatedFilePath = path.join(requestedPath, interpolatedFileName);

    // Add the file to the compilation assets.
    compilation.assets[interpolatedFilePath] = {
      source: () => fileContents,
      size: () => fileContents.length,
    };

    // Call the hooks to let webpack-manifest-plugin know the user-requested
    // file name.  Without this it will include the interpolated version as the
    // manifest key.
    compilation.hooks.moduleAsset.call(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      { userRequest: requestedAsset },
      interpolatedFilePath
    );
  }

  private static getInterpolationFormatFromCompilation(
    compilation: webpack.compilation.Compilation
  ): string {
    let format = compilation.compiler.options.output?.filename || '[name].js';

    if (typeof format === 'function') {
      format = format({
        chunk: compilation.chunks[0],
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
    const { assetLocator, assetsPath, filename, templatesPath } = config;

    if (filename && !filename.endsWith('[ext]')) {
      throw new Error(
        `[${this.PLUGIN_NAME}] invalid 'filename' configuration. The format ` +
          `should end with ".[ext]" if you are specifying the filename ` +
          `in the ${this.PLUGIN_NAME} constructor.`
      );
    }

    if (!templatesPath && !assetLocator) {
      throw new Error(
        `[${this.PLUGIN_NAME}] missing 'templatesPath' or 'assetLocator' configuration`
      );
    }

    if (templatesPath && !fs.existsSync(templatesPath)) {
      throw new Error(
        `[${this.PLUGIN_NAME}] templates path "${templatesPath}" does not exist`
      );
    }

    if (!assetsPath) {
      throw new Error(
        `[${this.PLUGIN_NAME}] missing 'assetsPath' configuration`
      );
    }

    if (!fs.existsSync(assetsPath)) {
      throw new Error(
        `[${this.PLUGIN_NAME}] assets path "${assetsPath}" does not exist`
      );
    }
  }
}

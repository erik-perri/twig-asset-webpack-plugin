import { TwigAssetWebpackPlugin, TwigAssetWebpackPluginConfig } from './plugin';
import { AssetLocator, AssetLocatorConfig } from './asset-locator';
import fs from 'fs';

interface TwigAssetWebpackPluginBcConfig {
  assetPath: string;
  templatePath: string;
  filename?: string;
  excludedAssetTypes?: string[];
  excludedFromSearch?: RegExp[];
  twigFileRegex?: RegExp;
  assetNameRegExp?: RegExp;
  assetNameRegExpMatch?: number;
}

class TwigAssetWebpackPluginBcWrapper extends TwigAssetWebpackPlugin {
  public constructor(config: TwigAssetWebpackPluginBcConfig) {
    super(TwigAssetWebpackPluginBcWrapper.buildModernConfig(config));
  }

  private static buildModernConfig(
    config: TwigAssetWebpackPluginBcConfig
  ): Omit<TwigAssetWebpackPluginConfig, 'entryPointMatch'> {
    if (!config.assetPath) {
      throw new Error(
        `[TwigAssetWebpackPlugin] missing 'assetPath' configuration`
      );
    }

    if (!fs.existsSync(config.assetPath)) {
      throw new Error(
        `[TwigAssetWebpackPlugin] assets path "${config.assetPath}" does not exist`
      );
    }

    if (!config.templatePath) {
      throw new Error(
        `[TwigAssetWebpackPlugin] missing 'templatePath' configuration`
      );
    }

    if (!fs.existsSync(config.templatePath)) {
      throw new Error(
        `[TwigAssetWebpackPlugin] template path "${config.templatePath}" does not exist`
      );
    }

    const modernConfig: Omit<
      TwigAssetWebpackPluginConfig,
      'entryPointMatch'
    > = {
      assetPath: config.assetPath,
      assetLocator: TwigAssetWebpackPluginBcWrapper.buildAssetLocator(config),
    };

    if (config.filename) {
      modernConfig.filename = config.filename;
    }

    return modernConfig;
  }

  private static buildAssetLocator(config: TwigAssetWebpackPluginBcConfig) {
    const excludedMatches: RegExp[] = [];
    const locatorConfig: Partial<AssetLocatorConfig> = {};

    if (!config.excludedAssetTypes) {
      config.excludedAssetTypes = ['css', 'js'];
    }

    config.excludedAssetTypes.forEach((type) => {
      excludedMatches.push(new RegExp(`\\.${type}$`));
    });

    config.excludedFromSearch?.forEach((match) => {
      excludedMatches.push(match);
    });

    if (excludedMatches.length) {
      locatorConfig.excludedMatches = excludedMatches;
    }

    if (config.twigFileRegex) {
      locatorConfig.fileMatch = config.twigFileRegex;
    }

    if (config.assetNameRegExp) {
      locatorConfig.assetMatch = config.assetNameRegExp;
    }

    if (config.assetNameRegExpMatch) {
      locatorConfig.assetMatchIndex = config.assetNameRegExpMatch;
    }

    return new AssetLocator(config.templatePath, locatorConfig);
  }
}

export = TwigAssetWebpackPluginBcWrapper;

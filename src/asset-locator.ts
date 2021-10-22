import fs from 'fs';
import path from 'path';

export interface AssetLocatorConfig {
  fileMatch: RegExp;
  assetMatch: RegExp;
  assetMatchIndex: number;
  excludedMatches: RegExp[];
}

export interface AssetLocatorInterface {
  findAssetReferences(): string[];
}

export class AssetLocator implements AssetLocatorInterface {
  private readonly searchPath: string;
  private readonly configuration: AssetLocatorConfig;
  private readonly defaultConfiguration: AssetLocatorConfig = {
    fileMatch: /\.html\.twig$/,
    /**
     * (['"])     Match the start of the quote
     * ((?!\1).+) Match anything that isn't the matched quote character
     * \1         Match the end of the quote
     */
    assetMatch: /asset\((['"])((?!\1).+)\1\)/g,
    assetMatchIndex: 2,
    excludedMatches: [/node_modules/],
  };

  constructor(searchPath: string, configuration?: Partial<AssetLocatorConfig>) {
    this.searchPath = searchPath;
    this.configuration = {
      ...this.defaultConfiguration,
      ...configuration,
    };
  }

  public findAssetReferences(): string[] {
    const assets: string[] = [];

    if (!fs.existsSync(this.searchPath)) {
      throw new Error(`Asset path "${this.searchPath}" does not exist`);
    }

    this.findAssetContainersInPath(this.searchPath).forEach((twigFile) => {
      try {
        const twigFileContent = fs.readFileSync(twigFile, 'utf8');

        this.findAssetReferencesInContent(twigFileContent).forEach(
          (requestedAsset) => {
            if (assets.indexOf(requestedAsset) === -1) {
              assets.push(requestedAsset);
            }
          }
        );
      } catch (e) {
        throw new Error(`${twigFile}: Failed to read file, ${e}`);
      }
    });

    return assets;
  }

  private findAssetContainersInPath(searchPath: string): string[] {
    const { excludedMatches, fileMatch } = this.configuration;
    let foundFiles: string[] = [];

    fs.readdirSync(searchPath).forEach((foundNode) => {
      if (excludedMatches.filter((regex) => regex.test(foundNode)).length) {
        return;
      }

      const foundNodePath = path.join(searchPath, foundNode);
      const foundNodeStats = fs.statSync(foundNodePath);

      if (foundNodeStats.isDirectory()) {
        foundFiles = [
          ...foundFiles,
          ...this.findAssetContainersInPath(foundNodePath),
        ];
      } else if (!fileMatch || fileMatch.test(foundNodePath)) {
        foundFiles = [...foundFiles, foundNodePath];
      }
    });

    return foundFiles;
  }

  public findAssetReferencesInContent(content: string): string[] {
    const { assetMatch, assetMatchIndex, excludedMatches } = this.configuration;
    const assets = [];
    let match;

    do {
      match = assetMatch.exec(content);
      if (match) {
        const assetPath = match[assetMatchIndex];
        if (
          excludedMatches.filter((regex) => regex.test(assetPath)).length < 1 &&
          assets.indexOf(assetPath) === -1
        ) {
          assets.push(assetPath);
        }
      }
    } while (match);

    return assets;
  }
}

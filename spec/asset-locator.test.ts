import fs from 'fs';
import path from 'path';
import { AssetLocator } from '../src/asset-locator';

describe('AssetLocator', () => {
  const FIXTURE_PATH = path.join(__dirname, '../spec/fixtures');
  let readFileSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    readFileSyncSpy.mockRestore();
  });

  test('works with quote variants', () => {
    const locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-quote-variants')
    );
    const assets = locator.findAssetReferences();

    expect(assets.sort()).toEqual(['100.png', '120.png']);
  });

  test('works with sub folders', () => {
    const locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-sub-folders')
    );
    const assets = locator.findAssetReferences();

    expect(assets.sort()).toEqual([
      'assets/100.png',
      'assets/120.png',
      'assets/sub/deeper/deepest/100.png',
    ]);
  });

  test('excludes paths', () => {
    let locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-excludes-paths'),
      {
        excludedMatches: [],
      }
    );
    let assets = locator.findAssetReferences();
    expect(assets).toHaveLength(4);

    locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-excludes-paths'),
      {
        excludedMatches: [/excluded/],
      }
    );
    assets = locator.findAssetReferences();
    expect(assets).toHaveLength(0);
  });

  test('excludes files', () => {
    const locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-excludes-files'),
      {
        excludedMatches: [/\.tiff$/, /\.gif$/],
      }
    );
    const assets = locator.findAssetReferences();
    expect(assets).toEqual(['100.png']);
  });

  test('excludes duplicates', () => {
    const locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-excludes-duplicates'),
      {
        excludedMatches: [/\.tiff$/],
      }
    );
    const assets = locator.findAssetReferences();

    expect(assets.sort()).toEqual([
      '100.png',
      '120.png',
      'index.css',
      'index.js',
    ]);
  });

  test('throws errors on read failure', () => {
    readFileSyncSpy.mockImplementation(() => {
      throw new Error('Access denied');
    });

    const locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-excludes-duplicates')
    );

    expect(() => locator.findAssetReferences()).toThrow(Error);
  });

  test('throws error on missing search path', () => {
    const locator = new AssetLocator('./invalid');

    expect(() => locator.findAssetReferences()).toThrow(Error);
  });

  test('works with custom matchers', () => {
    const locator = new AssetLocator(
      path.join(FIXTURE_PATH, './asset-locator-custom-match'),
      {
        fileMatch: /\.tpl\.php$/,
        assetMatch: /inc\('([^']+)'\)/g,
        assetMatchIndex: 1,
      }
    );

    expect(locator.findAssetReferences()).toEqual(['120.png', 'main.js']);
  });
});

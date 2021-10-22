/* eslint-disable @typescript-eslint/ban-ts-comment */
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import MemoryFileSystem from 'memory-fs';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';

import TwigAssetWebpackPlugin from '../src';

jest.setTimeout(10000);

describe('TwigAssetWebpackPluginBcWrapper', () => {
  const FIXTURE_PATH = path.join(__dirname, './fixtures');
  const OUTPUT_PATH = path.join(__dirname, './webpack-output');
  const MANIFEST_PATH = path.join(OUTPUT_PATH, 'manifest.json');
  const WEBPACK_CONFIG: webpack.Configuration = {
    mode: 'development',
    context: __dirname,
    entry: path.join(FIXTURE_PATH, './index.js'),
    output: {
      publicPath: '',
      path: OUTPUT_PATH,
    },
  };

  function webpackCompile(webpackOptions: webpack.Configuration): Promise<{
    stats: webpack.Stats | undefined;
    filesystem: MemoryFileSystem;
  }> {
    const compiler = webpack(webpackOptions);
    const filesystem = new MemoryFileSystem();

    // @ts-ignore
    compiler.outputFileSystem = filesystem;

    return new Promise((resolve, reject) => {
      try {
        compiler.run((error, stats) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              filesystem,
              stats,
            });
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function readManifest(filesystem: MemoryFileSystem) {
    let manifest: Record<string, string> | undefined;
    try {
      manifest = JSON.parse(
        filesystem.readFileSync(MANIFEST_PATH).toString()
      ) as Record<string, string>;
    } catch (e) {
      manifest = undefined;
    }
    return manifest;
  }

  let existsSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  test('works with custom matchers', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      mode: 'production',
      plugins: [
        new WebpackManifestPlugin({}),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          templatePath: path.join(FIXTURE_PATH, './asset-locator-custom-match'),
          twigFileRegex: /\.tpl\.php$/,
          assetNameRegExp: /inc\('([^']+)'\)/g,
          assetNameRegExpMatch: 1,
        }),
      ],
    });

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      '120.png': '120.png',
      'main.js': 'main.js',
    });
  });

  test('excludes paths', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      mode: 'production',
      plugins: [
        new WebpackManifestPlugin({}),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          templatePath: path.join(
            FIXTURE_PATH,
            './asset-locator-excludes-paths'
          ),
          excludedFromSearch: [/excluded/],
        }),
      ],
    });

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
    });
  });

  test('excludes files', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      mode: 'production',
      plugins: [
        new WebpackManifestPlugin({}),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          templatePath: path.join(
            FIXTURE_PATH,
            './asset-locator-excludes-files'
          ),
          excludedAssetTypes: ['tiff', 'gif'],
        }),
      ],
    });

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
      '100.png': '100.png',
    });
  });

  test('adds compilation errors on missing asset', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin({}),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          templatePath: path.join(FIXTURE_PATH, './plugin-missing-asset'),
        }),
      ],
    });

    expect(stats?.compilation.errors).toHaveLength(1);
    expect(stats?.compilation.errors[0].toString()).toContain(
      'Failed to add asset "111.png", asset not found at '
    );

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './100.png'))).toBe(
      true
    );

    expect(readManifest(filesystem)).toEqual({
      '100.png': '100.png',
      'main.js': 'main.js',
    });
  });

  test('throws error when configured improperly', async () => {
    existsSyncSpy.mockImplementation((file: string) =>
      file.startsWith('exists')
    );

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          assetPath: 'exists',
          templatePath: 'missing',
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          // @ts-ignore
          assetPath: undefined,
          templatePath: 'exists',
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          assetPath: 'exists',
          // @ts-ignore
          templatePath: undefined,
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          assetPath: 'missing',
          templatePath: 'exists',
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          filename: '[name].js',
          assetPath: 'exists',
          templatePath: 'exists',
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          filename: '[name].[ext]',
          assetPath: 'exists',
          templatePath: 'exists',
        })
    ).not.toThrow(Error);
  });
});

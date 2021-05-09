/* eslint-disable @typescript-eslint/ban-ts-comment */
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import MemoryFileSystem from 'memory-fs';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';

import { TwigAssetWebpackPlugin } from '../src/plugin';
import { AssetLocator } from '../src/asset-locator';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

describe('TwigAssetWebpackPlugin', () => {
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

  function webpackCompile(
    webpackOptions: webpack.Configuration
  ): Promise<{
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

  test('allows old style parameters', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      mode: 'production',
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          templatePath: path.join(
            FIXTURE_PATH,
            './asset-locator-quote-variants'
          ),
        }),
      ],
      output: {
        publicPath: '',
        path: OUTPUT_PATH,
        filename: '[name].js',
      },
    });

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      '100.png': '100.png',
      '120.png': '120.png',
      'main.js': 'main.js',
    });
  });

  test('does not process duplicates', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      mode: 'production',
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['100.png', '100.png'];
            },
          },
        }),
      ],
      output: {
        publicPath: '',
        path: OUTPUT_PATH,
        filename: '[name].js',
      },
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
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['100.png', '101.png'];
            },
          },
        }),
      ],
    });

    expect(stats?.compilation.errors).toHaveLength(1);
    expect(stats?.compilation.errors[0].toString()).toContain(
      'Failed to add asset "101.png", asset not found at '
    );

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './100.png'))).toBe(
      true
    );

    expect(readManifest(filesystem)).toEqual({
      '100.png': '100.png',
      'main.js': 'main.js',
    });
  });

  test('excludes string entry points', async () => {
    // When an entry point is just a string, webpack will use the module name
    // as the entry point file (main being the default), that should be
    // excluded.
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      entry: path.join(FIXTURE_PATH, './index.js'),
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['main.js'];
            },
          },
        }),
      ],
    });

    // Since main.js does not exist in the asset path, we will receive an error
    // if the plugin attempted to process it
    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
    });
  });

  test('excludes string array entry points', async () => {
    // When an entry point is an array of string, webpack will use the module
    // name as the entry point file (main being the default), that should be
    // excluded.
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      entry: [
        path.join(FIXTURE_PATH, './index.js'),
        path.join(FIXTURE_PATH, './another.js'),
      ],
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['main.js'];
            },
          },
        }),
      ],
    });

    // Since main.js does not exist in the asset path, we will receive an error
    // if the plugin attempted to process it
    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
    });
  });

  test('excludes object entry points', async () => {
    // When an entry point is an object, webpack will use the key as the entry
    // point file, they should be excluded.
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['main.js', 'another.js'];
            },
          },
        }),
      ],
      entry: {
        main: path.join(FIXTURE_PATH, './index.js'),
        another: path.join(FIXTURE_PATH, './another.js'),
      },
    });

    // Since main.js and another.js do not exist in the asset path, we will
    // receive an error if the plugin attempted to process them
    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
      'another.js': 'another.js',
    });
  });

  test('excludes function entry points', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['main.js', 'another.js'];
            },
          },
        }),
      ],
      entry: () => {
        return {
          main: path.join(FIXTURE_PATH, './index.js'),
          another: path.join(FIXTURE_PATH, './another.js'),
        };
      },
    });

    // Since main.js and another.js do not exist in the asset path, we will
    // receive an error if the plugin attempted to process them
    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
      'another.js': 'another.js',
    });
  });

  test('excludes entry points added by loaders', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      entry: {
        main: path.join(FIXTURE_PATH, './index-with-css.js'),
        another: path.join(FIXTURE_PATH, './index-with-css.js'),
        style: path.join(FIXTURE_PATH, './index-with-css.css'),
      },
      output: {
        publicPath: '',
        path: OUTPUT_PATH,
        filename: '[name].[contenthash:8].js',
      },
      plugins: [
        new MiniCssExtractPlugin({
          filename: '[name].[contenthash:8].css',
        }),
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return [
                'main.js',
                'main.css',
                'another.js',
                'another.css',
                'style.css',
                '100.png',
              ];
            },
          },
        }),
      ],
      module: {
        rules: [
          {
            test: /\.css$/i,
            use: [MiniCssExtractPlugin.loader, 'css-loader'],
          },
        ],
      },
    });

    // Since none of the js/css references exist in the asset path, we will
    // receive an error if the plugin attempted to process them
    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'another.css': 'another.828b1bad.css',
      'another.js': 'another.faa25e07.js',
      'main.css': 'main.828b1bad.css',
      'main.js': 'main.faa25e07.js',
      'style.css': 'style.828b1bad.css',
      'style.js': 'style.22514bb9.js',
      '100.png': '100.871a649c.png',
    });
  });

  test('excludes async entry points', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['index.js'];
            },
          },
        }),
      ],
      entry: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { index: path.join(FIXTURE_PATH, './index.js') };
      },
    });

    // Since index.js does not exist in the asset path, we will receive an error
    // if the plugin attempted to process it
    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'index.js': 'index.js',
    });
  });

  test('interpolates files to match filename setting', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['100.png'];
            },
          },
          filename: '[name].[contenthash:8].[ext]',
        }),
      ],
    });

    expect(
      filesystem.existsSync(path.join(OUTPUT_PATH, './100.871a649c.png'))
    ).toBe(true);

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.js',
      '100.png': '100.871a649c.png',
    });
  });

  test('interpolates files to match webpack filename', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['100.png'];
            },
          },
        }),
      ],
      output: {
        publicPath: '',
        path: OUTPUT_PATH,
        filename: '[name].[contenthash:8].js',
      },
    });

    expect(
      filesystem.existsSync(path.join(OUTPUT_PATH, './100.871a649c.png'))
    ).toBe(true);

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.9eef6c1a.js',
      '100.png': '100.871a649c.png',
    });
  });

  test('interpolates files to match webpack callable', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './assets'),
          assetLocator: {
            findAssetReferences(): string[] {
              return ['100.png'];
            },
          },
        }),
      ],
      output: {
        publicPath: '',
        path: OUTPUT_PATH,
        filename: () => '[name].[contenthash].js',
      },
    });

    expect(
      filesystem.existsSync(
        path.join(OUTPUT_PATH, './100.871a649c64f14b1e51f0c9bb61c92b43.png')
      )
    ).toBe(true);

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.9eef6c1a4c6fcaf2232f.js',
      '100.png': '100.871a649c64f14b1e51f0c9bb61c92b43.png',
    });
  });

  test('adds files from sub folders', async () => {
    const { filesystem, stats } = await webpackCompile({
      ...WEBPACK_CONFIG,
      plugins: [
        new WebpackManifestPlugin(),
        new TwigAssetWebpackPlugin({
          assetPath: path.join(FIXTURE_PATH, './'),
          assetLocator: {
            findAssetReferences(): string[] {
              return [
                'assets/100.png',
                'assets/120.png',
                'assets/sub/deeper/deepest/100.png',
              ];
            },
          },
        }),
      ],
      output: {
        publicPath: '',
        path: OUTPUT_PATH,
        filename: '[name].[contenthash:8].js',
      },
    });

    expect(
      filesystem.existsSync(path.join(OUTPUT_PATH, './assets/100.871a649c.png'))
    ).toBe(true);
    expect(
      filesystem.existsSync(
        path.join(OUTPUT_PATH, './assets/sub/deeper/deepest/100.871a649c.png')
      )
    ).toBe(true);
    expect(
      filesystem.existsSync(path.join(OUTPUT_PATH, './assets/120.09921e10.png'))
    ).toBe(true);

    expect(stats?.compilation.errors).toEqual([]);
    expect(readManifest(filesystem)).toEqual({
      'main.js': 'main.9eef6c1a.js',
      'assets/100.png': 'assets/100.871a649c.png',
      'assets/sub/deeper/deepest/100.png':
        'assets/sub/deeper/deepest/100.871a649c.png',
      'assets/120.png': 'assets/120.09921e10.png',
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
          assetLocator: new AssetLocator('exists'),
        })
    ).toThrow(Error);

    expect(
      () =>
        // @ts-ignore
        new TwigAssetWebpackPlugin({
          assetPath: 'exists',
          assetLocator: undefined,
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          assetPath: 'missing',
          assetLocator: new AssetLocator('exists'),
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          filename: '[name].js',
          assetPath: 'exists',
          assetLocator: new AssetLocator('exists'),
        })
    ).toThrow(Error);

    expect(
      () =>
        new TwigAssetWebpackPlugin({
          filename: '[name].[ext]',
          assetPath: 'exists',
          assetLocator: new AssetLocator('exists'),
        })
    ).not.toThrow(Error);
  });
});

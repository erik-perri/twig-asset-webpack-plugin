const path = require('path');
const webpack = require('webpack');

const ManifestPlugin = require('webpack-manifest-plugin');
const MemoryFileSystem = require('memory-fs');
const TwigAssetWebpackPlugin = require('../src/twig-asset-webpack-plugin.js');

const FIXTURE_PATH = path.join(__dirname, './fixtures');
const OUTPUT_PATH = path.join(__dirname, './webpack-out');
const MANIFEST_PATH = path.join(OUTPUT_PATH, 'manifest.json');

function webpackConfig(webpackOptions, pluginOptions) {
  return Object.assign({}, {
    mode: 'development',
    context: __dirname,
    entry: './fixtures/entry.js',
    output: {
      path: OUTPUT_PATH,
      filename: '[name].js',
    },
    plugins: [
      new ManifestPlugin({}),
      new TwigAssetWebpackPlugin(pluginOptions),
    ],
  }, webpackOptions || {});
}

function webpackCompile(webpackOptions, pluginOptions, callback) {
  const config = webpackConfig(webpackOptions, pluginOptions);
  const compiler = webpack(config);
  const filesystem = new MemoryFileSystem();

  compiler.outputFileSystem = filesystem;

  return new Promise((resolve, reject) => {
    try {
      // noinspection JSUnresolvedFunction
      compiler.run((err, stats) => {
        let manifest;
        try {
          manifest = JSON.parse(filesystem.readFileSync(MANIFEST_PATH).toString());
        } catch (e) {
          manifest = null;
        }

        expect(err).toBeFalsy();

        callback({ manifest, stats, filesystem });
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

describe('TwigAssetWebpackPlugin', () => {
  it('exists', () => {
    expect(TwigAssetWebpackPlugin).toBeDefined();
  });

  it('adds nothing when not configured', () => webpackCompile({}, {}, ({ manifest, stats }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.js',
    });
  }));

  it('fails on missing asset', () => webpackCompile({}, {
    assetPath: path.join(FIXTURE_PATH, './assets'),
    templatePath: path.join(FIXTURE_PATH, './missing-asset'),
  }, ({ stats }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(true);
  }));

  it('works with both quote types', () => webpackCompile({}, {
    assetPath: path.join(FIXTURE_PATH, './assets'),
    templatePath: path.join(FIXTURE_PATH, './quote-variants'),
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './100.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './120.png'))).toBe(true);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.js',
      '100.png': '100.png',
      '120.png': '120.png',
    });
  }));

  it('adds multiple assets', () => webpackCompile({}, {
    assetPath: path.join(FIXTURE_PATH, './assets'),
    templatePath: path.join(FIXTURE_PATH, './multiple-assets'),
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './100.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './120.png'))).toBe(true);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.js',
      '100.png': '100.png',
      '120.png': '120.png',
    });
  }));

  it('works with sub directories', () => webpackCompile({}, {
    assetPath: FIXTURE_PATH,
    templatePath: path.join(FIXTURE_PATH, './sub-directory'),
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/100.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/sub/deeper/deepest/100.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/120.png'))).toBe(true);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.js',
      'assets/100.png': 'assets/100.png',
      'assets/sub/deeper/deepest/100.png': 'assets/sub/deeper/deepest/100.png',
      'assets/120.png': 'assets/120.png',
    });
  }));

  it('excludes the specified types', () => webpackCompile({}, {
    assetPath: path.join(FIXTURE_PATH, './assets'),
    templatePath: path.join(FIXTURE_PATH, './excluded-types'),
    excludedAssetTypes: ['js', 'css', 'tiff'],
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './100.png'))).toBe(true);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.js',
      '100.png': '100.png',
    });
  }));

  it('works with hashes', () => webpackCompile({
    output: {
      path: OUTPUT_PATH,
      filename: '[name].[hash:8].js',
    },
  }, {
    assetPath: path.join(FIXTURE_PATH, './assets'),
    templatePath: path.join(FIXTURE_PATH, './single-asset'),
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './100.871a649c.png'))).toBe(true);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.590d7fa4.js',
      '100.png': '100.871a649c.png',
    });
  }));

  it('works with sub directory hashes', () => webpackCompile({
    output: {
      path: OUTPUT_PATH,
      filename: '[name].[hash:8].js',
    },
  }, {
    assetPath: path.join(FIXTURE_PATH),
    templatePath: path.join(FIXTURE_PATH, './sub-directory'),
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/100.871a649c.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/sub/deeper/deepest/100.871a649c.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/120.09921e10.png'))).toBe(true);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.590d7fa4.js',
      'assets/100.png': 'assets/100.871a649c.png',
      'assets/sub/deeper/deepest/100.png': 'assets/sub/deeper/deepest/100.871a649c.png',
      'assets/120.png': 'assets/120.09921e10.png',
    });
  }));

  it('excludes files properly', () => webpackCompile({
    output: {
      path: OUTPUT_PATH,
      filename: '[name].[hash:8].js',
    },
  }, {
    assetPath: path.join(FIXTURE_PATH),
    templatePath: path.join(FIXTURE_PATH, './sub-directory'),
    excludedFromSearch: [/deeper/],
  }, ({ stats, filesystem, manifest }) => {
    expect(stats).toBeDefined();
    expect(stats.hasErrors()).toBe(false);

    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/100.871a649c.png'))).toBe(true);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/sub/deeper/deepest/100.871a649c.png'))).toBe(false);
    expect(filesystem.existsSync(path.join(OUTPUT_PATH, './assets/120.09921e10.png'))).toBe(false);

    expect(manifest).toBeDefined();
    expect(manifest).toEqual({
      'main.js': 'main.590d7fa4.js',
      'assets/100.png': 'assets/100.871a649c.png',
    });
  }));
});

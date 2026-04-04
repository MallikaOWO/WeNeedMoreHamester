/**
 * Based on tavern_helper_template by 青空莉 (StageDog)
 * https://github.com/StageDog/tavern_helper_template
 * Licensed under Aladdin Free Public License (AFPL)
 * Modified: removed Vue support, adapted for React, added versioned output
 */
import http from 'node:http';
import { FSWatcher, watch } from 'chokidar';
import HtmlInlineScriptWebpackPlugin from 'html-inline-script-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import _ from 'lodash';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { ChildProcess, exec, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Server } from 'socket.io';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import webpack from 'webpack';
const require = createRequire(import.meta.url);
const HTMLInlineCSSWebpackPlugin = require('html-inline-css-webpack-plugin').default;

interface Config {
  port: number;
  entries: Entry[];
}
interface Entry {
  script: string;
  html?: string;
}

function parse_entry(script_file: string) {
  const html = path.join(path.dirname(script_file), 'index.html');
  if (fs.existsSync(html)) {
    return { script: script_file, html };
  }
  return { script: script_file };
}

function common_path(lhs: string, rhs: string) {
  const lhs_parts = lhs.split(path.sep);
  const rhs_parts = rhs.split(path.sep);
  for (let i = 0; i < Math.min(lhs_parts.length, rhs_parts.length); i++) {
    if (lhs_parts[i] !== rhs_parts[i]) {
      return lhs_parts.slice(0, i).join(path.sep);
    }
  }
  return lhs_parts.join(path.sep);
}

function glob_script_files() {
  const results: string[] = [];

  fs.globSync(`src/**/index.{ts,tsx,js,jsx}`)
    .filter(
      file => process.env.CI !== 'true' || !fs.readFileSync(path.join(import.meta.dirname, file)).includes('@no-ci'),
    )
    .forEach(file => {
      const file_dirname = path.dirname(file);
      for (const [index, result] of results.entries()) {
        const result_dirname = path.dirname(result);
        const common = common_path(result_dirname, file_dirname);
        if (common === result_dirname) {
          return;
        }
        if (common === file_dirname) {
          results.splice(index, 1, file);
          return;
        }
      }
      results.push(file);
    });

  return results;
}

const config: Config = {
  port: 6621,
  entries: glob_script_files().map(parse_entry),
};

// ── 本地开发静态文件服务 ──
const DEV_SERVE_PORT = 6622;
let devServer: http.Server;
function serve_dist(compiler: webpack.Compiler) {
  if (!compiler.options.watch || devServer) return;

  const distDir = path.join(import.meta.dirname, 'dist');
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  };

  devServer = http.createServer((req, res) => {
    // CORS — 允许酒馆 iframe 跨域请求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const urlPath = decodeURIComponent(req.url?.split('?')[0] || '/');
    const filePath = path.join(distDir, urlPath);

    // 安全：不允许目录遍历
    if (!filePath.startsWith(distDir)) { res.writeHead(403); res.end(); return; }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.writeHead(200);
      res.end(data);
    });
  });

  devServer.listen(DEV_SERVE_PORT, () => {
    console.info(`\x1b[36m[dev-server]\x1b[0m dist/ 本地服务已启动: http://localhost:${DEV_SERVE_PORT}/`);
  });
}

// ── 酒馆助手实时热重载 ──
let io: Server;
function watch_tavern_helper(compiler: webpack.Compiler) {
  if (compiler.options.watch) {
    // 同时启动本地文件服务
    serve_dist(compiler);

    if (!io) {
      const port = config.port ?? 6621;
      io = new Server(port, { cors: { origin: '*' } });
      console.info(`\x1b[36m[tavern_helper]\x1b[0m 已启动酒馆监听服务`);
      io.on('connect', socket => {
        console.info(`\x1b[36m[tavern_helper]\x1b[0m 成功连接到酒馆网页 '${socket.id}', 初始化推送...`);
        io.emit('iframe_updated');
        socket.on('disconnect', reason => {
          console.info(`\x1b[36m[tavern_helper]\x1b[0m 与酒馆网页 '${socket.id}' 断开连接: ${reason}`);
        });
      });
    }

    compiler.hooks.done.tap('watch_tavern_helper', () => {
      console.info('\n\x1b[36m[tavern_helper]\x1b[0m 检测到完成编译, 推送更新事件...');
      if (compiler.options.plugins.some(plugin => plugin instanceof HtmlWebpackPlugin)) {
        io.emit('message_iframe_updated');
      } else {
        io.emit('script_iframe_updated');
      }
    });
  }
}

// ── schema.ts → schema.json 自动生成 ──
let watcher: FSWatcher;
const dump = () => {
  exec('pnpm dump', { cwd: import.meta.dirname });
  console.info('\x1b[36m[schema_dump]\x1b[0m 已将所有 schema.ts 转换为 schema.json');
};
const dump_debounced = _.debounce(dump, 500, { leading: true, trailing: false });
function schema_dump(compiler: webpack.Compiler) {
  if (!compiler.options.watch) {
    dump_debounced();
    return;
  }
  if (!watcher) {
    watcher = watch('src', {
      awaitWriteFinish: true,
    }).on('all', (_event, path) => {
      if (path.endsWith('schema.ts')) {
        dump_debounced();
      }
    });
  }
}

// ── tavern_sync 自动打包 ──
let child_process: ChildProcess;
const bundle = () => {
  exec('pnpm sync bundle all', { cwd: import.meta.dirname });
  console.info('\x1b[36m[tavern_sync]\x1b[0m 已打包所有配置了的角色卡/世界书/预设');
};
const bundle_debounced = _.debounce(bundle, 500, { leading: true, trailing: false });
function tavern_sync(compiler: webpack.Compiler) {
  if (!compiler.options.watch) {
    bundle_debounced();
    return;
  }
  compiler.hooks.watchRun.tap('watch_tavern_sync', () => {
    if (!child_process) {
      child_process = spawn('pnpm', ['sync', 'watch', 'all', '-f'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: import.meta.dirname,
        env: { ...process.env, FORCE_COLOR: '1' },
      });
      child_process.stdout?.on('data', (data: Buffer) => {
        console.info(
          data
            .toString()
            .trimEnd()
            .split('\n')
            .map(string => (/^\s*$/s.test(string) ? string : `\x1b[36m[tavern_sync]\x1b[0m ${string}`))
            .join('\n'),
        );
      });
      child_process.stderr?.on('data', (data: Buffer) => {
        console.error(
          data
            .toString()
            .trimEnd()
            .split('\n')
            .map(string => (/^\s*$/s.test(string) ? string : `\x1b[36m[tavern_sync]\x1b[0m ${string}`))
            .join('\n'),
        );
      });
      child_process.on('error', error => {
        console.error(`\x1b[31m[tavern_sync]\x1b[0m Error: ${error.message}`);
      });
    }
  });
  compiler.hooks.watchClose.tap('watch_tavern_sync', () => {
    child_process?.kill();
  });
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      child_process?.kill();
    });
  });
}

// ── webpack 配置生成 ──
function parse_configuration(entry: Entry): (env: any, argv: any) => webpack.Configuration {
  const script_filepath = path.parse(entry.script);

  return (env, argv) => {
    const version = env?.version ?? '';
    return {
    experiments: {
      outputModule: true,
    },
    devtool: argv.mode === 'production' ? 'source-map' : 'eval-source-map',
    watchOptions: {
      ignored: ['**/dist', '**/node_modules', '**/venv_name'],
    },
    entry: path.join(import.meta.dirname, entry.script),
    target: 'browserslist',
    output: {
      devtoolNamespace: 'hamster_paradise',
      devtoolModuleFilenameTemplate: info => {
        const resource_path = decodeURIComponent(info.resourcePath.replace(/^\.\//, ''));
        const is_direct = info.allLoaders === '';
        return `${is_direct === true ? 'src' : 'webpack'}://${info.namespace}/${resource_path}${is_direct ? '' : '?' + info.hash}`;
      },
      filename: `${script_filepath.name}.js`,
      path: path.join(
        import.meta.dirname,
        'dist',
        ...(version ? [version] : []),
        path.relative(import.meta.dirname, script_filepath.dir).replace(/^[^\\/]+[\\/]/, ''),
      ),
      chunkFilename: `${script_filepath.name}.[contenthash].chunk.js`,
      asyncChunks: true,
      clean: true,
      publicPath: '',
      library: {
        type: 'module',
      },
    },
    module: {
      rules: [
        {
          oneOf: [
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                },
              },
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              test: /\.(sa|sc)ss$/,
              use: ['postcss-loader', 'sass-loader'],
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              test: /\.css$/,
              use: ['postcss-loader'],
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                },
              },
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              test: /\.(sa|sc)ss$/,
              use: ['postcss-loader', 'sass-loader'],
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              test: /\.css$/,
              use: ['postcss-loader'],
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                },
              },
              exclude: /node_modules/,
            },
            {
              test: /\.html$/,
              use: 'html-loader',
              exclude: /node_modules/,
            },
            {
              test: /\.ya?ml$/,
              loader: 'yaml-loader',
              options: { asStream: true },
              resourceQuery: /stream/,
            },
            {
              test: /\.ya?ml$/,
              loader: 'yaml-loader',
            },
          ].concat(
            entry.html === undefined
              ? ([
                  {
                    test: /\.s(a|c)ss$/,
                    use: [
                      'style-loader',
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                      'sass-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    test: /\.css$/,
                    use: ['style-loader', { loader: 'css-loader', options: { url: false } }, 'postcss-loader'],
                    exclude: /node_modules/,
                  },
                ] as any[])
              : ([
                  {
                    test: /\.s(a|c)ss$/,
                    use: [
                      MiniCssExtractPlugin.loader,
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                      'sass-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    test: /\.css$/,
                    use: [
                      MiniCssExtractPlugin.loader,
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                    ],
                    exclude: /node_modules/,
                  },
                ] as any[]),
          ),
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
      plugins: [
        new TsconfigPathsPlugin({
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
          configFile: path.join(import.meta.dirname, 'tsconfig.json'),
        }),
      ],
    },
    plugins: (entry.html === undefined
      ? [new MiniCssExtractPlugin()]
      : [
          new HtmlWebpackPlugin({
            template: path.join(import.meta.dirname, entry.html),
            filename: path.parse(entry.html).base,
            scriptLoading: 'module',
            cache: false,
          }),
          new HtmlInlineScriptWebpackPlugin(),
          new MiniCssExtractPlugin(),
          new HTMLInlineCSSWebpackPlugin({
            styleTagFactory({ style }: { style: string }) {
              return `<style>${style}</style>`;
            },
          }),
        ]
    )
      .concat(
        { apply: watch_tavern_helper },
        { apply: schema_dump },
        { apply: tavern_sync },
        new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      ),
    optimization: {
      minimize: true,
      minimizer: [
        argv.mode === 'production'
          ? new TerserPlugin({
              terserOptions: { format: { quote_style: 1 }, mangle: { reserved: ['_', 'toastr', 'YAML', '$', 'z'] } },
            })
          : new TerserPlugin({
              extractComments: false,
              terserOptions: {
                format: { beautify: true, indent_level: 2 },
                compress: false,
                mangle: false,
              },
            }),
      ],
      splitChunks: {
        chunks: 'async',
        minSize: 20000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
          },
          default: {
            name: 'default',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    },
    externals: ({ context, request }, callback) => {
      if (!context || !request) {
        return callback();
      }

      // 本地路径、相对路径、http导入、@别名、绝对路径 → 正常打包
      if (
        request.startsWith('-') ||
        request.startsWith('.') ||
        request.startsWith('/') ||
        request.startsWith('!') ||
        request.startsWith('http') ||
        request.startsWith('@/') ||
        request.startsWith('@util/') ||
        path.isAbsolute(request) ||
        fs.existsSync(path.join(context, request)) ||
        fs.existsSync(request)
      ) {
        return callback();
      }

      // react 相关包始终打包进来
      if (['react', 'react-dom', 'react/'].some(key => request.startsWith(key) || request.includes(key))) {
        return callback();
      }

      // 酒馆全局变量映射
      const global: Record<string, string> = {
        jquery: '$',
        lodash: '_',
        showdown: 'showdown',
        toastr: 'toastr',
        yaml: 'YAML',
        zod: 'z',
      };
      if (request in global) {
        return callback(null, 'var ' + global[request]);
      }

      // 其他npm包 → jsdelivr CDN ESM
      const cdn: Record<string, string> = {
        sass: 'https://jspm.dev/sass',
      };
      return callback(
        null,
        'module-import ' + (cdn[request] ?? `https://cdn.jsdelivr.net/npm/${request}/+esm`),
      );
    },
  };
  };
}

export default config.entries.map(parse_configuration);

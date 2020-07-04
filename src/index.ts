import { IApi, utils } from 'umi';
import { basename, dirname, extname, join, relative } from 'path';
import { readFileSync } from 'fs';
import { getModels } from './getModels/getModels';
import { getUserLibDir } from './getUserLibDir';

const { Mustache, lodash, winPath } = utils;

export default (api: IApi) => {
  const { logger } = api;

  function getModelDir() {
    return api.config.singular ? 'model' : 'models';
  }

  function getSrcModelsPath() {
    return join(api.paths.absSrcPath!, getModelDir());
  }

  function hasDvaDependency() {
    const { dependencies, devDependencies } = api.pkg;
    return dependencies?.dva || devDependencies?.dva;
  }

  // 配置
  api.describe({
    key: 'redux',
    config: {
      schema(joi) {
        return joi.object({
          // immer: joi.boolean(),
          // hmr: joi.boolean(),
          // skipModelValidate: joi.boolean(),
          extraModels: joi.array().items(joi.string()),
        });
      },
    },
  });

  function getAllModels() {
    const srcModelsPath = getSrcModelsPath();
    const baseOpts = {
      extraModels: api.config.redux?.extraModels,
    };
    return lodash.uniq([
      ...getModels({
        base: srcModelsPath,
        ...baseOpts,
      }),
      ...getModels({
        base: api.paths.absPagesPath!,
        pattern: `**/${getModelDir()}/**/*.{ts,tsx,js,jsx}`,
        ...baseOpts,
      }),
      ...getModels({
        base: api.paths.absPagesPath!,
        pattern: `**/model.{ts,tsx,js,jsx}`,
        ...baseOpts,
      }),
    ]);
  }

  let hasModels = false;

  // 初始检测一遍
  api.onStart(() => {
    hasModels = getAllModels().length > 0;
  });

  // 生成临时文件
  api.onGenerateFiles({
    fn() {
      const models = getAllModels();
      hasModels = models.length > 0;

      logger.debug('redux models:');
      logger.debug(models);
      // 没有 models 不生成文件
      if (!hasModels) return;

      // dva.ts
      const dvaTpl = readFileSync(join(__dirname, 'redux.tpl'), 'utf-8');
      let reducers = models
      .map(path => {
        // prettier-ignore
        const baseName = `${basename(path, extname(path))}`;
        
        return `
        ${baseName}:require('${path}').default
    `.trim();
      })
      .join(',\r\n');
      reducers = `{${reducers}}`;
      api.writeTmpFile({
        path: 'plugin-redux/redux.tsx',
        content: Mustache.render(dvaTpl, {
          ExtendDvaConfig: '',
          EnhanceApp: '',
          RegisterPlugins: [
            api.config.redux?.immer &&
              `app.use(require('${winPath(require.resolve('dva-immer'))}')());`,
          ]
            .filter(Boolean)
            .join('\n'),
          RegisterModels: reducers
        }),
      });

      // runtime.tsx
      const runtimeTpl = readFileSync(join(__dirname, 'runtime.tpl'), 'utf-8');
      api.writeTmpFile({
        path: 'plugin-redux/runtime.tsx',
        content: Mustache.render(runtimeTpl, {
          SSR: !!api.config?.ssr,
        }),
      });

      // exports.ts
      const exportsTpl = readFileSync(join(__dirname, 'exports.tpl'), 'utf-8');
      const reduxLibPath = winPath(
        getUserLibDir({
          library: 'redux',
          pkg: api.pkg,
          cwd: api.cwd,
        }) || dirname(require.resolve('redux/package.json')),
      );
      const reduxVersion = require(join(reduxLibPath, 'package.json')).version;
      const exportMethods = reduxVersion.startsWith('2.6')
        ? ['connect', 'useDispatch', 'useStore', 'useSelector']
        : ['connect'];

      logger.debug(`redux lib path: ${reduxLibPath}`);
      logger.debug(`redux version: ${reduxVersion}`);
      logger.debug(`exported methods:`);
      logger.debug(exportMethods);

      api.writeTmpFile({
        path: 'plugin-redux/exports.ts',
        content: Mustache.render(exportsTpl, {
          reduxLibPath,
          exportMethods: exportMethods.join(', '),
        }),
      });

      // typings

      const connectTpl = readFileSync(join(__dirname, 'connect.tpl'), 'utf-8');
      api.writeTmpFile({
        path: 'plugin-redux/connect.ts',
        content: Mustache.render(connectTpl, {
          dvaHeadExport: models
            .map(path => {
              // prettier-ignore
              return `export * from '${winPath(dirname(path) + "/" + basename(path, extname(path)))}';`;
            })
            .join('\r\n'),
          dvaLoadingModels: models
            .map(path => {
              // prettier-ignore
              return `    ${basename(path, extname(path))
                } ?: boolean;`;
            })
            .join('\r\n'),
        }),
      });
    },
    // 要比 preset-built-in 靠前
    // 在内部文件生成之前执行，这样 hasModels 设的值对其他函数才有效
    stage: -1,
  });

  // src/models 下的文件变化会触发临时文件生成
  api.addTmpGenerateWatcherPaths(() => [getSrcModelsPath()]);

  // dva 优先读用户项目的依赖
  api.addProjectFirstLibraries(() => [
    { name: 'dva', path: dirname(require.resolve('redux/package.json')) },
  ]);

  // Runtime Plugin
  api.addRuntimePlugin(() =>
    hasModels ? [join(api.paths.absTmpPath!, 'plugin-redux/runtime.tsx')] : [],
  );
  api.addRuntimePluginKey(() => (hasModels ? ['redux'] : []));

  // 导出内容
  api.addUmiExports(() =>
    hasModels
      ? [
          {
            exportAll: true,
            source: '../plugin-redux/exports',
          },
          {
            exportAll: true,
            source: '../plugin-redux/connect',
          },
        ]
      : [],
  );

  api.registerCommand({
    name: 'dva',
    fn({ args }) {
      if (args._[0] === 'list' && args._[1] === 'model') {
        const models = getAllModels();
        console.log();
        console.log(utils.chalk.bold('  Models in your project:'));
        console.log();
        models.forEach(model => {
          console.log(`    - ${relative(api.cwd, model)}`);
        });
        console.log();
        console.log(`  Totally ${models.length}.`);
        console.log();
      }
    },
  });
};

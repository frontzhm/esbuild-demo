import esbuild from 'esbuild'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2))
const target = args._[0] || 'reactivity'
const format = args.f || 'global'

const require = createRequire(import.meta.url) // import.meta.url当前文件路径
const pkg = require(`../packages/${target}/package.json`) // pkg就是当前文件夹下的package.json的对象


const outputFormat = format.startsWith('global')
  ? 'iife'
  : format === 'cjs'
  ? 'cjs'
  : 'esm'

const postfix = format.endsWith('-runtime')
  ? `runtime.${format.replace(/-runtime$/, '')}`
  : format

const __dirname = dirname(fileURLToPath(import.meta.url)) // __dirname当前文件的文件夹路径

const outfile = resolve(
  __dirname,
  `../packages/${target}/dist/${
    target === 'vue-compat' ? `vue` : target
  }.${postfix}.js`
)

esbuild
  .context({
    entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
    outfile,
    bundle: true,
    sourcemap: true,
    format: outputFormat,
    globalName: pkg.buildOptions?.name || target,
    platform: format === 'cjs' ? 'node' : 'browser',
    // define是将代码里这些key替换成value
    define: {
      __VERSION__: `"${pkg.version}"`,
      __DEV__: `true`,
    }
  })
  .then(ctx => ctx.watch())

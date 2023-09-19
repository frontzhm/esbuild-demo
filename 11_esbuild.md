---
title: esbuild基本使用，及简单介绍vue3源码的打包
tags: vue
categories: vue
theme: vue-pro
highlight:
---


## 初始化环境

创建文件夹，开始试验

```shell
mkdir esbuild-demo
cd esbuild-demo
pnpm init
code .
```
生成

```json
{
  "name": "esbuild-demo",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "zhm",
  "license": "ISC",
  "devDependencies": {
    "esbuild": "0.19.3"
  }
}

```

## 配置最简单打包

### 1. package.json加type

package.json加type是module，可以解析`import`语法。

```json
  "main": "index.js",
  "type": "module",
```

### 2. 配置packages文件夹

新建`packages文件夹`，这个文件夹里可以新建n个包，这里新建`add`的包，然后建一个`index.ts`。

```ts
// packages/add/index.ts
export function add(a: number, b: number) {
  return a + b
}
```
### 3. 配置scripts文件夹

新建`scripts文件夹`，这个文件夹里主要是，打包脚本，这里新建`dev.js`

先安装`esbuild`
```shell
pnpm install --save-exact --save-dev esbuild
```

`dev.js`内容如下：

```js
import esbuild from 'esbuild';

let ctx = await esbuild.context({
  // 入口
  entryPoints: ['./packages/add/index.ts'],
  // 输出文件
  outfile: './packages/add/dist/add.js',
})
// 每次entryPoints变动，就自动生成新的文件
await ctx.watch()
```

### 4. 配置命令

`package.json`里配置命令即可

```json
"scripts": {
    "dev": "node ./scripts/dev.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
```

然后运行

```shell
pnpm run dev
```

![esbuild_1](https://blog-huahua.oss-cn-beijing.aliyuncs.com/blog/code/esbuild_1.png)


### 5.稍微重构下文件目录

正常一个包，通常的结构是`index.js package.json src/index.ts src/...`

生成`package.json`

```js
cd packages/add
pnpm init
```

其他文件调整：
![esbuild_2](https://blog-huahua.oss-cn-beijing.aliyuncs.com/blog/code/esbuild_2.png)

额外注意`dev.js`里，需要配置`bundle:true`，这样依赖文件会打包到一个文件中

```js
let ctx = await esbuild.context({
  // ...
  // bundle是将所有的依赖打包到一个文件中
  bundle:true,
})
```

不然打包出来的结果就是`export { add } from './add';`

## 说说format

format有三种
- iife ----- 自执行函数cjs是commonjs，esm是es6模块，xx.global.js
- cjs  ----- commonjs（require module.exports），xx.cjs.js
- esm  ----- es6模块（import export），xx.esm.js

![esbuild_3](https://blog-huahua.oss-cn-beijing.aliyuncs.com/blog/code/esbuild_3.png)


## 打包vue的reactivity

### 安装插件@types/node和minimist

```shell
# 可以这么写，import { resolve } from 'node:path'
pnpm i -D @types/node
# 可以解析参数
pnpm i -D minimist
```

解析参数的多说说

如果运行下面的命令:

```shell
node ./scripts/dev.js a b c d -minify --format=iife`
```

用`process.argv`获取，是这样的：

```shell
[
  '/usr/local/bin/node',
  '/Users/zhm/.../scripts/dev.js',
  'a',
  'b',
  'c',
  'd',
  '-minify',
  '--format=iife'
]
```

用`minimist(process.argv)`获取，是这样的：

```shell
{
  _: [
    '/usr/local/bin/node',
    '/Users/zhm/.../scripts/dev.js',
    'a',
    'b',
    'c',
    'd'
  ],
  minify: true,
  format: 'iife'
}
```
minimist会将命令行里`-`，`--`单独用一个键值表示。对于node命令来说，前两个基本都是`node xx.ts`，所以一般取后面的`minimist(process.argv.slice(2))`

### 简单reactivity的打包

略微简化版的vue源码中的`dev.js`

```js
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

```

reactivity的目录结构如下：
![esbuild_4](https://blog-huahua.oss-cn-beijing.aliyuncs.com/blog/code/esbuild_4.png
)

运行`node ./scripts/dev.js`之后，在dist文件，就已经生成了。

新建个`index.html`，输入以下内容，浏览器正常运行

```html
<script src="./reactivity.global.js"> </script>
  <script>
    const { reactive, effect } = VueReactivity
    const state = reactive({ count: 0 })
    effect(() => {
      console.log(state.count)
    })
    const timer = setInterval(() => {
      state.count++
      if(state.count>6){
        clearInterval(timer)
      }
    }, 1000)
  </script>
```

如果执行，`node ./scripts/dev.js reactivity -f=esm`，就会生成`reactivity.esm.js`，index.html内容也可以换成module写法：

```html
<script type="module">
  import { reactive, effect } from './reactivity.esm.js'
  const state = reactive({ count: 0 })
  // ...
  </script>
```

同样，如果执行`node ./scripts/dev.js add`也是没问题的！

### reactivity其他文件的代码

#### package.json

```json
{
  "name": "@vue/reactivity",
  "version": "3.3.4",
  "description": "@vue/reactivity",
  "main": "index.js",
  "module": "dist/reactivity.esm-bundler.js",
  "types": "dist/reactivity.d.ts",
  "unpkg": "dist/reactivity.global.js",
  "jsdelivr": "dist/reactivity.global.js",
  "files": [
    "index.js",
    "dist"
  ],
  "sideEffects": false,
  "repository": {
    "type": "git",
    "url": "git+https://github.com/vuejs/core.git",
    "directory": "packages/reactivity"
  },
  "buildOptions": {
    "name": "VueReactivity",
    "formats": [
      "esm-bundler",
      "esm-browser",
      "cjs",
      "global"
    ]
  },
  "keywords": [
    "vue"
  ],
  "author": "Evan You",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/vuejs/core/issues"
  },
  "homepage": "https://github.com/vuejs/core/tree/main/packages/reactivity#readme",
  "dependencies": {
    "@vue/shared": "3.3.4"
  }
}

```

#### src/index.ts

```js
export * from './reactive'
export * from './effect'
```

#### src/effect.ts
```js
// track的时候，需要拿到effect，所以用下全局变量存放effect
export let activeEffect: ReactiveEffect | null = null;
// 建立类，方便存放fn，和运行
/**
 * fn是函数，收集属性依赖，scheduler是函数，属性依赖变化的时候，执行
 * 属性deps是个二维数组，结构是 [[_effect1,_effect2],[_effect3,_effect2],]
 */
export class ReactiveEffect {
  // 是否主动执行
  private active = true
  // 新增deps
  deps = []
  parent
  constructor(private fn, public scheduler) {
  }

  run() {
    if (!this.active) {
      const res = this.fn()
      // 这里watch的时候，fn是函数返回字段，需要返回值
      return res;
    }

    this.parent = activeEffect
    activeEffect = this;
    // 运行之前，清除依赖
    clearupEffect(this);
    const res = this.fn();
    activeEffect = this.parent
    this.parent && (this.parent = null);
    return res
  }
  stop() {
    if (this.active) {
      // 清除依赖
      clearupEffect(this);
      // 标记不主动执行
      this.active = false;

    }
  }



}

// 清除依賴
function clearupEffect(_effect) {
  // deps结构是 [[_effect1,_effect2],[_effect3,_effect2],]，假设去掉_effect2
  const deps = _effect.deps
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(_effect)
  }
  // 同时deps置空，保证每次effect运行都是新的属性映射
  _effect.deps.length = 0
}



// }
export function effect(fn, options) {
  const _effect = new ReactiveEffect(fn, options?.scheduler);
  _effect.run();
  // runner是个函数，等同于_effect.run，注意绑定this
  const runner = _effect.run.bind(_effect)
  // runner还有effect属性，直接赋值就好
  runner.effect = _effect
  return runner
}

// 本质是找到属性对应的effect，但属性存在于对象里，所以两层映射
// 响应性对象 和 effect的映射，对象属性和effect的映射
// targetMap = { obj:{name:[effect],age:[effect]} }
export const targetMap: WeakMap<object, Map<string, Set<ReactiveEffect>>> = new WeakMap();

// 让属性 订阅 和自己相关的effect，建立映射关系
export function track(target, key) {
  if (!activeEffect) {
    return;
  }
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }
  trackEffects(dep)
}

/**
 * dep收集effect
 */
export function trackEffects(dep: Set<ReactiveEffect>) {
  if (activeEffect && !dep.has(activeEffect)) {
    // 收集effect
    dep.add(activeEffect)
    // effect同样收集下dep
    // @ts-ignore
    activeEffect?.deps?.push(dep)
  }
}
/**
 * dep执行触发effect
 */
export function triggerEffects(dep: Set<ReactiveEffect>) {
  [...dep].forEach((effect) => {
    const isRunning = activeEffect === effect
    if (!isRunning) {
      effect.scheduler ? effect.scheduler() : effect.run()
    }
  });
}

// 属性值变化的时候，让相应的effect执行
export function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const dep = depsMap.get(key);
  if (!dep) {
    return;
  }
  // 触发执行
  triggerEffects(dep)
}

```
#### src/reactive.ts

```js
// import { isObject } from './shared'
import { track, trigger } from './effect';
export const isObject = (param) => {
  return typeof param === 'object' && param !== null
}
export const isFunction = (param) => {
  return typeof param === 'function';
}
const __v_isReactive = '__v_isReactive'
// 是不是响应式对象
export const isReactive = (param) => param[__v_isReactive];

// 代理对象的映射
export const reactiveMap = new WeakMap()

export function reactive(target) {
  // 如果不是对象，直接返回
  if (!isObject(target)) {
    return
  }

  // 如果已经代理过了，直接返回
  if (reactiveMap.has(target)) {
    return reactiveMap.get(target)
  }

  // 如果已经代理过了，__v_isReactive肯定是true，那直接返回
  if (target[__v_isReactive]) {
    return target
  }
  // 如果是ref对象，直接返回value
  if (target.__v_isRef) {
    return target.value
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      // 这里埋点，加上__v_isReactive属性，标识已经代理过了
      if (key === __v_isReactive) {
        return true
      }
      // Reflect将target的get方法里的this指向proxy上，也就是receiver
      const res = Reflect.get(target, key, receiver);
      // 依赖收集
      track(target, key)
      // 如果是对象，递归代理
      if(isObject(res)) {
        return reactive(res)
      }
      return res;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const r = Reflect.set(target, key, value, receiver);
      // 响应式对象发生变化的时候，触发effect执行
      if(oldValue !== value) {
        trigger(target, key)
      }
      return r;
    },
  })
  // 如果没有代理过，缓存映射
  reactiveMap.set(target, proxy)
  return proxy
}
```













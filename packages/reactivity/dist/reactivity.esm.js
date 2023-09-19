// packages/reactivity/src/effect.ts
var activeEffect = null;
var ReactiveEffect = class {
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
  }
  // 是否主动执行
  active = true;
  // 新增deps
  deps = [];
  parent;
  run() {
    if (!this.active) {
      const res2 = this.fn();
      return res2;
    }
    this.parent = activeEffect;
    activeEffect = this;
    clearupEffect(this);
    const res = this.fn();
    activeEffect = this.parent;
    this.parent && (this.parent = null);
    return res;
  }
  stop() {
    if (this.active) {
      clearupEffect(this);
      this.active = false;
    }
  }
};
function clearupEffect(_effect) {
  const deps = _effect.deps;
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(_effect);
  }
  _effect.deps.length = 0;
}
function effect(fn, options) {
  const _effect = new ReactiveEffect(fn, options?.scheduler);
  _effect.run();
  const runner = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}
var targetMap = /* @__PURE__ */ new WeakMap();
function track(target, key) {
  if (!activeEffect) {
    return;
  }
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
  }
  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, dep = /* @__PURE__ */ new Set());
  }
  trackEffects(dep);
}
function trackEffects(dep) {
  if (activeEffect && !dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect?.deps?.push(dep);
  }
}
function triggerEffects(dep) {
  [...dep].forEach((effect2) => {
    const isRunning = activeEffect === effect2;
    if (!isRunning) {
      effect2.scheduler ? effect2.scheduler() : effect2.run();
    }
  });
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const dep = depsMap.get(key);
  if (!dep) {
    return;
  }
  triggerEffects(dep);
}

// packages/reactivity/src/reactive.ts
var isObject = (param) => {
  return typeof param === "object" && param !== null;
};
var isFunction = (param) => {
  return typeof param === "function";
};
var __v_isReactive = "__v_isReactive";
var isReactive = (param) => param[__v_isReactive];
var reactiveMap = /* @__PURE__ */ new WeakMap();
function reactive(target) {
  if (!isObject(target)) {
    return;
  }
  if (reactiveMap.has(target)) {
    return reactiveMap.get(target);
  }
  if (target[__v_isReactive]) {
    return target;
  }
  if (target.__v_isRef) {
    return target.value;
  }
  const proxy = new Proxy(target, {
    get(target2, key, receiver) {
      if (key === __v_isReactive) {
        return true;
      }
      const res = Reflect.get(target2, key, receiver);
      track(target2, key);
      if (isObject(res)) {
        return reactive(res);
      }
      return res;
    },
    set(target2, key, value, receiver) {
      const oldValue = target2[key];
      const r = Reflect.set(target2, key, value, receiver);
      if (oldValue !== value) {
        trigger(target2, key);
      }
      return r;
    }
  });
  reactiveMap.set(target, proxy);
  return proxy;
}
export {
  ReactiveEffect,
  activeEffect,
  effect,
  isFunction,
  isObject,
  isReactive,
  reactive,
  reactiveMap,
  targetMap,
  track,
  trackEffects,
  trigger,
  triggerEffects
};
//# sourceMappingURL=reactivity.esm.js.map

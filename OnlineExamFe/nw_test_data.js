START_TIME__=globalThis.nativePerformanceNow?nativePerformanceNow():Date.now(),__DEV__=true,process=globalThis.process||{},__METRO_GLOBAL_PREFIX__='',__requireCycleIgnorePatterns=[/(^|\/|\\)node_modules($|\/|\\)/];process.env=process.env||{};process.env.NODE_ENV=process.env.NODE_ENV||"development";
(function (global) {
  'use strict';

  if (__DEV__ || !global[`${__METRO_GLOBAL_PREFIX__}__d`]) {
    global.__r = metroRequire;
    global[`${__METRO_GLOBAL_PREFIX__}__d`] = define;
    global.__c = clear;
    global.__registerSegment = registerSegment;
  }
  var modules = clear();
  var EMPTY = {};
  var CYCLE_DETECTED = {};
  var _ref = {},
    hasOwnProperty = _ref.hasOwnProperty;
  if (__DEV__) {
    var _global$$RefreshReg$, _global$$RefreshSig$;
    global.$RefreshReg$ = (_global$$RefreshReg$ = global.$RefreshReg$) != null ? _global$$RefreshReg$ : function () {};
    global.$RefreshSig$ = (_global$$RefreshSig$ = global.$RefreshSig$) != null ? _global$$RefreshSig$ : function () {
      return function (type) {
        return type;
      };
    };
  }
  function clear() {
    modules = new Map();
    return modules;
  }
  if (__DEV__) {
    var initializingModuleIds = [];
  }
  function define(factory, moduleId, dependencyMap) {
    if (modules.has(moduleId)) {
      if (__DEV__) {
        var inverseDependencies = arguments[4];
        if (inverseDependencies) {
          global.__accept(moduleId, factory, dependencyMap, inverseDependencies);
        }
      }
      return;
    }
    var mod = {
      dependencyMap: dependencyMap,
      factory: factory,
      hasError: false,
      importedAll: EMPTY,
      importedDefault: EMPTY,
      isInitialized: false,
      publicModule: {
        exports: {}
      }
    };
    modules.set(moduleId, mod);
    if (__DEV__) {
      mod.hot = createHotReloadingObject();
      var verboseName = arguments[3];
      if (verboseName) {
        mod.verboseName = verboseName;
      }
    }
  }
  function metroRequire(moduleId, moduleIdHint) {
    if (moduleId === null) {
      if (__DEV__ && typeof moduleIdHint === 'string') {
        throw new Error("Cannot find module '" + moduleIdHint + "'");
      }
      throw new Error('Cannot find module');
    }
    if (__DEV__) {
      var initializingIndex = initializingModuleIds.indexOf(moduleId);
      if (initializingIndex !== -1) {
        var cycle = initializingModuleIds.slice(initializingIndex).map(function (id) {
          var _ref2;
          var _modules_get;
          return (_ref2 = (_modules_get = modules.get(id)) == null ? void 0 : _modules_get.verboseName) != null ? _ref2 : '[unknown]';
        }
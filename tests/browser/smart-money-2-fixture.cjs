'use strict';

// Synthetic platform admission. Only the two injected plugins cross this boundary.
async function installSmartMoneyFixture(context, { coldAlert } = {}) {
  await context.addInitScript(({ coldAlert }) => {
    const queue = coldAlert ? [{ id: 'cold-fixture', text: coldAlert }] : [];
    const listeners = new Set();
    const held = [];
    const state = { secure: true, holdProtection: false, peeks: 0, acknowledgements: 0 };
    window.__qaSmartMoney = {
      state,
      share(id, text) {
        if (!queue.some(alert => alert.id === id || alert.text === text)) queue.push({ id, text });
        for (const callback of listeners) callback({});
      },
      waitingForProtection: () => held.length,
      releaseProtection() {
        state.holdProtection = false;
        for (const resolve of held.splice(0)) resolve();
      },
    };
    const promise = name => ({ name, rtype: 'promise' });
    window.Capacitor = {
      PluginHeaders: [
        { name: 'ScreenCaptureProtection', methods: ['setSensitive', 'confirmResume'].map(promise) },
        { name: 'SmartImportShare', methods: [...['status', 'peek', 'acknowledge', 'removeListener'].map(promise), { name: 'addListener' }] },
      ],
      nativePromise: async (plugin, operation, options) => {
        if (plugin === 'ScreenCaptureProtection') {
          if (operation === 'setSensitive') {
            state.secure = options.sensitive;
            if (options.sensitive && state.holdProtection) await new Promise(resolve => held.push(resolve));
          }
          return {};
        }
        if (operation === 'status') return { id: queue[0]?.id };
        if (operation === 'peek') {
          if (!state.secure) throw Error('Test fixture blocked an unprotected read');
          state.peeks++;
          return queue[0] || {};
        }
        if (operation === 'acknowledge') {
          const index = queue.findIndex(alert => alert.id === options.id);
          if (index >= 0) queue.splice(index, 1);
          state.acknowledgements++;
        }
        return {};
      },
      nativeCallback: async (plugin, operation, options, receive) => {
        if (plugin === 'SmartImportShare' && operation === 'addListener') listeners.add(receive);
        return 'synthetic-listener';
      },
    };
    Object.defineProperty(window.Capacitor, 'getPlatform', {
      // App checks the Android policy while Capacitor's internal platform still
      // loads the browser workspace and encrypted-repository test adapters.
      get: () => () => 'android',
      set: () => undefined,
    });
  }, { coldAlert });
}

module.exports = { installSmartMoneyFixture };

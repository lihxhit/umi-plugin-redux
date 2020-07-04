import React from 'react';
import { _ReduxContainer, getApp, _onCreate } from './redux';

export function rootContainer(container) {
  return React.createElement(_ReduxContainer, null, container);
}

{{#SSR}}
export const ssr = {
  modifyGetInitialPropsCtx: async (ctx) => {
    // 服务端执行早于 constructor 中的 onCreate
    if (process.env.__IS_SERVER && ctx.history) {
      const tmpApp = _onCreate({
        // server
        history: ctx.history,
      })
      // tmpApp.router(() => {})
      // tmpApp.start();
    }
    // 一定有 app
    const { store } = getApp();
    ctx.store = store;
    return ctx;
  },
}
{{/SSR}}

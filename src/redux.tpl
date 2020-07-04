import { Component } from 'react';
import { ApplyPluginsType } from 'umi';
import { combineReducers, applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';

// @ts-ignore
import { plugin, history } from '../core/umiExports';

let app: any = null;

export function _onCreate(options = {}) {
  const runtimeRedux = plugin.applyPlugins({
    key: 'redux',
    type: ApplyPluginsType.modify,
    initialValue: {},
  });


  // app = dva({
  //   history,
  //   {{{ ExtendDvaConfig }}}
  //   ...(runtimeRedux.config || {}),
  //   // @ts-ignore
  //   ...(typeof window !== 'undefined' && window.g_useSSR ? { initialState: window.g_initialProps } : {}),
  //   ...(options || {}),
  // });
  // {{{ EnhanceApp }}}
  // {{{ RegisterPlugins }}}
  // (runtimeRedux.plugins || []).forEach((plugin:any) => {
  //   app.use(plugin);
  // });
  const rootReducer = combineReducers(
    {{{ RegisterModels }}}
  );
  const bindMiddleware = (middleware) => {
    if (process.env.NODE_ENV !== 'production') {
      const { composeWithDevTools } = require('redux-devtools-extension');
      return composeWithDevTools(applyMiddleware(...middleware));
    }
    return applyMiddleware(...middleware);
  };
const store = createStore(
  rootReducer,
  typeof window !== 'undefined' && window.g_useSSR ? window.g_initialProps : {},
  bindMiddleware([thunk])
);


app = {
  store
}
return app;
}

export function getApp() {
  return app;
}

export class _ReduxContainer extends Component {
  constructor(props: any) {
    super(props);
    // run only in client, avoid override server _onCreate()
    if (typeof window !== 'undefined') {
      _onCreate();
    }
  }

  componentWillUnmount() {
    // let app = getApp();
    // app._models.forEach((model:any) => {
    //   app.unmodel(model.namespace);
    // });
    // app._models = [];
    // try {
    //   // 释放 app，for gc
    //   // immer 场景 app 是 read-only 的，这里 try catch 一下
    //   app = null;
    // } catch(e) {
    //   console.error(e);
    // }
  }

  render() {
    let app = getApp();
    return (<Provider store={app.store}>
      {this.props.children}
    </Provider>);
  }
}

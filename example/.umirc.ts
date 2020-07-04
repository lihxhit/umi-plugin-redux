import { defineConfig } from 'umi';

export default defineConfig({
  ssr:{},
  plugins: [require.resolve('../lib')],
});

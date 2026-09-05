import { clientBundle } from '../tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-client-ui-input-trigger', ['lib/types/index.js'], {
  companions: [{
    name: '@deepseek-ai/dsh-client-ui-input-trigger/client/controller',
    entry: { controller: 'lib/types/controller.js' },
    outDir: 'lib',
    platform: 'browser',
    format: 'esm',
    target: 'es2024',
    dts: false,
    clean: false,
    deps: {
      neverBundle: specifier => specifier === '@deepseek-ai/dsh-client-store',
      alwaysBundle: specifier => specifier !== '@deepseek-ai/dsh-client-store',
    },
  }],
})

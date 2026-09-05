import { clientBundle } from '../tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-client-ui-input-trigger', ['lib/types/index.js', 'lib/types/invariant.js'], {
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
      // A replacement provider owns controller instances; only the shared
      // runtime identity remains external when this helper is inlined.
      neverBundle: specifier => specifier === '@deepseek-ai/dsh-client-runtime/client',
      alwaysBundle: specifier => specifier !== '@deepseek-ai/dsh-client-runtime/client',
    },
  }],
})

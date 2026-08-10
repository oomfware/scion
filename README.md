# scion

a lightweight, drop-in React 19 replacement for synchronous browser apps.

```sh
npm install @oomfware/scion
```

## Vite

add exact aliases for the React entrypoints in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^react\/compiler-runtime$/,
				replacement: '@oomfware/scion/compiler-runtime',
			},
			{
				find: /^react\/jsx-dev-runtime$/,
				replacement: '@oomfware/scion/jsx-runtime',
			},
			{
				find: /^react\/jsx-runtime$/,
				replacement: '@oomfware/scion/jsx-runtime',
			},
			{
				find: /^react$/,
				replacement: '@oomfware/scion/react',
			},
			{
				find: /^react-dom\/client$/,
				replacement: '@oomfware/scion/react-dom-client',
			},
			{
				find: /^react-dom$/,
				replacement: '@oomfware/scion/react-dom',
			},
			{
				find: /^scheduler$/,
				replacement: '@oomfware/scion/scheduler',
			},
			{
				find: /^use-sync-external-store\/shim$/,
				replacement: '@oomfware/scion/use-sync-external-store-shim',
			},
		],
	},
});
```

## Rsbuild

add the same exact aliases in `rsbuild.config.ts`. the `$` suffix prevents a mapping from also
capturing unrelated subpaths:

```ts
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
	resolve: {
		alias: {
			'react/compiler-runtime$': '@oomfware/scion/compiler-runtime',
			'react/jsx-dev-runtime$': '@oomfware/scion/jsx-runtime',
			'react/jsx-runtime$': '@oomfware/scion/jsx-runtime',
			react$: '@oomfware/scion/react',
			'react-dom/client$': '@oomfware/scion/react-dom-client',
			'react-dom$': '@oomfware/scion/react-dom',
			scheduler$: '@oomfware/scion/scheduler',
			'use-sync-external-store/shim$': '@oomfware/scion/use-sync-external-store-shim',
		},
	},
});
```

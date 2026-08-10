import { defineConfig } from 'vitest/config';

export default defineConfig({
	// components are written once and rendered by both runtimes, so elements are always built by real
	// react's jsx runtime. both runtimes tag elements with `Symbol.for('react.transitional.element')`
	// and read the same `type`/`key`/`props` shape, so one element object feeds either renderer.
	oxc: {
		jsx: {
			runtime: 'automatic',
			importSource: 'react',
		},
	},
	test: {
		environment: 'happy-dom',
		include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
		setupFiles: ['test/support/setup.ts'],
	},
});

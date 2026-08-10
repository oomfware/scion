import { createRoot, flushSync } from 'runtime-under-test';

import { App } from './app.tsx';
import { bindSetData, remount, sortRows, tickFull, tickPartial } from './ops.ts';

// leave mounting to the benchmark harness.

declare global {
	interface Window {
		bench: {
			mount: () => void;
			tick: () => void;
			tickPartial: () => void;
			remount: () => void;
			sort: () => void;
			unmount: () => void;
			isMounted: () => boolean;
		};
	}
}

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}

let root: ReturnType<typeof createRoot> | null = null;

window.bench = {
	mount: () => {
		root = createRoot(container);
		flushSync(() => root?.render(<App />));
	},
	tick: () => flushSync(tickFull),
	tickPartial: () => flushSync(tickPartial),
	remount: () => flushSync(remount),
	sort: () => flushSync(sortRows),
	unmount: () => {
		const mounted = root;
		root = null;
		bindSetData(null);
		flushSync(() => mounted?.unmount());
	},
	isMounted: () => root !== null,
};

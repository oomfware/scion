import { QueryClient, hashKey } from '@tanstack/query-core';
import { atom, createStore as createJotaiStore } from 'jotai/vanilla';
import { createRoot, flushSync, memo, useSyncExternalStore } from 'runtime-under-test';
import { createStore as createZustandStore } from 'zustand/vanilla';

import { STORE_SUBSCRIBER_COUNT } from '../../runtime-shared/src/config.mjs';

type Integration = 'jotai' | 'tanstack-query' | 'zustand';
type Listener = () => void;

interface Backend {
	getValues: () => number[];
	invalidate?: () => Promise<{ refetches: number; value: number }>;
	name: Integration;
	subscribe: (listener: Listener) => () => void;
	writeAll: (value: number) => void;
	writeOne: (index: number, value: number) => void;
}

const initialValues = () => Array.from({ length: STORE_SUBSCRIBER_COUNT }, () => 0);

const createJotaiBackend = (): Backend => {
	const valuesAtom = atom(initialValues());
	const store = createJotaiStore();
	return {
		name: 'jotai',
		getValues: () => store.get(valuesAtom),
		subscribe: (listener) => store.sub(valuesAtom, listener),
		writeAll: (value) => store.set(valuesAtom, initialValues().fill(value)),
		writeOne: (index, value) => store.set(valuesAtom, (values) => values.with(index, value)),
	};
};

const createTanStackBackend = (): Backend => {
	const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
	const queryKey = ['runtime-stress', 'subscribers'];
	const queryHash = hashKey(queryKey);
	let refetches = 0;
	client.setQueryDefaults(queryKey, {
		queryFn: async () => {
			const values = client.getQueryData<number[]>(queryKey);
			if (values === undefined) {
				throw new Error('the integration query lost its subscriber state');
			}
			refetches++;
			return values.with(17, values[17] + 1);
		},
	});
	client.setQueryData(queryKey, initialValues());
	return {
		name: 'tanstack-query',
		getValues: () => client.getQueryData<number[]>(queryKey) ?? [],
		invalidate: async () => {
			await client.invalidateQueries({ exact: true, queryKey, refetchType: 'all' });
			return { refetches, value: client.getQueryData<number[]>(queryKey)?.[17] ?? -1 };
		},
		subscribe: (listener) =>
			client.getQueryCache().subscribe((event) => {
				if (event.query.queryHash === queryHash && event.type === 'updated') {
					listener();
				}
			}),
		writeAll: (value) => client.setQueryData(queryKey, initialValues().fill(value)),
		writeOne: (index, value) =>
			client.setQueryData<number[]>(queryKey, (values) => (values ?? initialValues()).with(index, value)),
	};
};

const createZustandBackend = (): Backend => {
	const store = createZustandStore(() => ({ values: initialValues() }));
	return {
		name: 'zustand',
		getValues: () => store.getState().values,
		subscribe: store.subscribe,
		writeAll: (value) => store.setState({ values: initialValues().fill(value) }),
		writeOne: (index, value) => store.setState(({ values }) => ({ values: values.with(index, value) })),
	};
};

const listeners = new Set<Listener>();
let backend: Backend | null = null;
let releaseBackend: (() => void) | null = null;
let subscribeCalls = 0;
let unsubscribeCalls = 0;

const integrationStore = {
	activate: (name: Integration) => {
		if (listeners.size !== 0) {
			throw new Error('cannot change integrations while subscribers are mounted');
		}
		releaseBackend?.();
		switch (name) {
			case 'jotai': {
				backend = createJotaiBackend();
				break;
			}
			case 'tanstack-query': {
				backend = createTanStackBackend();
				break;
			}
			case 'zustand': {
				backend = createZustandBackend();
				break;
			}
		}
		releaseBackend = backend.subscribe(() => {
			for (const listener of listeners) {
				listener();
			}
		});
	},
	get: (index: number) => backend?.getValues()[index] ?? 0,
	invalidate: () => backend?.invalidate?.(),
	subscribe: (listener: Listener) => {
		subscribeCalls++;
		listeners.add(listener);
		let active = true;
		return () => {
			if (active) {
				active = false;
				listeners.delete(listener);
				unsubscribeCalls++;
			}
		};
	},
	writeAll: (value: number) => backend?.writeAll(value),
	writeOne: (index: number, value: number) => backend?.writeOne(index, value),
	get size() {
		return listeners.size;
	},
};

const Subscriber = memo(({ index }: { index: number }) => {
	const value = useSyncExternalStore(integrationStore.subscribe, () => integrationStore.get(index));
	return <output data-subscriber-index={index}>{value}</output>;
});

const App = ({ visible }: { visible: boolean }) =>
	visible ? (
		<div id="store-subscribers">
			{Array.from({ length: STORE_SUBSCRIBER_COUNT }, (_, index) => (
				<Subscriber index={index} key={index} />
			))}
		</div>
	) : null;

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}
const root = createRoot(container);
flushSync(() => root.render(<App visible={false} />));

export const benchExternalStoreIntegrations = {
	activate: (name: Integration) => integrationStore.activate(name),
	invalidate: () => integrationStore.invalidate(),
	mount: () => flushSync(() => root.render(<App visible />)),
	stats: () => ({ size: integrationStore.size, subscribeCalls, unsubscribeCalls }),
	unmount: () => flushSync(() => root.render(<App visible={false} />)),
	writeAll: (value: number) => flushSync(() => integrationStore.writeAll(value)),
	writeOne: (index: number, value: number) => flushSync(() => integrationStore.writeOne(index, value)),
};

declare global {
	interface Window {
		benchExternalStoreIntegrations: typeof benchExternalStoreIntegrations;
	}
}
window.benchExternalStoreIntegrations = benchExternalStoreIntegrations;

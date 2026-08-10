import { flushSync, memo, useEffect, useState, useSyncExternalStore } from 'runtime-under-test';

import { FORM_FIELD_COUNT, LIFECYCLE_ROW_COUNT, STORE_SUBSCRIBER_COUNT } from './config.mjs';

const FORM_FIELDS = Array.from({ length: FORM_FIELD_COUNT }, (_, index) => index);
const LIFECYCLE_ROWS = Array.from({ length: LIFECYCLE_ROW_COUNT }, (_, index) => index);
const STORE_SUBSCRIBERS = Array.from({ length: STORE_SUBSCRIBER_COUNT }, (_, index) => index);

let bindStoreVisible: ((visible: boolean) => void) | null = null;

type Listener = () => void;

interface RuntimeStats {
	async: { cancelled: number; rejections: number; requests: number; resolutions: number };
	form: {
		fieldRenders: number[];
		lastSubmission: Record<string, FormDataEntryValue> | null;
		lastValidated: string;
		submits: number;
		validationApplied: number;
		validationGeneration: number;
		validationRequests: number;
		validationStale: number;
	};
	lifecycle: {
		cleanups: number;
		listenerAdds: number;
		listenerRemoves: number;
		mounts: number;
		probeEvents: number;
		subscriptionsCleared: number;
		subscriptionsCreated: number;
		timersCleared: number;
		timersCreated: number;
	};
	store: {
		notifications: number;
		renders: number[];
		snapshotCalls: number;
		subscribeCalls: number;
		unsubscribeCalls: number;
	};
}

const createStats = (): RuntimeStats => {
	let asyncStats: RuntimeStats['async'] | undefined;
	let formStats: RuntimeStats['form'] | undefined;
	let lifecycleStats: RuntimeStats['lifecycle'] | undefined;
	let storeStats: RuntimeStats['store'] | undefined;
	return {
		get async() {
			return (asyncStats ??= { cancelled: 0, rejections: 0, requests: 0, resolutions: 0 });
		},
		get form() {
			return (formStats ??= {
				fieldRenders: Array.from({ length: FORM_FIELD_COUNT }, () => 0),
				lastSubmission: null,
				lastValidated: '',
				submits: 0,
				validationApplied: 0,
				validationGeneration: 0,
				validationRequests: 0,
				validationStale: 0,
			});
		},
		get lifecycle() {
			return (lifecycleStats ??= {
				cleanups: 0,
				listenerAdds: 0,
				listenerRemoves: 0,
				mounts: 0,
				probeEvents: 0,
				subscriptionsCleared: 0,
				subscriptionsCreated: 0,
				timersCleared: 0,
				timersCreated: 0,
			});
		},
		get store() {
			return (storeStats ??= {
				notifications: 0,
				renders: Array.from({ length: STORE_SUBSCRIBER_COUNT }, () => 0),
				snapshotCalls: 0,
				subscribeCalls: 0,
				unsubscribeCalls: 0,
			});
		},
	};
};

const createStore = (stats: RuntimeStats['store']) => {
	const listeners = new Set<Listener>();
	const values = Array.from({ length: STORE_SUBSCRIBER_COUNT }, () => 0);
	const notify = () => {
		for (const listener of listeners) {
			stats.notifications++;
			listener();
		}
	};
	return {
		get: (index: number) => {
			stats.snapshotCalls++;
			return values[index];
		},
		subscribe: (listener: Listener) => {
			stats.subscribeCalls++;
			listeners.add(listener);
			let active = true;
			return () => {
				if (active) {
					active = false;
					listeners.delete(listener);
					stats.unsubscribeCalls++;
				}
			};
		},
		writeAll: (value: number) => {
			values.fill(value);
			notify();
		},
		writeAllSync: (value: number) => {
			flushSync(() => {
				values.fill(value);
				notify();
			});
		},
		writeOne: (index: number, value: number) => {
			values[index] = value;
			notify();
		},
		writeOneSync: (index: number, value: number) => {
			flushSync(() => {
				values[index] = value;
				notify();
			});
		},
		writeManySync: (index: number, next: number[]) => {
			flushSync(() => {
				for (const value of next) {
					values[index] = value;
					notify();
				}
			});
		},
		get size() {
			return listeners.size;
		},
	};
};

const createAsyncResource = (stats: RuntimeStats['async']) => {
	const listeners = new Set<Listener>();
	let generation = 0;
	let snapshot = { error: '', status: 'idle', value: '' };
	let timer: ReturnType<typeof setTimeout> | undefined;
	const publish = (next: typeof snapshot) => {
		snapshot = next;
		for (const listener of listeners) {
			listener();
		}
	};
	return {
		getSnapshot: () => snapshot,
		run: (outcome: 'reject' | 'resolve' | 'slow') => {
			const current = ++generation;
			if (timer !== undefined) {
				clearTimeout(timer);
				stats.cancelled++;
			}
			stats.requests++;
			publish({ error: '', status: 'pending', value: '' });
			timer = setTimeout(
				() => {
					timer = undefined;
					if (current !== generation) {
						return;
					}
					if (outcome === 'reject') {
						stats.rejections++;
						publish({ error: 'Benchmark request rejected', status: 'error', value: '' });
					} else {
						stats.resolutions++;
						publish({ error: '', status: 'resolved', value: 'recovered' });
					}
				},
				outcome === 'slow' ? 60 : 12,
			);
		},
		subscribe: (listener: Listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};

export const runtimeStress = (() => {
	const stats = createStats();
	let asyncResource: ReturnType<typeof createAsyncResource> | undefined;
	let store: ReturnType<typeof createStore> | undefined;
	return {
		get async() {
			return (asyncResource ??= createAsyncResource(stats.async));
		},
		ready: false,
		setStoreVisible: (visible: boolean) => flushSync(() => bindStoreVisible?.(visible)),
		stats,
		get store() {
			return (store ??= createStore(stats.store));
		},
	};
})();

const mountLifecycleResource = () => {
	const lifecycle = runtimeStress.stats.lifecycle;
	const onProbe = () => lifecycle.probeEvents++;
	const timer = setInterval(() => {}, 60_000);
	const unsubscribe = runtimeStress.store.subscribe(() => {});
	document.addEventListener('scion-runtime-probe', onProbe);
	lifecycle.listenerAdds++;
	lifecycle.mounts++;
	lifecycle.subscriptionsCreated++;
	lifecycle.timersCreated++;
	return () => {
		clearInterval(timer);
		unsubscribe();
		document.removeEventListener('scion-runtime-probe', onProbe);
		lifecycle.cleanups++;
		lifecycle.listenerRemoves++;
		lifecycle.subscriptionsCleared++;
		lifecycle.timersCleared++;
	};
};

const LifecycleRow = ({ index, tick }: { index: number; tick: number }) => {
	useEffect(mountLifecycleResource, []);
	return <li data-lifecycle-row={index}>{`${index}:${tick}`}</li>;
};

export const LifecycleBench = () => {
	const [tick, setTick] = useState(0);
	const [visible, setVisible] = useState(false);
	return (
		<section>
			<button id="lifecycle-toggle" onClick={() => setVisible((value) => !value)}>
				Toggle rows
			</button>
			<button id="lifecycle-update" onClick={() => setTick((value) => value + 1)}>
				Update rows
			</button>
			{visible && (
				<ul>
					{LIFECYCLE_ROWS.map((index) => (
						<LifecycleRow index={index} key={index} tick={tick} />
					))}
				</ul>
			)}
		</section>
	);
};

const recordValidation = (value: string) => {
	const form = runtimeStress.stats.form;
	const generation = ++form.validationGeneration;
	form.validationRequests++;
	setTimeout(() => {
		if (generation !== form.validationGeneration) {
			form.validationStale++;
		} else {
			form.validationApplied++;
			form.lastValidated = value;
		}
	}, 40);
};

const FormField = memo(({ index }: { index: number }) => {
	const [value, setValue] = useState('');
	runtimeStress.stats.form.fieldRenders[index]++;
	return (
		<label>
			<input
				data-field-index={index}
				name={`field-${index}`}
				value={value}
				onInput={(event) => {
					const next = event.currentTarget.value;
					setValue(next);
					recordValidation(next);
				}}
			/>
			<output data-field-output={index}>{value}</output>
		</label>
	);
});

export const ControlledFormBench = () => {
	const [audience, setAudience] = useState('personal');
	const [conditional, setConditional] = useState(false);
	const [delivery, setDelivery] = useState('standard');
	const [notifications, setNotifications] = useState(false);
	const [version, setVersion] = useState(0);
	return (
		<form
			id="stress-form"
			onSubmit={(event) => {
				event.preventDefault();
				const form = runtimeStress.stats.form;
				form.submits++;
				form.lastSubmission = Object.fromEntries(new FormData(event.currentTarget));
			}}
		>
			{FORM_FIELDS.map((index) => (
				<FormField index={index} key={`${version}:${index}`} />
			))}
			<input
				id="form-checkbox"
				type="checkbox"
				name="notifications"
				value="enabled"
				checked={notifications}
				onChange={(event) => setNotifications(event.currentTarget.checked)}
			/>
			<input
				id="form-radio-standard"
				type="radio"
				name="delivery"
				value="standard"
				checked={delivery === 'standard'}
				onChange={() => setDelivery('standard')}
			/>
			<input
				id="form-radio-express"
				type="radio"
				name="delivery"
				value="express"
				checked={delivery === 'express'}
				onChange={() => setDelivery('express')}
			/>
			<select
				id="form-select"
				name="audience"
				value={audience}
				onChange={(event) => setAudience(event.currentTarget.value)}
			>
				<option value="personal">Personal</option>
				<option value="team">Team</option>
			</select>
			<button id="form-conditional-toggle" type="button" onClick={() => setConditional((value) => !value)}>
				Toggle conditional
			</button>
			{conditional && <aside id="form-conditional">Conditional validation section</aside>}
			<button id="form-submit" type="submit">
				Send form
			</button>
			<button
				id="form-reset"
				type="button"
				onClick={() => {
					setVersion((value) => value + 1);
					setNotifications(false);
					setDelivery('standard');
					setAudience('personal');
					setConditional(false);
				}}
			>
				Reset form
			</button>
		</form>
	);
};

const StoreSubscriber = memo(({ index }: { index: number }) => {
	const value = useSyncExternalStore(runtimeStress.store.subscribe, () => runtimeStress.store.get(index));
	runtimeStress.stats.store.renders[index]++;
	return <output data-subscriber-index={index}>{value}</output>;
});

export const ExternalStoreBench = () => {
	const [visible, setVisible] = useState(false);
	bindStoreVisible = setVisible;
	return (
		<section>
			<button id="store-toggle" onClick={() => setVisible((value) => !value)}>
				Toggle subscribers
			</button>
			<button id="store-narrow" onClick={() => runtimeStress.store.writeOne(17, 1)}>
				Write one
			</button>
			<button id="store-broad" onClick={() => runtimeStress.store.writeAll(7)}>
				Write all
			</button>
			<button
				id="store-rapid"
				onClick={() => {
					runtimeStress.store.writeOne(17, 8);
					runtimeStress.store.writeOne(17, 9);
					runtimeStress.store.writeOne(17, 10);
				}}
			>
				Write rapid
			</button>
			{visible && (
				<div>
					{STORE_SUBSCRIBERS.map((index) => (
						<StoreSubscriber index={index} key={index} />
					))}
				</div>
			)}
		</section>
	);
};

export const AsyncRecoveryBench = () => {
	const snapshot = useSyncExternalStore(runtimeStress.async.subscribe, runtimeStress.async.getSnapshot);
	return (
		<section>
			<button id="async-resolve" onClick={() => runtimeStress.async.run('resolve')}>
				Resolve
			</button>
			<button id="async-reject" onClick={() => runtimeStress.async.run('reject')}>
				Reject
			</button>
			<button id="async-slow" onClick={() => runtimeStress.async.run('slow')}>
				Slow
			</button>
			<output id="async-status">{snapshot.status}</output>
			<output id="async-value">{snapshot.value}</output>
			<output id="async-error">{snapshot.error}</output>
		</section>
	);
};

export const CompositionBench = () => (
	<main>
		<LifecycleBench />
		<ControlledFormBench />
		<ExternalStoreBench />
		<AsyncRecoveryBench />
	</main>
);

declare global {
	interface Window {
		runtimeStress: typeof runtimeStress;
	}
}
window.runtimeStress = runtimeStress;

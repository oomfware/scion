import { expect, test } from 'vitest';

import { expectAgreement, runBoth } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';
import {
	startTransition,
	useCallback,
	useEffect,
	useEffectEvent,
	useId,
	useMemo,
	useReducer,
	useRef,
	useState,
	useSyncExternalStore,
} from './support/runtime.ts';

// #region state

test('useState lazy initialiser runs once', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ tick }: { tick: number }) => {
			const [value] = useState(() => {
				scenario.log('initialiser ran');
				return 'initial';
			});
			return <i>{`${value}:${tick}`}</i>;
		};
		await scenario.render(<Component tick={1} />);
		await scenario.render(<Component tick={2} />);
	});
});

test('a state updater receives the previous value and queues correctly', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [count, setCount] = useState(0);
			return (
				<button
					onClick={() => {
						setCount((value: number) => value + 1);
						setCount((value: number) => value + 1);
						setCount((value: number) => value + 1);
					}}
				>
					{count}
				</button>
			);
		};
		await scenario.render(<Component />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after three queued updaters');
	});
});

test('setting state to the same value bails out of re-rendering', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [value, setValue] = useState('same');
			scenario.log('render', value);
			return <button onClick={() => setValue('same')}>{value}</button>;
		};
		await scenario.render(<Component />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
	});
});

test('several updates inside one handler produce a single render', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [a, setA] = useState(0);
			const [b, setB] = useState(0);
			scenario.log('render', a, b);
			return (
				<button
					onClick={() => {
						setA(1);
						setB(1);
					}}
				>
					{`${a}${b}`}
				</button>
			);
		};
		await scenario.render(<Component />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
	});
});

test('a state update during render re-runs the component before committing', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ target }: { target: number }) => {
			const [value, setValue] = useState(0);
			if (value < target) {
				setValue(target);
			}
			scenario.log('render', value);
			return <i>{value}</i>;
		};
		await scenario.render(<Component target={3} />);
		scenario.snapshot('settled');
	});
});

test('an effect alongside a state update during render is armed once, from the settled render', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ target }: { target: number }) => {
			const [value, setValue] = useState(0);
			if (value < target) {
				setValue(value + 1);
			}
			useEffect(() => {
				scenario.log('effect', value);
				return () => scenario.log('cleanup', value);
			}, [value]);
			return <i>{value}</i>;
		};
		await scenario.render(<Component target={2} />);
		scenario.snapshot('mounted');
		await scenario.render(<Component target={4} />);
		scenario.snapshot('raised');
		await scenario.unmount();
	});
});

test('a state update during render that undoes itself leaves the committed effect alone', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [value, setValue] = useState(0);
			if (value !== 0) {
				setValue(0);
			}
			useEffect(() => {
				scenario.log('effect', value);
				return () => scenario.log('cleanup', value);
			}, [value]);
			return <button onClick={() => setValue(1)}>go</button>;
		};
		await scenario.render(<Component />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('bounced');
	});
});

test('useReducer dispatches through the reducer and supports a lazy initialiser', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [state, dispatch] = useReducer(
				(current: number, action: 'increment' | 'reset') => (action === 'reset' ? 0 : current + 1),
				5,
				(initial: number) => {
					scenario.log('init ran');
					return initial * 2;
				},
			);
			return (
				<div>
					<span>{state}</span>
					<button onClick={() => dispatch('increment')}>inc</button>
					<button onClick={() => dispatch('reset')}>reset</button>
				</div>
			);
		};
		await scenario.render(<Component />);
		scenario.snapshot('initial');
		await scenario.act(() => scenario.container.querySelectorAll('button')[0].click());
		scenario.snapshot('after increment');
		await scenario.act(() => scenario.container.querySelectorAll('button')[1].click());
		scenario.snapshot('after reset');
	});
});

test('state is per instance, not per component', async () => {
	await expectAgreement(async (scenario) => {
		const Counter = () => {
			const [count, setCount] = useState(0);
			return <button onClick={() => setCount(count + 1)}>{count}</button>;
		};
		await scenario.render(
			<div>
				<Counter />
				<Counter />
			</div>,
		);
		await scenario.act(() => scenario.container.querySelectorAll('button')[0].click());
		scenario.snapshot('only the first advanced');
	});
});

// #endregion

// #region memo, ref, id

test('useMemo recomputes only when deps change, and useCallback keeps identity', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ a, b }: { a: number; b: number }) => {
			const memo = useMemo(() => {
				scenario.log('factory ran', a);
				return a * 10;
			}, [a]);
			const callback = useCallback(() => a, [a]);
			const previous = useRef(callback);
			scenario.log('callback stable', String(previous.current === callback));
			previous.current = callback;
			return <i>{`${memo}:${b}`}</i>;
		};
		await scenario.render(<Component a={1} b={1} />);
		await scenario.render(<Component a={1} b={2} />);
		await scenario.render(<Component a={2} b={2} />);
	});
});

test('useMemo with no deps recomputes every render', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ tick }: { tick: number }) => {
			(useMemo as any)(() => scenario.log('ran', tick));
			return <i>{tick}</i>;
		};
		await scenario.render(<Component tick={1} />);
		await scenario.render(<Component tick={2} />);
	});
});

test('useRef keeps one object across renders and does not trigger renders', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ tick }: { tick: number }) => {
			const ref = useRef(0);
			scenario.log('same object', String(ref.current === tick - 1));
			ref.current = tick;
			return <i>{tick}</i>;
		};
		await scenario.render(<Component tick={1} />);
		await scenario.render(<Component tick={2} />);
	});
});

test('useId is stable across renders and unique across instances', async () => {
	const scenario = async (helper: Scenario) => {
		const Field = () => {
			const id = useId();
			return (
				<div>
					<label htmlFor={id}>label</label>
					<input id={id} />
				</div>
			);
		};
		await helper.render(
			<div>
				<Field />
				<Field />
			</div>,
		);
		const ids = [...helper.container.querySelectorAll('input')].map((input) => input.id);
		helper.log('unique', String(new Set(ids).size === ids.length));
		helper.log('non-empty', String(ids.every(Boolean)));
		helper.log(
			'label matches',
			String(
				[...helper.container.querySelectorAll('label')].every((label, index) => label.htmlFor === ids[index]),
			),
		);
		await helper.render(
			<div>
				<Field />
				<Field />
			</div>,
		);
		const afterRerender = [...helper.container.querySelectorAll('input')].map((input) => input.id);
		helper.log('stable across rerender', String(String(afterRerender) === String(ids)));
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(react.entries);
	expect(scion.entries.every((entry) => entry.endsWith('true'))).toBe(true);
});

// #endregion

// #region external stores

test('useSyncExternalStore renders the snapshot and re-renders on notification', async () => {
	await expectAgreement(async (scenario) => {
		let value = 'first';
		const listeners = new Set<() => void>();
		const store = {
			subscribe: (listener: () => void) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			getSnapshot: () => value,
			set: (next: string) => {
				value = next;
				for (const listener of listeners) {
					listener();
				}
			},
		};
		const Component = () => {
			const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			scenario.log('render', snapshot);
			return <i>{snapshot}</i>;
		};
		await scenario.render(<Component />);
		scenario.snapshot('initial');
		await scenario.act(() => store.set('second'));
		scenario.snapshot('after notify');
		await scenario.act(() => store.set('second'));
		scenario.snapshot('after redundant notify');
	});
});

test('two components reading one store see the same snapshot', async () => {
	await expectAgreement(async (scenario) => {
		let value = 0;
		const listeners = new Set<() => void>();
		const subscribe = (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		};
		const getSnapshot = () => value;
		const Reader = ({ name }: { name: string }) => {
			const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
			return <span>{`${name}=${snapshot}`}</span>;
		};
		await scenario.render(
			<div>
				<Reader name="a" />
				<Reader name="b" />
			</div>,
		);
		await scenario.act(() => {
			value = 1;
			for (const listener of listeners) {
				listener();
			}
		});
		scenario.snapshot('both readers advanced together');
	});
});

test('unsubscribing on unmount stops further renders', async () => {
	await expectAgreement(async (scenario) => {
		let value = 0;
		const listeners = new Set<() => void>();
		const subscribe = (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		};
		const getSnapshot = () => value;
		const Reader = () => {
			const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
			return <i>{snapshot}</i>;
		};
		const Host = ({ show }: { show: boolean }) => <div>{show ? <Reader /> : null}</div>;
		await scenario.render(<Host show />);
		await scenario.render(<Host show={false} />);
		scenario.log('listeners after unmount', listeners.size);
	});
});

// #endregion

// #region transitions

test('startTransition runs its callback before it returns', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [value, setValue] = useState('a');
			return (
				<button
					onClick={() => {
						startTransition(() => {
							scenario.log('inside the callback');
							setValue('b');
						});
						scenario.log('startTransition returned');
					}}
				>
					{value}
				</button>
			);
		};
		await scenario.render(<Component />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after the transition settles');
	});
});

test('updates from several transitions all arrive', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [first, setFirst] = useState('a');
			const [second, setSecond] = useState('a');
			return (
				<button
					onClick={() => {
						startTransition(() => setFirst('b'));
						startTransition(() => setSecond('b'));
					}}
				>
					{first}
					{second}
				</button>
			);
		};
		await scenario.render(<Component />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after both transitions');
	});
});

test('a transition started outside an event still commits', async () => {
	await expectAgreement(async (scenario) => {
		let start: (() => void) | null = null;
		const Component = () => {
			const [value, setValue] = useState('a');
			start = () => startTransition(() => setValue('b'));
			return <i>{value}</i>;
		};
		await scenario.render(<Component />);
		await scenario.act(() => start!());
		scenario.snapshot('after the transition');
	});
});

// #endregion

// #region effect events

test('useEffectEvent always calls the newest closure', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ value }: { value: string }) => {
			const report = useEffectEvent(() => scenario.log('event saw', value));
			useEffect(() => {
				report();
			}, []);
			return <button onClick={() => report()}>{value}</button>;
		};
		await scenario.render(<Component value="first" />);
		await scenario.render(<Component value="second" />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
	});
});

test('an effect event is not re-run by an effect that lists it in deps', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ value }: { value: string }) => {
			const report = useEffectEvent(() => scenario.log('saw', value));
			useEffect(() => {
				scenario.log('effect ran');
				report();
			}, [report]);
			return <i>{value}</i>;
		};
		await scenario.render(<Component value="first" />);
		await scenario.render(<Component value="second" />);
	});
});

test('neither runtime gives an effect event a stable identity', async () => {
	const scenario = async (helper: Scenario) => {
		let previous: unknown;
		const Component = ({ value }: { value: string }) => {
			const report = useEffectEvent(() => value);
			helper.log('identity', previous === undefined ? 'first' : String(previous === report));
			previous = report;
			return <i>{value}</i>;
		};
		await helper.render(<Component value="a" />);
		await helper.render(<Component value="b" />);
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(react.entries);
	expect(scion.entries).toEqual(['identity first', 'identity false']);
});

test('calling an effect event during render is rejected', async () => {
	const { react, scion } = await runBoth(async (helper) => {
		const Component = () => {
			const report = useEffectEvent(() => 'value');
			try {
				report();
				helper.log('render call allowed');
			} catch {
				helper.log('render call rejected');
			}
			return <i />;
		};
		await helper.render(<Component />);
	});
	expect(scion.entries).toEqual(['render call rejected']);
	expect(react.entries).toEqual(['render call rejected']);
});

// #endregion

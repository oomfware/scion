import type { ElementType } from 'react';
import { flushSync as reactFlushSync } from 'react-dom';
import { expect, test } from 'vitest';

import { flushSync as scionFlushSync } from '../src/react-dom.ts';
import { ErrorBoundary as errorBoundaryType } from '../src/runtime.ts';

import { expectAgreement, runBoth } from './support/differential.ts';
import { runScenario, scionRuntime, type Scenario } from './support/harness.ts';
import {
	Activity,
	activeRuntime,
	addTransitionType,
	startTransition,
	Suspense,
	use,
	useEffect,
	useLayoutEffect,
	useState,
	ViewTransition,
} from './support/runtime.ts';
import {
	describeViewTransitions,
	holdViewTransitions,
	installViewTransitions,
	settleViewTransitions,
	waitForViewTransitionStart,
} from './support/view-transitions.ts';

const ErrorBoundary = errorBoundaryType as unknown as ElementType;

const flushSync = (callback: () => void) =>
	activeRuntime().name === 'scion' ? scionFlushSync(callback) : reactFlushSync(callback);

// runs a scenario with the mock installed, then logs every transition it started.
const withViewTransitions =
	(body: (scenario: Scenario) => Promise<void>) =>
	async (scenario: Scenario): Promise<void> => {
		const restore = installViewTransitions();
		try {
			await body(scenario);
			await settleViewTransitions();
			await scenario.act();
		} finally {
			restore();
		}
		for (const line of describeViewTransitions()) {
			scenario.log('transition', line);
		}
	};

// applies an update inside a transition and waits for its animation to finish.
const step = async (scenario: Scenario, update: () => void) => {
	await scenario.act(() => startTransition(update));
	await settleViewTransitions();
	await scenario.act();
};

const events = (scenario: Scenario, label: string) => ({
	onEnter: (_instance: unknown, types: string[]) => {
		scenario.log(label, 'enter', types.join(','));
		return () => scenario.log(label, 'enter cleanup');
	},
	onExit: (_instance: unknown, types: string[]) => {
		scenario.log(label, 'exit', types.join(','));
	},
	onShare: (_instance: unknown, types: string[]) => {
		scenario.log(label, 'share', types.join(','));
	},
	onUpdate: (_instance: unknown, types: string[]) => {
		scenario.log(label, 'update', types.join(','));
	},
});

// #region triggers

test('a boundary inserted by a transition enters', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition {...events(scenario, 'card')}>
						<div>hello</div>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => setShow(true));
			scenario.snapshot('shown');
		}),
	);
});

test('a boundary removed by a transition exits', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(true);
				setShow = set;
				return show ? (
					<ViewTransition {...events(scenario, 'card')}>
						<div>goodbye</div>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => setShow(false));
			scenario.snapshot('hidden');
		}),
	);
});

test('a mutation inside a boundary updates it', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setText!: (text: string) => void;
			const App = () => {
				const [text, set] = useState('short');
				setText = set;
				return (
					<ViewTransition {...events(scenario, 'card')}>
						<div>{text}</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setText('much longer content here'));
			scenario.snapshot('updated');
		}),
	);
});

test('a synchronous update does not animate', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setText!: (text: string) => void;
			const App = () => {
				const [text, set] = useState('short');
				setText = set;
				return (
					<ViewTransition {...events(scenario, 'card')}>
						<div>{text}</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			await scenario.act(() => setText('changed'));
			scenario.snapshot('updated');
		}),
	);
});

test('a named boundary leaving pairs with one arriving as a share', async () => {
	const { react, scion } = await runBoth(
		withViewTransitions(async (scenario) => {
			let setPage!: (page: string) => void;
			const App = () => {
				const [page, set] = useState('a');
				setPage = set;
				return page === 'a' ? (
					<ViewTransition key="a" name="hero" {...events(scenario, 'a')}>
						<div>page a</div>
					</ViewTransition>
				) : (
					<ViewTransition key="b" name="hero" {...events(scenario, 'b')}>
						<div>page b</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setPage('b'));
			scenario.snapshot('b');
		}),
	);
	// both capture `hero` on each side, so the browser morphs one into the other. the docs, and
	// react's own tests, say the leaving side gets `onShare` in place of exit and enter events;
	// react 19.3 fires those instead, so scion follows the documented contract.
	const transition = 'transition {"new":{"hero":""},"old":{"hero":""},"skipped":false,"types":[]}';
	expect(react.entries).toEqual(['a exit ', 'b enter ', 'b enter cleanup', transition]);
	expect(scion.entries).toEqual(['a share ', transition]);
	expect(scion.snapshots).toEqual(react.snapshots);
});

test('a nested boundary removed with its parent does not exit on its own', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition exit="page-exit" enter="page-enter" {...events(scenario, 'page')}>
						<div>
							<ViewTransition exit="item-exit" enter="item-enter" {...events(scenario, 'item')}>
								<div>item</div>
							</ViewTransition>
						</div>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => setShow(true));
			await step(scenario, () => setShow(false));
		}),
	);
});

test('a boundary below a host node does not enter or exit', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<div>
						<ViewTransition {...events(scenario, 'inner')}>
							<span>inner</span>
						</ViewTransition>
					</div>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => setShow(true));
			await step(scenario, () => setShow(false));
		}),
	);
});

// #endregion

// #region classes and types

test('transition types pick classes and reach the browser and events', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition
						default="none"
						enter={{ back: 'slide-right', default: 'fade', forward: 'slide-left' }}
						{...events(scenario, 'card')}
					>
						<div>card</div>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => {
				addTransitionType('forward');
				setShow(true);
			});
			await step(scenario, () => setShow(false));
			await step(scenario, () => {
				setShow(true);
				addTransitionType('unmatched');
			});
		}),
	);
});

test('update="none" keeps an inner boundary from animating its own updates', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setTheme!: (theme: string) => void;
			let setText!: (text: string) => void;
			const Content = () => {
				const [text, set] = useState('content');
				setText = set;
				return <p>{text}</p>;
			};
			const App = () => {
				const [theme, set] = useState('light');
				setTheme = set;
				return (
					<ViewTransition {...events(scenario, 'page')}>
						<div className={theme}>
							<ViewTransition update="none" {...events(scenario, 'content')}>
								<Content />
							</ViewTransition>
						</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setText('changed content'));
			await step(scenario, () => setTheme('dark'));
		}),
	);
});

// #endregion

// #region lists, activity, and suspense

test('a keyed reorder updates each boundary that moved', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setOrder!: (order: string[]) => void;
			const App = () => {
				const [order, set] = useState(['a', 'b', 'c']);
				setOrder = set;
				return (
					<>
						{order.map((name) => (
							<ViewTransition key={name} {...events(scenario, name)}>
								<div>{name}</div>
							</ViewTransition>
						))}
					</>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setOrder(['c', 'a', 'b']));
			scenario.snapshot('reordered');
		}),
	);
});

test('an item inserted into a list enters and shifts its siblings', async () => {
	const { react, scion } = await runBoth(
		withViewTransitions(async (scenario) => {
			let setItems!: (items: string[]) => void;
			const App = () => {
				const [items, set] = useState(['a', 'c']);
				setItems = set;
				return (
					<>
						{items.map((name) => (
							<ViewTransition key={name} {...events(scenario, name)}>
								<div>{name}</div>
							</ViewTransition>
						))}
					</>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setItems(['a', 'b', 'c']));
			scenario.snapshot('inserted');
		}),
	);
	// `c` is pushed down and updates in both. react also reports an update for `a`, which kept its
	// place and size; scion cancels it, so `a` neither animates nor hears about it.
	const transition =
		'transition {"new":{"auto0":"","auto2":"","auto1":""},"old":{"auto0":"","auto1":""},"skipped":false,"types":[]}';
	expect(react.entries).toEqual(['a update ', 'b enter ', 'c update ', 'b enter cleanup', transition]);
	expect(scion.entries).toEqual(['b enter ', 'c update ', 'b enter cleanup', transition]);
	expect(scion.dom).toEqual(react.dom);
});

test('hiding and revealing an activity exits and enters its boundaries', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setVisible!: (visible: boolean) => void;
			const App = () => {
				const [visible, set] = useState(true);
				setVisible = set;
				return (
					<Activity mode={visible ? 'visible' : 'hidden'}>
						<ViewTransition {...events(scenario, 'panel')}>
							<div>panel</div>
						</ViewTransition>
					</Activity>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setVisible(false));
			scenario.snapshot('hidden');
			await step(scenario, () => setVisible(true));
			scenario.snapshot('visible');
		}),
	);
});

test('a suspense reveal animates without the types of the transition that suspended', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let resolve!: (value: string) => void;
			const data = new Promise<string>((done) => {
				resolve = done;
			});
			let setShow!: (show: boolean) => void;
			const Loaded = () => <div>{use(data)}</div>;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition {...events(scenario, 'content')}>
						<Suspense fallback={<div>loading</div>}>
							<Loaded />
						</Suspense>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => {
				addTransitionType('open');
				setShow(true);
			});
			scenario.snapshot('pending');
			await scenario.act(() => resolve('loaded'));
			await settleViewTransitions();
			await scenario.act();
			scenario.snapshot('loaded');
		}),
	);
});

// #endregion

// #region coordination

test('a transition without boundaries does not start a view transition', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setText!: (text: string) => void;
			const App = () => {
				const [text, set] = useState('a');
				setText = set;
				return <div>{text}</div>;
			};
			await scenario.render(<App />);
			await step(scenario, () => setText('b'));
			scenario.snapshot('after');
		}),
	);
});

test('transitions during a running animation batch into the next one', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setText!: (text: string) => void;
			const App = () => {
				const [text, set] = useState('a');
				setText = set;
				return (
					<ViewTransition {...events(scenario, 'card')}>
						<div>{text}</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			// the first transition is still waiting on the browser while two more arrive.
			const release = holdViewTransitions();
			try {
				await scenario.act(() => startTransition(() => setText('ab')));
				await waitForViewTransitionStart();
				await scenario.act(() => startTransition(() => setText('abc')));
				await scenario.act(() => startTransition(() => setText('abcd')));
			} finally {
				release();
			}
			await settleViewTransitions();
			await scenario.act();
			await settleViewTransitions();
			await scenario.act();
			scenario.snapshot('after');
		}),
	);
});

test('an urgent update while the old state is being captured commits without animating', async () => {
	const { react, scion } = await runBoth(
		withViewTransitions(async (scenario) => {
			let setText!: (text: string) => void;
			let setCount!: (count: number) => void;
			const App = () => {
				const [text, set] = useState('a');
				const [count, setCountState] = useState(0);
				setText = set;
				setCount = setCountState;
				return (
					<ViewTransition {...events(scenario, 'card')}>
						<div>
							{text} {count}
						</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			// the transition renders and hands its commit to the browser, which hasn't called back yet.
			const release = holdViewTransitions();
			try {
				await scenario.act(() => startTransition(() => setText('abc')));
				await waitForViewTransitionStart();
				await scenario.act(() => setCount(1));
				scenario.snapshot('urgent');
			} finally {
				release();
			}
		}),
	);
	// react holds the urgent update until the browser has called back, so it shows the old state
	// for a frame. scion commits the waiting pass with the urgent one right away and skips the
	// animation; the docs promise that skip for flushSync, and urgent input shouldn't wait on a frame.
	expect(react.snapshots[0][1]).toContain('"a"');
	expect(scion.snapshots[0][1]).toContain('"abc"');
	expect(scion.snapshots[0][1]).toContain('"1"');
	expect(scion.dom).toEqual(react.dom);
	expect(scion.entries.at(-1)).toContain('"skipped":true');
});

test('a root render while the old state is being captured keeps the pending effects', async () => {
	const { react, scion } = await runBoth(
		withViewTransitions(async (scenario) => {
			const Panel = () => {
				useLayoutEffect(() => {
					scenario.log('panel layout effect');
					return () => scenario.log('panel layout cleanup');
				}, []);
				return <div>panel</div>;
			};
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition {...events(scenario, 'panel')}>
						<Panel />
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			const release = holdViewTransitions();
			try {
				await scenario.act(() => startTransition(() => setShow(true)));
				await waitForViewTransitionStart();
				await scenario.render(<App />);
			} finally {
				release();
			}
			await settleViewTransitions();
			await scenario.act();
			scenario.snapshot('shown');
			await scenario.unmount();
		}),
	);
	// the pending pass's effects run in both. as with any urgent update during the snapshot, react
	// animates with the render folded in where scion commits at once and skips the animation.
	const effects = (entries: string[]) => entries.filter((entry) => entry.startsWith('panel layout'));
	expect(effects(scion.entries)).toEqual(['panel layout effect', 'panel layout cleanup']);
	expect(effects(scion.entries)).toEqual(effects(react.entries));
	expect(scion.snapshots).toEqual(react.snapshots);
	expect(scion.entries.at(-1)).toContain('"skipped":true');
});

test('a throwing event cleanup does not hold up later transitions', async () => {
	const errors: unknown[] = [];
	const previousReportError = Object.getOwnPropertyDescriptor(globalThis, 'reportError');
	Reflect.set(globalThis, 'reportError', (error: unknown) => errors.push(error));
	try {
		await runScenario(
			scionRuntime,
			withViewTransitions(async (scenario) => {
				let setText!: (text: string) => void;
				const App = () => {
					const [text, set] = useState('a');
					setText = set;
					return (
						<ViewTransition
							onUpdate={() => () => {
								throw new Error('cleanup failed');
							}}
						>
							<div>{text}</div>
						</ViewTransition>
					);
				};
				await scenario.render(<App />);
				await step(scenario, () => setText('ab'));
				await step(scenario, () => setText('abc'));
				scenario.snapshot('after');
			}),
		).then((result) => {
			expect(result.snapshots[0][1]).toContain('"abc"');
			expect(result.entries.filter((entry) => entry.startsWith('transition'))).toHaveLength(2);
			expect(document.documentElement.style.getPropertyValue('view-transition-name')).toBe('');
		});
	} finally {
		if (previousReportError) {
			Object.defineProperty(globalThis, 'reportError', previousReportError);
		} else {
			Reflect.deleteProperty(globalThis, 'reportError');
		}
	}
	expect(errors.map(String)).toEqual(['Error: cleanup failed', 'Error: cleanup failed']);
});

test('a flushSync from a layout effect in a deferred commit does not nest inside it', async () => {
	const { react, scion } = await runBoth(
		withViewTransitions(async (scenario) => {
			let setCount!: (count: number) => void;
			const App = () => {
				const [count, set] = useState(0);
				setCount = set;
				useLayoutEffect(() => {
					scenario.log('layout', count);
					if (count === 1) {
						flushSync(() => set(2));
					}
					return () => scenario.log('layout cleanup', count);
				}, [count]);
				useEffect(() => {
					scenario.log('passive', count);
					return () => scenario.log('passive cleanup', count);
				}, [count]);
				return (
					<ViewTransition>
						<div>{count}</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setCount(1));
			await scenario.unmount();
		}),
	);
	// each effect runs once and each cleanup belongs to the effect it follows. react flushes the
	// pending passive effects before the nested sync render; scion runs them after it, as it does
	// for the same flushSync outside any transition.
	const lifecycle = (entries: string[]) => entries.filter((entry) => !entry.startsWith('transition'));
	expect(lifecycle(scion.entries)).toEqual([
		'layout 0',
		'passive 0',
		'layout cleanup 0',
		'layout 1',
		'layout cleanup 1',
		'layout 2',
		'passive cleanup 0',
		'passive 1',
		'passive cleanup 1',
		'passive 2',
		'layout cleanup 2',
		'passive cleanup 2',
	]);
	expect(lifecycle(scion.entries).toSorted()).toEqual(lifecycle(react.entries).toSorted());
});

test('a root render outside a transition does not wait on transition work it picks up', async () => {
	await runScenario(
		scionRuntime,
		withViewTransitions(async (scenario) => {
			let setCount!: (count: number) => void;
			const App = ({ label }: { label: string }) => {
				const [count, set] = useState(0);
				setCount = set;
				return (
					<ViewTransition>
						<div>
							{label}:{count}
						</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App label="old" />);
			const release = holdViewTransitions();
			try {
				startTransition(() => setCount(1));
				await scenario.render(<App label="urgent" />);
				scenario.snapshot('urgent');
			} finally {
				release();
			}
		}),
	).then((result) => {
		expect(result.snapshots[0][1]).toContain('"urgent"');
		expect(result.snapshots[0][1]).toContain('"1"');
		expect(result.entries).toEqual([]);
	});
});

test('typing into a controlled input during the snapshot does not show the pending value early', async () => {
	await runScenario(
		scionRuntime,
		withViewTransitions(async (scenario) => {
			let setValue!: (value: string) => void;
			const App = () => {
				const [value, set] = useState('0');
				setValue = set;
				return (
					<ViewTransition>
						<input value={value} onChange={() => {}} />
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			const input = scenario.container.querySelector('input')!;
			const release = holdViewTransitions();
			try {
				await scenario.act(() => startTransition(() => setValue('1')));
				await waitForViewTransitionStart();
				input.value = '0x';
				input.dispatchEvent(new Event('input', { bubbles: true }));
				await Promise.resolve();
				scenario.log('during', input.value);
			} finally {
				release();
			}
			await settleViewTransitions();
			scenario.log('after', input.value);
		}),
	).then((result) => {
		expect(result.entries.slice(0, 2)).toEqual(['during 0x', 'after 1']);
	});
});

test('a named boundary that failed to mount does not stop later pairs from sharing', async () => {
	await runScenario(
		scionRuntime,
		withViewTransitions(async (scenario) => {
			const Broken = () => {
				throw new Error('broken');
			};
			let setPage!: (page: string) => void;
			const App = () => {
				const [page, set] = useState('a');
				setPage = set;
				return (
					<>
						<ErrorBoundary fallback={<b>failed</b>}>
							<ViewTransition name="doomed">
								<Broken />
							</ViewTransition>
						</ErrorBoundary>
						{page === 'a' ? (
							<ViewTransition key="a" name="hero" {...events(scenario, 'a')}>
								<div>page a</div>
							</ViewTransition>
						) : (
							<ViewTransition key="b" name="hero" {...events(scenario, 'b')}>
								<div>page b</div>
							</ViewTransition>
						)}
					</>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setPage('b'));
		}),
	).then((result) => {
		expect(result.entries[0]).toBe('a share ');
	});
});

test('a browser without view transition types commits without animating', async () => {
	await runBoth(
		withViewTransitions(async (scenario) => {
			Reflect.deleteProperty(window, 'ViewTransition');
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition {...events(scenario, 'card')}>
						<div>card</div>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => setShow(true));
			scenario.snapshot('shown');
		}),
	).then(({ scion }) => {
		expect(scion.entries).toEqual([]);
		expect(scion.snapshots[0][1]).toContain('card');
	});
});

// #endregion

// #region lifecycle

test('event cleanups run once the animation finishes', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setShow!: (show: boolean) => void;
			const App = () => {
				const [show, set] = useState(false);
				setShow = set;
				return show ? (
					<ViewTransition {...events(scenario, 'card')}>
						<div>card</div>
					</ViewTransition>
				) : null;
			};
			await scenario.render(<App />);
			await step(scenario, () => setShow(true));
			scenario.log('settled');
		}),
	);
});

test('inline names are restored after the browser has captured them', async () => {
	await expectAgreement(
		withViewTransitions(async (scenario) => {
			let setText!: (text: string) => void;
			const App = () => {
				const [text, set] = useState('a');
				setText = set;
				return (
					<ViewTransition>
						<div style={{ color: 'red' }}>{text}</div>
					</ViewTransition>
				);
			};
			await scenario.render(<App />);
			await step(scenario, () => setText('abc'));
			scenario.snapshot('after');
		}),
	);
});

// #endregion

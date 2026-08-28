import type { ComponentType } from 'react';
import { expect, test } from 'vitest';

import { expectAgreement, runBoth } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';
import { runScenario, scionRuntime } from './support/harness.ts';
import { Suspense, lazy, memo, use, useEffect, useState } from './support/runtime.ts';

// #region agreement — showing the fallback

test('a thrown promise shows the nearest fallback', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = () => <i>{use(gate.promise)}</i>;
		await scenario.render(
			<Suspense fallback={<b>loading</b>}>
				<Content />
			</Suspense>,
		);
		scenario.snapshot('suspended');
	});
});

test('only the subtree under the boundary is replaced by the fallback', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = () => <i>{use(gate.promise)}</i>;
		await scenario.render(
			<div>
				<header>always here</header>
				<Suspense fallback={<b>loading</b>}>
					<Content />
				</Suspense>
			</div>,
		);
		scenario.snapshot('siblings survive');
	});
});

test('the innermost boundary catches the suspension', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = () => <i>{use(gate.promise)}</i>;
		await scenario.render(
			<Suspense fallback={<b>outer</b>}>
				<div>
					<Suspense fallback={<b>inner</b>}>
						<Content />
					</Suspense>
				</div>
			</Suspense>,
		);
		scenario.snapshot('inner fallback shown');
	});
});

test('lazy suspends until its module arrives', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<{ default: ComponentType<{ label: string }> }>();
		const Screen = lazy(() => gate.promise);
		await scenario.render(
			<Suspense fallback={<b>loading</b>}>
				<Screen label="loaded" />
			</Suspense>,
		);
		scenario.snapshot('suspended');
	});
});

test('state above the boundary survives while the subtree is suspended', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = () => <i>{use(gate.promise)}</i>;
		const Host = () => {
			const [count, setCount] = useState(0);
			return (
				<div>
					<button onClick={() => setCount(count + 1)}>{count}</button>
					<Suspense fallback={<b>loading</b>}>
						<Content />
					</Suspense>
				</div>
			);
		};
		await scenario.render(<Host />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('counter advanced while suspended');
	});
});

// #endregion

// #region the retry path

test('a resolved suspension reveals its content without a fresh render', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = () => <i>{use(gate.promise)}</i>;
		const tree = (
			<Suspense fallback={<b>loading</b>}>
				<Content />
			</Suspense>
		);
		await scenario.render(tree);
		scenario.snapshot('suspended');
		await scenario.act(async () => {
			gate.resolve('ready');
			await gate.promise;
		});
		scenario.snapshot('after the promise resolved');
	});
});

test('a state update batched with a retry survives the full render it triggers', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		let bump: (value: number) => void = () => {};
		const Content = () => <i>{use(gate.promise)}</i>;
		const Counter = memo(() => {
			const [count, setCount] = useState(0);
			bump = setCount;
			return <em>{count}</em>;
		});
		const tree = (
			<div>
				<Suspense fallback={<b>loading</b>}>
					<Content />
				</Suspense>
				<Counter />
			</div>
		);
		await scenario.render(tree);
		scenario.snapshot('suspended');
		// the retry schedules a full render, which must not discard the queued counter update.
		await scenario.act(() => {
			gate.resolve('ready');
			bump(1);
		});
		scenario.snapshot('both the content and the counter advanced');
	});
});

test('a boundary nested under host elements still recovers', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = () => <i>{use(gate.promise)}</i>;
		const tree = (
			<div>
				<section>
					<Suspense fallback={<b>loading</b>}>
						<Content />
					</Suspense>
				</section>
			</div>
		);
		await scenario.render(tree);
		await scenario.act(async () => {
			gate.resolve('ready');
			await gate.promise;
		});
		scenario.snapshot('revealed');
	});
});

test('a lazy route reveals itself once its module resolves', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<{ default: ComponentType<{ label: string }> }>();
		const Screen = lazy(() => gate.promise);
		const tree = (
			<Suspense fallback={<b>loading</b>}>
				<Screen label="loaded" />
			</Suspense>
		);
		await scenario.render(tree);
		await scenario.act(async () => {
			gate.resolve({ default: ({ label }: { label: string }) => <i>{label}</i> });
			await gate.promise;
		});
		scenario.snapshot('revealed');
	});
});

test('an already resolved promise renders without showing the fallback', async () => {
	await expectAgreement(async (scenario) => {
		const resolved = Promise.resolve('immediate');
		await resolved;
		const Content = () => <i>{use(resolved)}</i>;
		await scenario.render(
			<Suspense fallback={<b>loading</b>}>
				<Content />
			</Suspense>,
		);
		scenario.snapshot('content directly');
	});
});

test('a thenable a cache already settled renders without showing the fallback', async () => {
	await expectAgreement(async (scenario) => {
		// the status/value expandos are the convention caches use to hand over a settled value.
		const settled: { status: 'fulfilled'; value: string } = { status: 'fulfilled', value: 'cached' };
		const cached = Object.assign(Promise.resolve('cached'), settled);
		const Content = () => <i>{use(cached)}</i>;
		await scenario.render(
			<Suspense fallback={<b>loading</b>}>
				<Content />
			</Suspense>,
		);
		scenario.snapshot('content directly');
	});
});

test('scion unmounts a subtree that suspends after mounting', async () => {
	const scenario = async (helper: Scenario) => {
		const gate = Promise.withResolvers<string>();
		const Content = ({ suspend }: { suspend: boolean }) => {
			useEffect(() => {
				helper.log('content mounted');
				return () => helper.log('content unmounted');
			}, []);
			return <i>{suspend ? use(gate.promise) : 'sync'}</i>;
		};
		const Host = ({ suspend }: { suspend: boolean }) => (
			<Suspense fallback={<b>loading</b>}>
				<Content suspend={suspend} />
			</Suspense>
		);
		await helper.render(<Host suspend={false} />);
		helper.log('--- suspend ---');
		await helper.render(<Host suspend />);
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['content mounted', '--- suspend ---', 'content unmounted']);
	expect(react.entries).toEqual(['content mounted', '--- suspend ---']);
});

test('scion subscribes to a stalled thenable once, however often the boundary re-renders', async () => {
	let subscriptions = 0;
	const pending = {
		// oxlint-disable-next-line unicorn/no-thenable -- test thenable
		then: () => {
			subscriptions++;
		},
	} as unknown as PromiseLike<string>;
	let afterFirstSuspend = 0;

	await runScenario(scionRuntime, async (scenario) => {
		const Content = () => <i>{use(pending)}</i>;
		const Host = ({ label }: { label: string }) => (
			<div>
				<span>{label}</span>
				<Suspense fallback={<b>loading</b>}>
					<Content />
				</Suspense>
			</div>
		);

		await scenario.render(<Host label="a" />);
		expect(scenario.html()).toBe('<div><span>a</span><b>loading</b></div>');
		afterFirstSuspend = subscriptions;

		for (const label of ['b', 'c', 'd']) {
			await scenario.render(<Host label={label} />);
		}
		expect(scenario.html()).toBe('<div><span>d</span><b>loading</b></div>');
	});

	expect(subscriptions).toBe(afterFirstSuspend);
});

// #endregion

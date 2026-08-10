import { expect, test, vi } from 'vitest';

import { expectAgreement } from './support/differential.ts';
import { runScenario, scionRuntime } from './support/harness.ts';
import { setActiveRuntime, useEffect, useLayoutEffect, useState } from './support/runtime.ts';

const withSilencedErrors = async (body: () => Promise<void>): Promise<unknown[][]> => {
	const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		await body();
		return spy.mock.calls;
	} finally {
		spy.mockRestore();
	}
};

test('a render that schedules itself forever is stopped', async () => {
	const errors = await withSilencedErrors(async () => {
		await runScenario(scionRuntime, async (scenario) => {
			const Counter = () => {
				const [count, setCount] = useState(0);
				useEffect(() => setCount((value) => value + 1));
				return <i data-count={count} />;
			};
			await scenario.render(<Counter />);
		});
	});

	expect(errors).toContainEqual(['scion stopped an update loop.', 'Counter']);
});

test('a chain broken by a dep array is not mistaken for a loop', async () => {
	const errors = await withSilencedErrors(async () => {
		await runScenario(scionRuntime, async (scenario) => {
			const Counter = ({ start }: { start: number }) => {
				const [count, setCount] = useState(start);
				useEffect(() => setCount(start + 1), [start]);
				return <i data-count={count} />;
			};
			for (let start = 0; start < 60; start++) {
				await scenario.render(<Counter start={start} />);
			}
			expect(scenario.container.querySelector('i')?.getAttribute('data-count')).toBe('60');
		});
	});

	expect(errors).toEqual([]);
});

test('an ancestor and its descendant scheduled together each render once', async () => {
	await expectAgreement(async (scenario) => {
		let bumpOuter: (value: number) => void = () => {};
		let bumpInner: (value: number) => void = () => {};
		const Inner = () => {
			const [count, setCount] = useState(0);
			bumpInner = setCount;
			scenario.log('inner rendered', count);
			return <i>{count}</i>;
		};
		const Outer = () => {
			const [count, setCount] = useState(0);
			bumpOuter = setCount;
			scenario.log('outer rendered', count);
			return (
				<div data-outer={count}>
					<Inner />
				</div>
			);
		};
		await scenario.render(<Outer />);
		scenario.log('--- both scheduled ---');
		// queued innermost first, so the pass has to reorder them.
		await scenario.act(() => {
			bumpInner(1);
			bumpOuter(1);
		});
		scenario.snapshot('final');
	});
});

test('many independent renders in one task are all applied', async () => {
	// bypass the harness to queue all renders in one task.
	const container = document.createElement('div');
	document.body.append(container);
	const errors = await withSilencedErrors(async () => {
		const root = scionRuntime.createRoot(container, {});
		const Display = ({ value }: { value: number }) => <i data-value={value} />;
		for (let value = 0; value < 300; value++) {
			root.render(<Display value={value} />);
		}
		expect(container.querySelector('i')?.getAttribute('data-value')).toBe('299');
		root.unmount();
	});
	container.remove();

	expect(errors).toEqual([]);
});

test('a render reentered from unmount teardown is ignored', async () => {
	// bypass the harness so the cleanup can reach the root itself.
	const container = document.createElement('div');
	document.body.append(container);
	setActiveRuntime(scionRuntime);
	const errors = await withSilencedErrors(async () => {
		const root = scionRuntime.createRoot(container, {});
		let reenter = false;
		const Child = () => {
			useLayoutEffect(() => {
				return () => {
					if (reenter) {
						reenter = false;
						root.render(<p>resurrected</p>);
					}
				};
			}, []);
			return <span>before</span>;
		};

		root.render(<Child />);
		expect(container.innerHTML).toBe('<span>before</span>');
		reenter = true;
		root.unmount();
	});
	setActiveRuntime(null);

	// unmount tears its fibers down before running cleanups, so a render from one of them
	// would reconcile against them and strand the result in the container.
	expect(container.innerHTML).toBe('');
	expect(errors).toEqual([['scion ignored a render on an unmounted root.']]);
	container.remove();
});

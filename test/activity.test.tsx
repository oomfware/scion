import { expect, test } from 'vitest';

import { expectAgreement } from './support/differential.ts';
import { Activity, Suspense, use, useEffect, useLayoutEffect, useRef, useState } from './support/runtime.ts';

// #region visibility

test('a hidden subtree stays in the dom, hidden', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ mode }: { mode: string }) => (
			<div>
				<Activity mode={mode}>
					<i>content</i>
					<b>more</b>
				</Activity>
			</div>
		);
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('visible');
		await scenario.render(<Host mode="hidden" />);
		scenario.snapshot('hidden');
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('visible again');
	});
});

test('a top-level text child is blanked while hidden and restored on reveal', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ mode }: { mode: string }) => (
			<div>
				<Activity mode={mode}>plain text</Activity>
			</div>
		);
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('visible');
		await scenario.render(<Host mode="hidden" />);
		scenario.snapshot('hidden');
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('visible again');
	});
});

test('a style prop changed while hidden is the one that wins on reveal', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ mode, color }: { mode: string; color: string }) => (
			<Activity mode={mode}>
				<i style={{ color }}>content</i>
			</Activity>
		);
		await scenario.render(<Host mode="visible" color="red" />);
		await scenario.render(<Host mode="hidden" color="red" />);
		scenario.snapshot('hidden');
		await scenario.render(<Host mode="hidden" color="blue" />);
		scenario.snapshot('restyled while hidden');
		await scenario.render(<Host mode="visible" color="blue" />);
		scenario.snapshot('revealed');
	});
});

test('an explicit display in the props survives being hidden and revealed', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<i style={{ display: 'inline-block' }}>content</i>
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		await scenario.render(<Host mode="hidden" />);
		scenario.snapshot('hidden');
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('revealed');
	});
});

// #endregion

// #region state and effects

test('state survives a hide and reveal', async () => {
	await expectAgreement(async (scenario) => {
		const Counter = () => {
			const [count, setCount] = useState(0);
			return <button onClick={() => setCount(count + 1)}>{String(count)}</button>;
		};
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<Counter />
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('counted');
		await scenario.render(<Host mode="hidden" />);
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('revealed');
	});
});

test('effects are torn down on hide and set up again on reveal', async () => {
	await expectAgreement(async (scenario) => {
		const Child = () => {
			useEffect(() => {
				scenario.log('passive mounted');
				return () => scenario.log('passive cleaned');
			}, []);
			useLayoutEffect(() => {
				scenario.log('layout mounted');
				return () => scenario.log('layout cleaned');
			}, []);
			return <i>content</i>;
		};
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<Child />
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		scenario.log('--- hide ---');
		await scenario.render(<Host mode="hidden" />);
		scenario.log('--- reveal ---');
		await scenario.render(<Host mode="visible" />);
	});
});

test('effects re-run on reveal even though their deps never changed', async () => {
	await expectAgreement(async (scenario) => {
		const Child = ({ value }: { value: string }) => {
			useEffect(() => {
				scenario.log('effect', value);
				return () => scenario.log('cleanup', value);
			}, [value]);
			return <i>{value}</i>;
		};
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<Child value="stable" />
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		await scenario.render(<Host mode="hidden" />);
		await scenario.render(<Host mode="visible" />);
	});
});

test('a hidden subtree runs no effects, even for a component mounted while hidden', async () => {
	await expectAgreement(async (scenario) => {
		const Child = () => {
			useEffect(() => {
				scenario.log('effect mounted');
				return () => scenario.log('effect cleaned');
			}, []);
			scenario.log('rendered');
			return <i>content</i>;
		};
		await scenario.render(
			<Activity mode="hidden">
				<Child />
			</Activity>,
		);
		scenario.snapshot('mounted hidden');
	});
});

test('a state update from inside a hidden subtree lands and is kept', async () => {
	await expectAgreement(async (scenario) => {
		let bump: (() => void) | null = null;
		const Counter = () => {
			const [count, setCount] = useState(0);
			bump = () => setCount((previous: number) => previous + 1);
			return <i>{String(count)}</i>;
		};
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<Counter />
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		await scenario.render(<Host mode="hidden" />);
		await scenario.act(() => bump!());
		scenario.snapshot('bumped while hidden');
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('revealed');
	});
});

test('a prop change reaches a hidden subtree', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ mode, value }: { mode: string; value: string }) => (
			<Activity mode={mode}>
				<i>{value}</i>
			</Activity>
		);
		await scenario.render(<Host mode="visible" value="a" />);
		await scenario.render(<Host mode="hidden" value="a" />);
		await scenario.render(<Host mode="hidden" value="b" />);
		scenario.snapshot('updated while hidden');
		await scenario.render(<Host mode="visible" value="b" />);
		scenario.snapshot('revealed');
	});
});

// #endregion

// #region refs

test('a ref is detached while hidden and attached again on reveal', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<i ref={(node) => scenario.log('ref', String(node?.tagName))}>content</i>
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		scenario.log('--- hide ---');
		await scenario.render(<Host mode="hidden" />);
		scenario.log('--- reveal ---');
		await scenario.render(<Host mode="visible" />);
	});
});

test('an object ref reads null while hidden and holds the same node again on reveal', async () => {
	await expectAgreement(async (scenario) => {
		const Child = ({ mode }: { mode: string }) => {
			const ref = useRef<HTMLElement>(null);
			useEffect(() => {
				scenario.log('effect sees', String(ref.current?.tagName));
			});
			return (
				<Activity mode={mode}>
					<i ref={ref}>content</i>
				</Activity>
			);
		};
		await scenario.render(<Child mode="visible" />);
		await scenario.render(<Child mode="hidden" />);
		await scenario.render(<Child mode="visible" />);
	});
});

// #endregion

// #region nesting and suspense

test('an inner hidden activity stays hidden when the outer one is revealed', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ outer, inner }: { inner: string; outer: string }) => (
			<Activity mode={outer}>
				<i>outer</i>
				<Activity mode={inner}>
					<b>inner</b>
				</Activity>
			</Activity>
		);
		await scenario.render(<Host outer="visible" inner="visible" />);
		await scenario.render(<Host outer="hidden" inner="hidden" />);
		scenario.snapshot('both hidden');
		await scenario.render(<Host outer="visible" inner="hidden" />);
		scenario.snapshot('outer revealed only');
		await scenario.render(<Host outer="visible" inner="visible" />);
		scenario.snapshot('both revealed');
	});
});

test('a suspension inside a hidden subtree does not reach the boundary above it', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Child = ({ suspend }: { suspend: boolean }) => {
			if (suspend) {
				throw gate.promise;
			}
			return <i>ready</i>;
		};
		const Host = ({ mode, suspend }: { mode: string; suspend: boolean }) => (
			<Suspense fallback={<b>loading</b>}>
				<em>sibling</em>
				<Activity mode={mode}>
					<Child suspend={suspend} />
				</Activity>
			</Suspense>
		);
		await scenario.render(<Host mode="visible" suspend={false} />);
		await scenario.render(<Host mode="hidden" suspend />);
		scenario.snapshot('hidden and suspended');
	});
});

test('a suspension inside a hidden subtree recovers once its promise resolves', async () => {
	await expectAgreement(async (scenario) => {
		const gate = Promise.withResolvers<string>();
		const Child = () => <i>{use(gate.promise)}</i>;
		const Host = ({ mode }: { mode: string }) => (
			<div>
				<em>sibling</em>
				<Activity mode={mode}>
					<Child />
				</Activity>
			</div>
		);
		await scenario.render(<Host mode="hidden" />);
		scenario.snapshot('hidden and suspended');
		await scenario.act(async () => {
			gate.resolve('ready');
			await gate.promise;
		});
		scenario.snapshot('resolved while still hidden');
		await scenario.render(<Host mode="visible" />);
		scenario.snapshot('revealed');
	});
});

// #endregion

test('hiding and revealing cost one render each under both runtimes', async () => {
	const result = await expectAgreement(async (scenario) => {
		const Child = () => {
			scenario.log('rendered');
			return <i>content</i>;
		};
		const Host = ({ mode }: { mode: string }) => (
			<Activity mode={mode}>
				<Child />
			</Activity>
		);
		await scenario.render(<Host mode="visible" />);
		scenario.log('--- hide ---');
		await scenario.render(<Host mode="hidden" />);
		scenario.log('--- reveal ---');
		await scenario.render(<Host mode="visible" />);
	});
	expect(result.entries).toEqual(['rendered', '--- hide ---', 'rendered', '--- reveal ---', 'rendered']);
});

import type { ElementType } from 'react';
import { expect, test } from 'vitest';

import { ErrorBoundary as errorBoundaryType } from '../src/runtime.ts';

import { runBoth } from './support/differential.ts';
import { runScenario, scionRuntime, type Scenario } from './support/harness.ts';
import { Suspense, use, useEffect, useState } from './support/runtime.ts';

const ErrorBoundary = errorBoundaryType as unknown as ElementType;

const run = (
	body: (scenario: Scenario) => Promise<void> | void,
	options: Parameters<typeof runScenario>[2] = {},
) => runScenario(scionRuntime, body, options);

const Boom = ({ message }: { message: string }) => {
	throw new Error(message);
};

test('a render-phase throw is caught and the fallback is shown', async () => {
	const result = await run(async (scenario) => {
		await scenario.render(
			<ErrorBoundary fallback={<b>failed</b>}>
				<Boom message="kaboom" />
			</ErrorBoundary>,
		);
		scenario.snapshot('fallback');
	});
	expect(result.snapshots).toEqual([['fallback', '<b >\n  #text "failed"']]);
});

test('a function fallback receives the error', async () => {
	const result = await run(async (scenario) => {
		await scenario.render(
			<ErrorBoundary fallback={(error: Error) => <b>{error.message}</b>}>
				<Boom message="kaboom" />
			</ErrorBoundary>,
		);
		scenario.snapshot('fallback');
	});
	expect(result.snapshots).toEqual([['fallback', '<b >\n  #text "kaboom"']]);
});

test('a throw during a keyed reorder leaves nothing behind but the fallback', async () => {
	const result = await run(async (scenario) => {
		const Row = ({ name, explode }: { name: string; explode: boolean }) => {
			if (explode) {
				throw new Error(`bad ${name}`);
			}
			return <li>{name}</li>;
		};
		const List = ({ order, explode }: { order: string[]; explode: string | null }) => (
			<ErrorBoundary fallback={(error: Error) => <b>{error.message}</b>}>
				<ul>
					{order.map((name) => (
						<Row key={name} name={name} explode={name === explode} />
					))}
				</ul>
			</ErrorBoundary>
		);

		await scenario.render(<List order={['a', 'b', 'c', 'd']} explode={null} />);
		scenario.snapshot('initial');
		await scenario.render(<List order={['d', 'b']} explode="b" />);
		scenario.snapshot('after the failed reorder');
	});
	expect(result.snapshots[1][1]).toBe('<b >\n  #text "bad b"');
});

test('siblings outside the boundary keep rendering', async () => {
	const result = await run(async (scenario) => {
		await scenario.render(
			<div>
				<header>intact</header>
				<ErrorBoundary fallback={<b>failed</b>}>
					<Boom message="kaboom" />
				</ErrorBoundary>
			</div>,
		);
		scenario.snapshot('partial failure');
	});
	expect(result.snapshots[0][1]).toContain('intact');
	expect(result.snapshots[0][1]).toContain('failed');
});

test('the innermost boundary catches the error', async () => {
	const result = await run(async (scenario) => {
		await scenario.render(
			<ErrorBoundary fallback={<b>outer</b>}>
				<div>
					<ErrorBoundary fallback={<b>inner</b>}>
						<Boom message="kaboom" />
					</ErrorBoundary>
				</div>
			</ErrorBoundary>,
		);
		scenario.snapshot('inner caught');
	});
	expect(result.snapshots[0][1]).toContain('inner');
	expect(result.snapshots[0][1]).not.toContain('outer');
});

test('onCaughtError is notified with the error', async () => {
	const caught: unknown[] = [];
	await run(
		async (scenario) => {
			await scenario.render(
				<ErrorBoundary fallback={<b>failed</b>}>
					<Boom message="kaboom" />
				</ErrorBoundary>,
			);
		},
		{ onCaughtError: (error: unknown) => caught.push(error) },
	);
	expect(caught).toHaveLength(1);
	expect((caught[0] as Error).message).toBe('kaboom');
});

test('an error thrown by an update is caught, not only one thrown on mount', async () => {
	const result = await run(async (scenario) => {
		const Child = ({ explode }: { explode: boolean }) => {
			if (explode) {
				throw new Error('late failure');
			}
			return <i>fine</i>;
		};
		const Host = ({ explode }: { explode: boolean }) => (
			<ErrorBoundary fallback={(error: Error) => <b>{error.message}</b>}>
				<Child explode={explode} />
			</ErrorBoundary>
		);
		await scenario.render(<Host explode={false} />);
		scenario.snapshot('healthy');
		await scenario.render(<Host explode />);
		scenario.snapshot('after failure');
	});
	expect(result.snapshots[0][1]).toContain('fine');
	expect(result.snapshots[1][1]).toContain('late failure');
});

test('an error thrown from a state update is caught', async () => {
	const result = await run(async (scenario) => {
		const Child = () => {
			const [explode, setExplode] = useState(false);
			if (explode) {
				throw new Error('from state');
			}
			return <button onClick={() => setExplode(true)}>go</button>;
		};
		await scenario.render(
			<ErrorBoundary fallback={(error: Error) => <b>{error.message}</b>}>
				<Child />
			</ErrorBoundary>,
		);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after failing update');
	});
	expect(result.snapshots[0][1]).toContain('from state');
});

test('the failed subtree is unmounted, so its cleanups run', async () => {
	const result = await run(async (scenario) => {
		const Healthy = () => {
			useEffect(() => {
				scenario.log('healthy mounted');
				return () => scenario.log('healthy cleaned up');
			}, []);
			return <i>fine</i>;
		};
		const Host = ({ explode }: { explode: boolean }) => (
			<ErrorBoundary fallback={<b>failed</b>}>
				<Healthy />
				{explode ? <Boom message="kaboom" /> : null}
			</ErrorBoundary>
		);
		await scenario.render(<Host explode={false} />);
		await scenario.render(<Host explode />);
	});
	expect(result.entries).toEqual(['healthy mounted', 'healthy cleaned up']);
});

test('a sibling mounted before the throw comes down with the rest of the failed subtree', async () => {
	const result = await run(async (scenario) => {
		const Healthy = () => {
			useEffect(() => {
				scenario.log('healthy mounted');
				return () => scenario.log('healthy cleaned up');
			}, []);
			return <i>half-rendered</i>;
		};
		await scenario.render(
			<ErrorBoundary fallback={<b>failed</b>}>
				<Healthy />
				<Boom message="kaboom" />
			</ErrorBoundary>,
		);
		scenario.snapshot('only the fallback');
	});
	expect(result.snapshots[0][1]).not.toContain('half-rendered');
	expect(result.entries).toEqual([]);
});

test('a boundary that has caught stays on its fallback', async () => {
	const result = await run(async (scenario) => {
		const Child = ({ explode }: { explode: boolean }) => {
			if (explode) {
				throw new Error('kaboom');
			}
			return <i>recovered</i>;
		};
		const Host = ({ explode }: { explode: boolean }) => (
			<ErrorBoundary fallback={<b>failed</b>}>
				<Child explode={explode} />
			</ErrorBoundary>
		);
		await scenario.render(<Host explode />);
		scenario.snapshot('failed');
		await scenario.render(<Host explode={false} />);
		scenario.snapshot('after the cause was removed');
	});
	expect(result.snapshots[1][1]).toContain('failed');
});

test('remounting the boundary under a new key recovers', async () => {
	const result = await run(async (scenario) => {
		const Child = ({ explode }: { explode: boolean }) => {
			if (explode) {
				throw new Error('kaboom');
			}
			return <i>recovered</i>;
		};
		const Host = ({ explode, attempt }: { explode: boolean; attempt: number }) => (
			<ErrorBoundary key={attempt} fallback={<b>failed</b>}>
				<Child explode={explode} />
			</ErrorBoundary>
		);
		await scenario.render(<Host explode attempt={1} />);
		scenario.snapshot('failed');
		await scenario.render(<Host explode={false} attempt={2} />);
		scenario.snapshot('after retry');
	});
	expect(result.snapshots[1][1]).toContain('recovered');
});

test('the fallback can reset the boundary to retry its children', async () => {
	const result = await run(async (scenario) => {
		let explode = true;
		const Child = () => {
			if (explode) {
				throw new Error('kaboom');
			}
			return <i>recovered</i>;
		};
		const retry = (reset: () => void) => {
			explode = false;
			reset();
		};
		await scenario.render(
			<ErrorBoundary
				fallback={(error: Error, reset: () => void) => (
					<button onClick={() => retry(reset)}>{error.message}</button>
				)}
			>
				<Child />
			</ErrorBoundary>,
		);
		scenario.snapshot('failed');
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after reset');
	});
	expect(result.snapshots[0][1]).toContain('kaboom');
	expect(result.snapshots[1][1]).toContain('recovered');
	expect(result.snapshots[1][1]).not.toContain('button');
});

test('a reset that fails again lands on the fallback with the new error', async () => {
	const result = await run(async (scenario) => {
		let attempt = 0;
		const Child = () => {
			attempt++;
			throw new Error(`failure ${attempt}`);
		};
		await scenario.render(
			<ErrorBoundary
				fallback={(error: Error, reset: () => void) => <button onClick={reset}>{error.message}</button>}
			>
				<Child />
			</ErrorBoundary>,
		);
		scenario.snapshot('first failure');
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('second failure');
	});
	expect(result.snapshots[0][1]).toContain('failure 1');
	expect(result.snapshots[1][1]).toContain('failure 2');
});

test('a reset unmounts the fallback before it mounts the children', async () => {
	const result = await run(async (scenario) => {
		let explode = true;
		const Fallback = ({ reset }: { reset: () => void }) => {
			useEffect(() => {
				scenario.log('fallback mounted');
				return () => scenario.log('fallback cleaned up');
			}, []);
			return (
				<button
					onClick={() => {
						explode = false;
						reset();
					}}
				>
					retry
				</button>
			);
		};
		const Child = () => {
			if (explode) {
				throw new Error('kaboom');
			}
			useEffect(() => scenario.log('child mounted'), []);
			return <i>recovered</i>;
		};
		await scenario.render(
			<ErrorBoundary fallback={(_error: Error, reset: () => void) => <Fallback reset={reset} />}>
				<Child />
			</ErrorBoundary>,
		);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
	});
	expect(result.entries).toEqual(['fallback mounted', 'fallback cleaned up', 'child mounted']);
});

test('the reset callback keeps its identity across fallback renders', async () => {
	const resets = new Set<() => void>();
	const result = await run(async (scenario) => {
		const Host = ({ label }: { label: string }) => (
			<ErrorBoundary
				fallback={(_error: Error, reset: () => void) => {
					resets.add(reset);
					return <b>{label}</b>;
				}}
			>
				<Boom message="kaboom" />
			</ErrorBoundary>
		);
		await scenario.render(<Host label="one" />);
		await scenario.render(<Host label="two" />);
		scenario.snapshot('re-rendered fallback');
	});
	expect(result.snapshots[0][1]).toContain('two');
	expect(resets.size).toBe(1);
});

test('a reset held from before a recovery does nothing when called again', async () => {
	const result = await run(async (scenario) => {
		let captured: (() => void) | undefined;
		let explode = true;
		const Child = () => {
			if (explode) {
				throw new Error('kaboom');
			}
			return <i>recovered</i>;
		};
		await scenario.render(
			<ErrorBoundary
				fallback={(_error: Error, reset: () => void) => {
					captured = reset;
					return <b>failed</b>;
				}}
			>
				<Child />
			</ErrorBoundary>,
		);
		explode = false;
		await scenario.act(() => captured!());
		scenario.snapshot('recovered');
		await scenario.act(() => captured!());
		scenario.snapshot('after the stale reset');
	});
	expect(result.snapshots[0][1]).toContain('recovered');
	expect(result.snapshots[1][1]).toEqual(result.snapshots[0][1]);
});

test('a thrown promise passes through the boundary to a suspense fallback', async () => {
	const gate = Promise.withResolvers<string>();
	const result = await run(async (scenario) => {
		const Content = () => <i>{use(gate.promise)}</i>;
		await scenario.render(
			<ErrorBoundary fallback={<b>failed</b>}>
				<Suspense fallback={<b>loading</b>}>
					<Content />
				</Suspense>
			</ErrorBoundary>,
		);
		scenario.snapshot('suspended, not failed');
	});
	expect(result.snapshots[0][1]).toContain('loading');
	expect(result.snapshots[0][1]).not.toContain('failed');
});

test('an error with no boundary above it reaches onUncaughtError', async () => {
	const uncaught: unknown[] = [];
	await run(
		async (scenario) => {
			await scenario.render(<Boom message="unhandled" />);
		},
		{ onUncaughtError: (error: unknown) => uncaught.push(error) },
	);
	expect(uncaught).toHaveLength(1);
	expect((uncaught[0] as Error).message).toBe('unhandled');
});

test('scion keeps the last good tree after an uncaught error, where react deletes it', async () => {
	const scenario = async (helper: Scenario) => {
		const Host = ({ fail }: { fail: boolean }) => (
			<div>
				<i>kept</i>
				{fail ? <Boom message="unhandled" /> : <b>fine</b>}
			</div>
		);
		await helper.render(<Host fail={false} />);
		try {
			await helper.render(<Host fail />);
		} catch {
			helper.log('render threw');
		}
		helper.log('dom', helper.html());
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['dom <div><i>kept</i><b>fine</b></div>']);
	expect(react.entries).toEqual(['render threw', 'dom ']);
});

test('a class component is not supported', async () => {
	const uncaught: unknown[] = [];
	await run(
		async (scenario) => {
			class LegacyComponent {
				render() {
					return null;
				}
			}
			const Legacy = LegacyComponent as unknown as ElementType;
			await scenario.render(<Legacy />);
		},
		{ onUncaughtError: (error: unknown) => uncaught.push(error) },
	);
	expect(uncaught).toHaveLength(1);
	expect(String(uncaught[0])).toMatch(/class constructor/i);
});

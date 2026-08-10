import { test } from 'vitest';

import { expectAgreement } from './support/differential.ts';
import { Fragment, useEffect, useState } from './support/runtime.ts';

const List = ({ items }: { items: string[] }) => (
	<ul>
		{items.map((item) => (
			<li key={item}>{item}</li>
		))}
	</ul>
);

test('a keyed list survives reordering, insertion and removal', async () => {
	await expectAgreement(async (scenario) => {
		const steps = [['a', 'b', 'c'], ['c', 'b', 'a'], ['b', 'c'], ['b', 'x', 'c'], ['x'], [], ['a', 'b']];
		for (const items of steps) {
			await scenario.render(<List items={items} />);
			scenario.snapshot(items.join(',') || 'empty');
		}
	});
});

test('reordering keyed children preserves their state and dom nodes', async () => {
	await expectAgreement(async (scenario) => {
		const Item = ({ name }: { name: string }) => {
			const [mountedAt] = useState(() => name);
			useEffect(() => {
				scenario.log('mounted', name);
				return () => scenario.log('unmounted', name);
			}, []);
			return <li>{`${name}/${mountedAt}`}</li>;
		};
		const Host = ({ items }: { items: string[] }) => (
			<ul>
				{items.map((item) => (
					<Item key={item} name={item} />
				))}
			</ul>
		);
		await scenario.render(<Host items={['a', 'b', 'c']} />);
		scenario.log('--- reorder ---');
		await scenario.render(<Host items={['c', 'a', 'b']} />);
		scenario.snapshot('after reorder');
	});
});

test('unkeyed children reconcile by position', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ items }: { items: string[] }) => (
			<ul>
				{items.map((item) => (
					// oxlint-disable-next-line react/jsx-key -- positional reconciliation is the subject here
					<li>{item}</li>
				))}
			</ul>
		);
		await scenario.render(<Host items={['a', 'b', 'c']} />);
		await scenario.render(<Host items={['c', 'b']} />);
		scenario.snapshot('after shrink');
	});
});

test('changing the element type replaces the subtree', async () => {
	await expectAgreement(async (scenario) => {
		const First = () => {
			useEffect(() => {
				scenario.log('first mounted');
				return () => scenario.log('first unmounted');
			}, []);
			return <i>first</i>;
		};
		const Second = () => {
			useEffect(() => {
				scenario.log('second mounted');
				return () => scenario.log('second unmounted');
			}, []);
			return <b>second</b>;
		};
		await scenario.render(
			<div>
				<First />
			</div>,
		);
		await scenario.render(
			<div>
				<Second />
			</div>,
		);
		scenario.snapshot('after swap');
	});
});

test('changing a host tag replaces the element', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<div>
				<span className="k">text</span>
			</div>,
		);
		await scenario.render(
			<div>
				<p className="k">text</p>
			</div>,
		);
		scenario.snapshot('after tag change');
	});
});

test('changing a key remounts the child', async () => {
	await expectAgreement(async (scenario) => {
		const Child = () => {
			const [value] = useState(() => 'fresh');
			useEffect(() => {
				scenario.log('mounted');
				return () => scenario.log('unmounted');
			}, []);
			return <i>{value}</i>;
		};
		await scenario.render(<Child key="one" />);
		await scenario.render(<Child key="two" />);
		scenario.snapshot('after key change');
	});
});

test('conditional and nullish children are handled the same way', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ show }: { show: boolean }) => (
			<div>
				{null}
				{undefined}
				{false}
				{true}
				{show && <i>shown</i>}
				{show ? <b>ternary</b> : null}
				{0}
			</div>
		);
		await scenario.render(<Host show />);
		scenario.snapshot('shown');
		await scenario.render(<Host show={false} />);
		scenario.snapshot('hidden');
	});
});

test('an empty string child produces no node', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(<div>{''}</div>);
		scenario.snapshot('empty string child');
	});
});

test('a text child that empties out removes its node', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ text }: { text: string }) => <div>{text}</div>;
		await scenario.render(<Host text="a" />);
		scenario.snapshot('text');
		await scenario.render(<Host text="" />);
		scenario.snapshot('emptied');
		await scenario.render(<Host text="b" />);
		scenario.snapshot('refilled');
	});
});

test('nested arrays and fragments flatten identically', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<div>
				{[
					<i key="a">a</i>,
					[<i key="b">b</i>, [<i key="c">c</i>]],
					<Fragment key="f">
						<i>d</i>
						<i>e</i>
					</Fragment>,
				]}
			</div>,
		);
		scenario.snapshot('flattened');
	});
});

test('keyed fragments reorder as units', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ order }: { order: string[] }) => (
			<div>
				{order.map((name) => (
					<Fragment key={name}>
						<dt>{name}</dt>
						<dd>{name.toUpperCase()}</dd>
					</Fragment>
				))}
			</div>
		);
		await scenario.render(<Host order={['a', 'b']} />);
		scenario.snapshot('initial');
		await scenario.render(<Host order={['b', 'a']} />);
		scenario.snapshot('reordered');
	});
});

test('adjacent text children merge and update in place', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ name, count }: { name: string; count: number }) => (
			<div>
				hello {name}, you have {count} items
			</div>
		);
		await scenario.render(<Host name="ana" count={1} />);
		scenario.snapshot('first');
		await scenario.render(<Host name="bo" count={2} />);
		scenario.snapshot('second');
	});
});

test('numbers, bigints and strings render as text; booleans and nullish do not', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(<div>{[0, -1, 1.5, 10n, 'text', true, false, null, undefined]}</div>);
		scenario.snapshot('rendered');
	});
});

test('an iterable child is expanded like an array', async () => {
	await expectAgreement(async (scenario) => {
		const set = new Set([<i key="a">a</i>, <i key="b">b</i>]);
		await scenario.render(<div>{set}</div>);
		scenario.snapshot('from a set');
	});
});

test('a deeply nested tree mounts and unmounts in one pass', async () => {
	await expectAgreement(async (scenario) => {
		const Nested = ({ depth }: { depth: number }) =>
			depth === 0 ? (
				<i>leaf</i>
			) : (
				<div className={`d${depth}`}>
					<Nested depth={depth - 1} />
				</div>
			);
		await scenario.render(<Nested depth={6} />);
		scenario.snapshot('mounted');
		await scenario.render(<i>replaced</i>);
		scenario.snapshot('replaced');
	});
});

import { expect, test } from 'vitest';

import { expectAgreement } from './support/differential.ts';
import { runScenario, scionRuntime } from './support/harness.ts';
import { Fragment, createContext, createElement, useState } from './support/runtime.ts';

test('a component that renders nothing keeps its slot between siblings', async () => {
	await expectAgreement(async (scenario) => {
		let show: ((value: boolean) => void) | undefined;
		const Slot = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return visible ? <i>middle</i> : null;
		};
		await scenario.render(
			<div>
				<b>before</b>
				<Slot />
				<b>after</b>
			</div>,
		);
		scenario.snapshot('empty');
		await scenario.act(() => show?.(true));
		scenario.snapshot('filled');
		await scenario.act(() => show?.(false));
		scenario.snapshot('emptied');
	});
});

test('a component that renders nothing keeps its slot as the last child', async () => {
	await expectAgreement(async (scenario) => {
		let show: ((value: boolean) => void) | undefined;
		const Slot = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return visible ? <i>tail</i> : null;
		};
		await scenario.render(
			<div>
				<b>before</b>
				<Slot />
			</div>,
		);
		scenario.snapshot('empty');
		await scenario.act(() => show?.(true));
		scenario.snapshot('filled');
	});
});

test('empty wrappers between the update and its dom parent do not lose the slot', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('light');
		let show: ((value: boolean) => void) | undefined;
		const Slot = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return (
				<Fragment>
					{visible ? <i>one</i> : null}
					{visible ? <i>two</i> : null}
				</Fragment>
			);
		};
		await scenario.render(
			<div>
				<b>before</b>
				<Fragment>
					{createElement(Theme.Provider, { value: 'dark' }, createElement(Fragment, null, <Slot />))}
				</Fragment>
				<b>after</b>
			</div>,
		);
		scenario.snapshot('empty');
		await scenario.act(() => show?.(true));
		scenario.snapshot('filled');
		await scenario.act(() => show?.(false));
		scenario.snapshot('emptied');
	});
});

test('siblings that are all empty resolve their slots independently', async () => {
	await expectAgreement(async (scenario) => {
		const setters: Array<(value: boolean) => void> = [];
		const Slot = ({ name }: { name: string }) => {
			const [visible, setVisible] = useState(false);
			setters.push(setVisible);
			return visible ? <i>{name}</i> : null;
		};
		await scenario.render(
			<div>
				<Slot name="a" />
				<Slot name="b" />
				<Slot name="c" />
			</div>,
		);
		scenario.snapshot('empty');
		await scenario.act(() => setters[2](true));
		scenario.snapshot('third');
		await scenario.act(() => setters[0](true));
		scenario.snapshot('first and third');
		await scenario.act(() => setters[1](true));
		scenario.snapshot('all');
	});
});

test('a fragment growing under an ancestor update appends after its existing child', async () => {
	await expectAgreement(async (scenario) => {
		let show: ((value: boolean) => void) | undefined;
		const Screen = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return (
				<div>
					<Fragment>
						<b>header</b>
						{visible ? <i>list</i> : null}
					</Fragment>
				</div>
			);
		};

		await scenario.render(<Screen />);
		scenario.snapshot('header only');

		await scenario.act(() => show?.(true));
		scenario.snapshot('list after header');

		await scenario.act(() => show?.(false));
		scenario.snapshot('header only again');
	});
});

test('a keyed reorder that also grows a moved child keeps each subtree together', async () => {
	await expectAgreement(async (scenario) => {
		const Item = ({ name, count }: { name: string; count: number }) => (
			<Fragment>
				<dt>{name}</dt>
				{Array.from({ length: count }, (_, index) => (
					<dd key={index}>{`${name}${index}`}</dd>
				))}
			</Fragment>
		);
		const Host = ({ order, counts }: { order: string[]; counts: Record<string, number> }) => (
			<dl>
				{order.map((name) => (
					<Item key={name} name={name} count={counts[name]} />
				))}
			</dl>
		);

		await scenario.render(<Host order={['a', 'b', 'c']} counts={{ a: 1, b: 1, c: 1 }} />);
		scenario.snapshot('initial');

		await scenario.render(<Host order={['c', 'a', 'b']} counts={{ a: 2, b: 0, c: 1 }} />);
		scenario.snapshot('rotated and regrown');
	});
});

test('a stateful row updates without disturbing its keyed siblings', async () => {
	await expectAgreement(async (scenario) => {
		const setters = new Map<string, (value: number) => void>();
		const Row = ({ name }: { name: string }) => {
			const [count, setCount] = useState(0);
			setters.set(name, setCount);
			return (
				<li>
					{name}
					{count > 0 ? <b>{String(count)}</b> : null}
				</li>
			);
		};
		await scenario.render(
			<ul>
				{['a', 'b', 'c'].map((name) => (
					<Row key={name} name={name} />
				))}
			</ul>,
		);
		scenario.snapshot('initial');
		await scenario.act(() => setters.get('b')?.(1));
		scenario.snapshot('middle updated');
		await scenario.act(() => setters.get('c')?.(2));
		scenario.snapshot('last updated');
	});
});

test('a component growing a fragment keeps the siblings after it in order', async () => {
	await expectAgreement(async (scenario) => {
		let setCount: ((value: number) => void) | undefined;
		const Group = () => {
			const [count, set] = useState(0);
			setCount = set;
			return (
				<Fragment>
					{Array.from({ length: count }, (_, index) => (
						<i key={index}>{String(index)}</i>
					))}
				</Fragment>
			);
		};
		await scenario.render(
			<div>
				<b>before</b>
				<Group />
				<b>after</b>
			</div>,
		);
		scenario.snapshot('none');
		await scenario.act(() => setCount?.(3));
		scenario.snapshot('three');
		await scenario.act(() => setCount?.(1));
		scenario.snapshot('one');
		await scenario.act(() => setCount?.(0));
		scenario.snapshot('none again');
	});
});

test('a component swapping its whole subtree keeps the siblings after it in order', async () => {
	await expectAgreement(async (scenario) => {
		let swap: ((value: boolean) => void) | undefined;
		const Body = () => {
			const [second, setSecond] = useState(false);
			swap = setSecond;
			return second ? <em>second</em> : <i>first</i>;
		};
		await scenario.render(
			<div>
				<b>before</b>
				<Body />
				<b>after</b>
			</div>,
		);
		scenario.snapshot('first');
		await scenario.act(() => swap?.(true));
		scenario.snapshot('second');
	});
});

test('a stateful component under a host parent with no siblings fills in place', async () => {
	await expectAgreement(async (scenario) => {
		let show: ((value: boolean) => void) | undefined;
		const Only = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return visible ? <i>only</i> : null;
		};
		await scenario.render(
			<div>
				<Only />
			</div>,
		);
		scenario.snapshot('empty');
		await scenario.act(() => show?.(true));
		scenario.snapshot('filled');
	});
});

test('a stateful component at the root of the tree fills in place', async () => {
	await expectAgreement(async (scenario) => {
		let show: ((value: boolean) => void) | undefined;
		const Root = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return visible ? <i>root</i> : null;
		};
		await scenario.render(<Root />);
		scenario.snapshot('empty');
		await scenario.act(() => show?.(true));
		scenario.snapshot('filled');
	});
});

test('a trailing child that renders nothing survives a full rerender', async () => {
	await expectAgreement(async (scenario) => {
		const Empty = () => null;
		const Host = ({ label }: { label: string }) => (
			<div>
				<b>{label}</b>
				<Empty />
			</div>
		);
		await scenario.render(<Host label="one" />);
		scenario.snapshot('first');
		await scenario.render(<Host label="two" />);
		scenario.snapshot('second');
	});
});

test('a keyed reorder moves component-wrapped subtrees as units', async () => {
	await expectAgreement(async (scenario) => {
		const Pair = ({ name }: { name: string }) => (
			<Fragment>
				<dt>{name}</dt>
				<dd>{name.toUpperCase()}</dd>
			</Fragment>
		);
		const Host = ({ order }: { order: string[] }) => (
			<dl>
				{order.map((name) => (
					<Pair key={name} name={name} />
				))}
			</dl>
		);
		await scenario.render(<Host order={['a', 'b', 'c']} />);
		scenario.snapshot('initial');
		await scenario.render(<Host order={['c', 'a', 'b']} />);
		scenario.snapshot('rotated');
		await scenario.render(<Host order={['b', 'c']} />);
		scenario.snapshot('shrunk');
	});
});

test('a keyed child that renders nothing materializes in its moved position', async () => {
	await expectAgreement(async (scenario) => {
		const Slot = ({ name, filled }: { name: string; filled: boolean }) => (filled ? <i>{name}</i> : null);
		const Host = ({ order, filled }: { order: string[]; filled: string[] }) => (
			<div>
				{order.map((name) => (
					<Slot key={name} name={name} filled={filled.includes(name)} />
				))}
			</div>
		);

		await scenario.render(<Host order={['a', 'b', 'c']} filled={['a', 'c']} />);
		scenario.snapshot('b empty');
		await scenario.render(<Host order={['b', 'a', 'c']} filled={['a', 'b', 'c']} />);
		scenario.snapshot('b moved and filled');
		await scenario.render(<Host order={['b', 'a', 'c']} filled={['a', 'c']} />);
		scenario.snapshot('b emptied in place');
	});
});

test('a moved multi-node child grows and shrinks as one unit', async () => {
	await expectAgreement(async (scenario) => {
		const Group = ({ name, count }: { name: string; count: number }) => (
			<Fragment>
				{Array.from({ length: count }, (_, index) => (
					<i key={index}>{`${name}${index}`}</i>
				))}
			</Fragment>
		);
		const Host = ({ order, counts }: { order: string[]; counts: Record<string, number> }) => (
			<div>
				{order.map((name) => (
					<Group key={name} name={name} count={counts[name]} />
				))}
			</div>
		);

		await scenario.render(<Host order={['a', 'b', 'c']} counts={{ a: 2, b: 2, c: 2 }} />);
		scenario.snapshot('initial');
		await scenario.render(<Host order={['c', 'a', 'b']} counts={{ a: 0, b: 2, c: 3 }} />);
		scenario.snapshot('rotated, grown and emptied');
		await scenario.render(<Host order={['c', 'a', 'b']} counts={{ a: 2, b: 1, c: 1 }} />);
		scenario.snapshot('refilled');
	});
});

test('a moved child updates on its own after the reorder settles', async () => {
	await expectAgreement(async (scenario) => {
		const setters = new Map<string, (value: number) => void>();
		const Group = ({ name }: { name: string }) => {
			const [count, setCount] = useState(0);
			setters.set(name, setCount);
			return (
				<Fragment>
					{Array.from({ length: count }, (_, index) => (
						<i key={index}>{`${name}${index}`}</i>
					))}
				</Fragment>
			);
		};
		const Host = ({ order }: { order: string[] }) => (
			<div>
				<b>head</b>
				{order.map((name) => (
					<Group key={name} name={name} />
				))}
				<b>tail</b>
			</div>
		);

		await scenario.render(<Host order={['a', 'b', 'c']} />);
		await scenario.render(<Host order={['c', 'a', 'b']} />);
		scenario.snapshot('rotated while empty');
		await scenario.act(() => setters.get('c')?.(2));
		scenario.snapshot('moved child filled');
		await scenario.act(() => setters.get('a')?.(1));
		scenario.snapshot('middle child filled');
	});
});

test('keyed and unkeyed children with holes reconcile side by side', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ order, show }: { order: string[]; show: boolean }) => (
			<div>
				{show ? <i>lead</i> : null}
				{order.map((name) => (
					<b key={name}>{name}</b>
				))}
				{null}
				{show && <em>trail</em>}
			</div>
		);

		await scenario.render(<Host order={['a', 'b']} show />);
		scenario.snapshot('initial');
		await scenario.render(<Host order={['b', 'a']} show={false} />);
		scenario.snapshot('reordered without the holes filled');
		await scenario.render(<Host order={['b', 'a']} show />);
		scenario.snapshot('holes refilled');
	});
});

test('a keyed reorder preserves the state of nodes moved within their parent', async () => {
	let moves = 0;
	await runScenario(scionRuntime, async (scenario) => {
		const List = ({ order }: { order: string[] }) => (
			<ul>
				{order.map((name) => (
					<li key={name}>{name}</li>
				))}
			</ul>
		);
		await scenario.render(<List order={['a', 'b', 'c']} />);
		const list = scenario.container.firstElementChild!;
		const insertBefore = list.insertBefore.bind(list);
		list.moveBefore = (node, before) => {
			moves++;
			insertBefore(node, before);
		};
		await scenario.render(<List order={['c', 'a', 'b']} />);
		expect(scenario.html()).toBe('<ul><li>c</li><li>a</li><li>b</li></ul>');
	});
	expect(moves).toBe(1);
});

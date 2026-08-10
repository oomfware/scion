import type { Ref, RefCallback } from 'react';
import { expect, test } from 'vitest';

import { expectAgreement, runBoth } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from './support/runtime.ts';

const describeNode = (node: HTMLElement | null) =>
	node === null ? 'null' : `${node.tagName}.${node.className}`;

test('an object ref holds the node by the time effects run, and is cleared once unmounted', async () => {
	await expectAgreement(async (scenario) => {
		let observed: { current: unknown } | null = null;
		const Component = () => {
			const ref = useRef<HTMLDivElement>(null);
			observed = ref;
			useEffect(() => scenario.log('effect sees', describeNode(ref.current)), []);
			return <div className="target" ref={ref} />;
		};
		const Host = ({ show }: { show: boolean }) => <div>{show ? <Component /> : null}</div>;
		await scenario.render(<Host show />);
		await scenario.render(<Host show={false} />);
		scenario.log('cleared once unmounted', String(observed!.current === null));
	});
});

test('an effect cleanup reads a ref that has already been detached', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const ref = useRef<HTMLDivElement>(null);
			useEffect(() => () => scenario.log('cleanup sees', describeNode(ref.current)), []);
			return <div className="target" ref={ref} />;
		};
		const Host = ({ show }: { show: boolean }) => <div>{show ? <Component /> : null}</div>;
		await scenario.render(<Host show />);
		await scenario.render(<Host show={false} />);
	});
});

test('a callback ref is called with the node and then with null', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ show }: { show: boolean }) => (
			<div>
				{show ? <i className="target" ref={(node) => scenario.log('ref', describeNode(node))} /> : null}
			</div>
		);
		await scenario.render(<Host show />);
		scenario.log('--- remove ---');
		await scenario.render(<Host show={false} />);
	});
});

test('a ref callback returning a cleanup gets the cleanup, not a null call', async () => {
	await expectAgreement(async (scenario) => {
		const attach: RefCallback<HTMLElement> = (node) => {
			scenario.log('attach', describeNode(node));
			return () => scenario.log('cleanup');
		};
		const Host = ({ show }: { show: boolean }) => <div>{show ? <i className="t" ref={attach} /> : null}</div>;
		await scenario.render(<Host show />);
		scenario.log('--- remove ---');
		await scenario.render(<Host show={false} />);
	});
});

test('changing the ref callback identity detaches the old and attaches the new', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ tag }: { tag: string }) => (
			<i
				className="t"
				ref={(node) => {
					scenario.log('attach', tag, describeNode(node));
					return () => scenario.log('cleanup', tag);
				}}
			/>
		);
		await scenario.render(<Host tag="first" />);
		scenario.log('--- swap ---');
		await scenario.render(<Host tag="second" />);
	});
});

test('a stable ref callback is not reattached on rerender', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ tick }: { tick: number }) => {
			const attach = useRef<RefCallback<HTMLElement>>((node) => {
				scenario.log('attach', describeNode(node));
				return () => scenario.log('cleanup');
			});
			return <i className="t" ref={attach.current} data-tick={tick} />;
		};
		await scenario.render(<Host tick={1} />);
		await scenario.render(<Host tick={2} />);
	});
});

test('several refs on one element all receive the node', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const first = useRef<HTMLElement>(null);
			const second = useRef<HTMLElement>(null);
			const merged: RefCallback<HTMLElement> = (node) => {
				first.current = node;
				second.current = node;
				return () => {
					first.current = null;
					second.current = null;
				};
			};
			useEffect(() => {
				scenario.log('both set', String(first.current === second.current && first.current !== null));
			}, []);
			return <i className="t" ref={merged} />;
		};
		await scenario.render(<Component />);
	});
});

test('ref passed as a plain prop to a function component reaches the host node', async () => {
	await expectAgreement(async (scenario) => {
		const Child = ({ ref, label }: { label: string; ref: Ref<HTMLElement> }) => (
			<i className="t" ref={ref}>
				{label}
			</i>
		);
		const Parent = () => {
			const ref = useRef<HTMLElement>(null);
			useEffect(() => scenario.log('parent sees', describeNode(ref.current)), []);
			return <Child ref={ref} label="text" />;
		};
		await scenario.render(<Parent />);
	});
});

test('forwardRef receives the ref as its second argument', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = forwardRef<HTMLElement, { label: string }>((props, ref) => (
			<i className="t" ref={ref}>
				{props.label}
			</i>
		));
		const Parent = () => {
			const ref = useRef<HTMLElement>(null);
			useEffect(() => scenario.log('parent sees', describeNode(ref.current)), []);
			return <Inner ref={ref} label="text" />;
		};
		await scenario.render(<Parent />);
		scenario.snapshot('ref must not leak into the markup');
	});
});

test('useImperativeHandle exposes a custom handle and refreshes on deps change', async () => {
	await expectAgreement(async (scenario) => {
		type Handle = { read: () => string };
		const Inner = ({ ref, offset }: { offset: number; ref: Ref<Handle> }) => {
			useImperativeHandle(ref, () => ({ read: () => `value${offset}` }), [offset]);
			return <i />;
		};
		const Parent = ({ offset }: { offset: number }) => {
			const handle = useRef<Handle>(null);
			useEffect(() => scenario.log('handle reads', handle.current?.read()), [offset]);
			return <Inner ref={handle} offset={offset} />;
		};
		await scenario.render(<Parent offset={1} />);
		await scenario.render(<Parent offset={2} />);
	});
});

test('a ref survives a keyed reorder without detaching', async () => {
	await expectAgreement(async (scenario) => {
		const Item = ({ name }: { name: string }) => (
			<li
				ref={(node) => {
					scenario.log('attach', name, describeNode(node));
					return () => scenario.log('detach', name);
				}}
			>
				{name}
			</li>
		);
		const Host = ({ order }: { order: string[] }) => (
			<ul>
				{order.map((name) => (
					<Item key={name} name={name} />
				))}
			</ul>
		);
		await scenario.render(<Host order={['a', 'b']} />);
		scenario.log('--- reorder ---');
		await scenario.render(<Host order={['b', 'a']} />);
		scenario.snapshot('after reorder');
	});
});

test('a ref is detached when the element type changes', async () => {
	await expectAgreement(async (scenario) => {
		const attach: RefCallback<HTMLElement> = (node) => {
			scenario.log('attach', describeNode(node));
			return () => scenario.log('detach');
		};
		await scenario.render(<i className="t" ref={attach} />);
		scenario.log('--- retag ---');
		await scenario.render(<b className="t" ref={attach} />);
	});
});

test('setting state from a ref callback settles', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [width, setWidth] = useState<number | null>(null);
			return (
				<div ref={(node) => setWidth(node === null ? null : 42)}>
					{width === null ? 'unmeasured' : `width ${width}`}
				</div>
			);
		};
		await scenario.render(<Component />);
		scenario.snapshot('measured');
	});
});

test('scion attaches an ancestor ref before a child layout effect, where react does not', async () => {
	const scenario = async (helper: Scenario) => {
		const Child = () => {
			useLayoutEffect(() => helper.log('child layout effect'));
			return <i>child</i>;
		};
		const Host = () => (
			<div ref={(node) => helper.log('ancestor ref', String(node?.tagName))}>
				<Child />
			</div>
		);
		await helper.render(<Host />);
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['ancestor ref DIV', 'child layout effect']);
	expect(react.entries).toEqual(['child layout effect', 'ancestor ref DIV']);
});

import type { ReactNode } from 'react';
import { createPortal as reactCreatePortal } from 'react-dom';
import { expect, test } from 'vitest';

import { createPortal as scionCreatePortal } from '../src/react-dom.ts';

import { expectAgreement, runBoth } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';
import { activeRuntime, useEffect, useState } from './support/runtime.ts';

const createPortal = (children: ReactNode, container: Element, key?: string) =>
	activeRuntime().name === 'scion'
		? scionCreatePortal(children, container, key)
		: reactCreatePortal(children, container, key);

const makeTarget = (scenario: Scenario) => {
	const target = document.createElement('section');
	target.id = 'portal-target';
	scenario.container.after(target);
	return target;
};

const describeTarget = (target: Element) => target.innerHTML.replaceAll('<!---->', '');

test('portal children render into the target, not the container', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		await scenario.render(
			<div className="host">
				<span>stays</span>
				{createPortal(<i>ported</i>, target)}
			</div>,
		);
		scenario.snapshot('container');
		scenario.log('target', describeTarget(target));
		target.remove();
	});
});

test('portal content updates in place', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		const Host = ({ label }: { label: string }) => <div>{createPortal(<i>{label}</i>, target)}</div>;
		await scenario.render(<Host label="first" />);
		scenario.log('target', describeTarget(target));
		await scenario.render(<Host label="second" />);
		scenario.log('target', describeTarget(target));
		target.remove();
	});
});

test('portal content is removed when the portal unmounts', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		const Host = ({ show }: { show: boolean }) => (
			<div>{show ? createPortal(<i>ported</i>, target) : null}</div>
		);
		await scenario.render(<Host show />);
		scenario.log('target while shown', describeTarget(target));
		await scenario.render(<Host show={false} />);
		scenario.log('target after removal', describeTarget(target));
		target.remove();
	});
});

test('effects and state inside a portal behave like anywhere else', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		const Inner = () => {
			const [count, setCount] = useState(0);
			useEffect(() => {
				scenario.log('inner mounted');
				return () => scenario.log('inner unmounted');
			}, []);
			return <button onClick={() => setCount(count + 1)}>{count}</button>;
		};
		const Host = ({ show }: { show: boolean }) => <div>{show ? createPortal(<Inner />, target) : null}</div>;
		await scenario.render(<Host show />);
		await scenario.act(() => target.querySelector('button')!.click());
		scenario.log('target', describeTarget(target));
		await scenario.render(<Host show={false} />);
		target.remove();
	});
});

test('events inside a portal bubble to react ancestors, not dom ancestors', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		await scenario.render(
			<div onClick={() => scenario.log('react ancestor')}>
				{createPortal(<button onClick={() => scenario.log('portal child')}>go</button>, target)}
			</div>,
		);
		await scenario.act(() => target.querySelector('button')!.click());
		target.remove();
	});
});

test('a capture handler above a portal sees the event first', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		await scenario.render(
			<div
				onClickCapture={() => scenario.log('ancestor capture')}
				onClick={() => scenario.log('ancestor bubble')}
			>
				{createPortal(<button onClick={() => scenario.log('portal child')}>go</button>, target)}
			</div>,
		);
		await scenario.act(() => target.querySelector('button')!.click());
		target.remove();
	});
});

test('stopPropagation inside a portal prevents the react ancestor handler', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		await scenario.render(
			<div onClick={() => scenario.log('ancestor')}>
				{createPortal(
					<button
						onClick={(event) => {
							event.stopPropagation();
							scenario.log('portal child');
						}}
					>
						go
					</button>,
					target,
				)}
			</div>,
		);
		await scenario.act(() => target.querySelector('button')!.click());
		target.remove();
	});
});

test('a handler fires once, not twice, for a portal nested in the react tree', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		await scenario.render(
			<div onClick={() => scenario.log('ancestor')}>
				<span onClick={() => scenario.log('middle')}>
					{createPortal(<button onClick={() => scenario.log('portal child')}>go</button>, target)}
				</span>
			</div>,
		);
		await scenario.act(() => target.querySelector('button')!.click());
		target.remove();
	});
});

test('two portals into the same target stay independent', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		await scenario.render(
			<div>
				{createPortal(<i>first</i>, target, 'a')}
				{createPortal(<i>second</i>, target, 'b')}
			</div>,
		);
		scenario.log('target', describeTarget(target));
		target.remove();
	});
});

test('a stateful component inside a portal fills its slot in place', async () => {
	await expectAgreement(async (scenario) => {
		const target = makeTarget(scenario);
		let show: ((value: boolean) => void) | undefined;
		const Slot = () => {
			const [visible, setVisible] = useState(false);
			show = setVisible;
			return visible ? <i>late</i> : null;
		};
		await scenario.render(
			<div>
				{createPortal(
					<>
						<b>first</b>
						<Slot />
					</>,
					target,
				)}
			</div>,
		);
		scenario.log('empty', describeTarget(target));
		await scenario.act(() => show?.(true));
		scenario.log('filled', describeTarget(target));
		target.remove();
	});
});

test('a portal moved to a new target relocates its content', async () => {
	await expectAgreement(async (scenario) => {
		const first = makeTarget(scenario);
		const second = document.createElement('aside');
		scenario.container.after(second);
		const Host = ({ target }: { target: Element }) => <div>{createPortal(<i>ported</i>, target)}</div>;
		await scenario.render(<Host target={first} />);
		scenario.log('first', describeTarget(first), 'second', describeTarget(second));
		await scenario.render(<Host target={second} />);
		scenario.log('first', describeTarget(first), 'second', describeTarget(second));
		first.remove();
		second.remove();
	});
});

test('unmounting the root clears portalled content', async () => {
	const scenario = async (helper: Scenario) => {
		const target = makeTarget(helper);
		await helper.render(<div>{createPortal(<i>ported</i>, target)}</div>);
		helper.log('before unmount', describeTarget(target));
		await helper.unmount();
		helper.log('after unmount', describeTarget(target));
		target.remove();
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(react.entries);
	expect(scion.entries.at(-1)).toBe('after unmount ');
});

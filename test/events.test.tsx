import { flushSync as reactFlushSync } from 'react-dom';
import { expect, test } from 'vitest';

import { flushSync as scionFlushSync } from '../src/react-dom.ts';

import { expectAgreement, runBoth } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';
import { activeRuntime, useState } from './support/runtime.ts';

const click = (scenario: Scenario, selector: string) =>
	scenario.container.querySelector<HTMLElement>(selector)!.click();

// happy-dom needs a forced render to test updates during propagation.
const flushSync = (callback: () => void) =>
	activeRuntime().name === 'scion' ? scionFlushSync(callback) : reactFlushSync(callback);

test('a click handler fires and can update state', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [count, setCount] = useState(0);
			return <button onClick={() => setCount(count + 1)}>{count}</button>;
		};
		await scenario.render(<Component />);
		await scenario.act(() => click(scenario, 'button'));
		await scenario.act(() => click(scenario, 'button'));
		scenario.snapshot('after two clicks');
	});
});

test('handlers bubble from child to ancestor', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<div onClick={() => scenario.log('outer')}>
				<span onClick={() => scenario.log('inner')}>
					<button>go</button>
				</span>
			</div>,
		);
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('capture handlers run before bubble handlers', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<div onClickCapture={() => scenario.log('outer capture')} onClick={() => scenario.log('outer bubble')}>
				<button
					onClickCapture={() => scenario.log('inner capture')}
					onClick={() => scenario.log('inner bubble')}
				>
					go
				</button>
			</div>,
		);
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('stopPropagation halts the bubble', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<div onClick={() => scenario.log('outer')}>
				<button
					onClick={(event) => {
						event.stopPropagation();
						scenario.log('inner');
					}}
				>
					go
				</button>
			</div>,
		);
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('replacing a handler between renders calls only the current one', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ tag }: { tag: string }) => (
			<button onClick={() => scenario.log('clicked', tag)}>go</button>
		);
		await scenario.render(<Component tag="first" />);
		await scenario.act(() => click(scenario, 'button'));
		await scenario.render(<Component tag="second" />);
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('removing a handler stops it firing', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ live }: { live: boolean }) => (
			<button onClick={live ? () => scenario.log('clicked') : undefined}>go</button>
		);
		await scenario.render(<Component live />);
		await scenario.act(() => click(scenario, 'button'));
		await scenario.render(<Component live={false} />);
		await scenario.act(() => click(scenario, 'button'));
		scenario.log('done');
	});
});

test('a handler armed on an ancestor mid-dispatch does not see that event', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [armed, setArmed] = useState(false);
			return (
				<div onClick={armed ? () => scenario.log('outer') : undefined}>
					<button onClick={() => flushSync(() => setArmed(true))}>go</button>
				</div>
			);
		};
		await scenario.render(<Component />);
		await scenario.act(() => click(scenario, 'button'));
		scenario.snapshot('after the click');
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('a capture handler armed on a descendant mid-dispatch does not see that event', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [armed, setArmed] = useState(false);
			return (
				<div onClickCapture={() => flushSync(() => setArmed(true))}>
					<button onClickCapture={armed ? () => scenario.log('inner capture') : undefined}>go</button>
				</div>
			);
		};
		await scenario.render(<Component />);
		await scenario.act(() => click(scenario, 'button'));
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('scion calls a handler rebound mid-dispatch, where react calls the one it started with', async () => {
	const scenario = async (helper: Scenario) => {
		const Component = () => {
			const [count, setCount] = useState(0);
			return (
				<div onClick={() => helper.log('outer saw', count)}>
					<button onClick={() => flushSync(() => setCount(1))}>go</button>
				</div>
			);
		};
		await helper.render(<Component />);
		await helper.act(() => click(helper, 'button'));
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['outer saw 1']);
	expect(react.entries).toEqual(['outer saw 0']);
});

test('scion still fires handlers on a detached element that react ignores', async () => {
	const scenario = async (helper: Scenario) => {
		const Component = ({ show }: { show: boolean }) => (
			<div>{show ? <button onClick={() => helper.log('clicked')}>go</button> : null}</div>
		);
		await helper.render(<Component show />);
		const button = helper.container.querySelector('button')!;
		await helper.act(() => button.click());
		helper.log('--- unmounted ---');
		await helper.render(<Component show={false} />);
		await helper.act(() => button.click());
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['clicked', '--- unmounted ---', 'clicked']);
	expect(react.entries).toEqual(['clicked', '--- unmounted ---']);
});

test('a handler receives an event carrying the synthetic-event surface base-ui probes for', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<button
				onClick={(event) => {
					scenario.log('has nativeEvent', String('nativeEvent' in event));
					scenario.log('isPropagationStopped is a function', typeof event.isPropagationStopped);
					scenario.log('isDefaultPrevented is a function', typeof event.isDefaultPrevented);
					scenario.log('persist is a function', typeof event.persist);
					scenario.log('currentTarget', event.currentTarget.tagName);
					scenario.log('target', event.target instanceof Element ? event.target.tagName : '');
					scenario.log('type', event.type);
				}}
			>
				go
			</button>,
		);
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('preventDefault is observable through the synthetic surface', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<button
				onClick={(event) => {
					scenario.log('before', String(event.isDefaultPrevented()));
					event.preventDefault();
					scenario.log('after', String(event.isDefaultPrevented()));
				}}
			>
				go
			</button>,
		);
		await scenario.act(() => click(scenario, 'button'));
	});
});

test('onChange fires on input for a text field', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(<input onChange={(event) => scenario.log('changed', event.currentTarget.value)} />);
		await scenario.act(() => {
			const input = scenario.container.querySelector('input')!;
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'typed');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
	});
});

test('keyboard handlers receive the key', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(<input onKeyDown={(event) => scenario.log('key', event.key)} />);
		await scenario.act(() =>
			scenario.container
				.querySelector('input')!
				.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })),
		);
	});
});

test('focus and blur handlers fire on the delegated focusin/focusout pair', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<input onFocus={() => scenario.log('focus')} onBlur={() => scenario.log('blur')} />,
		);
		await scenario.act(() => {
			const input = scenario.container.querySelector('input')!;
			input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
			input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		});
	});
});

test('the runtimes source mouseenter from different native events', async () => {
	const scenario = async (helper: Scenario) => {
		await helper.render(
			<div onMouseEnter={() => helper.log('outer enter')}>
				<button onMouseEnter={() => helper.log('inner enter')}>go</button>
			</div>,
		);
		const button = helper.container.querySelector('button')!;
		await helper.act(() => button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })));
		helper.log('--- via mouseover ---');
		await helper.act(() =>
			button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null })),
		);
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['inner enter', '--- via mouseover ---']);
	expect(react.entries).toEqual(['--- via mouseover ---', 'outer enter', 'inner enter']);
});

test('dropping a handler prop releases the record and the dom listener', async () => {
	const scenario = async (helper: Scenario) => {
		const Component = ({ live }: { live: boolean }) => (
			<button onClick={live ? () => helper.log('clicked') : undefined}>go</button>
		);
		const hasHandler = () => {
			const button = helper.container.querySelector<HTMLButtonElement & { __scion$click?: unknown }>(
				'button',
			)!;
			return Boolean(button.__scion$click);
		};
		await helper.render(<Component live />);
		helper.log('armed', hasHandler());
		await helper.render(<Component live={false} />);
		helper.log('dropped', hasHandler());
		await helper.render(<Component live />);
		helper.log('re-armed', hasHandler());
		await helper.act(() => click(helper, 'button'));
	};

	const { scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['armed true', 'dropped false', 're-armed true', 'clicked']);
});

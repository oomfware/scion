import { expect, test } from 'vitest';

import { expectAgreement, runBoth, transition } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';
import { useState } from './support/runtime.ts';

// use the native setter to update the browser's dirty-value state.
const typeInto = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
	Object.getOwnPropertyDescriptor(prototype.prototype, 'value')!.set!.call(element, value);
	element.dispatchEvent(new Event('input', { bubbles: true }));
};

const recordValue = (scenario: Scenario, label: string, selector: string) => {
	const element = scenario.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
	const checked = element instanceof HTMLInputElement ? element.checked : undefined;
	scenario.log(label, `value=${element.value}`, `checked=${checked}`);
};

// #region agreement

test('select reflects a controlled value', async () => {
	await expectAgreement(
		transition(
			<select value="b" onChange={() => {}}>
				<option value="a">a</option>
				<option value="b">b</option>
			</select>,
			<select value="a" onChange={() => {}}>
				<option value="a">a</option>
				<option value="b">b</option>
			</select>,
		),
	);
});

test('a multiple select reflects an array value', async () => {
	await expectAgreement(
		transition(
			<select multiple value={['a', 'b']} onChange={() => {}}>
				<option value="a">a</option>
				<option value="b">b</option>
			</select>,
			<select multiple value={['b']} onChange={() => {}}>
				<option value="a">a</option>
				<option value="b">b</option>
			</select>,
		),
	);
});

test('a controlled input adopts the value its handler commits', async () => {
	await expectAgreement(
		async (scenario) => {
			const Controlled = () => {
				const [value, setValue] = useState('a');
				return <input value={value} onChange={(event) => setValue(event.currentTarget.value)} />;
			};
			await scenario.render(<Controlled />);
			recordValue(scenario, 'initial', 'input');
			await scenario.act(() => typeInto(scenario.container.querySelector('input')!, 'typed'));
			recordValue(scenario, 'after typing', 'input');
		},
		{ compareDom: false },
	);
});

test('a controlled input snaps back when its handler refuses the edit', async () => {
	await expectAgreement(
		async (scenario) => {
			const Frozen = () => <input value="fixed" onChange={() => {}} />;
			await scenario.render(<Frozen />);
			await scenario.act(() => typeInto(scenario.container.querySelector('input')!, 'typed'));
			recordValue(scenario, 'after refused edit', 'input');
		},
		{ compareDom: false },
	);
});

test('a controlled checkbox snaps back when its handler refuses the toggle', async () => {
	await expectAgreement(
		async (scenario) => {
			const Frozen = () => <input type="checkbox" checked onChange={() => {}} />;
			await scenario.render(<Frozen />);
			await scenario.act(() => scenario.container.querySelector('input')!.click());
			recordValue(scenario, 'after refused toggle', 'input');
		},
		{ compareDom: false },
	);
});

test('a controlled checkbox adopts the state its handler commits', async () => {
	await expectAgreement(
		async (scenario) => {
			const Controlled = () => {
				const [checked, setChecked] = useState(false);
				return (
					<input
						type="checkbox"
						checked={checked}
						onChange={(event) => setChecked(event.currentTarget.checked)}
					/>
				);
			};
			await scenario.render(<Controlled />);
			await scenario.act(() => scenario.container.querySelector('input')!.click());
			recordValue(scenario, 'after click', 'input');
		},
		{ compareDom: false },
	);
});

test('an uncontrolled input keeps what the user typed across a rerender', async () => {
	await expectAgreement(
		async (scenario) => {
			const Uncontrolled = ({ label }: { label: string }) => (
				<div>
					<input defaultValue="start" />
					<span>{label}</span>
				</div>
			);
			await scenario.render(<Uncontrolled label="one" />);
			await scenario.act(() => typeInto(scenario.container.querySelector('input')!, 'typed'));
			recordValue(scenario, 'after typing', 'input');
			await scenario.render(<Uncontrolled label="two" />);
			recordValue(scenario, 'after unrelated rerender', 'input');
		},
		{ compareDom: false },
	);
});

test('a textarea driven by value adopts committed edits', async () => {
	await expectAgreement(
		async (scenario) => {
			const Controlled = () => {
				const [value, setValue] = useState('a');
				return <textarea value={value} onChange={(event) => setValue(event.currentTarget.value)} />;
			};
			await scenario.render(<Controlled />);
			await scenario.act(() => typeInto(scenario.container.querySelector('textarea')!, 'typed'));
			recordValue(scenario, 'after typing', 'textarea');
		},
		{ compareDom: false },
	);
});

// #endregion

// #region recorded differences

test('scion sets the value property without mirroring it to the attribute', async () => {
	const { react, scion } = await runBoth(
		transition(<input value="a" onChange={() => {}} />, <input value="b" onChange={() => {}} />),
	);
	expect(scion.dom).toBe('<input .checked=false .defaultChecked=false .defaultValue="" .value="b">');
	expect(react.dom).toBe(
		'<input value="b" .checked=false .defaultChecked=false .defaultValue="b" .value="b">',
	);
});

test('scion sets the checked property without mirroring it to the attribute', async () => {
	const { react, scion } = await runBoth(
		transition(
			<input type="checkbox" checked onChange={() => {}} />,
			<input type="checkbox" checked={false} onChange={() => {}} />,
		),
	);
	expect(scion.dom).toContain('.checked=false .defaultChecked=false');
	expect(scion.dom).not.toContain('checked=""');
	expect(react.dom).toContain('checked=""');
	expect(react.dom).toContain('.checked=false .defaultChecked=true');
});

test('a function form action is dropped by scion and run by react', async () => {
	const scenario = async (helper: Scenario) => {
		await helper.render(
			<form
				action={(data) => {
					const value = data.get('a');
					helper.log('action ran', typeof value === 'string' ? value : value?.name);
				}}
			>
				<input name="a" defaultValue="v" />
				<button type="submit">go</button>
			</form>,
		);
		helper.log(
			'has action attribute',
			String(helper.container.querySelector('form')!.hasAttribute('action')),
		);
		await helper.act(() => helper.container.querySelector('button')!.click());
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual(['has action attribute false']);
	expect(react.entries).toEqual(['has action attribute true', 'action ran v']);
});

// #endregion

// #region uncontrolled defaults

test('an updated defaultValue is written through', async () => {
	await expectAgreement(transition(<input defaultValue="a" />, <input defaultValue="b" />));
});

test('an updated defaultChecked is written through', async () => {
	await expectAgreement(
		transition(<input type="checkbox" defaultChecked />, <input type="checkbox" defaultChecked={false} />),
	);
});

test('a dropped defaultValue clears the attribute and a dropped defaultChecked does not', async () => {
	await expectAgreement(transition(<input defaultValue="a" />, <input />));
	await expectAgreement(transition(<input type="checkbox" defaultChecked />, <input type="checkbox" />));
});

test('a defaultValue arriving after mount is written through', async () => {
	await expectAgreement(transition(<input />, <input defaultValue="a" />));
});

test('a select defaultValue selects the matching option', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<select defaultValue="b">
				<option value="a">a</option>
				<option value="b">b</option>
				<option value="c">c</option>
			</select>,
		);
		scenario.log('value', scenario.container.querySelector('select')!.value);
	});
});

test('a multiple select defaultValue selects every option it names', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<select multiple defaultValue={['a', 'c']}>
				<option value="a">a</option>
				<option value="b">b</option>
				<option value="c">c</option>
			</select>,
		);
		scenario.log(
			'selected',
			[...scenario.container.querySelectorAll('option')]
				.filter((option) => option.selected)
				.map((option) => option.value)
				.join(','),
		);
	});
});

test('a select applies its defaultValue on mount only, so a later one is ignored', async () => {
	await expectAgreement(async (scenario) => {
		const Host = ({ value }: { value: string }) => (
			<select defaultValue={value}>
				<option value="a">a</option>
				<option value="b">b</option>
				<option value="c">c</option>
			</select>
		);
		await scenario.render(<Host value="b" />);
		scenario.log('mounted', scenario.container.querySelector('select')!.value);
		await scenario.render(<Host value="c" />);
		scenario.log('after change', scenario.container.querySelector('select')!.value);
	});
});

test('a defaultValue does not fight a user selection made after mount', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<select defaultValue="b">
				<option value="a">a</option>
				<option value="b">b</option>
			</select>,
		);
		const select = scenario.container.querySelector('select')!;
		await scenario.act(() => {
			select.value = 'a';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		scenario.log('after selecting', select.value);
	});
});

test('a textarea default is reflected the way react reflects it', async () => {
	await expectAgreement(transition(<textarea defaultValue="a" />, <textarea defaultValue="b" />));
	await expectAgreement(transition(<textarea defaultValue="a" />, <textarea />));
});

// #endregion

import { expect, test } from 'vitest';

import { expectAgreement } from './support/differential.ts';
import { createContext, memo, use, useContext, useEffect, useState } from './support/runtime.ts';

test('a consumer reads the default value when no provider is above it', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => <i>{useContext(Theme)}</i>;
		await scenario.render(<Reader />);
		scenario.snapshot('default value');
	});
});

test('a provider value reaches consumers at any depth and updates them', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Deep = () => <i>{useContext(Theme)}</i>;
		const Middle = () => (
			<div>
				<Deep />
			</div>
		);
		const Host = ({ value }: { value: string }) => (
			<Theme.Provider value={value}>
				<Middle />
			</Theme.Provider>
		);
		await scenario.render(<Host value="first" />);
		scenario.snapshot('first');
		await scenario.render(<Host value="second" />);
		scenario.snapshot('second');
	});
});

test('a bare context object works as a provider element', async () => {
	await expectAgreement(async (scenario) => {
		const Router = createContext('none');
		const Reader = () => <i>{useContext(Router)}</i>;
		const Host = ({ value }: { value: string }) => (
			<Router value={value}>
				<Reader />
			</Router>
		);
		await scenario.render(<Host value="first" />);
		scenario.snapshot('first');
		await scenario.render(<Host value="second" />);
		scenario.snapshot('second');
	});
});

test('use() reads a context value', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => <i>{use(Theme)}</i>;
		await scenario.render(
			<Theme.Provider value="provided">
				<Reader />
			</Theme.Provider>,
		);
		scenario.snapshot('through use');
	});
});

test('use() replaces context dependencies when conditional reads change', async () => {
	await expectAgreement(async (scenario) => {
		const First = createContext('first-default');
		const Second = createContext('second-default');
		const Reader = memo(({ both }: { both: boolean }) => {
			scenario.log('reader rendered');
			const first = use(First);
			const second = both ? use(Second) : 'skipped';
			return <i>{`${first}|${second}`}</i>;
		});
		const Host = ({ both, second }: { both: boolean; second: string }) => (
			<First.Provider value="one">
				<Second.Provider value={second}>
					<Reader both={both} />
				</Second.Provider>
			</First.Provider>
		);

		await scenario.render(<Host both second="two" />);
		await scenario.render(<Host both={false} second="two" />);
		scenario.log('--- unused context update ---');
		await scenario.render(<Host both={false} second="three" />);
		scenario.snapshot('unused context did not pass the memo boundary');
	});
});

test('nested providers shadow one another and restore on the way out', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = ({ name }: { name: string }) => <i>{`${name}:${useContext(Theme)}`}</i>;
		await scenario.render(
			<Theme.Provider value="outer">
				<Reader name="a" />
				<Theme.Provider value="inner">
					<Reader name="b" />
				</Theme.Provider>
				<Reader name="c" />
			</Theme.Provider>,
		);
		scenario.snapshot('shadowing');
	});
});

test('two independent contexts do not interfere', async () => {
	await expectAgreement(async (scenario) => {
		const First = createContext('first-default');
		const Second = createContext('second-default');
		const Reader = () => <i>{`${useContext(First)}|${useContext(Second)}`}</i>;
		await scenario.render(
			<First.Provider value="one">
				<Second.Provider value="two">
					<Reader />
				</Second.Provider>
			</First.Provider>,
		);
		scenario.snapshot('both read');
	});
});

test('a Consumer render prop receives the value', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		await scenario.render(
			<Theme.Provider value="provided">
				<Theme.Consumer>{(value: string) => <i>{value}</i>}</Theme.Consumer>
			</Theme.Provider>,
		);
		scenario.snapshot('consumer');
	});
});

test('a context update passes through a memo whose props did not change', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => {
			scenario.log('reader rendered');
			return <i>{useContext(Theme)}</i>;
		};
		const Blocker = memo(() => <Reader />);
		const Host = ({ value }: { value: string }) => (
			<Theme.Provider value={value}>
				<Blocker />
			</Theme.Provider>
		);
		await scenario.render(<Host value="first" />);
		scenario.log('--- update ---');
		await scenario.render(<Host value="second" />);
		scenario.snapshot('reader saw the update');
	});
});

test('a context change below a memo boundary leaves the boundary itself alone', async () => {
	const scion = await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => <i>{useContext(Theme)}</i>;
		const Blocker = memo(() => {
			scenario.log('blocker rendered');
			return <Reader />;
		});
		const Host = ({ value }: { value: string }) => (
			<Theme.Provider value={value}>
				<Blocker />
			</Theme.Provider>
		);
		await scenario.render(<Host value="first" />);
		scenario.log('--- update ---');
		await scenario.render(<Host value="second" />);
		scenario.snapshot('reader saw the update');
	});

	expect(scion.entries).toEqual(['blocker rendered', '--- update ---']);
});

test('a provider updated by its own state reaches consumers', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => <i>{useContext(Theme)}</i>;
		const Host = () => {
			const [value, setValue] = useState('first');
			return (
				<Theme.Provider value={value}>
					<button onClick={() => setValue('second')}>set</button>
					<Reader />
				</Theme.Provider>
			);
		};
		await scenario.render(<Host />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after provider state change');
	});
});

test('a consumer that also holds state re-renders once per context change', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => {
			const value = useContext(Theme);
			const [seen, setSeen] = useState<string[]>([]);
			useEffect(() => {
				setSeen((previous: string[]) => [...previous, value]);
			}, [value]);
			return <i>{seen.join(',')}</i>;
		};
		const Host = ({ value }: { value: string }) => (
			<Theme.Provider value={value}>
				<Reader />
			</Theme.Provider>
		);
		await scenario.render(<Host value="a" />);
		await scenario.render(<Host value="b" />);
		scenario.snapshot('one entry per value');
	});
});

test('a provider only wakes the consumers below it, not those of a sibling provider', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = ({ label }: { label: string }) => {
			const value = useContext(Theme);
			scenario.log('reader rendered', label, value);
			return <i>{value}</i>;
		};
		const Branch = memo(({ label }: { label: string }) => <Reader label={label} />);
		const Host = ({ left, right }: { left: string; right: string }) => (
			<div>
				<Theme.Provider value={left}>
					<Branch label="left" />
				</Theme.Provider>
				<Theme.Provider value={right}>
					<Branch label="right" />
				</Theme.Provider>
			</div>
		);
		await scenario.render(<Host left="a" right="b" />);
		scenario.log('--- only the left value changes ---');
		await scenario.render(<Host left="c" right="b" />);
		scenario.snapshot('final');
	});
});

test('a consumer under nested providers of one context follows the innermost value', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = () => <i>{useContext(Theme)}</i>;
		const Inner = memo(() => <Reader />);
		const Host = ({ outer, inner }: { inner: string; outer: string }) => (
			<Theme.Provider value={outer}>
				<Theme.Provider value={inner}>
					<Inner />
				</Theme.Provider>
			</Theme.Provider>
		);
		await scenario.render(<Host inner="in" outer="out" />);
		scenario.snapshot('innermost wins');
		await scenario.render(<Host inner="in" outer="changed" />);
		scenario.snapshot('outer change is shadowed');
		await scenario.render(<Host inner="fresh" outer="changed" />);
		scenario.snapshot('inner change applies');
	});
});

test('a consumer that stops reading a context is no longer woken by it', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext('default');
		const Reader = ({ reads }: { reads: boolean }) => {
			const value = reads ? useContext(Theme) : 'detached';
			scenario.log('reader rendered', value);
			return <i>{value}</i>;
		};
		const Host = ({ reads, value }: { reads: boolean; value: string }) => (
			<Theme.Provider value={value}>
				<div>
					<Reader reads={reads} />
				</div>
			</Theme.Provider>
		);
		await scenario.render(<Host reads value="a" />);
		scenario.log('--- detach ---');
		await scenario.render(<Host reads={false} value="a" />);
		scenario.log('--- change the value the reader dropped ---');
		await scenario.render(<Host reads={false} value="b" />);
		scenario.snapshot('final');
	});
});

test('an object context value only re-renders consumers when the identity changes', async () => {
	await expectAgreement(async (scenario) => {
		const Theme = createContext<{ label: string }>({ label: 'default' });
		const Reader = () => {
			const value = useContext(Theme);
			scenario.log('reader rendered', value.label);
			return <i>{value.label}</i>;
		};
		const stable = { label: 'stable' };
		const Host = ({ value }: { value: { label: string } }) => (
			<Theme.Provider value={value}>
				<Reader />
			</Theme.Provider>
		);
		await scenario.render(<Host value={stable} />);
		scenario.log('--- same identity ---');
		await scenario.render(<Host value={stable} />);
		scenario.log('--- new identity ---');
		await scenario.render(<Host value={{ label: 'fresh' }} />);
		scenario.snapshot('final');
	});
});

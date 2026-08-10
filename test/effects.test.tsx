import { flushSync as reactFlushSync } from 'react-dom';
import { test } from 'vitest';

import { flushSync as scionFlushSync } from '../src/react-dom.ts';

import { expectAgreement } from './support/differential.ts';
import {
	activeRuntime,
	useEffect,
	useInsertionEffect,
	useLayoutEffect,
	useState,
} from './support/runtime.ts';

const flushSync = (callback: () => void) =>
	activeRuntime().name === 'scion' ? scionFlushSync(callback) : reactFlushSync(callback);

const tracked = (log: (...parts: unknown[]) => void, name: string, deps?: unknown[]) => {
	useLayoutEffect(() => {
		log('layout', name);
		return () => log('layout cleanup', name);
	}, deps);
	useEffect(() => {
		log('passive', name);
		return () => log('passive cleanup', name);
	}, deps);
};

test('effect deps decide whether an effect re-runs', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ a, b }: { a: number; b: number }) => {
			useEffect(() => scenario.log('no deps'));
			useEffect(() => scenario.log('empty deps'), []);
			useEffect(() => scenario.log('deps a', a), [a]);
			useEffect(() => scenario.log('deps a b', a, b), [a, b]);
			return <i />;
		};
		await scenario.render(<Component a={1} b={1} />);
		scenario.log('---');
		await scenario.render(<Component a={1} b={2} />);
		scenario.log('---');
		await scenario.render(<Component a={2} b={2} />);
		scenario.log('---');
		await scenario.render(<Component a={2} b={2} />);
	});
});

test('deps are compared with Object.is, so NaN does not re-run and -0 does', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ value }: { value: number }) => {
			useEffect(() => scenario.log('ran', String(value)), [value]);
			return <i />;
		};
		for (const value of [Number.NaN, Number.NaN, 0, -0, 0]) {
			await scenario.render(<Component value={value} />);
		}
	});
});

test('a single component runs layout before passive, and cleanup before re-run', async () => {
	await expectAgreement(async (scenario) => {
		const Item = ({ id }: { id: string }) => {
			tracked(scenario.log, id, [id]);
			return <i>{id}</i>;
		};
		await scenario.render(<Item id="a" />);
		scenario.log('--- update ---');
		await scenario.render(<Item id="b" />);
		scenario.log('--- unmount ---');
		await scenario.unmount();
	});
});

test('insertion effects run before layout effects', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			useEffect(() => scenario.log('passive'), []);
			useLayoutEffect(() => scenario.log('layout'), []);
			useInsertionEffect(() => scenario.log('insertion'), []);
			return <i />;
		};
		await scenario.render(<Component />);
	});
});

test('an effect cleanup runs when the component unmounts', async () => {
	await expectAgreement(async (scenario) => {
		const Child = () => {
			useEffect(() => () => scenario.log('child cleanup'), []);
			return <i />;
		};
		const Parent = ({ show }: { show: boolean }) => <div>{show ? <Child /> : null}</div>;
		await scenario.render(<Parent show />);
		await scenario.render(<Parent show={false} />);
		scenario.snapshot('after removal');
	});
});

test('flushSync flushes passive effects before it returns', async () => {
	await expectAgreement(async (scenario) => {
		let hide: (() => void) | undefined;
		const Child = () => {
			useEffect(() => () => scenario.log('cleanup'), []);
			return <i />;
		};
		const Parent = () => {
			const [show, setShow] = useState(true);
			hide = () => setShow(false);
			return show ? <Child /> : null;
		};
		await scenario.render(<Parent />);
		flushSync(() => hide?.());
		scenario.log('after flush');
	});
});

test('layout effects observe the committed dom', async () => {
	await expectAgreement(async (scenario) => {
		const Component = ({ text }: { text: string }) => {
			useLayoutEffect(() => {
				scenario.log('layout sees', scenario.container.textContent);
			});
			return <i>{text}</i>;
		};
		await scenario.render(<Component text="one" />);
		await scenario.render(<Component text="two" />);
	});
});

test('state set from a layout effect is committed before passive effects run', async () => {
	await expectAgreement(async (scenario) => {
		const Component = () => {
			const [value, setValue] = useState('initial');
			useLayoutEffect(() => {
				if (value === 'initial') {
					setValue('from layout');
				}
			}, [value]);
			useEffect(() => scenario.log('passive sees', value), [value]);
			return <i>{value}</i>;
		};
		await scenario.render(<Component />);
		scenario.snapshot('settled');
	});
});

test('effects run child-first', async () => {
	await expectAgreement(async (scenario) => {
		const Child = () => {
			scenario.log('render child');
			useLayoutEffect(() => scenario.log('child layout'), []);
			useEffect(() => scenario.log('child passive'), []);
			return <i />;
		};
		const Parent = () => {
			scenario.log('render parent');
			useLayoutEffect(() => scenario.log('parent layout'), []);
			useEffect(() => scenario.log('parent passive'), []);
			return <Child />;
		};
		await scenario.render(<Parent />);
	});
});

test('effects run child-first across depth and siblings alike', async () => {
	await expectAgreement(async (scenario) => {
		const Leaf = ({ id }: { id: string }) => {
			tracked(scenario.log, id, []);
			return <i>{id}</i>;
		};
		const Branch = ({ id }: { id: string }) => {
			tracked(scenario.log, id, []);
			return (
				<div>
					<Leaf id={`${id}.1`} />
					<Leaf id={`${id}.2`} />
				</div>
			);
		};
		const Root = () => {
			tracked(scenario.log, 'root', []);
			return (
				<div>
					<Branch id="a" />
					<Branch id="b" />
				</div>
			);
		};
		await scenario.render(<Root />);
	});
});

test('a nested update commits its effects child-first too', async () => {
	await expectAgreement(async (scenario) => {
		const Child = ({ step }: { step: number }) => {
			tracked(scenario.log, `child ${step}`, [step]);
			return <i>{step}</i>;
		};
		const Parent = ({ step }: { step: number }) => {
			tracked(scenario.log, `parent ${step}`, [step]);
			return <Child step={step} />;
		};
		await scenario.render(<Parent step={1} />);
		scenario.log('--- update ---');
		await scenario.render(<Parent step={2} />);
	});
});

test('a deletion drains its layout cleanups before its passive ones', async () => {
	await expectAgreement(async (scenario) => {
		const Item = ({ id }: { id: string }) => {
			tracked(scenario.log, id, [id]);
			return <i>{id}</i>;
		};
		await scenario.render(
			<div>
				<Item id="a" />
				<Item id="b" />
			</div>,
		);
		scenario.log('--- unmount ---');
		await scenario.unmount();
	});
});

test('a removed subtree drains cleanups by kind across its depth', async () => {
	await expectAgreement(async (scenario) => {
		const Child = () => {
			tracked(scenario.log, 'child', []);
			return <i />;
		};
		const Parent = () => {
			tracked(scenario.log, 'parent', []);
			return <Child />;
		};
		const Host = ({ show }: { show: boolean }) => <div>{show ? <Parent /> : null}</div>;
		await scenario.render(<Host show />);
		scenario.log('--- remove ---');
		await scenario.render(<Host show={false} />);
	});
});

test('a keyed swap tears the old subtree down before the new one sets up', async () => {
	await expectAgreement(async (scenario) => {
		const Item = ({ id }: { id: string }) => {
			tracked(scenario.log, id, []);
			return <i>{id}</i>;
		};
		await scenario.render(
			<div>
				<Item key="a" id="a" />
			</div>,
		);
		scenario.log('--- swap ---');
		await scenario.render(
			<div>
				<Item key="b" id="b" />
			</div>,
		);
	});
});

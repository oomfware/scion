import { test } from 'vitest';

import { expectAgreement } from './support/differential.ts';
import { forwardRef, memo, useRef, useState } from './support/runtime.ts';

test('memo skips a re-render when props are shallow equal', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = memo(({ label }: { label: string }) => {
			scenario.log('inner rendered', label);
			return <i>{label}</i>;
		});
		const Host = ({ label, other }: { label: string; other: number }) => (
			<div data-other={other}>
				<Inner label={label} />
			</div>
		);
		await scenario.render(<Host label="a" other={1} />);
		scenario.log('--- unrelated prop changed ---');
		await scenario.render(<Host label="a" other={2} />);
		scenario.log('--- memoised prop changed ---');
		await scenario.render(<Host label="b" other={2} />);
	});
});

test('memo re-renders when a prop is added or removed', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = memo((props: { extra?: string; label: string }) => {
			scenario.log('inner rendered', JSON.stringify(props));
			return <i>{props.label}</i>;
		});
		await scenario.render(<Inner label="a" />);
		await scenario.render(<Inner label="a" extra="x" />);
		await scenario.render(<Inner label="a" />);
	});
});

test('memo compares own props independently of key order and prototype names', async () => {
	await expectAgreement(async (scenario) => {
		const inheritedToString: unknown = Reflect.get(Object.prototype, 'toString');
		const Inner = memo((props: { first?: number; second?: number; toString?: unknown }) => {
			scenario.log('inner rendered', Object.keys(props).join(','));
			return <i>{Object.keys(props).join(',')}</i>;
		});
		await scenario.render(<Inner first={1} second={2} />);
		await scenario.render(<Inner second={2} first={1} />);
		await scenario.render(<Inner toString={inheritedToString} />);
		await scenario.render(<Inner first={1} />);
	});
});

test('a custom memo comparator decides re-renders', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = memo(
			({ item }: { item: { id: number; label: string } }) => {
				scenario.log('inner rendered', item.label);
				return <i>{item.label}</i>;
			},
			(previous, next) => previous.item.id === next.item.id,
		);
		await scenario.render(<Inner item={{ id: 1, label: 'first' }} />);
		scenario.log('--- same id, new label ---');
		await scenario.render(<Inner item={{ id: 1, label: 'second' }} />);
		scenario.log('--- new id ---');
		await scenario.render(<Inner item={{ id: 2, label: 'third' }} />);
		scenario.snapshot('final');
	});
});

test('a memoised component still re-renders on its own state change', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = memo(() => {
			const [count, setCount] = useState(0);
			return <button onClick={() => setCount(count + 1)}>{count}</button>;
		});
		await scenario.render(<Inner />);
		await scenario.act(() => scenario.container.querySelector('button')!.click());
		scenario.snapshot('after own update');
	});
});

test('memo wrapping forwardRef forwards both props and ref', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = memo(
			forwardRef<HTMLElement, { label: string }>((props, ref) => {
				scenario.log('inner rendered', props.label);
				return (
					<i className="t" ref={ref}>
						{props.label}
					</i>
				);
			}),
		);
		const Host = ({ label, other }: { label: string; other: number }) => {
			const ref = useRef<HTMLElement>(null);
			return (
				<div data-other={other}>
					<Inner ref={ref} label={label} />
				</div>
			);
		};
		await scenario.render(<Host label="a" other={1} />);
		scenario.log('--- unrelated prop changed ---');
		await scenario.render(<Host label="a" other={2} />);
		scenario.snapshot('final');
	});
});

test('forwardRef with no ref supplied receives null', async () => {
	await expectAgreement(async (scenario) => {
		const Inner = forwardRef<HTMLElement, { label: string }>((props, ref) => {
			scenario.log('ref is null', String(ref === null));
			return <i>{props.label}</i>;
		});
		await scenario.render(<Inner label="a" />);
	});
});

test('a component returning null, a string or an array renders correctly', async () => {
	await expectAgreement(async (scenario) => {
		const Empty = () => null;
		const Text = () => 'bare text';
		const Many = () => [<i key="a">a</i>, <i key="b">b</i>];
		await scenario.render(
			<div>
				<Empty />
				<Text />
				<Many />
			</div>,
		);
		scenario.snapshot('mixed returns');
	});
});

test('a component rendering another component composes without extra nodes', async () => {
	await expectAgreement(async (scenario) => {
		const Leaf = ({ label }: { label: string }) => <i>{label}</i>;
		const Middle = ({ label }: { label: string }) => <Leaf label={label} />;
		const Outer = ({ label }: { label: string }) => <Middle label={label} />;
		await scenario.render(
			<div>
				<Outer label="deep" />
			</div>,
		);
		scenario.snapshot('composed');
	});
});

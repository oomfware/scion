import type * as react from 'react';
import * as Refresh from 'react-refresh/runtime';
import { expect, test } from 'vitest';

import {
	createRoot,
	ErrorBoundary as errorBoundaryType,
	flushSync,
	memo as scionMemo,
	Suspense as suspenseType,
	use,
	useEffect,
	useId,
	useMemo,
	useMemoCache,
	useRef,
	useState,
} from '../src/runtime.ts';

import { settleScion } from './support/harness.ts';

// jsx uses React's element types in this suite.
const memo = scionMemo as unknown as typeof react.memo;
const ErrorBoundary = errorBoundaryType as unknown as react.ElementType;
const Suspense = suspenseType as unknown as react.ElementType;

const MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');

// emulate the preamble and transform supplied by refresh-aware bundlers.
Refresh.injectIntoGlobalHook(globalThis);

interface HotModule {
	sign: (type?: any, key?: string, forceReset?: boolean, getCustomHooks?: () => any[]) => any;
	register: <Type>(type: Type, name: string) => Type;
}

// family IDs stay stable across edits and unique across tests.
const hotModule = (id: string): HotModule => ({
	sign: Refresh.createSignatureFunctionForTransform(),
	register: (type, name) => {
		Refresh.register(type, `${id} ${name}`);
		return type;
	},
});

const mount = (element: any) => {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	root.render(element);

	return { container, root };
};

test('an edit that leaves the hooks alone re-renders in place, and one that changes them remounts', () => {
	const id = '/counter.tsx';
	let setCount: ((value: number) => void) | undefined;

	const first = hotModule(id);
	const Counter = first.register(() => {
		first.sign();
		const [count, setCount_] = useState(0);
		setCount = setCount_;
		return <i>{`v1:${count}`}</i>;
	}, 'Counter');
	first.sign(Counter, 'useState{count}');

	const { container, root } = mount(<Counter />);
	try {
		flushSync(() => setCount?.(1));
		expect(container.innerHTML).toBe('<i>v1:1</i>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const [count, setCount_] = useState(0);
				setCount = setCount_;
				return <i>{`v2:${count}`}</i>;
			}, 'Counter');
			next.sign(Edited, 'useState{count}');
		}

		const updated = Refresh.performReactRefresh();

		expect(updated?.updatedFamilies.size).toBe(1);
		expect(updated?.staleFamilies.size).toBe(0);
		expect(container.innerHTML).toBe('<i>v2:1</i>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const [count, setCount_] = useState(0);
				useState('extra');
				setCount = setCount_;
				return <i>{`v3:${count}`}</i>;
			}, 'Counter');
			next.sign(Edited, 'useState{count}\nuseState{extra}');
		}

		const stale = Refresh.performReactRefresh();

		expect(stale?.updatedFamilies.size).toBe(0);
		expect(stale?.staleFamilies.size).toBe(1);
		expect(container.innerHTML).toBe('<i>v3:0</i>');
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh reaches a component nested below hosts and an untouched parent', async () => {
	const id = '/nested.tsx';
	const effects: string[] = [];
	let setOuter: ((value: number) => void) | undefined;
	let setLeaf: ((value: number) => void) | undefined;

	const first = hotModule(id);
	const Leaf = first.register(() => {
		first.sign();
		const [count, setCount] = useState(0);
		setLeaf = setCount;
		useEffect(() => {
			effects.push('mount-v1');
			return () => effects.push('cleanup-v1');
		}, []);
		return <b>{`leaf-v1:${count}`}</b>;
	}, 'Leaf');
	first.sign(Leaf, 'useState{count}\nuseEffect{}');

	// Parent keeps the original Leaf reference.
	const Parent = () => {
		const [outer, setOuter_] = useState(0);
		setOuter = setOuter_;
		return (
			<section>
				<span>{`parent:${outer}`}</span>
				<Leaf />
			</section>
		);
	};

	const { container, root } = mount(<Parent />);
	try {
		await settleScion();
		flushSync(() => setOuter?.(7));
		flushSync(() => setLeaf?.(3));
		expect(container.textContent).toBe('parent:7leaf-v1:3');
		const mountedNode = container.querySelector('b');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const [count, setCount] = useState(0);
				setLeaf = setCount;
				useEffect(() => {
					effects.push('mount-v2');
					return () => effects.push('cleanup-v2');
				}, []);
				return <b>{`leaf-v2:${count}`}</b>;
			}, 'Leaf');
			next.sign(Edited, 'useState{count}\nuseEffect{}');
		}

		Refresh.performReactRefresh();
		await settleScion();

		expect(container.textContent).toBe('parent:7leaf-v2:3');
		expect(container.querySelector('b')).toBe(mountedNode);
		expect(effects).toEqual(['mount-v1', 'cleanup-v1', 'mount-v2']);

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const [count] = useState(0);
				useState('extra');
				useEffect(() => {
					effects.push('mount-v3');
				}, []);
				return <b>{`leaf-v3:${count}`}</b>;
			}, 'Leaf');
			next.sign(Edited, 'useState{count}\nuseState{extra}\nuseEffect{}');
		}

		Refresh.performReactRefresh();
		await settleScion();

		expect(container.textContent).toBe('parent:7leaf-v3:0');
		expect(container.querySelector('b')).not.toBe(mountedNode);
		expect(effects).toEqual(['mount-v1', 'cleanup-v1', 'mount-v2', 'cleanup-v2', 'mount-v3']);
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh resolves a memo wrapper through its family', () => {
	const id = '/boxed.tsx';
	let setCount: ((value: number) => void) | undefined;

	const first = hotModule(id);
	const inner = first.sign(() => {
		first.sign();
		const [count, setCount_] = useState(0);
		setCount = setCount_;
		return <i>{`boxed-v1:${count}`}</i>;
	}, 'useState{count}');
	const Boxed = first.register(memo(inner), 'Boxed');

	const { container, root } = mount(<Boxed />);
	try {
		flushSync(() => setCount?.(2));
		expect(container.innerHTML).toBe('<i>boxed-v1:2</i>');

		{
			const next = hotModule(id);
			const edited = next.sign(() => {
				next.sign();
				const [count, setCount_] = useState(0);
				setCount = setCount_;
				return <i>{`boxed-v2:${count}`}</i>;
			}, 'useState{count}');
			next.register(memo(edited), 'Boxed');
		}

		Refresh.performReactRefresh();

		expect(container.innerHTML).toBe('<i>boxed-v2:2</i>');
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh reaches an implementation behind a wrapper from an unedited module', () => {
	const id = '/wrapped-inner.tsx';

	const first = hotModule(id);
	const Inner = first.register(() => {
		first.sign();
		const label = useMemo(() => 'memo-v1', []);
		return <i>{`inner-v1:${label}`}</i>;
	}, 'Inner');
	first.sign(Inner, 'useMemo{label}');

	const wrapper = hotModule('/wrapper.tsx');
	const Boxed = wrapper.register(memo(Inner), 'Boxed');

	const { container, root } = mount(<Boxed />);
	try {
		expect(container.innerHTML).toBe('<i>inner-v1:memo-v1</i>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const label = useMemo(() => 'memo-v2', []);
				return <i>{`inner-v2:${label}`}</i>;
			}, 'Inner');
			next.sign(Edited, 'useMemo{label}');
		}

		Refresh.performReactRefresh();

		expect(container.innerHTML).toBe('<i>inner-v2:memo-v2</i>');
	} finally {
		root.unmount();
		container.remove();
	}
});

// match the sentinel checks emitted by the React compiler.
test('a refresh empties the compiler memo cache, at the size the new implementation asks for', () => {
	const id = '/compiled.tsx';

	const first = hotModule(id);
	const Compiled = first.register(() => {
		first.sign();
		const $: any[] = useMemoCache(1);
		let element = $[0];
		if (element === MEMO_CACHE_SENTINEL) {
			element = $[0] = <i>v1</i>;
		}

		return element;
	}, 'Compiled');
	first.sign(Compiled, '');

	const { container, root } = mount(<Compiled />);
	try {
		expect(container.innerHTML).toBe('<i>v1</i>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const $: any[] = useMemoCache(1);
				let element = $[0];
				if (element === MEMO_CACHE_SENTINEL) {
					element = $[0] = <i>v2</i>;
				}

				return element;
			}, 'Compiled');
			next.sign(Edited, '');
		}

		Refresh.performReactRefresh();

		expect(container.innerHTML).toBe('<i>v2</i>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const $: any[] = useMemoCache(2);
				let inner = $[0];
				if (inner === MEMO_CACHE_SENTINEL) {
					inner = $[0] = <b>grown</b>;
				}
				let element = $[1];
				if (element === MEMO_CACHE_SENTINEL) {
					element = $[1] = <i>v3{inner}</i>;
				}

				return element;
			}, 'Compiled');
			next.sign(Edited, '');
		}

		Refresh.performReactRefresh();

		expect(container.innerHTML).toBe('<i>v3<b>grown</b></i>');
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh re-runs an effect whose dependencies did not change, and keeps refs and ids', async () => {
	const id = '/effects.tsx';
	const ran: string[] = [];
	let seenRef: { current: number | undefined } | undefined;
	let seenId: string | undefined;

	const first = hotModule(id);
	const Widget = first.register(() => {
		first.sign();
		const ref = useRef(1);
		seenRef = ref;
		seenId = useId();
		useEffect(() => {
			ran.push('v1');
		}, []);
		return <i>v1</i>;
	}, 'Widget');
	first.sign(Widget, 'useRef{}\nuseId{}\nuseEffect{}');

	const { container, root } = mount(<Widget />);
	try {
		await settleScion();
		expect(ran).toEqual(['v1']);
		const firstRef = seenRef;
		const firstId = seenId;

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const ref = useRef(1);
				seenRef = ref;
				seenId = useId();
				useEffect(() => {
					ran.push('v2');
				}, []);
				return <i>v2</i>;
			}, 'Widget');
			next.sign(Edited, 'useRef{}\nuseId{}\nuseEffect{}');
		}

		Refresh.performReactRefresh();
		await settleScion();

		expect(container.innerHTML).toBe('<i>v2</i>');
		expect(ran).toEqual(['v1', 'v2']);
		expect(seenRef).toBe(firstRef);
		expect(seenId).toBe(firstId);
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh retries an error boundary that a render-phase throw stalled', () => {
	const id = '/render-throw.tsx';

	const first = hotModule(id);
	const Child = first.register(() => {
		first.sign();
		throw new Error('boom-v1');
	}, 'Child');
	first.sign(Child, '');

	const { container, root } = mount(
		<ErrorBoundary fallback={(error: Error) => <b>{error.message}</b>}>
			<Child />
		</ErrorBoundary>,
	);
	try {
		expect(container.innerHTML).toBe('<b>boom-v1</b>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				return <i>child-v2</i>;
			}, 'Child');
			next.sign(Edited, '');
		}

		Refresh.performReactRefresh();

		expect(container.innerHTML).toBe('<i>child-v2</i>');
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh leaves an error boundary that caught nothing alone', () => {
	const id = '/healthy-boundary.tsx';
	let bump: (() => void) | undefined;

	const first = hotModule(id);
	const Child = first.register(() => {
		first.sign();
		const [count, setCount] = useState(0);
		bump = () => setCount(count + 1);
		return <i>{`v1:${count}`}</i>;
	}, 'Child');
	first.sign(Child, 'useState{count}');

	const { container, root } = mount(
		<ErrorBoundary fallback={<b>failed</b>}>
			<Child />
		</ErrorBoundary>,
	);
	try {
		flushSync(() => bump?.());
		expect(container.innerHTML).toBe('<i>v1:1</i>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				const [count, setCount] = useState(0);
				bump = () => setCount(count + 1);
				return <i>{`v2:${count}`}</i>;
			}, 'Child');
			next.sign(Edited, 'useState{count}');
		}

		Refresh.performReactRefresh();

		expect(container.innerHTML).toBe('<i>v2:1</i>');
	} finally {
		root.unmount();
		container.remove();
	}
});

test('a refresh retries a suspense boundary whose primary never settled', async () => {
	const id = '/never-settles.tsx';
	const pending = new Promise<string>(() => {});

	const first = hotModule(id);
	const Child = first.register(() => {
		first.sign();
		use(pending);
		return <i>child-v1</i>;
	}, 'Child');
	first.sign(Child, '');

	const { container, root } = mount(
		<section>
			<Suspense fallback={<b>loading</b>}>
				<Child />
			</Suspense>
		</section>,
	);
	try {
		await settleScion();
		expect(container.innerHTML).toBe('<section><b>loading</b></section>');

		{
			const next = hotModule(id);
			const Edited = next.register(() => {
				next.sign();
				return <i>child-v2</i>;
			}, 'Child');
			next.sign(Edited, '');
		}

		Refresh.performReactRefresh();
		await settleScion();

		expect(container.innerHTML).toBe('<section><i>child-v2</i></section>');
	} finally {
		root.unmount();
		container.remove();
	}
});

test('react-refresh stops tracking a root once it unmounts', () => {
	const before = Refresh._getMountedRootCount();

	const id = '/tracked.tsx';
	const module = hotModule(id);
	const Widget = module.register(() => <i>tracked</i>, 'Widget');

	const { container, root } = mount(<Widget />);
	expect(Refresh._getMountedRootCount()).toBe(before + 1);

	root.unmount();
	container.remove();

	expect(Refresh._getMountedRootCount()).toBe(before);
});

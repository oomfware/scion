import { DEV } from 'esm-env';

// #region types

type Key = string | null;
type Props = Record<string, any>;
type Child = VNode | string;
type HostContainer = Element | DocumentFragment;

const enum EffectKind {
	Insertion,
	Layout,
	Passive,
}

// commit work runs queue by queue, in declaration order.
const enum CommitQueue {
	LayoutCleanup,
	RefDetach,
	Removal,
	RefAttach,
	AutoFocus,
	PassiveCleanup,
	Count,
}

const enum HookKind {
	Effect,
	Memo,
	MemoCache,
	State,
	Store,
}

const enum FiberKind {
	Activity,
	Component,
	ErrorBoundary,
	Fragment,
	Host,
	Portal,
	Provider,
	Suspense,
	Text,
}

const fiberKindNames = [
	'activity',
	'component',
	'error-boundary',
	'fragment',
	'host',
	'portal',
	'provider',
	'suspense',
	'text',
];

const fiberKindName = (kind: FiberKind): string => fiberKindNames[kind];

const enum FiberFlag {
	Empty = 0,
	ForceUpdate = 1 << 0,
	Hidden = 1 << 1,
	RenderPhaseUpdate = 1 << 2,
	Queued = 1 << 3,
	// a descendant carries ForceUpdate, so this fiber cannot bail out.
	SubtreeDirty = 1 << 4,
	Unmounted = 1 << 5,
}

const enum UpdateFiber {
	Empty = 0,
	Forced = 1 << 0,
	Mounting = 1 << 1,
}

interface VNode {
	$$typeof: symbol;
	key: Key;
	props: Props;
	ref: any;
	type: any;
}

// hooks form a linked list in call order.
interface HookLink {
	next: Hook | null;
}

// one link per useContext call, in call order, naming the provider it read from.
interface ContextLink {
	next: ContextLink | null;
	provider: Fiber | null;
}

type Reducer<State, Action> = (state: State, action: Action) => State;
type SetStateAction<State> = State | ((previous: State) => State);
type LazyInitial<State> = State | (() => State);

interface StateHook extends HookLink {
	kind: HookKind.State;
	dispatch: (action: any) => void;
	// value before the pending updates.
	pending?: { previousValue: any };
	reducer: Reducer<any, any>;
	value: any;
}

interface EffectHook extends HookLink {
	kind: HookKind.Effect;
	cleanup?: () => void;
	deps?: ReadonlyArray<unknown>;
	effect: () => void | (() => void);
	effectKind: EffectKind;
}

interface MemoHook extends HookLink {
	kind: HookKind.Memo;
	deps?: ReadonlyArray<unknown>;
	value: any;
}

// separate from memo hooks so fast refresh can clear all compiler caches.
interface MemoCacheHook extends HookLink {
	kind: HookKind.MemoCache;
	value: unknown[];
}

interface StoreHook extends HookLink {
	kind: HookKind.Store;
	getSnapshot: () => any;
	value: any;
}

type Hook = EffectHook | MemoCacheHook | MemoHook | StateHook | StoreHook;

type InnerFiberKind = Exclude<FiberKind, FiberKind.Host | FiberKind.Text>;

interface HandlerRecord {
	attachedAt: number;
	handler: (event: ScionEvent) => void;
}

interface ScionExpandos {
	__scionFiber?: Fiber;
	[key: `__scion$${string}`]: HandlerRecord | undefined;
}

interface HostElementProps {
	checked?: boolean;
	defaultChecked?: boolean;
	defaultValue?: string;
	muted?: boolean;
	selected?: boolean;
	value?: string;
}

// react-shaped additions to native events.
interface ScionEvent extends Event {
	__scionDispatch?: number;
	__scionPortalInvoked?: { bubble?: Set<Fiber>; capture?: Set<Fiber> };
	isDefaultPrevented?: () => boolean;
	isPropagationStopped?: () => boolean;
	nativeEvent?: Event;
	persist?: () => void;
}

type HostElement = (HTMLElement | SVGElement) & HostElementProps & ScionExpandos;

interface FiberBase<
	Kind extends FiberKind = FiberKind,
	NodeType extends HostElement | Text | null = HostElement | Text | null,
> {
	children: Fiber[];
	// distance from the root, so pending work can render shallowest first.
	depth: number;
	firstHost: Node | null;
	index: number;
	key: Key;
	kind: Kind;
	node: NodeType;
	parent: Fiber | null;
	root: Root;
	slot: number;

	props: Props;
	// text fibers keep their string here; every other kind keeps its element type.
	type: any;

	// reconcile pass that most recently claimed this fiber.
	pass: number;
	flags: FiberFlag;

	contexts: ContextLink | null;
	// fibers that read this provider's value, on provider fibers only.
	consumers: Set<Fiber> | null;
	hooks: Hook | null;

	caughtError: { value: unknown } | undefined;
	portalEnd: Comment | undefined;
	portalStart: Comment | undefined;
	refCleanup: (() => void) | undefined;
	// cached to preserve the reset callback identity.
	resetError: (() => void) | undefined;
}

type HostFiber = FiberBase<FiberKind.Host, HostElement>;

type TextFiber = FiberBase<FiberKind.Text, Text>;

type InnerFiber = FiberBase<InnerFiberKind, null>;

type Fiber = HostFiber | InnerFiber | TextFiber;

interface PendingEffect {
	// snapshot for passive effects that run after a later render.
	effect: () => void | (() => void);
	fiber: Fiber;
	hook: EffectHook;
	kind: EffectKind;
	next: PendingEffect | null;
}

interface Root {
	container: Element | DocumentFragment;
	current?: { alternate: { memoizedState: { element: any } }; memoizedState: Root };
	element: any;
	fibers: Fiber[];
	hidden: Set<Fiber>;

	// consecutive renders scheduled by root work.
	cascadeDepth: number;
	cascadeScheduled: boolean;
	// set before teardown begins, so work reentered from a cleanup cannot revive this root.
	disposed: boolean;
	dirty: Fiber[];
	fullRender: boolean;
	scheduled: boolean;
	scheduleReason?: string;

	effects: PendingEffect | null;
	effectsTail: PendingEffect | null;
	// deferred commit work, indexed by `CommitQueue`.
	queues: Array<Array<() => void>>;

	// portal targets already bridged, and the teardown for every listener placed on them.
	portalTargets: Set<EventTarget>;
	portalEvents: Set<string>;
	portalCleanups: Array<() => void>;

	id?: number;
	nextId: number;
	onCaughtError?: (error: unknown) => void;
	onUncaughtError?: (error: unknown) => void;
}

// react records a thenable's outcome on the thenable itself, so a cache that already
// settled one reads back synchronously. the expandos are that shared convention.
interface TrackedThenable<Value> extends PromiseLike<Value> {
	reason?: unknown;
	status?: 'fulfilled' | 'pending' | 'rejected';
	value?: Value;
}

interface RefreshUpdate {
	staleFamilies: Set<unknown>;
	updatedFamilies: Set<unknown>;
}

interface Context<T> {
	$$typeof: symbol;
	Consumer: any;
	Provider: any;
	// innermost provider currently on the render stack, or null for the default value.
	currentProvider: Fiber | null;
	currentValue: T;
	_defaultValue: T;
}

// #endregion

// #region constants and state

export const version = '19.2.8-scion';

const ACTIVITY = Symbol.for('react.activity');
const CONTEXT = Symbol.for('react.context');
const ELEMENT = Symbol.for('react.transitional.element');
const ERROR_BOUNDARY = Symbol.for('scion.error-boundary');
const FORWARD_REF = Symbol.for('react.forward_ref');
const FRAGMENT = Symbol.for('react.fragment');
const LAZY = Symbol.for('react.lazy');
const MEMO = Symbol.for('react.memo');
const MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const PORTAL = Symbol.for('react.portal');
const PROVIDER = Symbol.for('react.provider');
const STRICT_MODE = Symbol.for('react.strict_mode');
const SUSPENSE = Symbol.for('react.suspense');

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SUPPORTS_MOVE_BEFORE = typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;

let dirtyRoots: Root[] = [];
const roots = new Set<Root>();

const childBuffers: Array<Array<Child | boolean | null>> = [];
const EMPTY_CHILDREN: Fiber[] = [];
// stands in for a fiber's props until its first update; never mutated.
const EMPTY_PROPS: Props = {};
const effectRestores: Array<{
	deps?: ReadonlyArray<unknown>;
	effect: () => void | (() => void);
	effectKind: EffectKind;
	hook: EffectHook;
}> = [];

let currentFiber: Fiber | null = null;
let currentContext: ContextLink | null = null;
let currentHook: Hook | null = null;

let reconcileDepth = 0;
let reconcilePass = 0;

let batching = 0;
let flushing = false;
let passiveScheduled = false;
let synchronousEffects = 0;
// root whose render, commit, or effect flush is active.
let renderingRoot: Root | null = null;
let transitionScheduled = false;

let familyResolver: ((type: any) => { current: any } | undefined) | null = null;
let refreshInstallScheduled = false;
let rendererId: number | undefined;

// #endregion

// #region fibers

const createFiberNode = <Kind extends FiberKind, NodeType extends HostElement | Text | null>(
	kind: Kind,
	node: NodeType,
	parent: Fiber | null,
	value: Child,
	root: Root,
	type: any,
): FiberBase<Kind, NodeType> => {
	return {
		children: EMPTY_CHILDREN,
		pass: 0,
		consumers: null,
		contexts: null,
		caughtError: undefined,
		depth: parent ? parent.depth + 1 : 0,
		firstHost: node,
		flags: FiberFlag.Empty,
		hooks: null,
		index: 0,
		key: typeof value === 'string' ? null : value.key,
		kind,
		node,
		parent,
		portalEnd: undefined,
		portalStart: undefined,
		props: EMPTY_PROPS,
		refCleanup: undefined,
		resetError: undefined,
		root,
		slot: 0,
		type,
	};
};

// mark the path to the root so no ancestor can bail out before reaching this fiber.
const markDirtyPath = (fiber: Fiber) => {
	for (let parent = fiber.parent; parent !== null; parent = parent.parent) {
		if ((parent.flags & FiberFlag.SubtreeDirty) !== 0) {
			return;
		}
		parent.flags |= FiberFlag.SubtreeDirty;
	}
};

// force this fiber to render on the next pass, whatever its props do.
const markForceUpdate = (fiber: Fiber) => {
	fiber.flags |= FiberFlag.ForceUpdate;
	markDirtyPath(fiber);
};

const isUnmounted = (fiber: Fiber): boolean => (fiber.flags & FiberFlag.Unmounted) !== 0;

// #endregion

// #region elements

export const Activity = ACTIVITY;
export const ErrorBoundary = ERROR_BOUNDARY;
export const Fragment = FRAGMENT;
export const StrictMode = STRICT_MODE;
export const Suspense = SUSPENSE;

const assignChildren = (props: Props, children: any[]) => {
	if (children.length === 1) {
		props.children = children[0];
	} else if (children.length > 1) {
		props.children = children;
	}
};

const assignPropsWithoutKey = (target: Props, source: Props) => {
	const prototype = Object.getPrototypeOf(source);
	const plain = prototype === null || prototype === Object.prototype;
	for (const name in source) {
		if (name !== 'key' && (plain || Object.hasOwn(source, name))) {
			target[name] = source[name];
		}
	}

	return target;
};

const copyPropsWithoutKey = (source: Props): Props => {
	if (!Object.hasOwn(source, 'key')) {
		return { ...source };
	}

	return assignPropsWithoutKey({}, source);
};

export const createElement = (type: any, config: Props | null, ...children: any[]): VNode => {
	const props = config ? copyPropsWithoutKey(config) : {};
	assignChildren(props, children);

	return createVNode(type, props, config?.key);
};

export const createVNode = (type: any, props: Props, keyValue?: string | number | bigint | null): VNode => {
	const key = keyValue == null ? null : String(keyValue);
	return {
		$$typeof: ELEMENT,
		key,
		props,
		ref: props.ref ?? null,
		type,
	};
};

export const cloneElement = (element: VNode, config?: Props | null, ...children: any[]): VNode => {
	if (!isValidElement(element)) {
		throw new Error('cloneElement expected a valid element.');
	}

	const props: Props = { ...element.props };
	if (config) {
		assignPropsWithoutKey(props, config);
	}

	const key = config?.key == null ? element.key : config.key;
	assignChildren(props, children);

	return createVNode(element.type, props, key);
};

export const isValidElement = (value: any): value is VNode => {
	return Boolean(value && typeof value === 'object' && value.$$typeof === ELEMENT);
};

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const createRef = <T>(): { current: T | null } => ({ current: null });

export const forwardRef = (render: (props: Props, ref: any) => any) => ({
	$$typeof: FORWARD_REF,
	render,
});

export const memo = (type: any, compare?: (previous: Props, next: Props) => boolean) => ({
	$$typeof: MEMO,
	compare,
	type,
});

export const lazy = (load: () => Promise<{ default: any }>) => {
	const type = {
		$$typeof: LAZY,
		_load: load,
		_status: 'uninitialized',
		_value: undefined,
	};
	return Object.assign(type, {
		_init: resolveLazy,
		_payload: type,
	});
};

export const createContext = <T>(defaultValue: T): Context<T> => {
	// both fields close over the context under construction.
	const context: Context<T> = {
		$$typeof: CONTEXT,
		Consumer: null,
		Provider: null,
		currentProvider: null,
		currentValue: defaultValue,
		_defaultValue: defaultValue,
	};
	context.Provider = { $$typeof: PROVIDER, _context: context };
	context.Consumer = (props: Props) => props.children(useContext(context));
	return context;
};

// #endregion

// #region hooks

const isHookKind = <Kind extends Hook['kind']>(
	hook: Hook,
	kind: Kind,
): hook is Extract<Hook, { kind: Kind }> => hook.kind === kind;

const nextHook = <Kind extends Hook['kind']>(kind: Kind): Extract<Hook, { kind: Kind }> | undefined => {
	if (!currentFiber) {
		throw new Error('hooks can only run while rendering a function component.');
	}
	const hook = currentHook ? currentHook.next : currentFiber.hooks;
	if (!hook) {
		return undefined;
	}
	if (!isHookKind(hook, kind)) {
		throw new Error('rendered a different hook than on the previous render.');
	}
	currentHook = hook;
	return hook;
};

const pushHook = <New extends Hook>(hook: New): New => {
	if (currentHook) {
		currentHook.next = hook;
	} else {
		currentFiber!.hooks = hook;
	}
	currentHook = hook;
	return hook;
};

const truncateHooks = (fiber: Fiber, tail: Hook | null) => {
	let removed: Hook | null;
	if (tail) {
		removed = tail.next;
		tail.next = null;
	} else {
		removed = fiber.hooks;
		fiber.hooks = null;
	}
	while (removed) {
		if (removed.kind === HookKind.Effect) {
			removed.cleanup?.();
		}
		removed = removed.next;
	}
};

const depsEqual = (previous?: ReadonlyArray<unknown>, next?: ReadonlyArray<unknown>): boolean => {
	if (previous === undefined || next === undefined) {
		return false;
	}
	if (previous === next) {
		return true;
	}
	if (previous.length !== next.length) {
		return false;
	}
	for (let index = 0; index < previous.length; index++) {
		if (!Object.is(previous[index], next[index])) {
			return false;
		}
	}
	return true;
};

const shallowEqual = (previous: Props, next: Props): boolean => {
	if (!Object.is(previous.children, next.children)) {
		return false;
	}

	const previousKeys = Object.keys(previous);
	const nextKeys = Object.keys(next);
	if (previousKeys.length !== nextKeys.length) {
		return false;
	}

	for (let index = 0; index < previousKeys.length; index++) {
		const key = previousKeys[index];
		if (!Object.is(previous[key], next[key]) || (key !== nextKeys[index] && !Object.hasOwn(next, key))) {
			return false;
		}
	}

	return true;
};

const subscribeContext = (fiber: Fiber, provider: Fiber | null) => {
	if (provider) {
		(provider.consumers ??= new Set()).add(fiber);
	}
};

const unsubscribeContexts = (fiber: Fiber, link: ContextLink | null) => {
	for (; link; link = link.next) {
		link.provider?.consumers?.delete(fiber);
	}
};

// a changed provider value reaches its readers directly, without scanning the subtree.
const notifyConsumers = (provider: Fiber) => {
	const consumers = provider.consumers;
	if (!consumers) {
		return;
	}
	for (const consumer of consumers) {
		if (isUnmounted(consumer)) {
			consumers.delete(consumer);
		} else {
			markForceUpdate(consumer);
		}
	}
};

const createStateHook = (fiber: Fiber, value: any, reducer: Reducer<any, any>): StateHook => {
	const hook: StateHook = {
		kind: HookKind.State,
		dispatch(action: any) {
			if (isUnmounted(fiber)) {
				return;
			}

			const next = hook.reducer(hook.value, action);
			if (Object.is(next, hook.value)) {
				return;
			}

			hook.pending ??= { previousValue: hook.value };
			hook.value = next;
			if (fiber === currentFiber) {
				fiber.flags |= FiberFlag.RenderPhaseUpdate;
			} else {
				scheduleFiber(fiber);
			}
		},
		next: null,
		reducer,
		value,
	};

	return hook;
};

export const useReducer = <State, Action>(
	reducer: Reducer<State, Action>,
	initialArg: any,
	initialize?: (value: any) => State,
): [State, (action: Action) => void] => {
	let hook = nextHook(HookKind.State);

	if (hook === undefined) {
		hook = pushHook(
			createStateHook(currentFiber!, initialize ? initialize(initialArg) : initialArg, reducer),
		);
	}

	hook.reducer = reducer;
	hook.pending = undefined;

	return [hook.value, hook.dispatch];
};

const isUpdater = <State>(action: SetStateAction<State>): action is (previous: State) => State => {
	return typeof action === 'function';
};

const basicStateReducer = <State>(previous: State, action: SetStateAction<State>): State => {
	return isUpdater(action) ? action(previous) : action;
};

const isLazy = <State>(initial: LazyInitial<State>): initial is () => State => {
	return typeof initial === 'function';
};

const resolveInitialState = <State>(initial: LazyInitial<State>): State => {
	return isLazy(initial) ? initial() : initial;
};

export const useState = <State>(initial: LazyInitial<State>) => {
	return useReducer<State, SetStateAction<State>>(basicStateReducer, initial, resolveInitialState);
};

const useEffectKind = (
	kind: EffectKind,
	effect: () => void | (() => void),
	deps?: ReadonlyArray<unknown>,
) => {
	const fiber = currentFiber!;
	const existing = nextHook(HookKind.Effect);
	if (existing && depsEqual(existing.deps, deps)) {
		return;
	}
	const hook =
		existing ?? pushHook<EffectHook>({ kind: HookKind.Effect, effect, effectKind: kind, next: null });
	// save values before a render-phase update can discard this attempt.
	effectRestores.push({
		deps: existing?.deps,
		effect: hook.effect,
		effectKind: hook.effectKind,
		hook,
	});
	hook.deps = deps;
	hook.effect = effect;
	hook.effectKind = kind;
	if (!isDeactivated(fiber)) {
		queueEffect(fiber, hook);
	}
};

export const useEffect = (effect: () => void | (() => void), deps?: ReadonlyArray<unknown>) => {
	useEffectKind(EffectKind.Passive, effect, deps);
};

export const useLayoutEffect = (effect: () => void | (() => void), deps?: ReadonlyArray<unknown>) => {
	useEffectKind(EffectKind.Layout, effect, deps);
};

export const useInsertionEffect = (effect: () => void | (() => void), deps?: ReadonlyArray<unknown>) => {
	useEffectKind(EffectKind.Insertion, effect, deps);
};

export const useRef = <Value>(initial?: Value): { current: Value | undefined } => {
	const hook =
		nextHook(HookKind.Memo) ??
		pushHook<MemoHook>({ kind: HookKind.Memo, next: null, value: { current: initial } });

	return hook.value;
};

const newMemoCache = (size: number): unknown[] => Array.from({ length: size }, () => MEMO_CACHE_SENTINEL);

export const useMemoCache = (size: number): unknown[] => {
	let hook = nextHook(HookKind.MemoCache);

	if (hook === undefined) {
		hook = pushHook({
			kind: HookKind.MemoCache,
			next: null,
			value: newMemoCache(size),
		});
	} else if (hook.value.length !== size) {
		hook.value = newMemoCache(size);
	}

	return hook.value;
};

export const useMemo = <Value>(factory: () => Value, deps?: ReadonlyArray<unknown>): Value => {
	let hook = nextHook(HookKind.Memo);

	if (hook === undefined) {
		hook = pushHook({
			kind: HookKind.Memo,
			deps,
			next: null,
			value: factory(),
		});
	} else if (!depsEqual(hook.deps, deps)) {
		hook.deps = deps;
		hook.value = factory();
	}

	return hook.value;
};

export const useCallback = <Callback extends (...args: any[]) => any>(
	callback: Callback,
	deps?: ReadonlyArray<unknown>,
): Callback => {
	return useMemo(() => callback, deps);
};

export const useContext = <T>(context: Context<T>): T => {
	const fiber = currentFiber;
	if (fiber) {
		const provider = context.currentProvider;
		let link = currentContext ? currentContext.next : fiber.contexts;
		if (link) {
			if (link.provider !== provider) {
				link.provider?.consumers?.delete(fiber);
				link.provider = provider;
				subscribeContext(fiber, provider);
			}
		} else {
			link = { next: null, provider };
			subscribeContext(fiber, provider);
			if (currentContext) {
				currentContext.next = link;
			} else {
				fiber.contexts = link;
			}
		}
		currentContext = link;
	}
	return context.currentValue;
};

const isContext = <T>(resource: PromiseLike<T> | Context<T>): resource is Context<T> => {
	return '$$typeof' in resource && resource.$$typeof === CONTEXT;
};

export const use = <T>(resource: PromiseLike<T> | Context<T>): T => {
	if (isContext(resource)) {
		return useContext(resource);
	}

	return readThenable(resource);
};

export const useImperativeHandle = (ref: any, create: () => any, deps?: ReadonlyArray<unknown>) => {
	const effectDeps = deps === undefined ? undefined : [...deps, ref];

	useLayoutEffect(() => {
		if (!ref) {
			return undefined;
		}
		return setRef(ref, create());
	}, effectDeps);
};

export const useId = (): string => {
	const hook =
		nextHook(HookKind.Memo) ??
		pushHook<MemoHook>({
			kind: HookKind.Memo,
			next: null,
			value: `:r${currentFiber!.root.nextId++}:`,
		});

	return hook.value;
};

export const useSyncExternalStore = <Snapshot>(
	subscribe: (notify: () => void) => () => void,
	getSnapshot: () => Snapshot,
): Snapshot => {
	const fiber = currentFiber!;

	const hook =
		nextHook(HookKind.Store) ??
		pushHook<StoreHook>({
			kind: HookKind.Store,
			getSnapshot,
			next: null,
			value: undefined,
		});

	hook.getSnapshot = getSnapshot;
	hook.value = getSnapshot();

	useLayoutEffect(() => {
		const notify = () => {
			const value = hook.getSnapshot();
			if (!Object.is(value, hook.value)) {
				hook.value = value;
				fiber.flags |= FiberFlag.ForceUpdate;
				scheduleFiber(fiber);
			}
		};

		const unsubscribe = subscribe(notify);
		notify();

		return unsubscribe;
	}, [subscribe]);

	return hook.value;
};

export const useEffectEvent = <Args extends unknown[], Return>(callback: (...args: Args) => Return) => {
	const ref = useRef(callback);
	ref.current = callback;

	return (...args: Args): Return => {
		if (currentFiber) {
			throw new Error("a function wrapped in useEffectEvent can't be called during rendering.");
		}
		return ref.current!(...args);
	};
};

export const useDebugValue = (_value: unknown, _format?: (value: unknown) => unknown) => {};

export const startTransition = (callback: () => void) => {
	batching++;
	try {
		callback();
	} finally {
		batching--;
	}
	if (transitionScheduled) {
		return;
	}
	transitionScheduled = true;
	setTimeout(() => {
		transitionScheduled = false;
		flushRoots();
	}, 0);
};

// #endregion

// #region children and roots

export const Children = {
	count(children: any) {
		let count = 0;
		mapChildren(children, () => {
			count++;
		});
		return count;
	},
	forEach(children: any, callback: (child: any, index: number) => void, context?: any) {
		mapChildren(children, (child, index) => {
			callback.call(context, child, index);
		});
	},
	map(children: any, callback: (child: any, index: number) => any, context?: any) {
		return mapChildren(children, (child, index) => callback.call(context, child, index));
	},
	only(children: any) {
		if (!isValidElement(children)) {
			throw new Error('Children.only expected one element.');
		}
		return children;
	},
	toArray(children: any) {
		return mapChildren(children, (child) => child) ?? [];
	},
};

export const createPortal = (
	children: any,
	container: Element | DocumentFragment,
	key?: null | string,
): VNode => {
	return createVNode(PORTAL, { children, container }, key);
};

export const createRoot = (
	container: Element | DocumentFragment,
	options: { onCaughtError?: (error: unknown) => void; onUncaughtError?: (error: unknown) => void } = {},
) => {
	if (DEV) {
		installRefreshBridge();
	}

	const root: Root = {
		cascadeDepth: 0,
		cascadeScheduled: false,
		container,
		dirty: [],
		disposed: false,
		effects: null,
		effectsTail: null,
		element: null,
		fibers: [],
		fullRender: false,
		hidden: new Set(),
		nextId: 0,
		onCaughtError: options.onCaughtError,
		onUncaughtError: options.onUncaughtError,
		portalCleanups: [],
		portalEvents: new Set(),
		portalTargets: new Set(),
		queues: newCommitQueues(),
		scheduled: false,
	};
	if (DEV) {
		root.id = rendererId ?? -1;
		root.current = { alternate: { memoizedState: { element: true } }, memoizedState: root };
		roots.add(root);
		scheduleRefreshBridge();
	}

	return {
		render(element: any) {
			if (root.disposed) {
				if (DEV) {
					console.error('scion ignored a render on an unmounted root.');
				}

				return;
			}
			root.element = element;
			renderRoot(root);
		},
		unmount() {
			if (root.disposed) {
				return;
			}

			root.disposed = true;
			root.queues = newCommitQueues();
			for (const fiber of root.fibers) {
				unmountFiber(fiber);
			}
			// the attach queues target nodes that are going away, so only teardown work runs.
			runQueue(root.queues[CommitQueue.LayoutCleanup]);
			runQueue(root.queues[CommitQueue.RefDetach]);
			runQueue(root.queues[CommitQueue.Removal]);
			runQueue(root.queues[CommitQueue.PassiveCleanup]);
			root.queues = newCommitQueues();
			root.fibers = [];
			root.hidden.clear();
			// release references held by pending work.
			discardDirtyFibers(root);
			root.scheduled = false;
			runQueue(root.portalCleanups);
			root.portalTargets.clear();
			root.portalEvents.clear();
			if (DEV) {
				root.element = null;
				getDevtoolsHook()?.onCommitFiberRoot?.(root.id, root, null, false);
				roots.delete(root);
			}
		},
	};
};

export const flushSync = <Value>(callback: () => Value): Value => {
	batching++;
	synchronousEffects++;
	try {
		return callback();
	} finally {
		batching--;
		try {
			flushRoots();
		} finally {
			synchronousEffects--;
		}
	}
};

// #endregion

// #region scheduling

const scheduleFiber = (fiber: Fiber) => {
	if (isUnmounted(fiber)) {
		return;
	}
	// a full render still bails out on unchanged subtrees, so mark the path either way.
	markDirtyPath(fiber);
	if ((fiber.flags & FiberFlag.Queued) === 0) {
		fiber.flags |= FiberFlag.Queued;
		fiber.root.dirty.push(fiber);
	}
	scheduleRootWork(fiber.root, fiber);
};

const scheduleRootWork = (root: Root, fiber: Fiber) => {
	// work scheduled by active root work extends its cascade.
	if (renderingRoot === root) {
		root.cascadeScheduled = true;
		if (DEV) {
			root.scheduleReason = describeFiber(fiber);
		}
	}
	if (root.scheduled) {
		return;
	}
	root.scheduled = true;
	dirtyRoots.push(root);
	if (batching === 0) {
		queueMicrotask(flushRoots);
	}
};

const flushRoots = () => {
	if (flushing) {
		return;
	}
	flushing = true;
	try {
		// use a snapshot because a render can reschedule its root.
		const pending = dirtyRoots;
		dirtyRoots = [];
		for (const root of pending) {
			if (!root.scheduled) {
				continue;
			}
			root.scheduled = false;
			if (root.fullRender) {
				root.fullRender = false;
				// renderRoot consumes the queue; discarding it would drop those updates.
				renderRoot(root);
			} else {
				renderDirtyFibers(root);
			}
		}
	} finally {
		flushing = false;
	}
};

const newCommitQueues = (): Array<Array<() => void>> => Array.from({ length: CommitQueue.Count }, () => []);

// every commit drains its queues, so the next pass always starts from empty ones.
const runQueue = (queue: Array<() => void>) => {
	for (const run of queue) {
		run();
	}
	queue.length = 0;
};

const beginRenderPass = (root: Root): Root | null => {
	root.effects = null;
	root.effectsTail = null;
	const previous = renderingRoot;
	renderingRoot = root;
	return previous;
};

const renderRoot = (root: Root) => {
	if (!beginRender(root)) {
		return;
	}
	const previousRoot = beginRenderPass(root);
	try {
		const pending = root.dirty;
		root.dirty = [];
		for (const fiber of pending) {
			fiber.flags &= ~FiberFlag.Queued;
			// a pass that ran since this fiber was queued may have cleared the path to it.
			if (consumeFiberUpdate(fiber)) {
				markDirtyPath(fiber);
			}
		}
		const hook = DEV ? getDevtoolsHook() : undefined;
		hook?.onScheduleFiberRoot?.(root.id, root, root.element);

		let failed = false;
		try {
			root.fibers = reconcileChildren(null, root.fibers, root.element, root.container, null, root);
		} catch (error) {
			failed = true;
			root.onUncaughtError?.(error);
			console.error(error);
		}

		commitRoot(root, failed);
	} finally {
		renderingRoot = previousRoot;
	}
};

// match React's nested update limit.
const CASCADE_LIMIT = 50;

const beginRender = (root: Root): boolean => {
	// external renders start a new cascade.
	root.cascadeDepth = root.cascadeScheduled ? root.cascadeDepth + 1 : 0;
	root.cascadeScheduled = false;
	if (root.cascadeDepth <= CASCADE_LIMIT) {
		return true;
	}
	root.scheduled = false;
	if (DEV) {
		console.error('scion stopped an update loop.', root.scheduleReason);
	}

	return false;
};

const renderDirtyFibers = (root: Root) => {
	if (!beginRender(root)) {
		discardDirtyFibers(root);
		return;
	}
	const previousRoot = beginRenderPass(root);

	try {
		const hook = DEV ? getDevtoolsHook() : undefined;
		hook?.onScheduleFiberRoot?.(root.id, root, root.element);
		let failed = false;
		const targets = root.dirty;
		root.dirty = [];
		let targetCount = 0;
		for (const fiber of targets) {
			fiber.flags &= ~FiberFlag.Queued;
			if (consumeFiberUpdate(fiber)) {
				targets[targetCount++] = fiber;
			}
		}

		targets.length = targetCount;

		// shallowest first, so an ancestor's render reaches its dirty descendants itself.
		if (targetCount > 1) {
			targets.sort(byDepth);
		}

		for (const fiber of targets) {
			// skip fibers an earlier target already rendered, and those it removed.
			if ((fiber.flags & FiberFlag.ForceUpdate) === 0 || isUnmounted(fiber)) {
				continue;
			}

			fiber.flags &= ~FiberFlag.ForceUpdate;

			try {
				rerenderFiber(fiber);
			} catch (error) {
				const boundary = findUpdateBoundary(fiber, error);
				if (boundary) {
					rerenderFiber(boundary);
				} else {
					failed = true;
					root.onUncaughtError?.(error);
					console.error(error);
				}
			}
		}

		commitRoot(root, failed);
	} finally {
		renderingRoot = previousRoot;
	}
};

const commitRoot = (root: Root, failed: boolean) => {
	const hook = DEV ? getDevtoolsHook() : undefined;
	hook?.onCommitFiberRoot?.(root.id, root, null, failed);
	const queues = root.queues;
	runQueue(queues[CommitQueue.LayoutCleanup]);
	runEffects(root.effects, EffectKind.Insertion);
	runQueue(queues[CommitQueue.RefDetach]);
	runQueue(queues[CommitQueue.Removal]);
	// a hidden render can add visible nodes, so hide them after DOM changes settle.
	for (const activity of root.hidden) {
		hideChildren(activity);
	}
	runQueue(queues[CommitQueue.RefAttach]);
	runQueue(queues[CommitQueue.AutoFocus]);
	runEffects(root.effects, EffectKind.Layout);
	flushPassiveEffects(root, synchronousEffects > 0);
};

// #endregion

// #region reconciliation

// marks a child that keeps its DOM position, so only its siblings have to move.
const STABLE_CHILD = -1;

// null, empty strings, and booleans render nothing, so they claim no fiber and no slot.
const isRenderableChild = (value: Child | boolean | null | undefined): value is Child =>
	value != null && value !== '' && typeof value !== 'boolean';

const childKeyOf = (value: Child): Key => (typeof value === 'string' ? null : value.key);

// advance past fibers an earlier child already claimed this pass.
const skipClaimed = (previous: Fiber[], scan: number, pass: number): number => {
	while (scan < previous.length && previous[scan].pass === pass) {
		scan++;
	}

	return scan;
};

const matchesInOrder = (candidate: Fiber | undefined, value: Child, key: Key, index: number): boolean =>
	candidate !== undefined &&
	candidate.key === key &&
	(key !== null || candidate.index === index) &&
	compatible(candidate, value);

// a repeated key keeps only its last fiber in the index, as React does; the rest remount.
const matchRemaining = (
	previous: Fiber[],
	values: Array<Child | boolean | null>,
	start: number,
	scanStart: number,
	pass: number,
): Array<Fiber | undefined> => {
	const previousIndex = new Map<number | string, Fiber>();
	for (const fiber of previous) {
		previousIndex.set(fiber.key ?? fiber.index, fiber);
	}

	// oxlint-disable-next-line unicorn/no-new-array
	const matches = new Array<Fiber | undefined>(values.length);

	let scan = scanStart;
	for (let index = start; index < values.length; index++) {
		const value = values[index];

		if (!isRenderableChild(value)) {
			continue;
		}

		const key = childKeyOf(value);
		scan = skipClaimed(previous, scan, pass);

		let match = previous[scan];

		if (matchesInOrder(match, value, key, index)) {
			scan++;
		} else {
			const indexed = previousIndex.get(key ?? index);
			if (indexed === undefined || indexed.pass === pass || !compatible(indexed, value)) {
				continue;
			}

			match = indexed;
		}

		match.pass = pass;
		matches[index] = match;
	}
	return matches;
};

// children whose previous slots already increase can stay put; the rest have to move.
// each entry holds the length of the longest such run ending there, then `STABLE_CHILD` for the run itself.
const stableChildPositions = (matches: Array<Fiber | undefined>): Int32Array => {
	const lengths = new Int32Array(matches.length);
	// tails[length - 1] is the smallest slot that can end a run of that length.
	const tails: number[] = [];
	for (let index = 0; index < matches.length; index++) {
		const match = matches[index];
		if (match === undefined) {
			continue;
		}

		let low = 0;
		let high = tails.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (tails[middle] < match.slot) {
				low = middle + 1;
			} else {
				high = middle;
			}
		}

		tails[low] = match.slot;
		lengths[index] = low + 1;
	}

	// walking back, the first entry of each length belongs to the longest run.
	let remaining = tails.length;
	for (let index = matches.length - 1; remaining > 0; index--) {
		if (lengths[index] === remaining) {
			lengths[index] = STABLE_CHILD;
			remaining--;
		}
	}

	return lengths;
};

// elements, text, and holes reconcile in place; anything else has to be flattened first.
const directChildArray = (children: any): Array<Child | boolean | null> | null => {
	if (!Array.isArray(children)) {
		return null;
	}

	for (const child of children) {
		switch (typeof child) {
			case 'object': {
				if (child !== null && child.$$typeof !== ELEMENT) {
					return null;
				}
				break;
			}
			case 'bigint':
			case 'number': {
				return null;
			}
		}
	}

	return children;
};
const nextPreviousNode = (previous: Fiber[], start: number, pass: number, end: Node | null): Node | null => {
	for (let index = start; index < previous.length; index++) {
		const fiber = previous[index];

		if (fiber.pass !== pass && fiber.firstHost) {
			return fiber.firstHost;
		}
	}

	return end;
};

// detach dropped nodes before mounting replacements to avoid costly live DOM updates.
const detachDropped = (previous: Fiber[], pass: number, end: Node | null): Array<Node | null> | null => {
	let detached: Array<Node | null> | null = null;

	const detach = (node: ChildNode) => {
		// keep the reconciliation anchor attached.
		if (node === end) {
			return;
		}

		(detached ??= []).push(node, node.nextSibling);

		node.remove();
	};

	for (const fiber of previous) {
		if (fiber.pass !== pass) {
			forEachNode(fiber, detach);
		}
	}

	return detached;
};

const restoreDetached = (container: HostContainer, detached: Array<Node | null>) => {
	for (let index = detached.length - 2; index >= 0; index -= 2) {
		container.insertBefore(detached[index]!, detached[index + 1]);
	}
};

const reconcileChildren = (
	parent: Fiber | null,
	previous: Fiber[],
	children: any,
	container: HostContainer,
	end: Node | null,
	root: Root,
): Fiber[] => {
	// flat JSX arrays can feed the diff without a copy.
	const directValues = directChildArray(children);
	const values = directValues ?? (childBuffers[reconcileDepth] ??= []);
	if (directValues === null) {
		flattenChildrenInto(children, values);
	}

	reconcileDepth++;

	const pass = ++reconcilePass;

	let next: Fiber[] | null = null;
	let mounted: Fiber[] | null = null;

	// start at the first existing node.
	let cursor: Node | null = nextChildNode(previous, 0, end);

	// stay allocation-free while old and new children remain in order.
	let scan = 0;
	let reorderedMatches: Array<Fiber | undefined> | null = null;
	let stableMatches: Int32Array | null = null;
	let detached: Array<Node | null> | null = null;

	try {
		for (let index = 0; index < values.length; index++) {
			const value = values[index];
			if (!isRenderableChild(value)) {
				continue;
			}

			let match: Fiber | undefined;
			let ordered = false;
			if (reorderedMatches) {
				match = reorderedMatches[index];
			} else {
				const key = childKeyOf(value);
				scan = skipClaimed(previous, scan, pass);
				const candidate = previous[scan];

				if (matchesInOrder(candidate, value, key, index)) {
					match = candidate;
					match.pass = pass;
					ordered = true;
					scan++;
				} else if (candidate !== undefined) {
					reorderedMatches = matchRemaining(previous, values, index, scan, pass);
					stableMatches = stableChildPositions(reorderedMatches);
					detached = detachDropped(previous, pass, end);
					cursor = end;

					for (let remaining = index; remaining < reorderedMatches.length; remaining++) {
						const stable = reorderedMatches[remaining];
						if (stable && stableMatches[remaining] === STABLE_CHILD) {
							const found = stable.firstHost;
							if (found) {
								cursor = found;
								break;
							}
						}
					}

					match = reorderedMatches[index];
				}
			}

			const stable = match !== undefined && stableMatches?.[index] === STABLE_CHILD;
			const before = stable && match ? (lastNode(match)?.nextSibling ?? cursor) : cursor;
			const fiber = reconcileFiber(parent, match, value, container, before, root);

			fiber.index = index;

			if (match) {
				if (ordered) {
					if (fiber.firstHost) {
						cursor = nextPreviousNode(previous, scan, pass, end);
					}
				} else {
					const first = fiber.firstHost;
					if (first !== null) {
						if (stable || first === cursor) {
							cursor = lastNode(fiber)!.nextSibling;
						} else {
							forEachNode(fiber, (node) => moveNode(container, node, cursor));
						}
					}
				}
			} else {
				(mounted ??= []).push(fiber);
			}

			next ??= [];
			fiber.slot = next.length;
			next.push(fiber);
		}
	} catch (error) {
		// tear down new siblings that the failed pass cannot return.
		if (mounted) {
			for (const fiber of mounted) {
				unmountFiber(fiber);
			}
		}

		if (detached) {
			restoreDetached(container, detached);
		}

		throw error;
	} finally {
		if (directValues === null) {
			values.length = 0;
		}

		reconcileDepth--;
	}

	for (const fiber of previous) {
		if (fiber.pass !== pass) {
			unmountFiber(fiber);
		}
	}

	return next ?? EMPTY_CHILDREN;
};

const reconcileInnerChildren = (
	fiber: Fiber,
	children: any,
	container: HostContainer,
	before: Node | null,
): Fiber[] => reconcileChildren(fiber, fiber.children, children, container, before, fiber.root);

const unmountChildren = (fiber: Fiber) => {
	for (const child of fiber.children) {
		unmountFiber(child);
	}

	fiber.children = EMPTY_CHILDREN;
};

const discardChildren = (fiber: Fiber) => {
	for (const child of fiber.children) {
		unmountFiberTree(child);
	}

	fiber.children = EMPTY_CHILDREN;
};

const reconcileFiber = (
	parent: Fiber | null,
	previous: Fiber | undefined,
	value: Child,
	container: HostContainer,
	before: Node | null,
	root: Root,
): Fiber => {
	if (previous) {
		updateFiber(previous, value, container, before, UpdateFiber.Empty);
		return previous;
	}

	const fiber = createFiber(parent, value, container, before, root);

	try {
		updateFiber(fiber, value, container, before, UpdateFiber.Mounting);
	} catch (error) {
		unmountFiber(fiber);

		throw error;
	}

	return fiber;
};

// the text a host element can write directly, or null when its children need the full diff.
const soleTextValue = (children: any): string | null => {
	switch (typeof children) {
		case 'string': {
			return children === '' ? null : children;
		}
		case 'bigint':
		case 'number': {
			return String(children);
		}
		default: {
			return null;
		}
	}
};

const mountSoleText = (fiber: HostFiber, value: string) => {
	const element = fiber.node;
	element.textContent = value;

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	const node = element.firstChild as Text;

	fiber.children = [createFiberNode(FiberKind.Text, node, fiber, value, fiber.root, value)];
};

const updateSoleText = (fiber: HostFiber, value: string): boolean => {
	if (fiber.children.length !== 1) {
		return false;
	}

	const only = fiber.children[0];
	if (only.kind !== FiberKind.Text) {
		return false;
	}

	updateFiber(only, value, fiber.node, null, UpdateFiber.Empty);
	return true;
};

// the anchor for a dirty child's nodes: the first host node to its right, or its parent's anchor.
const nextChildNode = (children: Fiber[], start: number, end: Node | null): Node | null => {
	for (let index = start; index < children.length; index++) {
		const found = children[index].firstHost;
		if (found) {
			return found;
		}
	}
	return end;
};

const passesToChildren = (fiber: Fiber): boolean => {
	switch (fiber.kind) {
		case FiberKind.Component:
		case FiberKind.Fragment:
		case FiberKind.Host:
		case FiberKind.Provider: {
			return true;
		}
		default: {
			return false;
		}
	}
};

const updateDirtyChildren = (fiber: Fiber, container: HostContainer, before: Node | null) => {
	const context = fiber.kind === FiberKind.Provider ? providerContext(fiber.type) : null;

	let previousValue: any;
	let previousProvider: Fiber | null = null;
	if (context) {
		previousValue = context.currentValue;
		previousProvider = context.currentProvider;
		context.currentValue = fiber.props.value;
		context.currentProvider = fiber;
	}

	const children = fiber.children;
	const element = fiber.kind === FiberKind.Host ? fiber.node : null;
	const childContainer = element ?? container;
	const childEnd = element ? null : before;

	let firstHostMoved = false;

	try {
		for (let index = 0; index < children.length; index++) {
			const child = children[index];
			if ((child.flags & (FiberFlag.ForceUpdate | FiberFlag.SubtreeDirty)) === 0) {
				continue;
			}

			const previousFirstHost = child.firstHost;
			const anchor = nextChildNode(children, index + 1, childEnd);

			if ((child.flags & FiberFlag.ForceUpdate) === 0 && passesToChildren(child)) {
				updateDirtyChildren(child, childContainer, anchor);
			} else {
				updateFiber(child, selfVNode(child), childContainer, anchor, UpdateFiber.Forced);
			}

			firstHostMoved ||= child.firstHost !== previousFirstHost;
		}

		if (element) {
			restoreControlled(element);
		}
	} catch (error) {
		refreshFirstHost(fiber);
		throw error;
	} finally {
		if (context) {
			context.currentValue = previousValue;
			context.currentProvider = previousProvider;
		}
	}

	fiber.flags &= ~FiberFlag.SubtreeDirty;

	if (firstHostMoved) {
		refreshFirstHost(fiber);
	}
};

const updateFiber = (
	fiber: Fiber,
	value: Child,
	container: HostContainer,
	before: Node | null,
	flags: UpdateFiber,
) => {
	const forced = (flags & UpdateFiber.Forced) !== 0;
	const mounting = (flags & UpdateFiber.Mounting) !== 0;

	if (typeof value === 'string') {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		const text = fiber as TextFiber;
		if (text.node.data !== value) {
			text.node.data = value;
		}
		// a hidden activity blanks the node, so keep the string to restore.
		text.type = value;
		return;
	}

	const vnode = value;

	if (fiber.props === vnode.props && !forced && (fiber.flags & FiberFlag.ForceUpdate) === 0) {
		if (!subtreeUnchanged(fiber)) {
			updateDirtyChildren(fiber, container, before);
		}
		return;
	}

	const previousChildren = fiber.children;
	const previousProps = fiber.props;

	fiber.props = vnode.props;
	if (DEV && familyResolver) {
		fiber.type = resolveType(vnode.type);
	}

	try {
		switch (fiber.kind) {
			case FiberKind.Host: {
				if (!mounting && shallowEqual(previousProps, vnode.props)) {
					if (!subtreeUnchanged(fiber)) {
						updateDirtyChildren(fiber, container, before);
					}
					break;
				}

				const element = fiber.node;
				if (mounting) {
					element.__scionFiber = fiber;
				}

				updateProps(element, previousProps, vnode.props, fiber);

				if (!vnode.props.dangerouslySetInnerHTML) {
					const children = vnode.props.children;
					const soleText = soleTextValue(children);
					// a fresh element takes the text path outright; an update falls back to the
					// full diff when the existing child is not already a lone text fiber.
					if (soleText !== null && mounting) {
						mountSoleText(fiber, soleText);
					} else if (soleText === null || !updateSoleText(fiber, soleText)) {
						fiber.children = reconcileInnerChildren(fiber, children, element, null);
					}
				}
				restoreControlled(element);
				if (mounting && vnode.props.defaultValue != null) {
					applySelectDefault(element, vnode.props);
				}

				if (mounting && vnode.props.autoFocus && element instanceof HTMLElement && !isDeactivated(fiber)) {
					fiber.root.queues[CommitQueue.AutoFocus].push(() => {
						if (element.isConnected) {
							element.focus();
						}
					});
				}

				const previousRef = previousProps.ref;
				const nextRef = vnode.props.ref;

				if (
					(previousRef != null || nextRef != null) &&
					(mounting || previousRef !== nextRef) &&
					!isDeactivated(fiber)
				) {
					queueRefDetach(fiber);
					queueRefAttach(fiber, { ref: nextRef, value: element });
				}

				break;
			}
			case FiberKind.Fragment: {
				fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				break;
			}
			case FiberKind.Activity: {
				fiber.flags &= ~FiberFlag.ForceUpdate;
				const hidden = vnode.props.mode === 'hidden';
				const wasHidden = (fiber.flags & FiberFlag.Hidden) !== 0;
				// keep it hidden during reveal so only reactivation queues its effects.
				fiber.flags = hidden || wasHidden ? fiber.flags | FiberFlag.Hidden : fiber.flags & ~FiberFlag.Hidden;
				if (hidden && !wasHidden) {
					fiber.root.hidden.add(fiber);
					deactivateFiber(fiber);
				}

				try {
					fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				} catch (error) {
					// hidden activity handles its own suspension.
					if (!hidden || !isThenable(error)) {
						throw error;
					}

					retryWhenSettled(fiber, error);
					refreshFirstHost(fiber);

					break;
				} finally {
					// every exit settles on the mode this render asked for.
					fiber.flags = hidden ? fiber.flags | FiberFlag.Hidden : fiber.flags & ~FiberFlag.Hidden;
				}

				if (wasHidden && !hidden) {
					fiber.root.hidden.delete(fiber);
					showChildren(fiber);
					reactivateFiber(fiber);
				}

				break;
			}
			case FiberKind.Provider: {
				const context = providerContext(fiber.type);
				const previousValue = context.currentValue;
				const previousProvider = context.currentProvider;

				context.currentValue = vnode.props.value;
				context.currentProvider = fiber;

				if (!mounting && !Object.is(previousProps.value, vnode.props.value)) {
					notifyConsumers(fiber);
				}

				try {
					fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				} finally {
					context.currentValue = previousValue;
					context.currentProvider = previousProvider;
				}

				break;
			}
			case FiberKind.Portal: {
				const target: Element | DocumentFragment = vnode.props.container;

				registerPortalTarget(fiber.root, target);

				if (!fiber.portalStart || !fiber.portalEnd || fiber.portalStart.parentNode !== target) {
					if (fiber.portalStart && fiber.portalEnd) {
						discardChildren(fiber);
						const start = fiber.portalStart;
						const end = fiber.portalEnd;
						fiber.root.queues[CommitQueue.Removal].push(() => removeRange(start, end));
					}

					fiber.portalStart = document.createComment('');
					fiber.portalEnd = document.createComment('');
					target.append(fiber.portalStart, fiber.portalEnd);
				}

				fiber.children = reconcileInnerChildren(fiber, vnode.props.children, target, fiber.portalEnd);
				break;
			}
			case FiberKind.Suspense: {
				fiber.flags &= ~FiberFlag.ForceUpdate;

				try {
					fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				} catch (error) {
					if (!isThenable(error)) {
						throw error;
					}

					// prevent the retry from bailing out on the same vnode.
					fiber.flags |= FiberFlag.ForceUpdate;
					retryWhenSettled(fiber, error);
					unmountChildren(fiber);
					fiber.children = reconcileInnerChildren(fiber, vnode.props.fallback, container, before);
				}

				break;
			}
			case FiberKind.ErrorBoundary: {
				fiber.flags &= ~FiberFlag.ForceUpdate;

				if (fiber.caughtError) {
					renderErrorFallback(fiber, vnode, container, before);
					break;
				}

				try {
					fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				} catch (error) {
					if (isThenable(error)) {
						throw error;
					}

					fiber.caughtError = { value: error };
					fiber.root.onCaughtError?.(error);

					unmountChildren(fiber);
					renderErrorFallback(fiber, vnode, container, before);
				}

				break;
			}
			case FiberKind.Component: {
				if (
					fiber.type?.$$typeof === MEMO &&
					!mounting &&
					!forced &&
					(fiber.flags & FiberFlag.ForceUpdate) === 0 &&
					(fiber.type.compare ?? shallowEqual)(previousProps, vnode.props)
				) {
					if (!subtreeUnchanged(fiber)) {
						updateDirtyChildren(fiber, container, before);
					}

					break;
				}

				const previousContext = currentContext;
				const previousFiber = currentFiber;
				const previousHook = currentHook;
				const restoresMark = effectRestores.length;
				const effectsMark = fiber.root.effectsTail;

				fiber.flags &= ~FiberFlag.ForceUpdate;
				currentFiber = fiber;

				let rendered: any;
				let renderAttempts = 0;

				try {
					do {
						if (renderAttempts > 0) {
							detachEffectsAfter(fiber.root, effectsMark);
							restoreEffectHooks(restoresMark);
						}

						fiber.flags &= ~FiberFlag.RenderPhaseUpdate;
						currentContext = null;
						currentHook = null;
						rendered = renderComponent(fiber, vnode.props);
						renderAttempts++;

						if (renderAttempts > 25) {
							throw new Error('too many render-phase updates.');
						}
					} while ((fiber.flags & FiberFlag.RenderPhaseUpdate) !== 0);
				} finally {
					if (currentContext) {
						unsubscribeContexts(fiber, currentContext.next);
						currentContext.next = null;
					} else {
						unsubscribeContexts(fiber, fiber.contexts);
						fiber.contexts = null;
					}

					truncateHooks(fiber, currentHook);
					effectRestores.length = restoresMark;
					currentContext = previousContext;
					currentFiber = previousFiber;
					currentHook = previousHook;
				}

				// requeue this fiber's effects after its descendants.
				const ownTail = fiber.root.effectsTail;
				const ownEffects = detachEffectsAfter(fiber.root, effectsMark);

				fiber.children = reconcileInnerChildren(fiber, rendered, container, before);

				appendEffects(fiber.root, ownEffects, ownTail);
				break;
			}
		}
	} catch (error) {
		// leave the dirty path in place; the retry has to reach the same descendants.
		refreshFirstHost(fiber);
		throw error;
	}

	// every descendant was either rendered or bailed out on a clean subtree of its own.
	fiber.flags &= ~FiberFlag.SubtreeDirty;

	if (fiber.children !== previousChildren) {
		refreshFirstHost(fiber);
	}
};

const componentOf = (fiber: Fiber) => {
	const component = resolveComponent(fiber.type);
	return component?.$$typeof === FORWARD_REF ? component.render : component;
};

const renderComponent = (fiber: Fiber, props: Props) => {
	const component = resolveComponent(fiber.type);
	if (component?.$$typeof === FORWARD_REF) {
		const { ref, ...componentProps } = props;
		return component.render(componentProps, ref ?? null);
	}
	return component(props);
};

const resolveComponent = (source: any): any => {
	let component = resolveType(source);
	while (true) {
		if (component?.$$typeof === LAZY) {
			component = resolveType(resolveLazy(component));
			continue;
		}
		if (component?.$$typeof === MEMO) {
			component = resolveType(component.type);
			continue;
		}
		return component;
	}
};

const describeFiber = (fiber: Fiber): string => {
	const component = componentOf(fiber);
	if (typeof component === 'string') {
		return component;
	}
	if (typeof component === 'function') {
		return component.displayName || component.name || fiberKindName(fiber.kind);
	}
	return fiberKindName(fiber.kind);
};

const retryWhenSettled = (fiber: Fiber, thenable: PromiseLike<unknown>) => {
	const retry = () => {
		if (isUnmounted(fiber)) {
			return;
		}

		// the pass that suspended has since cleared the path down to this boundary.
		markForceUpdate(fiber);

		// the boundary can sit under an ancestor that already bailed out, so render from the root.
		fiber.root.fullRender = true;
		scheduleRootWork(fiber.root, fiber);
	};

	Promise.resolve(thenable).then(retry, retry);
};

const renderErrorFallback = (fiber: Fiber, vnode: VNode, container: HostContainer, before: Node | null) => {
	const { value } = fiber.caughtError!;
	const fallback =
		typeof vnode.props.fallback === 'function'
			? vnode.props.fallback(value, boundaryReset(fiber))
			: vnode.props.fallback;
	fiber.children = reconcileInnerChildren(fiber, fallback, container, before);
};

const boundaryReset = (fiber: Fiber): (() => void) => {
	fiber.resetError ??= () => {
		if (isUnmounted(fiber) || !fiber.caughtError) {
			return;
		}

		fiber.caughtError = undefined;
		// prevent the retry from bailing out on the same vnode.
		fiber.flags |= FiberFlag.ForceUpdate;
		scheduleFiber(fiber);
	};

	return fiber.resetError;
};

const findUpdateBoundary = (fiber: Fiber, error: unknown): Fiber | undefined => {
	let parent = fiber.parent;
	while (parent) {
		if (parent.kind === FiberKind.ErrorBoundary && !isThenable(error)) {
			parent.caughtError = { value: error };
			parent.root.onCaughtError?.(error);
			return parent;
		}
		if (parent.kind === FiberKind.Suspense && isThenable(error)) {
			return parent;
		}
		parent = parent.parent;
	}
	return undefined;
};

const hostContainerOf = (fiber: Fiber): HostContainer => {
	let parent = fiber.parent;
	while (parent) {
		switch (parent.kind) {
			case FiberKind.Host: {
				return parent.node;
			}
			case FiberKind.Portal: {
				return parent.props.container;
			}
		}
		parent = parent.parent;
	}
	return fiber.root.container;
};

const rerenderFiber = (fiber: Fiber) => {
	const previousFirstHost = fiber.firstHost;
	const container = hostContainerOf(fiber);

	try {
		withFiberContext(fiber, () => {
			updateFiber(fiber, selfVNode(fiber), container, nextNode(fiber), UpdateFiber.Forced);
		});
	} finally {
		if (fiber.firstHost !== previousFirstHost) {
			refreshAncestorFirstHosts(fiber);
		}
	}
};

const selfVNode = (fiber: Fiber): VNode => createVNode(fiber.type, fiber.props, fiber.key);

const byDepth = (left: Fiber, right: Fiber): number => left.depth - right.depth;

const discardDirtyFibers = (root: Root) => {
	for (const fiber of root.dirty) {
		fiber.flags &= ~FiberFlag.Queued;
	}
	root.dirty = [];
};

const consumeFiberUpdate = (fiber: Fiber): boolean => {
	let changed = (fiber.flags & FiberFlag.ForceUpdate) !== 0;
	for (let hook = fiber.hooks; hook; hook = hook.next) {
		if (hook.kind === HookKind.State && hook.pending) {
			changed ||= !Object.is(hook.pending.previousValue, hook.value);
			hook.pending = undefined;
		}
	}
	fiber.flags = changed ? fiber.flags | FiberFlag.ForceUpdate : fiber.flags & ~FiberFlag.ForceUpdate;
	return changed;
};

// scheduling marks the path to every fiber that needs work, so this is a flag test.
const subtreeUnchanged = (fiber: Fiber): boolean => (fiber.flags & FiberFlag.SubtreeDirty) === 0;

const withFiberContext = <Value>(fiber: Fiber, callback: () => Value): Value => {
	let providers: Fiber[] | null = null;
	for (let parent = fiber.parent; parent !== null; parent = parent.parent) {
		if (parent.kind === FiberKind.Provider) {
			(providers ??= []).push(parent);
		}
	}

	if (providers === null) {
		return callback();
	}

	const previousValues = Array(providers.length);
	const previousProviders = Array(providers.length);
	for (let index = providers.length - 1; index >= 0; index--) {
		const provider = providers[index];
		const context = providerContext(provider.type);
		previousValues[index] = context.currentValue;
		previousProviders[index] = context.currentProvider;
		context.currentValue = provider.props.value;
		context.currentProvider = provider;
	}

	try {
		return callback();
	} finally {
		for (let index = 0; index < providers.length; index++) {
			const context = providerContext(providers[index].type);
			context.currentValue = previousValues[index];
			context.currentProvider = previousProviders[index];
		}
	}
};

const compatible = (fiber: Fiber, value: Child): boolean => {
	if (typeof value === 'string') {
		return fiber.kind === FiberKind.Text;
	}
	if (fiber.type === value.type) {
		return true;
	}
	if (!DEV || !familyResolver) {
		return false;
	}
	const previousFamily = familyResolver(fiber.type);
	const nextFamily = familyResolver(value.type);
	return previousFamily !== undefined && previousFamily === nextFamily && fiber.kind === kindOf(value);
};

const kindOf = (value: Child): FiberKind => {
	if (typeof value === 'string') {
		return FiberKind.Text;
	}
	const type = resolveType(value.type);
	if (typeof type === 'string') {
		return FiberKind.Host;
	}
	if (typeof type === 'function') {
		return FiberKind.Component;
	}
	switch (type) {
		case FRAGMENT:
		case STRICT_MODE: {
			return FiberKind.Fragment;
		}
		case ACTIVITY: {
			return FiberKind.Activity;
		}
		case SUSPENSE: {
			return FiberKind.Suspense;
		}
		case ERROR_BOUNDARY: {
			return FiberKind.ErrorBoundary;
		}
		case PORTAL: {
			return FiberKind.Portal;
		}
	}
	switch (type?.$$typeof) {
		case CONTEXT:
		case PROVIDER: {
			return FiberKind.Provider;
		}
		case FORWARD_REF:
		case MEMO:
		case LAZY: {
			return FiberKind.Component;
		}
	}
	throw new Error(`unsupported element type: ${String(type)}`);
};

const resolveType = (type: any): any => (DEV ? (familyResolver?.(type)?.current ?? type) : type);

const providerContext = (type: any): Context<any> => {
	return type.$$typeof === CONTEXT ? type : type._context;
};

const createFiber = (
	parent: Fiber | null,
	value: Child,
	container: HostContainer,
	before: Node | null,
	root: Root,
): Fiber => {
	const kind = kindOf(value);
	const type = typeof value === 'string' ? value : resolveType(value.type);
	switch (kind) {
		case FiberKind.Text: {
			const node = document.createTextNode(typeof value === 'string' ? value : '');
			container.insertBefore(node, before);
			return createFiberNode(kind, node, parent, value, root, type);
		}
		case FiberKind.Host: {
			const namespace = hostNamespace(container, type);
			const element: HostElement =
				namespace === HTML_NAMESPACE
					? document.createElement(type)
					: document.createElementNS(namespace, type);
			container.insertBefore(element, before);
			return createFiberNode(kind, element, parent, value, root, type);
		}
		default: {
			return createFiberNode(kind, null, parent, value, root, type);
		}
	}
};

const isElementContainer = (container: HostContainer): container is Element =>
	container.nodeType === Node.ELEMENT_NODE;

const hostNamespace = (container: HostContainer, type: string): string => {
	return type === 'svg' ||
		(isElementContainer(container) &&
			container.namespaceURI === SVG_NAMESPACE &&
			container.nodeName !== 'foreignObject')
		? SVG_NAMESPACE
		: HTML_NAMESPACE;
};

const moveNode = (container: HostContainer, node: Node, before: Node | null) => {
	if (SUPPORTS_MOVE_BEFORE && node.parentNode === container) {
		container.moveBefore(node, before);
	} else {
		container.insertBefore(node, before);
	}
};

const removeRange = (start: ChildNode, end: ChildNode) => {
	let node: ChildNode | null = start;
	while (node) {
		const next: ChildNode | null = node.nextSibling;
		node.remove();

		if (node === end) {
			break;
		}

		node = next;
	}
};

const forEachNode = (fiber: Fiber, visit: (node: ChildNode) => void) => {
	switch (fiber.kind) {
		case FiberKind.Host:
		case FiberKind.Text: {
			visit(fiber.node);
			return;
		}
		case FiberKind.Portal: {
			return;
		}
		default: {
			for (const child of fiber.children) {
				forEachNode(child, visit);
			}
		}
	}
};

const refreshFirstHost = (fiber: Fiber): boolean => {
	if (fiber.kind === FiberKind.Host || fiber.kind === FiberKind.Text || fiber.kind === FiberKind.Portal) {
		return false;
	}

	const previous = fiber.firstHost;
	const next = nextChildNode(fiber.children, 0, null);

	if (next === previous) {
		return false;
	}

	fiber.firstHost = next;
	return true;
};

const refreshAncestorFirstHosts = (fiber: Fiber) => {
	let parent = fiber.parent;
	while (parent && refreshFirstHost(parent)) {
		parent = parent.parent;
	}
};

const lastNode = (fiber: Fiber): Node | null => {
	switch (fiber.kind) {
		case FiberKind.Host:
		case FiberKind.Text: {
			return fiber.node;
		}
		case FiberKind.Portal: {
			return null;
		}
		default: {
			for (let index = fiber.children.length - 1; index >= 0; index--) {
				const found = lastNode(fiber.children[index]);
				if (found) {
					return found;
				}
			}
			return null;
		}
	}
};

const nextNode = (fiber: Fiber): Node | null => {
	let node: Fiber = fiber;
	while (true) {
		const parent: Fiber | null = node.parent;
		const siblings = parent ? parent.children : node.root.fibers;

		const found = nextChildNode(siblings, node.slot + 1, null);
		if (found) {
			return found;
		}

		if (!parent || parent.kind === FiberKind.Host) {
			return null;
		}

		if (parent.kind === FiberKind.Portal) {
			return parent.portalEnd ?? null;
		}

		node = parent;
	}
};

const queueHookCleanups = (fiber: Fiber) => {
	for (let hook = fiber.hooks; hook; hook = hook.next) {
		if (hook.kind !== HookKind.Effect || !hook.cleanup) {
			continue;
		}
		const cleanup = hook.cleanup;
		hook.cleanup = undefined;
		const queue =
			hook.effectKind === EffectKind.Passive ? CommitQueue.PassiveCleanup : CommitQueue.LayoutCleanup;
		fiber.root.queues[queue].push(cleanup);
	}
};

const queueRefDetach = (fiber: Fiber) => {
	const refCleanup = fiber.refCleanup;
	fiber.refCleanup = undefined;
	if (refCleanup) {
		fiber.root.queues[CommitQueue.RefDetach].push(refCleanup);
	}
};

const queueRefAttach = (fiber: Fiber, { ref, value }: { ref: any; value: any }) => {
	fiber.root.queues[CommitQueue.RefAttach].push(() => {
		fiber.refCleanup = setRef(ref, value);
	});
};

const unmountFiberTree = (fiber: Fiber) => {
	if (isUnmounted(fiber)) {
		return;
	}

	fiber.flags |= FiberFlag.Unmounted;
	if (fiber.kind === FiberKind.Activity) {
		fiber.root.hidden.delete(fiber);
	}
	unsubscribeContexts(fiber, fiber.contexts);
	fiber.contexts = null;
	queueHookCleanups(fiber);
	for (const child of fiber.children) {
		unmountFiberTree(child);
	}
	queueRefDetach(fiber);
	if (fiber.portalStart && fiber.portalEnd) {
		const start = fiber.portalStart;
		const end = fiber.portalEnd;
		fiber.root.queues[CommitQueue.Removal].push(() => removeRange(start, end));
	}
};

const unmountFiber = (fiber: Fiber) => {
	if (isUnmounted(fiber)) {
		return;
	}

	unmountFiberTree(fiber);
	fiber.root.queues[CommitQueue.Removal].push(() => {
		forEachNode(fiber, (node) => node.remove());
	});
};

// #endregion

// #region activity

const isDeactivated = (fiber: Fiber): boolean => {
	if (fiber.root.hidden.size === 0) {
		return false;
	}
	let parent = fiber.parent;
	while (parent) {
		if ((parent.flags & FiberFlag.Hidden) !== 0) {
			return true;
		}
		parent = parent.parent;
	}
	return false;
};

const deactivateFiber = (fiber: Fiber) => {
	queueHookCleanups(fiber);
	for (const child of fiber.children) {
		deactivateFiber(child);
	}
	queueRefDetach(fiber);
};

const reactivateFiber = (fiber: Fiber) => {
	if ((fiber.flags & FiberFlag.Hidden) !== 0) {
		return;
	}
	for (const child of fiber.children) {
		reactivateFiber(child);
	}
	for (let hook = fiber.hooks; hook; hook = hook.next) {
		if (hook.kind === HookKind.Effect) {
			queueEffect(fiber, hook);
		}
	}
	if (fiber.kind === FiberKind.Host && fiber.props.ref) {
		queueRefAttach(fiber, { ref: fiber.props.ref, value: fiber.node });
	}
};

const forEachActivityNode = (fiber: Fiber, visit: (node: HostFiber | TextFiber) => void) => {
	for (const child of fiber.children) {
		if (child.kind === FiberKind.Host || child.kind === FiberKind.Text) {
			visit(child);
		} else if ((child.flags & FiberFlag.Hidden) === 0) {
			forEachActivityNode(child, visit);
		}
	}
};

const hideChildren = (fiber: Fiber) => {
	forEachActivityNode(fiber, (node) => {
		if (node.kind === FiberKind.Text) {
			if (node.node.data !== '') {
				node.node.data = '';
			}
			return;
		}
		if (node.node.style.getPropertyValue('display') !== 'none') {
			node.node.style.setProperty('display', 'none', 'important');
		}
	});
};

const showChildren = (fiber: Fiber) => {
	forEachActivityNode(fiber, (node) => {
		if (node.kind === FiberKind.Text) {
			node.node.data = node.type;
			return;
		}
		const display = node.props.style?.display;
		node.node.style.display = isAttributeValue(display) ? String(display) : '';
	});
};

// #endregion

// #region children

const flattenChildrenInto = (value: any, result: any[]) => {
	if (Array.isArray(value)) {
		for (const child of value) {
			flattenChildrenInto(child, result);
		}
		return;
	}
	switch (typeof value) {
		case 'bigint':
		case 'number': {
			result.push(String(value));
			return;
		}
		case 'object': {
			if (value !== null && value.$$typeof !== ELEMENT && value[Symbol.iterator]) {
				for (const child of value) {
					flattenChildrenInto(child, result);
				}
				return;
			}
			break;
		}
	}
	result.push(value);
};

const escapeChildKey = (key: string): string => {
	return `$${key.replace(/[=:]/g, (character) => (character === '=' ? '=0' : '=2'))}`;
};

const escapeMappedKey = (key: string): string => key.replace(/\/+/g, '$&/');

const childKey = (value: any, index: number): string => {
	if (isValidElement(value) && value.key !== null) {
		return escapeChildKey(value.key);
	}
	return index.toString(36);
};

const cloneWithKey = (element: VNode, key: string): VNode => ({ ...element, key });

const mapChildrenInto = (
	children: any,
	result: any[],
	escapedPrefix: string,
	name: string,
	callback: (child: any) => any,
): number => {
	const type = typeof children;
	const value = type === 'boolean' || type === 'undefined' ? null : children;
	const leaf =
		value === null || type === 'bigint' || type === 'number' || type === 'string' || isValidElement(value);
	if (leaf) {
		const mapped = callback(value);
		const key = name === '' ? `.${childKey(value, 0)}` : name;
		if (Array.isArray(mapped)) {
			return mapChildrenInto(mapped, result, `${escapeMappedKey(key)}/`, '', (child) => child);
		}
		if (mapped != null) {
			if (isValidElement(mapped)) {
				const mappedKey =
					mapped.key !== null && (!isValidElement(value) || value.key !== mapped.key)
						? `${escapeMappedKey(mapped.key)}/`
						: '';
				result.push(cloneWithKey(mapped, `${escapedPrefix}${mappedKey}${key}`));
			} else {
				result.push(mapped);
			}
		}
		return 1;
	}
	if (value?.$$typeof === LAZY) {
		return mapChildrenInto(resolveLazy(value), result, escapedPrefix, name, callback);
	}
	let count = 0;
	const prefix = name === '' ? '.' : `${name}:`;
	if (Array.isArray(value) || typeof value?.[Symbol.iterator] === 'function') {
		let index = 0;
		for (const child of value) {
			count += mapChildrenInto(
				child,
				result,
				escapedPrefix,
				`${prefix}${childKey(child, index++)}`,
				callback,
			);
		}
		return count;
	}
	throw new Error(`objects are not valid as a React child: ${String(value)}.`);
};

const mapChildren = (
	children: any,
	callback: (child: any, index: number) => any,
): any[] | null | undefined => {
	if (children == null) {
		return children;
	}
	const result: any[] = [];
	let index = 0;
	mapChildrenInto(children, result, '', '', (child) => callback(child, index++));
	return result;
};

// #endregion

// #region DOM props

const updateProps = (element: HostElement, previous: Props, next: Props, fiber: Fiber) => {
	for (const name in previous) {
		if (name !== 'children' && !Object.hasOwn(next, name)) {
			setProp(element, name, undefined, previous[name], fiber);
		}
	}
	for (const name in next) {
		if (name !== 'children' && !Object.is(previous[name], next[name])) {
			setProp(element, name, next[name], previous[name], fiber);
		}
	}
};

const setProp = (element: HostElement, name: string, value: any, previous: any, fiber: Fiber) => {
	switch (name) {
		case 'autoFocus':
		case 'children':
		case 'key':
		case 'ref':
		case 'suppressContentEditableWarning':
		case 'suppressHydrationWarning': {
			return;
		}
		case 'className':
		case 'htmlFor': {
			const attribute = name === 'className' ? 'class' : 'for';
			if (isAttributeValue(value)) {
				element.setAttribute(attribute, String(value));
			} else {
				element.removeAttribute(attribute);
			}
			return;
		}
		case 'style': {
			setStyle(element.style, previous, value);
			return;
		}
		case 'dangerouslySetInnerHTML': {
			const html = value?.__html ?? '';
			if (element.innerHTML !== html) {
				discardChildren(fiber);
				element.innerHTML = html;
			}
			return;
		}
		case 'value': {
			setControlledValue(element, value);
			return;
		}
		case 'checked':
		case 'muted':
		case 'selected': {
			const next = value ?? false;
			if (element[name] !== next) {
				element[name] = next;
			}
			return;
		}
		case 'defaultChecked':
		case 'defaultValue': {
			setDefault(element, name, value, previous);
			return;
		}
	}

	if (name.startsWith('on')) {
		setEvent(element, name, value, fiber);
		return;
	}

	if (name.startsWith('aria-') || name.startsWith('data-') || booleanishAttributes.has(name)) {
		writeAttribute(element, name, isWritableValue(value) ? String(value) : null);
		return;
	}

	if (!isWritableValue(value) || value === false) {
		writeAttribute(element, name, null);
	} else {
		writeAttribute(element, name, value === true ? '' : String(value));
	}
};

// attributes that React writes with mechanically hyphenated names.
const hyphenatedAttributes = new Set([
	'acceptCharset',
	'alignmentBaseline',
	'baselineShift',
	'clipPath',
	'clipRule',
	'colorInterpolation',
	'colorInterpolationFilters',
	'colorRendering',
	'dominantBaseline',
	'fillOpacity',
	'fillRule',
	'floodColor',
	'floodOpacity',
	'fontFamily',
	'fontSize',
	'fontSizeAdjust',
	'fontStretch',
	'fontStyle',
	'fontVariant',
	'fontWeight',
	'glyphOrientationVertical',
	'httpEquiv',
	'imageRendering',
	'letterSpacing',
	'lightingColor',
	'markerEnd',
	'markerMid',
	'markerStart',
	'paintOrder',
	'pointerEvents',
	'shapeRendering',
	'stopColor',
	'stopOpacity',
	'strokeDasharray',
	'strokeDashoffset',
	'strokeLinecap',
	'strokeLinejoin',
	'strokeMiterlimit',
	'strokeOpacity',
	'strokeWidth',
	'textAnchor',
	'textDecoration',
	'textRendering',
	'transformOrigin',
	'unicodeBidi',
	'vectorEffect',
	'wordSpacing',
	'writingMode',
]);

const attributeName = (name: string): string => {
	if (!hyphenatedAttributes.has(name)) {
		return name;
	}
	return name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
};

const attributeNamespaces: Record<string, string> = {
	xlink: 'http://www.w3.org/1999/xlink',
	xml: 'http://www.w3.org/XML/1998/namespace',
	xmlns: 'http://www.w3.org/2000/xmlns/',
};

// react spells a namespaced attribute as its prefix followed by the local name
const namespacedAttribute = /^(xmlns|xlink|xml)([A-Z]\w*)$/;

const namespaceOf = (name: string): RegExpExecArray | null => {
	return name.charCodeAt(0) === 120 ? namespacedAttribute.exec(name) : null;
};

const writeAttribute = (element: HostElement, name: string, value: string | null) => {
	const namespaced = namespaceOf(name);
	if (namespaced) {
		const namespace = attributeNamespaces[namespaced[1]];
		const local = namespaced[2].toLowerCase();

		if (value === null) {
			element.removeAttributeNS(namespace, local);
		} else {
			element.setAttributeNS(namespace, `${namespaced[1]}:${local}`, value);
		}

		return;
	}

	const attribute = attributeName(name);
	if (value === null) {
		element.removeAttribute(attribute);
	} else {
		element.setAttribute(attribute, value);
	}
};

const booleanishAttributes = new Set([
	'autoReverse',
	'contentEditable',
	'draggable',
	'externalResourcesRequired',
	'focusable',
	'preserveAlpha',
	'spellCheck',
]);

const isWritableValue = (value: unknown): boolean =>
	value != null && typeof value !== 'function' && typeof value !== 'symbol';

const isAttributeValue = (value: unknown): boolean => isWritableValue(value) && typeof value !== 'boolean';

const unitless = new Set([
	'aspectRatio',
	'flex',
	'flexGrow',
	'flexShrink',
	'fontWeight',
	'lineHeight',
	'opacity',
	'order',
	'zIndex',
	'zoom',
]);

type StyleValue = string | number | null | undefined;

const setStyle = (
	style: CSSStyleDeclaration,
	previous: Record<string, StyleValue> | null | undefined,
	next: Record<string, StyleValue> | string | null | undefined,
) => {
	if (typeof next === 'string') {
		throw new TypeError(`the \`style\` prop expects a property-to-value mapping, not a string.`);
	}
	for (const name in previous) {
		if (next == null || !(name in next)) {
			if (name.startsWith('--')) {
				style.removeProperty(name);
			} else {
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				(style as any)[name] = '';
			}
		}
	}
	for (const name in next) {
		const rawValue = next[name];
		if (typeof previous === 'object' && Object.is(previous?.[name], rawValue)) {
			continue;
		}
		const value =
			typeof rawValue === 'number' && rawValue !== 0 && !name.startsWith('--') && !unitless.has(name)
				? `${rawValue}px`
				: (rawValue ?? '');
		if (name.startsWith('--')) {
			style.setProperty(name, String(value));
		} else {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			(style as any)[name] = value;
		}
	}
};

const eventNames: Record<string, string> = {
	Blur: 'focusout',
	DoubleClick: 'dblclick',
	Focus: 'focusin',
	GotPointerCapture: 'gotpointercapture',
	LostPointerCapture: 'lostpointercapture',
	MouseEnter: 'mouseenter',
	MouseLeave: 'mouseleave',
	PointerEnter: 'pointerenter',
	PointerLeave: 'pointerleave',
};

const handlerKey = (name: string, capture: boolean): `__scion$${string}` => {
	return `__scion$${name}${capture ? 'Capture' : ''}`;
};

// ignore handlers attached after the current dispatch began.
let eventClock = 0;

const createEventProxy = (capture: boolean) => {
	return (event: ScionEvent): void => {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		const element = event.currentTarget as HostElement;
		const record = element[handlerKey(event.type, capture)];

		// stamp events even if the handler was removed during propagation.
		event.__scionDispatch ??= eventClock++;
		try {
			if (record && event.__scionDispatch >= record.attachedAt) {
				event.nativeEvent ??= event;
				event.isDefaultPrevented ??= () => event.defaultPrevented;
				event.isPropagationStopped ??= () => event.cancelBubble;
				event.persist ??= () => {};
				record.handler(event);
			}
		} finally {
			if (event.type === 'input' && isControlled(element)) {
				queueMicrotask(() => restoreControlled(element));
			}
		}
	};
};

const eventProxy = createEventProxy(false);
const eventProxyCapture = createEventProxy(true);

const setEvent = (element: HostElement, prop: string, handler: any, fiber: Fiber) => {
	const capture = prop.endsWith('Capture');
	const reactName = prop.slice(2, capture ? -7 : undefined);
	const name = eventNames[reactName] ?? (reactName === 'Change' ? 'input' : reactName.toLowerCase());
	const key = handlerKey(name, capture);
	const proxy = capture ? eventProxyCapture : eventProxy;

	if (typeof handler !== 'function') {
		if (element[key]) {
			delete element[key];
			element.removeEventListener(name, proxy, capture);
		}
		return;
	}

	const record = element[key];

	if (record === undefined) {
		registerPortalEvent(fiber.root, name);

		element[key] = { attachedAt: eventClock, handler };
		element.addEventListener(name, proxy, capture);
	} else {
		record.handler = handler;
	}
};

const registerPortalTarget = (root: Root, target: EventTarget) => {
	if (root.portalTargets.has(target)) {
		return;
	}
	root.portalTargets.add(target);
	for (const name of root.portalEvents) {
		registerPortalBridgePair(root, target, name);
	}
};

const registerPortalEvent = (root: Root, name: string) => {
	if (root.portalEvents.has(name)) {
		return;
	}
	root.portalEvents.add(name);
	for (const target of root.portalTargets) {
		registerPortalBridgePair(root, target, name);
	}
};

const registerPortalBridgePair = (root: Root, target: EventTarget, name: string) => {
	for (const capture of [false, true]) {
		const listener: EventListener = (event) => dispatchPortalEvent(root, target, event, name, capture);
		target.addEventListener(name, listener, capture);
		root.portalCleanups.push(() => target.removeEventListener(name, listener, capture));
	}
};

const dispatchPortalEvent = (
	root: Root,
	target: EventTarget,
	event: ScionEvent,
	name: string,
	capture: boolean,
) => {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	const targetFiber = (event.target as ScionExpandos | null)?.__scionFiber;
	if (!targetFiber || targetFiber.root !== root) {
		return;
	}
	let crossedPortal = false;
	let parent: Fiber | null = targetFiber;
	const logicalPath: HostFiber[] = [];
	while (parent) {
		if (parent.kind === FiberKind.Portal && parent.props.container === target) {
			crossedPortal = true;
		}
		if (crossedPortal && parent.kind === FiberKind.Host) {
			logicalPath.push(parent);
		}
		parent = parent.parent;
	}
	if (!crossedPortal) {
		return;
	}
	const nativePath = new Set(event.composedPath());
	const ordered = capture ? logicalPath.toReversed() : logicalPath;
	const invoked = ((event.__scionPortalInvoked ??= {})[capture ? 'capture' : 'bubble'] ??= new Set<Fiber>());
	const dispatch = (event.__scionDispatch ??= eventClock++);
	for (const fiber of ordered) {
		if (event.cancelBubble || invoked.has(fiber) || nativePath.has(fiber.node)) {
			continue;
		}
		const record = fiber.node[handlerKey(name, capture)];
		if (!record || dispatch < record.attachedAt) {
			continue;
		}
		invoked.add(fiber);
		Object.defineProperty(event, 'currentTarget', {
			configurable: true,
			value: fiber.node,
		});
		record.handler(event);
	}
	Reflect.deleteProperty(event, 'currentTarget');
};

const setDefault = (
	element: HostElement,
	name: 'defaultChecked' | 'defaultValue',
	value: any,
	previous: any,
) => {
	if (element instanceof HTMLSelectElement) {
		return;
	}
	const live = name === 'defaultValue' ? 'value' : 'checked';
	if (value != null) {
		element[name] = value;
		if (previous === undefined) {
			element[live] = value;
		}
		return;
	}
	if (previous == null) {
		return;
	}
	if (element instanceof HTMLTextAreaElement) {
		element.defaultValue = '';
	} else if (name === 'defaultValue') {
		element.removeAttribute('value');
	}
};

const setControlledValue = (element: HostElement, value: any) => {
	if (element instanceof HTMLSelectElement && element.multiple && Array.isArray(value)) {
		const selected = new Set(value.map(String));
		for (const option of element.options) {
			option.selected = selected.has(option.value);
		}
		return;
	}
	const next = value == null ? '' : String(value);
	if (element.value !== next) {
		element.value = next;
	}
};

const applySelectDefault = (element: HostElement, props: Props) => {
	if (element instanceof HTMLSelectElement && !Object.hasOwn(props, 'value') && props.defaultValue != null) {
		setControlledValue(element, props.defaultValue);
	}
};

const isControlled = (element: HostElement): boolean => {
	const props = element.__scionFiber?.props;
	return props !== undefined && (props.value != null || props.checked != null);
};

const restoreControlled = (element: HostElement) => {
	const props = element.__scionFiber?.props;
	if (props === undefined) {
		return;
	}
	if (props.value != null) {
		setControlledValue(element, props.value);
	}
	if (props.checked != null) {
		const checked = Boolean(props.checked);
		if (element.checked !== checked) {
			element.checked = checked;
		}
	}
};

const setRef = (ref: any, value: any): (() => void) | undefined => {
	if (!ref) {
		return undefined;
	}
	if (typeof ref === 'function') {
		const cleanup = ref(value);
		return typeof cleanup === 'function' ? cleanup : () => ref(null);
	}
	ref.current = value;
	return () => {
		ref.current = null;
	};
};

// #endregion

// #region effect queue

const queueEffect = (fiber: Fiber, hook: EffectHook) => {
	const pending: PendingEffect = { effect: hook.effect, fiber, hook, kind: hook.effectKind, next: null };
	appendEffects(fiber.root, pending, pending);
};

const detachEffectsAfter = (root: Root, mark: PendingEffect | null): PendingEffect | null => {
	const head = mark ? mark.next : root.effects;
	if (mark) {
		mark.next = null;
	} else {
		root.effects = null;
	}
	root.effectsTail = mark;
	return head;
};

const appendEffects = (root: Root, head: PendingEffect | null, tail: PendingEffect | null) => {
	if (!head) {
		return;
	}
	if (root.effectsTail) {
		root.effectsTail.next = head;
	} else {
		root.effects = head;
	}
	root.effectsTail = tail;
};

const hasPassiveEffect = (head: PendingEffect | null): boolean => {
	for (let pending = head; pending; pending = pending.next) {
		if (pending.kind === EffectKind.Passive) {
			return true;
		}
	}
	return false;
};

const restoreEffectHooks = (mark: number) => {
	for (let index = effectRestores.length - 1; index >= mark; index--) {
		const { deps, effect, effectKind, hook } = effectRestores[index];
		hook.deps = deps;
		hook.effect = effect;
		hook.effectKind = effectKind;
	}
	effectRestores.length = mark;
};

const flushPassiveEffects = (root: Root, synchronous: boolean) => {
	const effects = root.effects;
	const cleanups = root.queues[CommitQueue.PassiveCleanup];
	root.queues[CommitQueue.PassiveCleanup] = [];
	if (cleanups.length === 0 && !hasPassiveEffect(effects)) {
		return;
	}
	const flush = () => {
		const previousRoot = renderingRoot;
		renderingRoot = root;
		try {
			runQueue(cleanups);
			runEffects(effects, EffectKind.Passive);
		} finally {
			renderingRoot = previousRoot;
		}
	};
	if (synchronous) {
		flush();
		return;
	}
	passiveScheduled = true;
	queueMicrotask(() => {
		try {
			flush();
		} finally {
			passiveScheduled = false;
		}
	});
};

const runEffects = (head: PendingEffect | null, kind: EffectKind) => {
	for (let pending = head; pending; pending = pending.next) {
		if (pending.kind === kind && !isUnmounted(pending.fiber)) {
			const cleanup = pending.hook.cleanup;
			pending.hook.cleanup = undefined;
			cleanup?.();
		}
	}
	for (let pending = head; pending; pending = pending.next) {
		if (pending.kind === kind && !isUnmounted(pending.fiber)) {
			const cleanup = pending.effect();
			pending.hook.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
		}
	}
};

// #endregion

// #region async and development tools

const isThenable = (value: unknown): value is PromiseLike<unknown> => {
	if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
		return false;
	}
	return 'then' in value && typeof value.then === 'function';
};

const readThenable = <Value>(thenable: TrackedThenable<Value>): Value => {
	if (thenable.status === undefined) {
		thenable.status = 'pending';
		thenable.then(
			(value) => {
				if (thenable.status === 'pending') {
					thenable.status = 'fulfilled';
					thenable.value = value;
				}
			},
			(reason: unknown) => {
				if (thenable.status === 'pending') {
					thenable.status = 'rejected';
					thenable.reason = reason;
				}
			},
		);
	}

	if (thenable.status === 'fulfilled') {
		return thenable.value!;
	}

	if (thenable.status === 'rejected') {
		throw thenable.reason;
	}

	throw thenable;
};

const resolveLazy = (type: any) => {
	if (type._status === 'resolved') {
		return type._value;
	}
	if (type._status === 'rejected') {
		throw type._value;
	}
	if (type._status === 'uninitialized') {
		type._status = 'pending';
		type._value = type._load().then(
			(module: { default: any }) => {
				type._status = 'resolved';
				type._value = module.default;
				return module.default;
			},
			(error: unknown) => {
				type._status = 'rejected';
				type._value = error;
				throw error;
			},
		);
	}
	throw type._value;
};

const getDevtoolsHook = (): any => {
	// avoid publishing a global declaration.
	const scope: typeof globalThis & { __REACT_DEVTOOLS_GLOBAL_HOOK__?: any } = globalThis;
	return scope.__REACT_DEVTOOLS_GLOBAL_HOOK__;
};

const installRefreshBridge = (): boolean => {
	if (rendererId !== undefined) {
		return true;
	}

	const hook = getDevtoolsHook();
	if (!hook?.inject) {
		return false;
	}

	rendererId = hook.inject({
		bundleType: 1,
		version,
		rendererPackageName: 'scion',
		scheduleRefresh(root: Root, update: RefreshUpdate) {
			markRefreshWork(root.fibers, update);
			renderRoot(root);
		},
		scheduleRoot(root: Root, element: any) {
			root.element = element;
			renderRoot(root);
		},
		setRefreshHandler(resolve: typeof familyResolver) {
			familyResolver = resolve;
		},
	});

	return true;
};

const invalidateHookDeps = (fiber: Fiber) => {
	for (let hook = fiber.hooks; hook; hook = hook.next) {
		switch (hook.kind) {
			case HookKind.Effect:
			case HookKind.Memo: {
				hook.deps = undefined;
				break;
			}
			case HookKind.MemoCache: {
				hook.value = [];
				break;
			}
		}
	}
};

const remountFiber = (fiber: Fiber) => {
	queueHookCleanups(fiber);
	fiber.hooks = null;
	unmountChildren(fiber);
	markForceUpdate(fiber);
};

const enum RefreshVerdict {
	None,
	Update,
	Remount,
}

const familyVerdict = (type: any, update: RefreshUpdate): RefreshVerdict => {
	const family = familyResolver!(type);
	if (update.staleFamilies.has(family)) {
		return RefreshVerdict.Remount;
	}

	return update.updatedFamilies.has(family) ? RefreshVerdict.Update : RefreshVerdict.None;
};

const refreshVerdict = (fiber: Fiber, update: RefreshUpdate): RefreshVerdict => {
	if (fiber.kind !== FiberKind.Component) {
		return RefreshVerdict.None;
	}

	const outer = familyVerdict(fiber.type, update);
	if (outer === RefreshVerdict.Remount) {
		return outer;
	}

	let inner: any;
	try {
		inner = componentOf(fiber);
	} catch {
		return outer;
	}

	const nested = familyVerdict(inner, update);
	return nested > outer ? nested : outer;
};

const markRefreshWork = (fibers: Fiber[], update: RefreshUpdate) => {
	for (const fiber of fibers) {
		const verdict = refreshVerdict(fiber, update);

		switch (verdict) {
			case RefreshVerdict.Remount: {
				remountFiber(fiber);
				continue;
			}
			case RefreshVerdict.Update: {
				invalidateHookDeps(fiber);
				markForceUpdate(fiber);
				break;
			}
		}

		markRefreshWork(fiber.children, update);
	}
};

const scheduleRefreshBridge = () => {
	if (rendererId !== undefined || refreshInstallScheduled) {
		return;
	}

	refreshInstallScheduled = true;
	setTimeout(() => {
		refreshInstallScheduled = false;
		if (!installRefreshBridge()) {
			return;
		}

		const hook = getDevtoolsHook();
		for (const root of roots) {
			root.id = rendererId!;
			hook?.onCommitFiberRoot?.(root.id, root, null, false);
		}
	}, 0);
};

export const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = {
	A: null,
	H: null,
	S: null,
	T: null,
};

export const __scion = {
	get passiveScheduled() {
		return passiveScheduled;
	},
};

// #endregion

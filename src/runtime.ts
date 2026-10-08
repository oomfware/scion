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

// host mutations the render phase records against live nodes, replayed in order at commit.
const enum HostOp {
	// container, node, before
	Insert,
	// a removal cancelled by a reconcile pass that failed; one operand wide
	Noop,
	// element, previous props, next props, fiber
	Props,
	// node
	Remove,
	// element
	RestoreControlled,
	// activity fiber
	Show,
	// text node, value
	Text,
}

// commit work runs queue by queue, in declaration order.
const enum CommitQueue {
	LayoutCleanup,
	RefDetach,
	Removal,
	RefAttach,
	AutoFocus,
	PassiveCleanup,
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
	ViewTransition,
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
	'view-transition',
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
	pendingThenable: PromiseLike<unknown> | undefined;
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

	// where pending work came from; a pass animates only when all of it came from transitions.
	transitionLane: boolean;
	urgentLane: boolean;
	// transition types collected for the pending work.
	transitionTypes: string[] | null;
	// set while a rendered pass waits for the browser to snapshot the old state.
	pendingCommit: (() => void) | null;

	effects: PendingEffect | null;
	effectsTail: PendingEffect | null;
	// `HostOp` entries, each an opcode followed by its operands.
	ops: any[];
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
const VIEW_TRANSITION = Symbol.for('react.view_transition');

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SUPPORTS_MOVE_BEFORE = typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;

let dirtyRoots: Root[] = [];
const roots = new Set<Root>();

const EMPTY_CHILDREN: Fiber[] = [];
const EMPTY_PROPS: Props = {};

const childBuffers: Array<Array<Child | boolean | null>> = [];

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
// true while reconciling inside a host element created this pass. such nodes are not attached
// yet, so they take their mutations directly instead of through the root's op journal.
let detached = false;
// what the pass being reconciled may animate, when it is eligible for a view transition.
let transitionFrame: TransitionFrame | null = null;
// innermost `<ViewTransition>` on the render stack, which owns the host mutations below it.
let enclosingBoundary: Fiber | null = null;
// true while mounting below the root of an inserted subtree.
let inserting = false;

let batching = 0;
let draining = false;
let flushing = false;
let passiveScheduled = false;
let synchronousEffects = 0;
// root whose render, commit, or effect flush is active.
let renderingRoot: Root | null = null;
let transitionScheduled = false;
// the startTransition call being run, if any.
let transitionScope: { roots: Root[]; types: string[] } | null = null;

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
		pendingThenable: undefined,
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

// tree-shaken exports leave their flags false, so minifiers drop the guarded code.
let hasActivity = false;
let hasErrorBoundary = false;
let hasPortal = false;
let hasSuspense = false;
let hasViewTransition = false;

const enable = <Value>(value: Value, fill: () => void): Value => {
	fill();

	return value;
};

export const Activity = /* @__PURE__ */ enable(ACTIVITY, () => {
	hasActivity = true;
});
export const ErrorBoundary = /* @__PURE__ */ enable(ERROR_BOUNDARY, () => {
	hasErrorBoundary = true;
});
export const Fragment = FRAGMENT;
export const StrictMode = STRICT_MODE;
export const Suspense = /* @__PURE__ */ enable(SUSPENSE, () => {
	hasSuspense = true;
});
export const ViewTransition = /* @__PURE__ */ enable(VIEW_TRANSITION, () => {
	hasViewTransition = true;
});

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

const newMemoCache = (size: number): unknown[] => Array(size).fill(MEMO_CACHE_SENTINEL);

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
	const outer = transitionScope;
	const scope = outer ?? { roots: [], types: [] };
	transitionScope = scope;
	batching++;
	try {
		callback();
	} finally {
		batching--;
		transitionScope = outer;
	}
	// types added after a setState still belong to the update it scheduled.
	if (outer === null && scope.types.length !== 0) {
		for (const root of scope.roots) {
			const types = (root.transitionTypes ??= []);
			for (const type of scope.types) {
				addType(types, type);
			}
		}
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

/**
 * names the cause of the transition being started, so `<ViewTransition>` class maps and the
 * browser's `:active-view-transition-type()` can tell transitions apart.
 *
 * @param type an arbitrary transition type; only meaningful inside `startTransition`
 */
export const addTransitionType = (type: string) => {
	if (transitionScope === null) {
		if (DEV) {
			console.error('addTransitionType can only be called inside startTransition.');
		}
		return;
	}
	addType(transitionScope.types, type);
};

const addType = (types: string[], type: string) => {
	if (!types.includes(type)) {
		types.push(type);
	}
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

export const createPortal = /* @__PURE__ */ enable(
	(children: any, container: Element | DocumentFragment, key?: null | string): VNode => {
		return createVNode(PORTAL, { children, container }, key);
	},
	() => {
		hasPortal = true;
	},
);

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
		ops: [],
		pendingCommit: null,
		portalCleanups: [],
		portalEvents: new Set(),
		portalTargets: new Set(),
		queues: newCommitQueues(),
		scheduled: false,
		transitionLane: false,
		transitionTypes: null,
		urgentLane: false,
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
			// inside a transition the render waits with the rest of it.
			if (transitionScope !== null) {
				root.fullRender = true;
				scheduleRootWork(root, null);
				return;
			}
			// any transition work this pass picks up commits with it, unanimated.
			if (hasViewTransition) {
				root.urgentLane = true;
			}
			renderRootWork(root, true);
		},
		unmount() {
			if (root.disposed) {
				return;
			}

			root.pendingCommit?.();
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

const scheduleRootWork = (root: Root, fiber: Fiber | null) => {
	// only view transitions tell transition work from urgent work.
	if (hasViewTransition) {
		if (transitionScope === null) {
			root.urgentLane = true;
		} else {
			root.transitionLane = true;
			if (!transitionScope.roots.includes(root)) {
				transitionScope.roots.push(root);
			}
		}
	}
	queueRootWork(root, fiber);
};

// queues a root for the next flush, leaving its lanes to the caller.
const queueRootWork = (root: Root, fiber: Fiber | null) => {
	// work scheduled by active root work extends its cascade.
	if (renderingRoot === root) {
		root.cascadeScheduled = true;
		if (DEV) {
			root.scheduleReason = fiber ? describeFiber(fiber) : 'root';
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

const renderPass = (root: Root) => {
	root.scheduled = false;
	if (hasViewTransition && holdForViewTransition(root)) {
		return;
	}
	const full = root.fullRender;
	root.fullRender = false;
	renderRootWork(root, full);
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
			renderPass(root);
		}
	} finally {
		flushing = false;
	}
};

// commit updates must finish before later microtasks observe the DOM.
const drainCascade = (root: Root) => {
	if (draining || renderingRoot) {
		return;
	}
	draining = true;
	try {
		for (let pass = 0; pass < CASCADE_LIMIT && root.scheduled && !root.disposed; pass++) {
			renderPass(root);
		}
	} finally {
		draining = false;
	}
};

const newCommitQueues = (): Array<Array<() => void>> => [[], [], [], [], [], []];

// every commit drains its queues, so the next pass always starts from empty ones.
const runQueue = (queue: Array<() => void>) => {
	for (const run of queue) {
		run();
	}
	queue.length = 0;
};

// match React's nested update limit.
const CASCADE_LIMIT = 50;

const renderRootWork = (root: Root, full: boolean) => {
	// external renders start a new cascade.
	root.cascadeDepth = root.cascadeScheduled ? root.cascadeDepth + 1 : 0;
	root.cascadeScheduled = false;
	if (root.cascadeDepth > CASCADE_LIMIT) {
		root.scheduled = false;
		if (DEV) {
			console.error('scion stopped an update loop.', root.scheduleReason);
		}
		if (!full) {
			discardDirtyFibers(root);
		}
		return;
	}

	// a pass still waiting on its snapshot owns the journal and effects, so it lands first.
	if (hasViewTransition) {
		root.pendingCommit?.();
	}

	root.effects = null;
	root.effectsTail = null;
	const frame = hasViewTransition ? openTransitionFrame(root) : null;
	const failed = reconcileRoot(root, full, frame);

	if (frame !== null && startViewTransitionFrame(root, frame, failed)) {
		return;
	}

	commitRoot(root, failed);
	drainCascade(root);
};

// renders the pending work, recording host mutations instead of performing them.
const reconcileRoot = (root: Root, full: boolean, frame: TransitionFrame | null): boolean => {
	let failed = false;
	const previousRoot = renderingRoot;
	const previousFrame = transitionFrame;
	const previousBoundary = enclosingBoundary;
	renderingRoot = root;
	transitionFrame = frame;
	enclosingBoundary = null;
	try {
		const hook = DEV ? getDevtoolsHook() : undefined;
		hook?.onScheduleFiberRoot?.(root.id, root, root.element);

		const targets = root.dirty;
		root.dirty = [];
		let targetCount = 0;
		for (const fiber of targets) {
			fiber.flags &= ~FiberFlag.Queued;
			// another pass may have consumed the update.
			if (!consumeFiberUpdate(fiber)) {
				continue;
			}
			if (full) {
				markDirtyPath(fiber);
			} else {
				targets[targetCount++] = fiber;
			}
		}
		targets.length = targetCount;

		if (full) {
			try {
				root.fibers = reconcileChildren(null, root.fibers, root.element, root.container, null, root);
			} catch (error) {
				failed = true;
				root.onUncaughtError?.(error);
				console.error(error);
			}
		} else {
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
		}
	} finally {
		renderingRoot = previousRoot;
		transitionFrame = previousFrame;
		enclosingBoundary = previousBoundary;
	}

	return failed;
};

// performs the recorded host mutations, then the commit queues and effects.
const commitRoot = (root: Root, failed: boolean) => {
	const previousRoot = renderingRoot;
	renderingRoot = root;
	try {
		const commitHook = DEV ? getDevtoolsHook() : undefined;
		commitHook?.onCommitFiberRoot?.(root.id, root, null, failed);
		const queues = root.queues;
		// read once: an effect that renders this root again starts a list of its own.
		const effects = root.effects;
		try {
			applyHostOps(root.ops);
		} catch (error) {
			root.onUncaughtError?.(error);
			console.error(error);
		}
		runQueue(queues[CommitQueue.LayoutCleanup]);
		runEffects(effects, EffectKind.Insertion);
		runQueue(queues[CommitQueue.RefDetach]);
		runQueue(queues[CommitQueue.Removal]);

		// a hidden render can add visible nodes, so hide them after DOM changes settle.
		if (hasActivity) {
			for (const activity of root.hidden) {
				hideChildren(activity);
			}
		}

		runQueue(queues[CommitQueue.RefAttach]);
		runQueue(queues[CommitQueue.AutoFocus]);
		runEffects(effects, EffectKind.Layout);
		flushPassiveEffects(root, effects, synchronousEffects > 0);
	} finally {
		renderingRoot = previousRoot;
	}
};

// #endregion

// #region reconciliation

// marks claimed children outside the stable subsequence.
const MOVED_CHILD = 1;

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

// build the key index only after the in-order scan misses.
const matchChildren = (
	previous: Fiber[],
	values: Array<Child | boolean | null>,
	matches: Array<Fiber | undefined>,
	pass: number,
): boolean => {
	let byKey: Map<number | string, Fiber> | null = null;
	let scan = 0;

	for (let index = 0; index < values.length; index++) {
		const value = values[index];

		if (!isRenderableChild(value)) {
			matches.push(undefined);
			continue;
		}

		const key = childKeyOf(value);
		scan = skipClaimed(previous, scan, pass);

		let match = previous[scan];

		if (matchesInOrder(match, value, key, index)) {
			scan++;
		} else if (match === undefined && byKey === null) {
			matches.push(undefined);
			continue;
		} else {
			if (byKey === null) {
				byKey = new Map();
				for (const fiber of previous) {
					byKey.set(fiber.key ?? fiber.index, fiber);
				}
			}

			const indexed = byKey.get(key ?? index);
			if (indexed === undefined || indexed.pass === pass || !compatible(indexed, value)) {
				matches.push(undefined);
				continue;
			}

			match = indexed;
		}

		match.pass = pass;
		matches.push(match);
	}

	return byKey !== null;
};

// marks children outside the longest increasing slot subsequence.
const markMovedChildren = (matches: Array<Fiber | undefined>): Int32Array => {
	const runs = new Int32Array(matches.length);
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
		runs[index] = low + 1;
	}

	// reconstruct the longest increasing subsequence.
	let remaining = tails.length;
	for (let index = matches.length - 1; index >= 0; index--) {
		const run = runs[index];
		if (run === 0) {
			continue;
		}

		if (run === remaining) {
			runs[index] = 0;
			remaining--;
		} else {
			runs[index] = MOVED_CHILD;
		}
	}

	return runs;
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

const unwrapSoleFragment = (children: any): any => {
	if (isValidElement(children) && children.type === FRAGMENT && children.key === null) {
		return children.props.children;
	}

	return children;
};

// detach dropped nodes before mounting replacements to reduce live DOM work.
const detachDropped = (previous: Fiber[], pass: number, end: Node | null, ops: any[]) => {
	const detach = (node: ChildNode) => {
		// keep the reconciliation anchor attached.
		if (node !== end) {
			ops.push(HostOp.Remove, node);
			noteMutation();
		}
	};

	for (const fiber of previous) {
		if (fiber.pass !== pass) {
			forEachNode(fiber, detach);
		}
	}
};

// the dropped fibers stay mounted when their pass fails, so their nodes must stay too.
const cancelDetached = (ops: any[], start: number, end: number) => {
	for (let index = start; index < end; index += 2) {
		ops[index] = HostOp.Noop;
	}
};

// finds the next claimed child that stays in place.
const nextKeptChild = (matches: Array<Fiber | undefined>, moves: Int32Array | null, from: number): number => {
	for (let index = from; index < matches.length; index++) {
		const match = matches[index];
		if (match !== undefined && match.firstHost !== null && (moves === null || moves[index] !== MOVED_CHILD)) {
			return index;
		}
	}

	return matches.length;
};

const reconcileChildren = (
	parent: Fiber | null,
	previous: Fiber[],
	children: any,
	container: HostContainer,
	end: Node | null,
	root: Root,
): Fiber[] => {
	const unwrapped = unwrapSoleFragment(children);

	// flat JSX arrays can feed the diff without a copy.
	const directValues = directChildArray(unwrapped);
	const values = directValues ?? (childBuffers[reconcileDepth] ??= []);
	if (directValues === null) {
		flattenChildrenInto(unwrapped, values);
	}

	reconcileDepth++;

	const pass = ++reconcilePass;

	let next: Fiber[] | null = null;
	let mounted: Fiber[] | null = null;
	let matches: Array<Fiber | undefined> = EMPTY_CHILDREN;
	let moves: Int32Array | null = null;
	let moved = false;
	const ops = root.ops;
	let detachStart = 0;
	let detachEnd = 0;

	try {
		// plan matches before placement so anchors use valid claims.
		if (previous.length !== 0) {
			matches = [];
			if (matchChildren(previous, values, matches, pass)) {
				moves = markMovedChildren(matches);
				detachStart = ops.length;
				detachDropped(previous, pass, end, ops);
				detachEnd = ops.length;
			}
		}

		// place changes before the next child that stays in place.
		const claimed = matches.length !== 0;
		let kept = claimed ? 0 : values.length;
		let anchor = end;

		for (let index = 0; index < values.length; index++) {
			const value = values[index];
			if (!isRenderableChild(value)) {
				continue;
			}

			if (kept <= index) {
				kept = nextKeptChild(matches, moves, index + 1);
				anchor = kept < matches.length ? matches[kept]!.firstHost : end;
			}

			const match = claimed ? matches[index] : undefined;
			const held = match !== undefined && match.firstHost !== null;
			const fiber = reconcileFiber(parent, match, value, container, anchor, root);

			fiber.index = index;

			if (match === undefined) {
				(mounted ??= []).push(fiber);
			}

			if (held && moves !== null && moves[index] === MOVED_CHILD && fiber.firstHost !== anchor) {
				forEachNode(fiber, (node) => {
					ops.push(HostOp.Insert, container, node, anchor);
				});
				moved = true;
				noteMutation();
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

		cancelDetached(ops, detachStart, detachEnd);

		throw error;
	} finally {
		if (directValues === null) {
			values.length = 0;
		}
		reconcileDepth--;
	}

	let removed = false;
	for (const fiber of previous) {
		if (fiber.pass !== pass) {
			unmountFiber(fiber);
			removed = true;
		}
	}

	// a changed set or order of siblings can shift the boundaries among them.
	if (hasViewTransition && transitionFrame !== null && next !== null && (mounted !== null || moved || removed)) {
		transitionFrame.scopes.push(next);
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
	const frame = hasViewTransition ? transitionFrame : null;
	const outerInserting = inserting;
	if (frame !== null) {
		inserting = true;
	}

	try {
		updateFiber(fiber, value, container, before, UpdateFiber.Mounting);
	} catch (error) {
		unmountFiber(fiber);

		throw error;
	} finally {
		inserting = outerInserting;
	}

	// only the root of an inserted subtree can enter; its boundaries are found once it is built.
	if (frame !== null && !outerInserting) {
		frame.inserted.push(fiber);
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

const subtreeUnchanged = (fiber: Fiber): boolean => (fiber.flags & FiberFlag.SubtreeDirty) === 0;

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

const updateDirtyChildren = (fiber: Fiber, container: HostContainer, before: Node | null) => {
	const mark = fiber.kind === FiberKind.Provider ? pushProvider(fiber) : -1;
	const outerBoundary = enclosingBoundary;
	if (hasViewTransition && fiber.kind === FiberKind.ViewTransition) {
		enclosingBoundary = fiber;
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

			if (
				(child.flags & FiberFlag.ForceUpdate) === 0 &&
				(child.kind === FiberKind.Component ||
					child.kind === FiberKind.Fragment ||
					child.kind === FiberKind.Host ||
					child.kind === FiberKind.Provider ||
					child.kind === FiberKind.ViewTransition)
			) {
				updateDirtyChildren(child, childContainer, anchor);
			} else {
				updateFiber(child, selfVNode(child), childContainer, anchor, UpdateFiber.Forced);
			}

			firstHostMoved ||= child.firstHost !== previousFirstHost;
		}

		if (element !== null && isControlled(element)) {
			fiber.root.ops.push(HostOp.RestoreControlled, element);
		}
	} catch (error) {
		refreshFirstHost(fiber);
		throw error;
	} finally {
		if (mark >= 0) {
			popProviders(mark);
		}
		enclosingBoundary = outerBoundary;
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
		// a hidden activity blanks the node, so the string to restore lives on the fiber.
		if (text.type !== value) {
			text.type = value;
			if (detached) {
				text.node.data = value;
			} else {
				text.root.ops.push(HostOp.Text, text.node, value);
				noteMutation();
			}
		}
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
	const wasDetached = detached;

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
					updateProps(element, previousProps, vnode.props, fiber);
				} else {
					// markup replaces the child nodes, so their fibers go now.
					if (vnode.props.dangerouslySetInnerHTML && fiber.children.length !== 0) {
						discardChildren(fiber);
					}
					// rejected while rendering, where a boundary can catch it, rather than at commit.
					assertStyleObject(vnode.props.style);
					// a host re-rendered by its parent usually changes only its children array.
					if (hostPropsDiffer(previousProps, vnode.props)) {
						fiber.root.ops.push(HostOp.Props, element, previousProps, vnode.props, fiber);
						if (hasViewTransition && transitionFrame !== null && hasVisualChange(previousProps, vnode.props)) {
							noteMutation();
						}
					}
				}

				// a fresh element stays detached until commit; a live one defers its children too.
				detached = mounting;

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
				if (mounting) {
					restoreControlled(element);
					if (vnode.props.defaultValue != null) {
						applySelectDefault(element, vnode.props);
					}
				} else if (isControlled(element)) {
					fiber.root.ops.push(HostOp.RestoreControlled, element);
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
					queueRefAttach(fiber, nextRef, element);
				}

				break;
			}
			case FiberKind.Fragment: {
				fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				break;
			}
			case FiberKind.ViewTransition: {
				if (!hasViewTransition) {
					break;
				}

				// counted before the children render, so a failed mount's teardown takes back what it added.
				namedBoundaries +=
					Number(isExplicitName(vnode.props.name)) - Number(!mounting && isExplicitName(previousProps.name));

				const outerBoundary = enclosingBoundary;
				enclosingBoundary = fiber;
				try {
					fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				} finally {
					enclosingBoundary = outerBoundary;
				}

				const previousRef = previousProps.ref;
				const nextRef = vnode.props.ref;
				if ((previousRef != null || nextRef != null) && (mounting || previousRef !== nextRef)) {
					queueRefDetach(fiber);
					queueRefAttach(fiber, nextRef, transitionInstance(fiber));
				}

				break;
			}
			case FiberKind.Activity: {
				if (!hasActivity) {
					break;
				}

				fiber.flags &= ~FiberFlag.ForceUpdate;

				const hidden = vnode.props.mode === 'hidden';
				const wasHidden = (fiber.flags & FiberFlag.Hidden) !== 0;
				// keep it hidden during reveal so only reactivation queues its effects.
				fiber.flags = hidden || wasHidden ? fiber.flags | FiberFlag.Hidden : fiber.flags & ~FiberFlag.Hidden;
				if (hidden && !wasHidden) {
					fiber.root.hidden.add(fiber);
					deactivateFiber(fiber);
					// hiding exits the boundaries as they were before this render.
					if (hasViewTransition && transitionFrame !== null && !mounting) {
						collectChildBoundaries(fiber, transitionFrame.exits);
						noteMutation();
					}
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
					fiber.root.ops.push(HostOp.Show, fiber);
					reactivateFiber(fiber);
					if (hasViewTransition && transitionFrame !== null) {
						collectChildBoundaries(fiber, transitionFrame.enters);
						noteMutation();
					}
				}

				break;
			}
			case FiberKind.Provider: {
				const mark = pushProvider(fiber);

				if (!mounting && !Object.is(previousProps.value, vnode.props.value)) {
					notifyConsumers(fiber);
				}

				try {
					fiber.children = reconcileInnerChildren(fiber, vnode.props.children, container, before);
				} finally {
					popProviders(mark);
				}

				break;
			}
			case FiberKind.Portal: {
				if (!hasPortal) {
					break;
				}

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
					fiber.root.ops.push(
						HostOp.Insert,
						target,
						fiber.portalStart,
						null,
						HostOp.Insert,
						target,
						fiber.portalEnd,
						null,
					);
				}

				// the target is outside this tree, so its children are live whatever the portal's own state.
				detached = false;
				fiber.children = reconcileInnerChildren(fiber, vnode.props.children, target, fiber.portalEnd);
				break;
			}
			case FiberKind.Suspense: {
				if (!hasSuspense) {
					break;
				}

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
				if (!hasErrorBoundary) {
					break;
				}

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
		detached = wasDetached;
		// leave the dirty path in place; the retry has to reach the same descendants.
		refreshFirstHost(fiber);
		throw error;
	}
	detached = wasDetached;

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
	// avoid retaining duplicate reactions to a thenable that may never settle.
	if (fiber.pendingThenable === thenable) {
		return;
	}

	fiber.pendingThenable = thenable;

	const retry = () => {
		fiber.pendingThenable = undefined;

		if (isUnmounted(fiber)) {
			return;
		}

		// the pass that suspended has since cleared the path down to this boundary.
		markForceUpdate(fiber);

		// the boundary can sit under an ancestor that already bailed out, so render from the root.
		fiber.root.fullRender = true;
		// a reveal animates like a transition, without the types of the one that suspended.
		if (hasViewTransition) {
			fiber.root.transitionLane = true;
		}
		queueRootWork(fiber.root, fiber);
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

const rerenderFiber = (fiber: Fiber) => {
	const previousFirstHost = fiber.firstHost;
	let container: HostContainer | undefined;
	let providers: Fiber[] | undefined;
	let boundary: Fiber | null = null;
	for (let parent = fiber.parent; parent !== null; parent = parent.parent) {
		switch (parent.kind) {
			case FiberKind.Host: {
				container ??= parent.node;
				break;
			}
			case FiberKind.Portal: {
				container ??= parent.props.container;
				break;
			}
			case FiberKind.Provider: {
				(providers ??= []).push(parent);
				break;
			}
			case FiberKind.ViewTransition: {
				boundary ??= parent;
				break;
			}
		}
	}
	container ??= fiber.root.container;

	// apply provider context outermost first.
	const mark = providerStack.length;
	if (providers) {
		for (let index = providers.length - 1; index >= 0; index--) {
			pushProvider(providers[index]);
		}
	}

	const outerBoundary = enclosingBoundary;
	enclosingBoundary = boundary;

	try {
		updateFiber(fiber, selfVNode(fiber), container, nextNode(fiber), UpdateFiber.Forced);
	} finally {
		enclosingBoundary = outerBoundary;
		popProviders(mark);
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
			if (hasActivity) {
				return FiberKind.Activity;
			}

			break;
		}
		case SUSPENSE: {
			if (hasSuspense) {
				return FiberKind.Suspense;
			}

			break;
		}
		case ERROR_BOUNDARY: {
			if (hasErrorBoundary) {
				return FiberKind.ErrorBoundary;
			}

			break;
		}
		case PORTAL: {
			if (hasPortal) {
				return FiberKind.Portal;
			}

			break;
		}
		case VIEW_TRANSITION: {
			if (hasViewTransition) {
				return FiberKind.ViewTransition;
			}

			break;
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

// flat context/value/provider frames avoid per-provider allocations.
const providerStack: any[] = [];

const pushProvider = (fiber: Fiber): number => {
	const context = providerContext(fiber.type);
	const mark = providerStack.length;
	providerStack.push(context, context.currentValue, context.currentProvider);
	context.currentValue = fiber.props.value;
	context.currentProvider = fiber;

	return mark;
};

const popProviders = (mark: number) => {
	for (let index = providerStack.length - 3; index >= mark; index -= 3) {
		const context: Context<any> = providerStack[index];
		context.currentValue = providerStack[index + 1];
		context.currentProvider = providerStack[index + 2];
	}
	providerStack.length = mark;
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
			insertNode(root, container, node, before);
			return createFiberNode(kind, node, parent, value, root, type);
		}
		case FiberKind.Host: {
			const namespace = hostNamespace(container, type);
			const element: HostElement =
				namespace === HTML_NAMESPACE
					? document.createElement(type)
					: document.createElementNS(namespace, type);
			insertNode(root, container, element, before);
			return createFiberNode(kind, element, parent, value, root, type);
		}
		default: {
			return createFiberNode(kind, null, parent, value, root, type);
		}
	}
};

// `instanceof` reads no property of the container, see `insertChild`.
const hostNamespace = (container: HostContainer, type: string): string => {
	return type === 'svg' || (container instanceof SVGElement && !(container instanceof SVGForeignObjectElement))
		? SVG_NAMESPACE
		: HTML_NAMESPACE;
};

// a <form> exposes its controls as named properties that shadow its prototype, so every method or
// accessor read on one searches its controls, and a mutation invalidates the index that search
// uses. placing n controls into a form that way costs O(n²); calling through the prototypes skips it.
/* oxlint-disable typescript/unbound-method -- each is called with an explicit receiver */
const domPrototypes =
	typeof Node === 'undefined'
		? null
		: {
				elementMoveBefore: SUPPORTS_MOVE_BEFORE ? Element.prototype.moveBefore : null,
				fragmentMoveBefore: SUPPORTS_MOVE_BEFORE ? DocumentFragment.prototype.moveBefore : null,
				insertBefore: Node.prototype.insertBefore,
				parentNode: Object.getOwnPropertyDescriptor(Node.prototype, 'parentNode')!.get!,
				removeChild: Node.prototype.removeChild,
			};
/* oxlint-enable typescript/unbound-method */

const insertChild = (container: HostContainer, node: Node, before: Node | null) => {
	domPrototypes!.insertBefore.call(container, node, before);
};

const parentOf = (node: Node): ParentNode | null => domPrototypes!.parentNode.call(node);

const removeNode = (node: Node) => {
	const parent = parentOf(node);
	if (parent !== null) {
		domPrototypes!.removeChild.call(parent, node);
	}
};

const moveNode = (container: HostContainer, node: Node, before: Node | null) => {
	if (SUPPORTS_MOVE_BEFORE && parentOf(node) === container) {
		const move = container instanceof Element ? domPrototypes!.elementMoveBefore : domPrototypes!.fragmentMoveBefore;
		move!.call(container, node, before);
	} else {
		insertChild(container, node, before);
	}
};

// places a node now when its container is still detached, otherwise at commit.
const insertNode = (root: Root, container: HostContainer, node: Node, before: Node | null) => {
	if (detached) {
		insertChild(container, node, before);
	} else {
		root.ops.push(HostOp.Insert, container, node, before);
		noteMutation();
	}
};

const applyHostOps = (ops: any[]) => {
	try {
		replayHostOps(ops);
	} finally {
		ops.length = 0;
	}
};

// entries per op, opcode included, indexed by `HostOp`.
const hostOpWidths = [4, 2, 5, 2, 2, 2, 3];

// render already treated every op as done, so one that throws can't stop the ones after it.
const replayHostOps = (ops: any[]) => {
	let failure: { error: unknown } | null = null;
	for (let index = 0; index < ops.length; ) {
		const op: HostOp = ops[index];
		try {
			switch (op) {
				case HostOp.Insert: {
					moveNode(ops[index + 1], ops[index + 2], ops[index + 3]);
					break;
				}
				case HostOp.Props: {
					updateProps(ops[index + 1], ops[index + 2], ops[index + 3], ops[index + 4]);
					break;
				}
				case HostOp.Remove: {
					removeNode(ops[index + 1]);
					break;
				}
				case HostOp.RestoreControlled: {
					restoreControlled(ops[index + 1]);
					break;
				}
				case HostOp.Show: {
					showChildren(ops[index + 1]);
					break;
				}
				case HostOp.Text: {
					ops[index + 1].data = ops[index + 2];
					break;
				}
			}
		} catch (error) {
			failure ??= { error };
		}
		index += hostOpWidths[op];
	}
	if (failure !== null) {
		throw failure.error;
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

const queueRefAttach = (fiber: Fiber, ref: any, value: any) => {
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
	if (hasViewTransition && fiber.kind === FiberKind.ViewTransition && isExplicitName(fiber.props.name)) {
		namedBoundaries--;
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

	// the subtree still holds its old nodes, so its boundaries can be named for the old snapshot.
	if (hasViewTransition && transitionFrame !== null) {
		transitionFrame.removed.push(fiber);
		// inside a hidden activity there was nothing on screen to exit.
		if (!isDeactivated(fiber)) {
			collectBoundaries(fiber, transitionFrame.exits);
		}
		noteMutation();
	}

	unmountFiberTree(fiber);
	fiber.root.queues[CommitQueue.Removal].push(() => {
		forEachNode(fiber, removeNode);
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
		queueRefAttach(fiber, fiber.props.ref, fiber.node);
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

// whether `updateProps` would write anything.
const hostPropsDiffer = (previous: Props, next: Props): boolean => {
	for (const name in next) {
		if (name !== 'children' && !Object.is(previous[name], next[name])) {
			return true;
		}
	}
	for (const name in previous) {
		if (name !== 'children' && !Object.hasOwn(next, name)) {
			return true;
		}
	}
	return false;
};

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

const attributeNamespaces: Record<string, string> = {
	xlink: 'http://www.w3.org/1999/xlink',
	xml: 'http://www.w3.org/XML/1998/namespace',
	xmlns: 'http://www.w3.org/2000/xmlns/',
};

// react spells a namespaced attribute as its prefix followed by the local name
const namespacedAttribute = /^(xmlns|xlink|xml)([A-Z]\w*)$/;

const writeAttribute = (element: HostElement, name: string, value: string | null) => {
	const namespaced = name.charCodeAt(0) === 120 ? namespacedAttribute.exec(name) : null;
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

	const attribute = hyphenatedAttributes.has(name)
		? name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
		: name;
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

const assertStyleObject: (style: unknown) => asserts style is Record<string, StyleValue> | null | undefined = (
	style,
) => {
	if (typeof style === 'string') {
		throw new TypeError(`the \`style\` prop expects a property-to-value mapping, not a string.`);
	}
};

const setStyle = (
	style: CSSStyleDeclaration,
	previous: Record<string, StyleValue> | string | null | undefined,
	next: Record<string, StyleValue> | string | null | undefined,
) => {
	assertStyleObject(next);
	// a rejected string stays on the fiber's props but never reached the element.
	if (typeof previous === 'string') {
		previous = null;
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
	Change: 'input',
	DoubleClick: 'dblclick',
	Focus: 'focusin',
};

const handlerKey = (name: string, capture: boolean): `__scion$${string}` => {
	return `__scion$${name}${capture ? 'Capture' : ''}`;
};

// ignore handlers attached after the current dispatch began.
let eventClock = 0;

// libraries written against react feature-detect this surface on the event they
// are handed — base-ui and radix both do — so every dispatch path has to paint it
// on before invoking a handler. mutates `event` in place.
const paintSyntheticSurface = (event: ScionEvent) => {
	event.nativeEvent ??= event;
	event.isDefaultPrevented ??= () => event.defaultPrevented;
	event.isPropagationStopped ??= () => event.cancelBubble;
	event.persist ??= () => {};
};

const createEventProxy = (capture: boolean) => {
	return (event: ScionEvent): void => {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		const element = event.currentTarget as HostElement;
		const record = element[handlerKey(event.type, capture)];

		// stamp events even if the handler was removed during propagation.
		event.__scionDispatch ??= eventClock++;
		try {
			if (record && event.__scionDispatch >= record.attachedAt) {
				paintSyntheticSurface(event);
				record.handler(event);
			}
		} finally {
			if (event.type === 'input' && isControlled(element)) {
				queueMicrotask(() => {
					const root = element.__scionFiber?.root;
					// the props of a pass awaiting its commit aren't on screen yet, so restore with it.
					if (root?.pendingCommit != null) {
						root.ops.push(HostOp.RestoreControlled, element);
					} else {
						restoreControlled(element);
					}
				});
			}
		}
	};
};

const eventProxy = createEventProxy(false);
const eventProxyCapture = createEventProxy(true);

const setEvent = (element: HostElement, prop: string, handler: any, fiber: Fiber) => {
	// pointer capture event names end in `Capture` even for bubble handlers.
	const capture = prop.endsWith('Capture') && !prop.endsWith('PointerCapture');
	const reactName = prop.slice(2, capture ? -7 : undefined);
	const name = eventNames[reactName] ?? reactName.toLowerCase();
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
		if (hasPortal) {
			registerPortalEvent(fiber.root, name);
		}

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
		paintSyntheticSurface(event);
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

const flushPassiveEffects = (root: Root, effects: PendingEffect | null, synchronous: boolean) => {
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

// #region view transitions

interface TransitionFrame {
	// boundaries a reveal or insertion brought in, and those a hide or removal took out.
	enters: Fiber[];
	exits: Fiber[];
	// roots of inserted and removed subtrees, searched for named pairs.
	inserted: Fiber[];
	removed: Fiber[];
	// boundaries owning a host mutation, and the host targets boundaries had before this pass.
	mutated: Set<Fiber>;
	oldTargets: Map<Fiber, HostElement[]>;
	// sibling lists whose set or order changed.
	scopes: Fiber[][];
	types: string[];
}

const enum Trigger {
	Enter,
	Exit,
	Share,
	Update,
}

// the class prop and event prop for each `Trigger`.
const triggerClasses = ['enter', 'exit', 'share', 'update'];
const triggerEvents = ['onEnter', 'onExit', 'onShare', 'onUpdate'];

interface Participant {
	fiber: Fiber;
	// the incoming half of a pair animates without an event of its own.
	notify: boolean;
	trigger: Trigger;
}

// a surviving boundary that may update; whether it does is known once the new layout is.
interface UpdateCandidate {
	className: string | null;
	fiber: Fiber;
	mutated: boolean;
	oldElements: HostElement[];
	oldRects: DOMRect[];
}

// a boundary entering or leaving, before it is known to have anything on screen.
interface Placement {
	className: string | null;
	elements: HostElement[];
	fiber: Fiber;
	notify: boolean;
	trigger: Trigger;
}

interface TransitionPlan {
	candidates: UpdateCandidate[];
	document: Document;
	enters: Fiber[];
	frame: TransitionFrame;
	// boundaries already given a role, so none animates twice.
	handled: Set<Fiber>;
	// elements carrying a temporary name, restored once the browser has captured them.
	named: HostElement[];
	// explicit names shared by an outgoing and an incoming boundary, to the incoming one.
	pairs: Map<string, Fiber>;
	participants: Participant[];
}

// mounted boundaries with an explicit name; pairs are only searched for while there are some.
let namedBoundaries = 0;
let nextAutoName = 0;
const autoNames = new WeakMap<Fiber, string>();
// the document's running view transition, which later transition work waits behind.
let activeTransition: ViewTransition | null = null;
const waitingRoots: Root[] = [];

const isExplicitName = (name: unknown): name is string => typeof name === 'string' && name !== 'auto';

const boundaryName = (fiber: Fiber): string => {
	const name = fiber.props.name;
	if (isExplicitName(name)) {
		return name;
	}
	let auto = autoNames.get(fiber);
	if (auto === undefined) {
		auto = `_scion-vt-${(nextAutoName++).toString(36)}`;
		autoNames.set(fiber, auto);
	}
	return auto;
};

// a name that is not a valid identifier is encoded; it still works, but can't be selected in CSS.
const cssName = (name: string): string => {
	if (CSS.escape(name) === name) {
		return name;
	}
	let binary = '';
	for (const byte of new TextEncoder().encode(name)) {
		binary += String.fromCharCode(byte);
	}
	return `r-${btoa(binary).replace(/=/g, '')}`;
};

const noteMutation = () => {
	const frame = transitionFrame;
	const boundary = enclosingBoundary;
	if (hasViewTransition && frame !== null && boundary !== null && !frame.mutated.has(boundary)) {
		// the first mutation is recorded before any fiber below it changes, so these are the
		// targets the old snapshot shows.
		frame.oldTargets.set(boundary, hostTargets(boundary, true, []));
		frame.mutated.add(boundary);
	}
};

// `setProp` writes nothing for these, and handlers swap on every render without changing a pixel.
const invisibleProps = new Set([
	'autoFocus',
	'children',
	'key',
	'ref',
	'suppressContentEditableWarning',
	'suppressHydrationWarning',
]);

const isVisualProp = (name: string): boolean => !invisibleProps.has(name) && !name.startsWith('on');

const sameStyle = (previous: any, next: any): boolean => {
	if (previous == null || next == null) {
		return previous == next;
	}
	for (const name in next) {
		if (!Object.is(previous[name], next[name])) {
			return false;
		}
	}
	for (const name in previous) {
		if (!(name in next)) {
			return false;
		}
	}
	return true;
};

const hasVisualChange = (previous: Props, next: Props): boolean => {
	for (const name in next) {
		if (
			isVisualProp(name) &&
			!Object.is(previous[name], next[name]) &&
			(name !== 'style' || !sameStyle(previous.style, next.style))
		) {
			return true;
		}
	}
	for (const name in previous) {
		if (isVisualProp(name) && !Object.hasOwn(next, name)) {
			return true;
		}
	}
	return false;
};

// the outermost boundaries of a subtree that no host node encloses.
const collectBoundaries = (fiber: Fiber, result: Fiber[]) => {
	switch (fiber.kind) {
		case FiberKind.ViewTransition: {
			result.push(fiber);
			return;
		}
		case FiberKind.Host:
		case FiberKind.Portal:
		case FiberKind.Text: {
			return;
		}
		case FiberKind.Activity: {
			if ((fiber.flags & FiberFlag.Hidden) !== 0) {
				return;
			}
			break;
		}
	}
	collectChildBoundaries(fiber, result);
};

const collectChildBoundaries = (fiber: Fiber, result: Fiber[]) => {
	for (const child of fiber.children) {
		collectBoundaries(child, result);
	}
};

// every visible boundary with an explicit name, however deep.
const collectNamed = (fiber: Fiber, result: Map<string, Fiber>) => {
	if (fiber.kind === FiberKind.Activity && (fiber.flags & FiberFlag.Hidden) !== 0) {
		return;
	}
	if (fiber.kind === FiberKind.ViewTransition && isExplicitName(fiber.props.name)) {
		result.set(fiber.props.name, fiber);
	}
	for (const child of fiber.children) {
		collectNamed(child, result);
	}
};

// the nearest host elements of a boundary; an update leaves nested boundaries to animate themselves.
const hostTargets = (fiber: Fiber, stopAtBoundaries: boolean, result: HostElement[]): HostElement[] => {
	for (const child of fiber.children) {
		switch (child.kind) {
			case FiberKind.Host: {
				result.push(child.node);
				break;
			}
			case FiberKind.Portal:
			case FiberKind.Text: {
				break;
			}
			case FiberKind.Activity: {
				if ((child.flags & FiberFlag.Hidden) === 0) {
					hostTargets(child, stopAtBoundaries, result);
				}
				break;
			}
			case FiberKind.ViewTransition: {
				if (!stopAtBoundaries) {
					hostTargets(child, stopAtBoundaries, result);
				}
				break;
			}
			default: {
				hostTargets(child, stopAtBoundaries, result);
			}
		}
	}
	return result;
};

// the sibling list a boundary sits in, looking through wrappers that hold nothing else.
const siblingScope = (fiber: Fiber): Fiber[] => {
	let scope = fiber;
	while (
		scope.parent !== null &&
		scope.parent.children.length === 1 &&
		scope.parent.kind !== FiberKind.Host &&
		scope.parent.kind !== FiberKind.Portal &&
		scope.parent.kind !== FiberKind.ViewTransition
	) {
		scope = scope.parent;
	}
	return scope.parent ? scope.parent.children : scope.root.fibers;
};

const classByType = (value: any, types: string[]): string | null | undefined => {
	if (value == null || typeof value === 'string') {
		return value;
	}
	let className: string | null = null;
	for (const type of types) {
		const match = value[type];
		if (match != null) {
			if (match === 'none') {
				return 'none';
			}
			className = className === null ? match : `${className} ${match}`;
		}
	}
	return className ?? value.default;
};

// the class a boundary animates with for a trigger; null is the browser default, 'none' opts out.
const transitionClass = (props: Props, trigger: Trigger, types: string[]): string | null => {
	const base = classByType(props.default, types);
	const event = classByType(props[triggerClasses[trigger]], types);
	if (event == null) {
		return base == null || base === 'auto' ? null : base;
	}
	return event === 'auto' ? null : event;
};

const isInViewport = (rect: DOMRect, window: Window): boolean =>
	rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;

const anyInViewport = (rects: DOMRect[], window: Window): boolean => {
	for (const rect of rects) {
		if (isInViewport(rect, window)) {
			return true;
		}
	}
	return false;
};

const measure = (elements: HostElement[]): DOMRect[] => elements.map((element) => element.getBoundingClientRect());

const sameRects = (previous: DOMRect[], next: DOMRect[]): boolean => {
	if (previous.length !== next.length) {
		return false;
	}
	for (let index = 0; index < previous.length; index++) {
		const a = previous[index];
		const b = next[index];
		if (a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height) {
			return false;
		}
	}
	return true;
};

const partName = (name: string, index: number): string => (index === 0 ? name : `${name}_${index}`);

const nameElements = (plan: TransitionPlan, elements: HostElement[], name: string, className: string | null) => {
	const escaped = cssName(name);
	for (let index = 0; index < elements.length; index++) {
		const style = elements[index].style;
		style.setProperty('view-transition-name', partName(escaped, index));
		style.setProperty('view-transition-class', className ?? '');
		plan.named.push(elements[index]);
	}
};

// puts back whatever the element's own style prop says about view transitions.
const restoreNames = (elements: HostElement[]) => {
	for (const element of elements) {
		const style = element.__scionFiber?.props.style;
		element.style.setProperty('view-transition-name', String(style?.viewTransitionName ?? ''));
		element.style.setProperty('view-transition-class', String(style?.viewTransitionClass ?? ''));
	}
};

const supportsViewTransitions = (document: Document): boolean => {
	// object options and types arrived after the first shipping version; animate only with both.
	const Type = Reflect.get(document.defaultView ?? {}, 'ViewTransition');
	return (
		typeof document.startViewTransition === 'function' &&
		typeof Type === 'function' &&
		'types' in Type.prototype
	);
};

// starts recording what a pass may animate, if its work came from transitions alone.
const openTransitionFrame = (root: Root): TransitionFrame | null => {
	const eligible = root.transitionLane && !root.urgentLane && synchronousEffects === 0;
	const types = root.transitionTypes ?? [];
	root.transitionLane = false;
	root.urgentLane = false;
	root.transitionTypes = null;
	if (!eligible || !supportsViewTransitions(root.container.ownerDocument)) {
		return null;
	}
	return {
		enters: [],
		exits: [],
		inserted: [],
		mutated: new Set(),
		oldTargets: new Map(),
		removed: [],
		scopes: [],
		types,
	};
};

const releaseWaitingRoots = () => {
	const released = waitingRoots.splice(0);
	for (const root of released) {
		if (!root.disposed && !root.scheduled) {
			root.scheduled = true;
			dirtyRoots.push(root);
		}
	}
	if (released.length !== 0) {
		flushRoots();
	}
};

// transition work waits for the running view transition, batching into one later pass. urgent
// work can't wait; `renderRootWork` lands any pass still waiting on its snapshot before it renders.
const holdForViewTransition = (root: Root): boolean => {
	if (root.urgentLane || synchronousEffects > 0) {
		return false;
	}
	if (root.pendingCommit !== null || (activeTransition !== null && root.transitionLane)) {
		if (!waitingRoots.includes(root)) {
			waitingRoots.push(root);
		}
		return true;
	}
	return false;
};

// names the old state of everything that may animate, or returns null when nothing can.
const planViewTransition = (document: Document, frame: TransitionFrame): TransitionPlan | null => {
	const window = document.defaultView!;
	const types = frame.types;
	const plan: TransitionPlan = {
		candidates: [],
		document,
		enters: [...frame.enters],
		frame,
		handled: new Set(),
		named: [],
		pairs: new Map(),
		participants: [],
	};

	for (const fiber of frame.inserted) {
		if (!isUnmounted(fiber) && !isDeactivated(fiber)) {
			collectBoundaries(fiber, plan.enters);
		}
	}

	const outgoing: Placement[] = [];
	if (namedBoundaries > 0 && frame.removed.length !== 0 && frame.inserted.length !== 0) {
		const before = new Map<string, Fiber>();
		const after = new Map<string, Fiber>();
		for (const fiber of frame.removed) {
			collectNamed(fiber, before);
		}
		for (const fiber of frame.inserted) {
			if (!isUnmounted(fiber)) {
				collectNamed(fiber, after);
			}
		}
		for (const [name, fiber] of before) {
			const incoming = after.get(name);
			const className = transitionClass(fiber.props, Trigger.Share, types);
			if (
				incoming === undefined ||
				className === 'none' ||
				transitionClass(incoming.props, Trigger.Share, types) === 'none'
			) {
				continue;
			}
			plan.pairs.set(name, incoming);
			plan.handled.add(fiber);
			outgoing.push({
				className,
				elements: hostTargets(fiber, false, []),
				fiber,
				notify: true,
				trigger: Trigger.Share,
			});
		}
	}

	for (const fiber of frame.exits) {
		if (plan.handled.has(fiber)) {
			continue;
		}
		plan.handled.add(fiber);
		const className = transitionClass(fiber.props, Trigger.Exit, types);
		if (className !== 'none') {
			outgoing.push({
				className,
				elements: hostTargets(fiber, false, []),
				fiber,
				notify: true,
				trigger: Trigger.Exit,
			});
		}
	}

	const updating = new Set(frame.mutated);
	const swept = new Set<Fiber[]>();
	const sweep = (scope: Fiber[]) => {
		if (swept.has(scope)) {
			return;
		}
		swept.add(scope);
		const found: Fiber[] = [];
		for (const fiber of scope) {
			collectBoundaries(fiber, found);
		}
		for (const boundary of found) {
			updating.add(boundary);
		}
	};
	for (const scope of frame.scopes) {
		sweep(scope);
	}
	for (const fiber of frame.mutated) {
		sweep(siblingScope(fiber));
		for (let parent = fiber.parent; parent !== null && !updating.has(parent); parent = parent.parent) {
			if (parent.kind === FiberKind.ViewTransition) {
				updating.add(parent);
			}
		}
	}
	const entering = new Set(plan.enters);
	for (const fiber of updating) {
		if (plan.handled.has(fiber) || entering.has(fiber) || isUnmounted(fiber)) {
			continue;
		}
		plan.handled.add(fiber);
		const className = transitionClass(fiber.props, Trigger.Update, types);
		if (className === 'none') {
			continue;
		}
		const oldElements = (frame.oldTargets.get(fiber) ?? hostTargets(fiber, true, [])).filter(
			(element) => element.isConnected,
		);
		if (oldElements.length !== 0) {
			plan.candidates.push({
				className,
				fiber,
				mutated: frame.mutated.has(fiber),
				oldElements,
				oldRects: [],
			});
		}
	}

	// every layout read happens before the first name is written.
	for (const candidate of plan.candidates) {
		candidate.oldRects = measure(candidate.oldElements);
	}
	for (const entry of outgoing) {
		entry.elements = entry.elements.filter((element) => element.isConnected);
	}
	for (const { fiber, trigger } of placeEntries(plan, outgoing, window)) {
		// a pair whose outgoing side has nothing on screen falls back to a plain enter.
		if (trigger === Trigger.Share) {
			plan.pairs.delete(fiber.props.name);
		}
	}
	for (const candidate of plan.candidates) {
		nameElements(plan, candidate.oldElements, boundaryName(candidate.fiber), candidate.className);
	}

	if (plan.participants.length === 0 && plan.candidates.length === 0 && plan.enters.length === 0) {
		return null;
	}
	return plan;
};

// names the new state once the pass has committed, and cancels the candidates that didn't move.
const finalizeViewTransition = (plan: TransitionPlan, animations: Animation[], suppressRoot: boolean) => {
	const { document, frame } = plan;
	const window = document.defaultView!;
	const documentElement = document.documentElement;
	const types = frame.types;

	const incoming: Placement[] = [];
	const enter = (fiber: Fiber, trigger: Trigger) => {
		if (plan.handled.has(fiber) || isUnmounted(fiber)) {
			return;
		}
		plan.handled.add(fiber);
		const className = transitionClass(fiber.props, trigger, types);
		if (className !== 'none') {
			// the incoming half of a pair animates without an event of its own.
			const notify = trigger === Trigger.Enter;
			incoming.push({ className, elements: hostTargets(fiber, false, []), fiber, notify, trigger });
		}
	};
	for (const fiber of plan.enters) {
		enter(fiber, plan.pairs.get(fiber.props.name) === fiber ? Trigger.Share : Trigger.Enter);
	}
	// the incoming half of a pair can sit deep inside what was inserted.
	for (const fiber of plan.pairs.values()) {
		enter(fiber, Trigger.Share);
	}

	// every layout read happens before the first new name is written.
	const newElements = plan.candidates.map((candidate) =>
		isUnmounted(candidate.fiber) ? [] : hostTargets(candidate.fiber, true, []),
	);
	const newRects = newElements.map(measure);
	placeEntries(plan, incoming, window);

	const animating = new Set<Fiber>();
	for (const participant of plan.participants) {
		animating.add(participant.fiber);
	}

	const unchanged: number[] = [];
	for (let index = 0; index < plan.candidates.length; index++) {
		const candidate = plan.candidates[index];
		const changed = candidate.mutated || !sameRects(candidate.oldRects, newRects[index]);
		const visible = anyInViewport(candidate.oldRects, window) || anyInViewport(newRects[index], window);
		if (changed && visible) {
			nameElements(plan, newElements[index], boundaryName(candidate.fiber), candidate.className);
			plan.participants.push({ fiber: candidate.fiber, notify: true, trigger: Trigger.Update });
			animating.add(candidate.fiber);
		} else {
			unchanged.push(index);
		}
	}

	for (const index of unchanged) {
		const candidate = plan.candidates[index];
		// hiding a captured child would leave a hole in an animating parent, so it rides along unchanged.
		if (hasAnimatingAncestor(candidate.fiber, animating)) {
			nameElements(plan, newElements[index], boundaryName(candidate.fiber), candidate.className);
			continue;
		}
		// the old snapshot is already taken; hiding its group leaves the live element showing.
		const escaped = cssName(boundaryName(candidate.fiber));
		for (let part = 0; part < candidate.oldElements.length; part++) {
			animations.push(
				documentElement.animate(
					{ opacity: [0, 0], pointerEvents: ['none', 'none'] },
					{
						duration: 0,
						fill: 'forwards',
						pseudoElement: `::view-transition-group(${partName(escaped, part)})`,
					},
				),
			);
		}
	}

	// with the page itself uncaptured, let pointer events through to whatever isn't animating.
	if (suppressRoot) {
		animations.push(
			documentElement.animate(
				{ height: [0, 0], width: [0, 0] },
				{ duration: 0, fill: 'forwards', pseudoElement: '::view-transition' },
			),
		);
	}
};

// names the entries with something on screen and makes them participants, measuring all of them
// before writing any name. returns the entries left out.
const placeEntries = (plan: TransitionPlan, entries: Placement[], window: Window): Placement[] => {
	const rects = entries.map((entry) => measure(entry.elements));
	const skipped: Placement[] = [];
	for (let index = 0; index < entries.length; index++) {
		const entry = entries[index];
		if (entry.elements.length === 0 || !anyInViewport(rects[index], window)) {
			skipped.push(entry);
			continue;
		}
		nameElements(plan, entry.elements, boundaryName(entry.fiber), entry.className);
		plan.participants.push({ fiber: entry.fiber, notify: entry.notify, trigger: entry.trigger });
	}
	return skipped;
};

// the animation can run for seconds; past finalizing, only names, participants, and types are read,
// so the removed subtrees and measurements the rest holds can go.
const releaseTransitionPlan = (plan: TransitionPlan) => {
	const frame = plan.frame;
	plan.candidates = [];
	plan.enters = [];
	plan.handled.clear();
	plan.pairs.clear();
	frame.enters = [];
	frame.exits = [];
	frame.inserted = [];
	frame.removed = [];
	frame.scopes = [];
	frame.mutated.clear();
	frame.oldTargets.clear();
};

const hasAnimatingAncestor = (fiber: Fiber, animating: Set<Fiber>): boolean => {
	for (let parent = fiber.parent; parent !== null; parent = parent.parent) {
		if (animating.has(parent)) {
			return true;
		}
	}
	return false;
};

const pseudoElement = (document: Document, part: string, name: string) => {
	const selector = `::view-transition-${part}(${name})`;
	return {
		animate(keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
			const timing: KeyframeAnimationOptions = typeof options === 'number' ? { duration: options } : { ...options };
			timing.pseudoElement = selector;
			return document.documentElement.animate(keyframes, timing);
		},
		getAnimations() {
			return document.documentElement
				.getAnimations({ subtree: true })
				.filter((animation) => Reflect.get(animation.effect ?? {}, 'pseudoElement') === selector);
		},
		getComputedStyle() {
			return document.defaultView!.getComputedStyle(document.documentElement, selector);
		},
	};
};

const transitionInstance = (fiber: Fiber) => {
	const document = fiber.root.container.ownerDocument;
	const name = cssName(boundaryName(fiber));
	return {
		group: pseudoElement(document, 'group', name),
		imagePair: pseudoElement(document, 'image-pair', name),
		name,
		new: pseudoElement(document, 'new', name),
		old: pseudoElement(document, 'old', name),
	};
};

const dispatchTransitionEvents = (plan: TransitionPlan, cleanups: Array<() => void>) => {
	const types = [...plan.frame.types];
	for (const participant of plan.participants) {
		if (!participant.notify) {
			continue;
		}
		const handler = participant.fiber.props[triggerEvents[participant.trigger]];
		if (typeof handler === 'function') {
			try {
				const cleanup = handler(transitionInstance(participant.fiber), types);
				if (typeof cleanup === 'function') {
					cleanups.push(cleanup);
				}
			} catch (error) {
				reportAsync(error);
			}
		}
	}
};

// hands a rendered pass to the browser to commit between its old and new snapshots. returns false
// when nothing participates, leaving the caller to commit as usual.
const startViewTransitionFrame = (root: Root, frame: TransitionFrame, failed: boolean): boolean => {
	const document = root.container.ownerDocument;
	const plan = planViewTransition(document, frame);
	if (plan === null) {
		return false;
	}

	const documentElement = document.documentElement;
	// the page stays live and uncaptured, so only participating boundaries animate.
	const suppressRoot = documentElement.style.getPropertyValue('view-transition-name') === '';
	if (suppressRoot) {
		documentElement.style.setProperty('view-transition-name', 'none');
	}
	const restoreRoot = () => {
		if (suppressRoot && documentElement.style.getPropertyValue('view-transition-name') === 'none') {
			documentElement.style.removeProperty('view-transition-name');
		}
	};

	const animations: Animation[] = [];
	const cleanups: Array<() => void> = [];
	let committed = false;
	const commit = (): boolean => {
		if (committed) {
			return false;
		}
		committed = true;
		root.pendingCommit = null;
		// the browser calls back outside any flush, so guard the commit as one would: a flushSync
		// from a layout effect then queues its work for the drain below instead of nesting.
		const wasFlushing = flushing;
		flushing = true;
		try {
			commitRoot(root, failed);
		} finally {
			flushing = wasFlushing;
		}
		drainCascade(root);
		flushRoots();
		return true;
	};

	let transition: ViewTransition;
	try {
		transition = document.startViewTransition({
			update() {
				// a skipped transition still calls back, after the pass has already committed.
				if (!commit()) {
					return;
				}
				try {
					finalizeViewTransition(plan, animations, suppressRoot);
				} catch (error) {
					reportAsync(error);
				} finally {
					releaseTransitionPlan(plan);
				}
			},
			types: frame.types,
		});
	} catch {
		restoreNames(plan.named);
		restoreRoot();
		return false;
	}

	activeTransition = transition;
	root.pendingCommit = () => {
		transition.skipTransition();
		commit();
	};
	transition.ready.then(
		() => {
			restoreNames(plan.named);
			dispatchTransitionEvents(plan, cleanups);
		},
		() => {
			commit();
			restoreNames(plan.named);
		},
	);
	// an app's cleanup can throw; the coordinator still has to let go of the document.
	const settle = () => {
		for (const cleanup of cleanups) {
			try {
				cleanup();
			} catch (error) {
				reportAsync(error);
			}
		}
		for (const animation of animations) {
			animation.cancel();
		}
		restoreRoot();
		if (activeTransition === transition) {
			activeTransition = null;
		}
		releaseWaitingRoots();
	};
	transition.finished.then(settle, settle);
	return true;
};

// #endregion

// #region async and development tools

// surfaces an error from a callback whose rejection nothing would observe, or from app code that
// must not stop the caller, as an uncaught error.
const reportAsync = (error: unknown) => {
	if (typeof reportError === 'function') {
		reportError(error);
		return;
	}
	queueMicrotask(() => {
		throw error;
	});
};

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
	switch (type._status) {
		case 'resolved': {
			return type._value;
		}
		case 'rejected': {
			throw type._value;
		}

		case 'uninitialized': {
			const thenable = type._load();

			type._status = 'pending';
			type._value = thenable;

			thenable.then(
				(module: { default: any }) => {
					if (type._status === 'pending') {
						type._status = 'resolved';
						type._value = module.default;
					}
				},
				(error: unknown) => {
					if (type._status === 'pending') {
						type._status = 'rejected';
						type._value = error;
					}
				},
			);
		}
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
			renderRootWork(root, true);
		},
		scheduleRoot(root: Root, element: any) {
			root.element = element;
			renderRootWork(root, true);
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

// refresh cannot match families in an unmounted primary subtree.
const retryStalledBoundary = (fiber: Fiber): boolean => {
	switch (fiber.kind) {
		case FiberKind.ErrorBoundary: {
			if (!fiber.caughtError) {
				break;
			}

			fiber.caughtError = undefined;
			// discard the fallback in case it was edited.
			remountFiber(fiber);
			return true;
		}
		case FiberKind.Suspense: {
			// ForceUpdate remains set while the fallback is mounted.
			if ((fiber.flags & FiberFlag.ForceUpdate) === 0) {
				break;
			}

			// restore the dirty path without discarding the fallback.
			markDirtyPath(fiber);
			break;
		}
	}

	return false;
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
		if (retryStalledBoundary(fiber)) {
			continue;
		}

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

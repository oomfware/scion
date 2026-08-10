// derived from @types/react 19.2.18 (DefinitelyTyped, MIT) and limited to scion's supported API.

import type * as CSS from 'csstype';

import type {
	NativeAnimationEvent,
	NativeClipboardEvent,
	NativeCompositionEvent,
	NativeDragEvent,
	NativeFocusEvent,
	NativeInputEvent,
	NativeKeyboardEvent,
	NativeMouseEvent,
	NativePointerEvent,
	NativeSubmitEvent,
	NativeToggleEvent,
	NativeTouchEvent,
	NativeTransitionEvent,
	NativeUIEvent,
	NativeWheelEvent,
	TrustedHTML,
	StyleMedia,
	HTMLWebViewElement,
} from './dom.js';

type Booleanish = boolean | 'true' | 'false';

type CrossOrigin = 'anonymous' | 'use-credentials' | '' | undefined;

declare const UNDEFINED_VOID_ONLY: unique symbol;

/** @internal use `Awaited<ReactNode>` instead */
// mirrors the non-thenable members of `ReactNode` for `Awaited<ReactNode>`.
type AwaitedReactNode =
	| ReactElement
	| string
	| number
	| bigint
	| Iterable<ReactNode>
	| ReactPortal
	| boolean
	| null
	| undefined;

/** cleans up an effect after it reruns or unmounts. */
type Destructor = () => void | { [UNDEFINED_VOID_ONLY]: never };
type VoidOrUndefinedOnly = void | { [UNDEFINED_VOID_ONLY]: never };

// #region elements

/** a component or intrinsic tag compatible with `P`. */
export type ElementType<P = any, Tag extends keyof JSX.IntrinsicElements = keyof JSX.IntrinsicElements> =
	| { [K in Tag]: P extends JSX.IntrinsicElements[K] ? K : never }[Tag]
	| FunctionComponent<P>;

/** a user-defined component constructor. */
export type JSXElementConstructor<P> = (props: P) => ReactNode | Promise<ReactNode>;

// just to make React happy.
type ElementConstructor<P> = JSXElementConstructor<P> | (new (props: P, context: any) => any);

/** a ref object whose value persists between renders. */
export interface RefObject<T> {
	current: T;
}

/** a callback invoked when a ref value changes. */
export type RefCallback<T> = {
	bivarianceHack(instance: T | null): void | (() => VoidOrUndefinedOnly);
}['bivarianceHack'];

/** a callback ref, object ref, or `null`. */
export type Ref<T> = RefCallback<T> | RefObject<T | null> | null;

/** a value that identifies an item among its siblings. */
export type Key = string | number | bigint;

/** props accepted by every component but unavailable to its implementation. */
export interface Attributes {
	key?: Key | null | undefined;
}
/** props for components that accept refs; prefer `Ref<T>` for new prop types. */
export interface RefAttributes<T> extends Attributes {
	/** receives the instance, then `null` when it unmounts. */
	ref?: Ref<T> | undefined;
}

/** a JSX element with props `P` and element type `T`. */
export interface ReactElement<
	P = unknown,
	T extends string | ElementConstructor<any> = string | ElementConstructor<any>,
> {
	type: T;
	props: P;
	key: string | null;
}

export interface ReactPortal extends ReactElement {
	children: ReactNode;
}

// non-thenables need to be kept in sync with AwaitedReactNode
/** any value React can render. */
export type ReactNode =
	| ReactElement
	| string
	| number
	| bigint
	| Iterable<ReactNode>
	| ReactPortal
	| boolean
	| null
	| undefined
	| Promise<AwaitedReactNode>;

// #endregion

// #region api

// DOM elements
// TODO: support every intrinsic tag, not only `input`.
export function createElement(
	type: 'input',
	props?: (InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>) | null,
	...children: ReactNode[]
): ReactElement<InputHTMLAttributes<HTMLInputElement>, string>;
export function createElement<P extends DOMAttributes<T>, T extends Element>(
	type: string,
	props?: (RefAttributes<T> & P) | null,
	...children: ReactNode[]
): ReactElement<P, string>;

// custom components
export function createElement<P extends {}>(
	type: FunctionComponent<P>,
	props?: (Attributes & P) | null,
	...children: ReactNode[]
): ReactElement<P, FunctionComponent<P>>;
export function createElement<P extends {}>(
	type: FunctionComponent<P> | string,
	props?: (Attributes & P) | null,
	...children: ReactNode[]
): ReactElement<P>;

export function cloneElement<P, T extends string | ElementConstructor<any>>(
	element: ReactElement<P, T>,
	props?: Partial<P> & Attributes,
	...children: ReactNode[]
): ReactElement<P, T>;

/** props accepted by a context provider. */
export interface ProviderProps<T> {
	value: T;
	children?: ReactNode | undefined;
}

/** props accepted by a context consumer. */
export interface ConsumerProps<T> {
	children: (value: T) => ReactNode;
}

/** a renderer-managed object with a component-compatible type. */
export interface ExoticComponent<P = {}> {
	(props: P): ReactNode;
	readonly $$typeof: symbol;
}

/** an exotic component with a debugging name. */
export interface NamedExoticComponent<P = {}> extends ExoticComponent<P> {
	/** the name shown in debugging output. */
	displayName?: string | undefined;
}

/** the value type provided by a context. */
export type ContextType<C extends Context<any>> = C extends Context<infer T> ? T : never;

/** provides a context value to descendants. */
export type Provider<T> = ExoticComponent<ProviderProps<T>>;

/** reads a context value with a render callback. */
export type Consumer<T> = ExoticComponent<ConsumerProps<T>>;

/** a context that passes values through the component tree. */
export interface Context<T> extends Provider<T> {
	Provider: Provider<T>;
	Consumer: Consumer<T>;
	/** the name shown in debugging output. */
	displayName?: string | undefined;
}

/**
 * creates a context with a fallback value.
 *
 * @param defaultValue value used when no matching provider exists
 * @returns context that provides and reads `T`
 */
export function createContext<T>(
	// required to preserve React inference and runtime behavior.
	defaultValue: T,
): Context<T>;

export function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;

export const Children: {
	map<T, C>(
		children: C | readonly C[],
		fn: (child: C, index: number) => T,
	): C extends null | undefined ? C : Array<Exclude<T, boolean | null | undefined>>;
	forEach<C>(children: C | readonly C[], fn: (child: C, index: number) => void): void;
	count(children: any): number;
	only<C>(children: C): C extends any[] ? never : C;
	toArray(children: ReactNode | ReactNode[]): Array<Exclude<ReactNode, boolean | null | undefined>>;
};

export interface FragmentProps {
	children?: ReactNode;
}
/** groups elements without adding a DOM node. */
export const Fragment: ExoticComponent<FragmentProps>;

/** props accepted by `Suspense`. */
export interface SuspenseProps {
	children?: ReactNode | undefined;

	/** content shown while a descendant is suspended. */
	fallback?: ReactNode;

	/** accepted for React compatibility and ignored by scion. */
	name?: string | undefined;
}

/** shows fallback content while descendants are suspended. */
export const Suspense: ExoticComponent<SuspenseProps>;
export const version: string;

// #endregion

// #region components

/** alias for `FunctionComponent`. */
export type FC<P = {}> = FunctionComponent<P>;

/** alias for `FunctionComponent`. */
export type ComponentType<P = {}> = FunctionComponent<P>;

/** a function component that accepts props `P`. */
export interface FunctionComponent<P = {}> {
	(props: P): ReactNode | Promise<ReactNode>;
	/** the name shown in debugging output. */
	displayName?: string | undefined;
}

// React-managed object refs are cleared with `null`.
/** the ref received by a forwarded-ref render function. */
export type ForwardedRef<T> = ((instance: T | null) => void) | RefObject<T | null> | null;

/** a component render function that receives a forwarded ref. */
export interface ForwardRefRenderFunction<T, P = {}> {
	(props: P, ref: ForwardedRef<T>): ReactNode;
	/** the name shown in debugging output. */
	displayName?: string | undefined;
}

export function createRef<T>(): RefObject<T | null>;

/** the component returned by `forwardRef`. */
export interface ForwardRefExoticComponent<P> extends NamedExoticComponent<P> {}

/**
 * creates a component that forwards its ref to `render`.
 *
 * @param render component render function
 * @returns component that accepts the forwarded ref
 */
export function forwardRef<T, P = {}>(
	render: ForwardRefRenderFunction<T, PropsWithoutRef<P>>,
): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;

/** removes the `ref` prop from a props type. */
export type PropsWithoutRef<Props> =
	// distribute over unions without mapping members that have no ref.
	Props extends any ? ('ref' extends keyof Props ? Omit<Props, 'ref'> : Props) : Props;

export type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };

/** the props accepted by a component or intrinsic tag. */
export type ComponentProps<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> =
	T extends JSXElementConstructor<infer Props>
		? Props
		: T extends keyof JSX.IntrinsicElements
			? JSX.IntrinsicElements[T]
			: {};

/** the props accepted by a component or intrinsic tag, including its ref. */
export type ComponentPropsWithRef<T extends ElementType> =
	T extends JSXElementConstructor<infer Props> ? Props : ComponentProps<T>;
/** the props accepted by a custom component, including its ref. */
export type CustomComponentPropsWithRef<T extends FunctionComponent> =
	T extends JSXElementConstructor<infer Props> ? Props : never;

/** the props accepted by a component or intrinsic tag, excluding its ref. */
export type ComponentPropsWithoutRef<T extends ElementType> = PropsWithoutRef<ComponentProps<T>>;

/** the ref value type for a component or intrinsic tag. */
export type ComponentRef<T extends ElementType> =
	ComponentPropsWithRef<T> extends RefAttributes<infer Method> ? Method : never;

export type MemoExoticComponent<T extends FunctionComponent<any>> = NamedExoticComponent<
	CustomComponentPropsWithRef<T>
> & {
	readonly type: T;
};

/**
 * skips rendering a component when its props compare equal.
 *
 * @param Component component to memoize
 * @param propsAreEqual optional custom props comparison
 * @returns memoized component
 */
export function memo<P extends object>(
	Component: FunctionComponent<P>,
	propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean,
): NamedExoticComponent<P>;
export function memo<T extends FunctionComponent<any>>(
	Component: T,
	propsAreEqual?: (prevProps: Readonly<ComponentProps<T>>, nextProps: Readonly<ComponentProps<T>>) => boolean,
): MemoExoticComponent<T>;

export interface LazyExoticComponent<T extends FunctionComponent<any>> extends ExoticComponent<
	CustomComponentPropsWithRef<T>
> {
	readonly _result: T;
}

/**
 * defers loading a component until its first render.
 *
 * @param load loads a module whose default export is the component
 * @returns lazy component that caches the load result
 */
export function lazy<T extends FunctionComponent<any>>(
	load: () => Promise<{ default: T }>,
): LazyExoticComponent<T>;

// #endregion

// #region hooks

/** a state value or function that derives it from the previous state. */
export type SetStateAction<S> = S | ((prevState: S) => S);

/** updates state managed by `useState` or `useReducer`. */
export type Dispatch<A> = (value: A) => void;
// reducers accept zero or one action argument.
export type AnyActionArg = [] | [any];
// preserve optional action arguments in the dispatch signature.
export type ActionDispatch<ActionArg extends AnyActionArg> = (...args: ActionArg) => void;
export type Reducer<S, A> = (prevState: S, action: A) => S;
export type DependencyList = readonly unknown[];

// effect callbacks may only return cleanup functions.
export type EffectCallback = () => void | Destructor;

/**
 * reads the nearest value for `context`.
 *
 * @param context context to read
 * @returns current provided or fallback value
 */
export function useContext<T>(context: Context<T> /*, (not public API) observedBits?: number|boolean */): T;
/**
 * creates state preserved between renders.
 *
 * @param initialState initial value or initializer
 * @returns current state and its update function
 */
export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
/**
 * creates state initialized to `undefined` and preserved between renders.
 *
 * @returns current state and its update function
 */
export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
/**
 * creates state updated by a reducer.
 *
 * @param reducer derives the next state
 * @param initialState initial state
 * @returns current state and its dispatch function
 */
export function useReducer<S, A extends AnyActionArg>(
	reducer: (prevState: S, ...args: A) => S,
	initialState: S,
): [S, ActionDispatch<A>];
/**
 * creates state updated by a reducer.
 *
 * @param reducer derives the next state
 * @param initialArg value passed to `init`
 * @param init creates the initial state
 * @returns current state and its dispatch function
 */
export function useReducer<S, I, A extends AnyActionArg>(
	reducer: (prevState: S, ...args: A) => S,
	initialArg: I,
	init: (i: I) => S,
): [S, ActionDispatch<A>];
/**
 * returns a stable ref initialized to `initialValue`.
 *
 * @param initialValue initial ref value
 * @returns ref object preserved between renders
 */
export function useRef<T>(initialValue: T): RefObject<T>;
/**
 * returns a stable ref initialized to `initialValue`.
 *
 * @param initialValue initial ref value
 * @returns ref object preserved between renders
 */
export function useRef<T>(initialValue: T | null): RefObject<T | null>;
/**
 * returns a stable ref initialized to `initialValue`.
 *
 * @param initialValue initial ref value
 * @returns ref object preserved between renders
 */
export function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
/**
 * runs an effect synchronously after DOM mutations and before paint.
 *
 * @param effect effect that may return a cleanup function
 * @param deps optional values that control when the effect reruns
 */
export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
/**
 * runs an effect after the rendered output is committed.
 *
 * @param effect effect that may return a cleanup function
 * @param deps optional values that control when the effect reruns
 */
export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
/**
 * returns an effect event that always reads the latest props and state.
 *
 * @param callback event callback
 * @returns event that invokes the latest callback
 * @throws when called during render
 */
export function useEffectEvent<T extends Function>(callback: T): T;
/**
 * customizes the value exposed through a ref.
 *
 * @param ref ref to update
 * @param init creates the exposed value
 * @param deps optional values that control when the handle updates
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function useImperativeHandle<T, R extends T>(
	ref: Ref<T> | undefined,
	init: () => R,
	deps?: DependencyList,
): void;

// `Function` preserves callback parameter inference.
/**
 * preserves a callback while its dependencies remain equal.
 *
 * @param callback callback to preserve
 * @param deps values that invalidate the callback
 * @returns current callback
 */
export function useCallback<T extends Function>(callback: T, deps: DependencyList): T;
/**
 * caches a computed value while its dependencies remain equal.
 *
 * @param factory computes the value
 * @param deps values that invalidate the cached value
 * @returns current value
 */
export function useMemo<T>(factory: () => T, deps: DependencyList): T;

export function useId(): string;

/**
 * runs an effect before layout effects.
 *
 * @param effect effect that may return a cleanup function
 * @param deps optional values that control when the effect reruns
 */
export function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;

/**
 * subscribes to an external store and reads a consistent snapshot.
 *
 * @param subscribe registers a store-change callback
 * @param getSnapshot reads the current snapshot
 * @returns current snapshot
 */
export function useSyncExternalStore<Snapshot>(
	subscribe: (onStoreChange: () => void) => () => void,
	getSnapshot: () => Snapshot,
): Snapshot;

export interface UntrackedReactPromise<T> extends PromiseLike<T> {
	status?: void;
}

export interface PendingReactPromise<T> extends PromiseLike<T> {
	status: 'pending';
}

export interface FulfilledReactPromise<T> extends PromiseLike<T> {
	status: 'fulfilled';
	value: T;
}

export interface RejectedReactPromise<T> extends PromiseLike<T> {
	status: 'rejected';
	reason: unknown;
}

export type ReactPromise<T> =
	| UntrackedReactPromise<T>
	| PendingReactPromise<T>
	| FulfilledReactPromise<T>
	| RejectedReactPromise<T>;

export type Usable<T> = ReactPromise<T> | Context<T>;

export function use<T>(usable: Usable<T>): T;

export interface ActivityProps {
	/** @default 'visible' */
	mode?: 'hidden' | 'visible' | undefined;
	children: ReactNode;
}

/** hides or reveals children while preserving their state. */
export const Activity: ExoticComponent<ActivityProps>;

// #endregion

// #region events
export interface BaseSyntheticEvent<E = object, C = any, T = any> {
	nativeEvent: E;
	currentTarget: C;
	target: T;
	bubbles: boolean;
	cancelable: boolean;
	defaultPrevented: boolean;
	eventPhase: number;
	isTrusted: boolean;
	preventDefault(): void;
	isDefaultPrevented(): boolean;
	stopPropagation(): void;
	isPropagationStopped(): boolean;
	persist(): void;
	timeStamp: number;
	type: string;
}

/** a React event whose `currentTarget` is the listener target and `target` is the dispatch origin. */
export interface SyntheticEvent<T = Element, E = Event> extends BaseSyntheticEvent<
	E,
	EventTarget & T,
	EventTarget
> {}

export interface ClipboardEvent<T = Element> extends SyntheticEvent<T, NativeClipboardEvent> {
	clipboardData: DataTransfer;
}

export interface CompositionEvent<T = Element> extends SyntheticEvent<T, NativeCompositionEvent> {
	data: string;
}

export interface DragEvent<T = Element> extends MouseEvent<T, NativeDragEvent> {
	dataTransfer: DataTransfer;
}

export interface PointerEvent<T = Element> extends MouseEvent<T, NativePointerEvent> {
	pointerId: number;
	pressure: number;
	tangentialPressure: number;
	tiltX: number;
	tiltY: number;
	twist: number;
	width: number;
	height: number;
	pointerType: 'mouse' | 'pen' | 'touch';
	isPrimary: boolean;
}

export interface FocusEvent<Target = Element, RelatedTarget = Element> extends SyntheticEvent<
	Target,
	NativeFocusEvent
> {
	relatedTarget: (EventTarget & RelatedTarget) | null;
	target: EventTarget & Target;
}

export interface InvalidEvent<T = Element> extends SyntheticEvent<T> {}

/** a change event with a narrowed target for non-nestable form controls. */
export interface ChangeEvent<
	CurrentTarget = Element,
	Target = Element,
> extends SyntheticEvent<CurrentTarget> {
	// preserve the React 19 target type for compatibility.
	target: EventTarget & CurrentTarget;
}

export interface InputEvent<T = Element> extends SyntheticEvent<T, NativeInputEvent> {
	data: string;
}

export type ModifierKey =
	| 'Alt'
	| 'AltGraph'
	| 'CapsLock'
	| 'Control'
	| 'Fn'
	| 'FnLock'
	| 'Hyper'
	| 'Meta'
	| 'NumLock'
	| 'ScrollLock'
	| 'Shift'
	| 'Super'
	| 'Symbol'
	| 'SymbolLock';

export interface KeyboardEvent<T = Element> extends UIEvent<T, NativeKeyboardEvent> {
	altKey: boolean;
	/** @deprecated */
	charCode: number;
	ctrlKey: boolean;
	code: string;
	getModifierState(key: ModifierKey): boolean;
	key: string;
	/** @deprecated */
	keyCode: number;
	locale: string;
	location: number;
	metaKey: boolean;
	repeat: boolean;
	shiftKey: boolean;
	/** @deprecated */
	which: number;
}

export interface MouseEvent<T = Element, E = NativeMouseEvent> extends UIEvent<T, E> {
	altKey: boolean;
	button: number;
	buttons: number;
	clientX: number;
	clientY: number;
	ctrlKey: boolean;
	getModifierState(key: ModifierKey): boolean;
	metaKey: boolean;
	movementX: number;
	movementY: number;
	pageX: number;
	pageY: number;
	relatedTarget: EventTarget | null;
	screenX: number;
	screenY: number;
	shiftKey: boolean;
}

export interface SubmitEvent<T = Element> extends SyntheticEvent<T, NativeSubmitEvent> {
	// submit events always target forms.
	target: EventTarget & HTMLFormElement;
}

export interface TouchEvent<T = Element> extends UIEvent<T, NativeTouchEvent> {
	altKey: boolean;
	changedTouches: TouchList;
	ctrlKey: boolean;
	getModifierState(key: ModifierKey): boolean;
	metaKey: boolean;
	shiftKey: boolean;
	targetTouches: TouchList;
	touches: TouchList;
}

export interface UIEvent<T = Element, E = NativeUIEvent> extends SyntheticEvent<T, E> {
	detail: number;
	view: AbstractView;
}

export interface WheelEvent<T = Element> extends MouseEvent<T, NativeWheelEvent> {
	deltaMode: number;
	deltaX: number;
	deltaY: number;
	deltaZ: number;
}

export interface AnimationEvent<T = Element> extends SyntheticEvent<T, NativeAnimationEvent> {
	animationName: string;
	elapsedTime: number;
	pseudoElement: string;
}

export interface ToggleEvent<T = Element> extends SyntheticEvent<T, NativeToggleEvent> {
	oldState: 'closed' | 'open';
	newState: 'closed' | 'open';
}

export interface TransitionEvent<T = Element> extends SyntheticEvent<T, NativeTransitionEvent> {
	elapsedTime: number;
	propertyName: string;
	pseudoElement: string;
}

// event handlers

export type EventHandler<E extends SyntheticEvent<any>> = {
	bivarianceHack(event: E): void;
}['bivarianceHack'];

export type ReactEventHandler<T = Element> = EventHandler<SyntheticEvent<T>>;

export type ClipboardEventHandler<T = Element> = EventHandler<ClipboardEvent<T>>;
export type CompositionEventHandler<T = Element> = EventHandler<CompositionEvent<T>>;
export type DragEventHandler<T = Element> = EventHandler<DragEvent<T>>;
export type FocusEventHandler<T = Element> = EventHandler<FocusEvent<T>>;
export type ChangeEventHandler<CurrentTarget = Element, Target = Element> = EventHandler<
	ChangeEvent<CurrentTarget, Target>
>;
export type InputEventHandler<T = Element> = EventHandler<InputEvent<T>>;
export type KeyboardEventHandler<T = Element> = EventHandler<KeyboardEvent<T>>;
export type MouseEventHandler<T = Element> = EventHandler<MouseEvent<T>>;
export type SubmitEventHandler<T = Element> = EventHandler<SubmitEvent<T>>;
export type TouchEventHandler<T = Element> = EventHandler<TouchEvent<T>>;
export type PointerEventHandler<T = Element> = EventHandler<PointerEvent<T>>;
export type UIEventHandler<T = Element> = EventHandler<UIEvent<T>>;
export type WheelEventHandler<T = Element> = EventHandler<WheelEvent<T>>;
export type AnimationEventHandler<T = Element> = EventHandler<AnimationEvent<T>>;
export type ToggleEventHandler<T = Element> = EventHandler<ToggleEvent<T>>;
export type TransitionEventHandler<T = Element> = EventHandler<TransitionEvent<T>>;

// #endregion

// #region DOM props

export interface HTMLProps<T> extends AllHTMLAttributes<T>, RefAttributes<T> {}

export type DetailedHTMLProps<E extends HTMLAttributes<T>, T> = RefAttributes<T> & E;

export interface SVGProps<T> extends SVGAttributes<T>, RefAttributes<T> {}

export interface SVGLineElementAttributes<T> extends SVGProps<T> {}
export interface SVGTextElementAttributes<T> extends SVGProps<T> {}

export interface DOMAttributes<T> {
	children?: ReactNode | undefined;
	dangerouslySetInnerHTML?:
		| {
				// renderer-neutral declarations cannot use `InnerHTML` directly.
				__html: string | TrustedHTML;
		  }
		| undefined;

	// clipboard events
	onCopy?: ClipboardEventHandler<T> | undefined;
	onCopyCapture?: ClipboardEventHandler<T> | undefined;
	onCut?: ClipboardEventHandler<T> | undefined;
	onCutCapture?: ClipboardEventHandler<T> | undefined;
	onPaste?: ClipboardEventHandler<T> | undefined;
	onPasteCapture?: ClipboardEventHandler<T> | undefined;

	// composition events
	onCompositionEnd?: CompositionEventHandler<T> | undefined;
	onCompositionEndCapture?: CompositionEventHandler<T> | undefined;
	onCompositionStart?: CompositionEventHandler<T> | undefined;
	onCompositionStartCapture?: CompositionEventHandler<T> | undefined;
	onCompositionUpdate?: CompositionEventHandler<T> | undefined;
	onCompositionUpdateCapture?: CompositionEventHandler<T> | undefined;

	// focus events
	onFocus?: FocusEventHandler<T> | undefined;
	onFocusCapture?: FocusEventHandler<T> | undefined;
	onBlur?: FocusEventHandler<T> | undefined;
	onBlurCapture?: FocusEventHandler<T> | undefined;

	// form events
	onChange?: ChangeEventHandler<T> | undefined;
	onChangeCapture?: ChangeEventHandler<T> | undefined;
	onBeforeInput?: InputEventHandler<T> | undefined;
	onBeforeInputCapture?: InputEventHandler<T> | undefined;
	onInput?: InputEventHandler<T> | undefined;
	onInputCapture?: InputEventHandler<T> | undefined;
	onReset?: ReactEventHandler<T> | undefined;
	onResetCapture?: ReactEventHandler<T> | undefined;
	onSubmit?: SubmitEventHandler<T> | undefined;
	onSubmitCapture?: SubmitEventHandler<T> | undefined;
	onInvalid?: ReactEventHandler<T> | undefined;
	onInvalidCapture?: ReactEventHandler<T> | undefined;

	// image events
	onLoad?: ReactEventHandler<T> | undefined;
	onLoadCapture?: ReactEventHandler<T> | undefined;
	onError?: ReactEventHandler<T> | undefined; // also a media event
	onErrorCapture?: ReactEventHandler<T> | undefined; // also a media event

	// keyboard events
	onKeyDown?: KeyboardEventHandler<T> | undefined;
	onKeyDownCapture?: KeyboardEventHandler<T> | undefined;
	/** @deprecated use `onKeyUp` or `onKeyDown` instead */
	onKeyPress?: KeyboardEventHandler<T> | undefined;
	/** @deprecated use `onKeyUpCapture` or `onKeyDownCapture` instead */
	onKeyPressCapture?: KeyboardEventHandler<T> | undefined;
	onKeyUp?: KeyboardEventHandler<T> | undefined;
	onKeyUpCapture?: KeyboardEventHandler<T> | undefined;

	// media events
	onAbort?: ReactEventHandler<T> | undefined;
	onAbortCapture?: ReactEventHandler<T> | undefined;
	onCanPlay?: ReactEventHandler<T> | undefined;
	onCanPlayCapture?: ReactEventHandler<T> | undefined;
	onCanPlayThrough?: ReactEventHandler<T> | undefined;
	onCanPlayThroughCapture?: ReactEventHandler<T> | undefined;
	onDurationChange?: ReactEventHandler<T> | undefined;
	onDurationChangeCapture?: ReactEventHandler<T> | undefined;
	onEmptied?: ReactEventHandler<T> | undefined;
	onEmptiedCapture?: ReactEventHandler<T> | undefined;
	onEncrypted?: ReactEventHandler<T> | undefined;
	onEncryptedCapture?: ReactEventHandler<T> | undefined;
	onEnded?: ReactEventHandler<T> | undefined;
	onEndedCapture?: ReactEventHandler<T> | undefined;
	onLoadedData?: ReactEventHandler<T> | undefined;
	onLoadedDataCapture?: ReactEventHandler<T> | undefined;
	onLoadedMetadata?: ReactEventHandler<T> | undefined;
	onLoadedMetadataCapture?: ReactEventHandler<T> | undefined;
	onLoadStart?: ReactEventHandler<T> | undefined;
	onLoadStartCapture?: ReactEventHandler<T> | undefined;
	onPause?: ReactEventHandler<T> | undefined;
	onPauseCapture?: ReactEventHandler<T> | undefined;
	onPlay?: ReactEventHandler<T> | undefined;
	onPlayCapture?: ReactEventHandler<T> | undefined;
	onPlaying?: ReactEventHandler<T> | undefined;
	onPlayingCapture?: ReactEventHandler<T> | undefined;
	onProgress?: ReactEventHandler<T> | undefined;
	onProgressCapture?: ReactEventHandler<T> | undefined;
	onRateChange?: ReactEventHandler<T> | undefined;
	onRateChangeCapture?: ReactEventHandler<T> | undefined;
	onSeeked?: ReactEventHandler<T> | undefined;
	onSeekedCapture?: ReactEventHandler<T> | undefined;
	onSeeking?: ReactEventHandler<T> | undefined;
	onSeekingCapture?: ReactEventHandler<T> | undefined;
	onStalled?: ReactEventHandler<T> | undefined;
	onStalledCapture?: ReactEventHandler<T> | undefined;
	onSuspend?: ReactEventHandler<T> | undefined;
	onSuspendCapture?: ReactEventHandler<T> | undefined;
	onTimeUpdate?: ReactEventHandler<T> | undefined;
	onTimeUpdateCapture?: ReactEventHandler<T> | undefined;
	onVolumeChange?: ReactEventHandler<T> | undefined;
	onVolumeChangeCapture?: ReactEventHandler<T> | undefined;
	onWaiting?: ReactEventHandler<T> | undefined;
	onWaitingCapture?: ReactEventHandler<T> | undefined;

	// mouse events
	onAuxClick?: MouseEventHandler<T> | undefined;
	onAuxClickCapture?: MouseEventHandler<T> | undefined;
	onClick?: MouseEventHandler<T> | undefined;
	onClickCapture?: MouseEventHandler<T> | undefined;
	onContextMenu?: MouseEventHandler<T> | undefined;
	onContextMenuCapture?: MouseEventHandler<T> | undefined;
	onDoubleClick?: MouseEventHandler<T> | undefined;
	onDoubleClickCapture?: MouseEventHandler<T> | undefined;
	onDrag?: DragEventHandler<T> | undefined;
	onDragCapture?: DragEventHandler<T> | undefined;
	onDragEnd?: DragEventHandler<T> | undefined;
	onDragEndCapture?: DragEventHandler<T> | undefined;
	onDragEnter?: DragEventHandler<T> | undefined;
	onDragEnterCapture?: DragEventHandler<T> | undefined;
	onDragExit?: DragEventHandler<T> | undefined;
	onDragExitCapture?: DragEventHandler<T> | undefined;
	onDragLeave?: DragEventHandler<T> | undefined;
	onDragLeaveCapture?: DragEventHandler<T> | undefined;
	onDragOver?: DragEventHandler<T> | undefined;
	onDragOverCapture?: DragEventHandler<T> | undefined;
	onDragStart?: DragEventHandler<T> | undefined;
	onDragStartCapture?: DragEventHandler<T> | undefined;
	onDrop?: DragEventHandler<T> | undefined;
	onDropCapture?: DragEventHandler<T> | undefined;
	onMouseDown?: MouseEventHandler<T> | undefined;
	onMouseDownCapture?: MouseEventHandler<T> | undefined;
	onMouseEnter?: MouseEventHandler<T> | undefined;
	onMouseLeave?: MouseEventHandler<T> | undefined;
	onMouseMove?: MouseEventHandler<T> | undefined;
	onMouseMoveCapture?: MouseEventHandler<T> | undefined;
	onMouseOut?: MouseEventHandler<T> | undefined;
	onMouseOutCapture?: MouseEventHandler<T> | undefined;
	onMouseOver?: MouseEventHandler<T> | undefined;
	onMouseOverCapture?: MouseEventHandler<T> | undefined;
	onMouseUp?: MouseEventHandler<T> | undefined;
	onMouseUpCapture?: MouseEventHandler<T> | undefined;

	// selection events
	onSelect?: ReactEventHandler<T> | undefined;
	onSelectCapture?: ReactEventHandler<T> | undefined;

	// touch events
	onTouchCancel?: TouchEventHandler<T> | undefined;
	onTouchCancelCapture?: TouchEventHandler<T> | undefined;
	onTouchEnd?: TouchEventHandler<T> | undefined;
	onTouchEndCapture?: TouchEventHandler<T> | undefined;
	onTouchMove?: TouchEventHandler<T> | undefined;
	onTouchMoveCapture?: TouchEventHandler<T> | undefined;
	onTouchStart?: TouchEventHandler<T> | undefined;
	onTouchStartCapture?: TouchEventHandler<T> | undefined;

	// pointer events
	onPointerDown?: PointerEventHandler<T> | undefined;
	onPointerDownCapture?: PointerEventHandler<T> | undefined;
	onPointerMove?: PointerEventHandler<T> | undefined;
	onPointerMoveCapture?: PointerEventHandler<T> | undefined;
	onPointerUp?: PointerEventHandler<T> | undefined;
	onPointerUpCapture?: PointerEventHandler<T> | undefined;
	onPointerCancel?: PointerEventHandler<T> | undefined;
	onPointerCancelCapture?: PointerEventHandler<T> | undefined;
	onPointerEnter?: PointerEventHandler<T> | undefined;
	onPointerLeave?: PointerEventHandler<T> | undefined;
	onPointerOver?: PointerEventHandler<T> | undefined;
	onPointerOverCapture?: PointerEventHandler<T> | undefined;
	onPointerOut?: PointerEventHandler<T> | undefined;
	onPointerOutCapture?: PointerEventHandler<T> | undefined;
	onGotPointerCapture?: PointerEventHandler<T> | undefined;
	onGotPointerCaptureCapture?: PointerEventHandler<T> | undefined;
	onLostPointerCapture?: PointerEventHandler<T> | undefined;
	onLostPointerCaptureCapture?: PointerEventHandler<T> | undefined;

	// UI events
	onScroll?: UIEventHandler<T> | undefined;
	onScrollCapture?: UIEventHandler<T> | undefined;
	onScrollEnd?: UIEventHandler<T> | undefined;
	onScrollEndCapture?: UIEventHandler<T> | undefined;

	// wheel events
	onWheel?: WheelEventHandler<T> | undefined;
	onWheelCapture?: WheelEventHandler<T> | undefined;

	// animation events
	onAnimationStart?: AnimationEventHandler<T> | undefined;
	onAnimationStartCapture?: AnimationEventHandler<T> | undefined;
	onAnimationEnd?: AnimationEventHandler<T> | undefined;
	onAnimationEndCapture?: AnimationEventHandler<T> | undefined;
	onAnimationIteration?: AnimationEventHandler<T> | undefined;
	onAnimationIterationCapture?: AnimationEventHandler<T> | undefined;

	// toggle events
	onToggle?: ToggleEventHandler<T> | undefined;
	onBeforeToggle?: ToggleEventHandler<T> | undefined;

	// transition events
	onTransitionCancel?: TransitionEventHandler<T> | undefined;
	onTransitionCancelCapture?: TransitionEventHandler<T> | undefined;
	onTransitionEnd?: TransitionEventHandler<T> | undefined;
	onTransitionEndCapture?: TransitionEventHandler<T> | undefined;
	onTransitionRun?: TransitionEventHandler<T> | undefined;
	onTransitionRunCapture?: TransitionEventHandler<T> | undefined;
	onTransitionStart?: TransitionEventHandler<T> | undefined;
	onTransitionStartCapture?: TransitionEventHandler<T> | undefined;
}

export interface CSSProperties extends CSS.Properties<string | number> {
	// augment this interface to add custom properties or an index signature.
}

// WAI-ARIA attributes
export interface AriaAttributes {
	/**
	 * identifies the currently active element when DOM focus is on a composite widget, textbox, group, or
	 * application.
	 */
	'aria-activedescendant'?: string | undefined;
	/** indicates whether assistive technologies present all or part of a changed region. */
	'aria-atomic'?: Booleanish | undefined;
	/** indicates whether and how input predictions may be presented. */
	'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | undefined;
	/** defines a string value that labels the current element, which is intended to be converted into Braille. */
	'aria-braillelabel'?: string | undefined;
	/** defines a localized role description intended for Braille. */
	'aria-brailleroledescription'?: string | undefined;
	/** indicates that the element is being modified. */
	'aria-busy'?: Booleanish | undefined;
	/** indicates the current "checked" state of checkboxes, radio buttons, and other widgets. */
	'aria-checked'?: boolean | 'false' | 'mixed' | 'true' | undefined;
	/** defines the total number of columns in a table, grid, or treegrid. */
	'aria-colcount'?: number | undefined;
	/** defines an element's column position within a table, grid, or treegrid. */
	'aria-colindex'?: number | undefined;
	/** defines a human-readable text alternative to `aria-colindex`. */
	'aria-colindextext'?: string | undefined;
	/** defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid. */
	'aria-colspan'?: number | undefined;
	/** identifies the element (or elements) whose contents or presence are controlled by the current element. */
	'aria-controls'?: string | undefined;
	/** indicates the element that represents the current item within a container or set of related elements. */
	'aria-current'?: boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time' | undefined;
	/** identifies the element (or elements) that describes the object. */
	'aria-describedby'?: string | undefined;
	/** defines a string value that describes or annotates the current element. */
	'aria-description'?: string | undefined;
	/** identifies the element that provides a detailed, extended description for the object. */
	'aria-details'?: string | undefined;
	/** indicates that the element is perceivable but disabled, so it is not editable or otherwise operable. */
	'aria-disabled'?: Booleanish | undefined;
	/** @deprecated in ARIA 1.1 */
	'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | undefined;
	/** identifies the element that provides an error message for the object. */
	'aria-errormessage'?: string | undefined;
	/** indicates whether the element or its controlled group is expanded. */
	'aria-expanded'?: Booleanish | undefined;
	/** identifies elements in an alternative reading order. */
	'aria-flowto'?: string | undefined;
	/** @deprecated in ARIA 1.1 */
	'aria-grabbed'?: Booleanish | undefined;
	/** indicates the kind of popup the element can trigger. */
	'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | undefined;
	/** indicates whether the element is exposed to an accessibility API. */
	'aria-hidden'?: Booleanish | undefined;
	/** indicates the entered value does not conform to the format expected by the application. */
	'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling' | undefined;
	/** indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
	'aria-keyshortcuts'?: string | undefined;
	/** defines a string value that labels the current element. */
	'aria-label'?: string | undefined;
	/** identifies the element (or elements) that labels the current element. */
	'aria-labelledby'?: string | undefined;
	/** defines the hierarchical level of an element within a structure. */
	'aria-level'?: number | undefined;
	/** describes the updates expected from a live region. */
	'aria-live'?: 'off' | 'assertive' | 'polite' | undefined;
	/** indicates whether an element is modal when displayed. */
	'aria-modal'?: Booleanish | undefined;
	/** indicates whether a text box accepts multiple lines of input or only a single line. */
	'aria-multiline'?: Booleanish | undefined;
	/** indicates that the user may select more than one item from the current selectable descendants. */
	'aria-multiselectable'?: Booleanish | undefined;
	/** indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
	'aria-orientation'?: 'horizontal' | 'vertical' | undefined;
	/** identifies elements in a parent-child relationship not represented by the DOM. */
	'aria-owns'?: string | undefined;
	/** provides a data-entry hint while the control has no value. */
	'aria-placeholder'?: string | undefined;
	/** defines an element's position in the current set of list or tree items. */
	'aria-posinset'?: number | undefined;
	/** indicates the current "pressed" state of toggle buttons. */
	'aria-pressed'?: boolean | 'false' | 'mixed' | 'true' | undefined;
	/** indicates that the element is not editable, but is otherwise operable. */
	'aria-readonly'?: Booleanish | undefined;
	/** defines which live-region changes trigger notifications. */
	'aria-relevant'?:
		| 'additions'
		| 'additions removals'
		| 'additions text'
		| 'all'
		| 'removals'
		| 'removals additions'
		| 'removals text'
		| 'text'
		| 'text additions'
		| 'text removals'
		| undefined;
	/** indicates that user input is required on the element before a form may be submitted. */
	'aria-required'?: Booleanish | undefined;
	/** defines a human-readable, author-localized description for the role of an element. */
	'aria-roledescription'?: string | undefined;
	/** defines the total number of rows in a table, grid, or treegrid. */
	'aria-rowcount'?: number | undefined;
	/** defines an element's row position within a table, grid, or treegrid. */
	'aria-rowindex'?: number | undefined;
	/** defines a human-readable text alternative to `aria-rowindex`. */
	'aria-rowindextext'?: string | undefined;
	/** defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid. */
	'aria-rowspan'?: number | undefined;
	/** indicates the current "selected" state of various widgets. */
	'aria-selected'?: Booleanish | undefined;
	/** defines the number of items in the current list or tree set. */
	'aria-setsize'?: number | undefined;
	/** indicates if items in a table or grid are sorted in ascending or descending order. */
	'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | undefined;
	/** defines the maximum allowed value for a range widget. */
	'aria-valuemax'?: number | undefined;
	/** defines the minimum allowed value for a range widget. */
	'aria-valuemin'?: number | undefined;
	/** defines the current value for a range widget. */
	'aria-valuenow'?: number | undefined;
	/** defines the human-readable text alternative to `aria-valuenow`. */
	'aria-valuetext'?: string | undefined;
}

// WAI-ARIA roles
export type AriaRole =
	| 'alert'
	| 'alertdialog'
	| 'application'
	| 'article'
	| 'banner'
	| 'button'
	| 'cell'
	| 'checkbox'
	| 'columnheader'
	| 'combobox'
	| 'complementary'
	| 'contentinfo'
	| 'definition'
	| 'dialog'
	| 'directory'
	| 'document'
	| 'feed'
	| 'figure'
	| 'form'
	| 'grid'
	| 'gridcell'
	| 'group'
	| 'heading'
	| 'img'
	| 'link'
	| 'list'
	| 'listbox'
	| 'listitem'
	| 'log'
	| 'main'
	| 'marquee'
	| 'math'
	| 'menu'
	| 'menubar'
	| 'menuitem'
	| 'menuitemcheckbox'
	| 'menuitemradio'
	| 'navigation'
	| 'none'
	| 'note'
	| 'option'
	| 'presentation'
	| 'progressbar'
	| 'radio'
	| 'radiogroup'
	| 'region'
	| 'row'
	| 'rowgroup'
	| 'rowheader'
	| 'scrollbar'
	| 'search'
	| 'searchbox'
	| 'separator'
	| 'slider'
	| 'spinbutton'
	| 'status'
	| 'switch'
	| 'tab'
	| 'table'
	| 'tablist'
	| 'tabpanel'
	| 'term'
	| 'textbox'
	| 'timer'
	| 'toolbar'
	| 'tooltip'
	| 'tree'
	| 'treegrid'
	| 'treeitem'
	| (string & {});

export interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
	// React-specific attributes
	defaultChecked?: boolean | undefined;
	defaultValue?: string | number | readonly string[] | undefined;
	suppressContentEditableWarning?: boolean | undefined;
	suppressHydrationWarning?: boolean | undefined;

	// standard HTML attributes
	accessKey?: string | undefined;
	autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined | (string & {});
	autoFocus?: boolean | undefined;
	className?: string | undefined;
	contentEditable?: Booleanish | 'inherit' | 'plaintext-only' | undefined;
	contextMenu?: string | undefined;
	dir?: string | undefined;
	draggable?: Booleanish | undefined;
	enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined;
	hidden?: boolean | undefined;
	id?: string | undefined;
	lang?: string | undefined;
	nonce?: string | undefined;
	slot?: string | undefined;
	spellCheck?: Booleanish | undefined;
	style?: CSSProperties | undefined;
	tabIndex?: number | undefined;
	title?: string | undefined;
	translate?: 'yes' | 'no' | undefined;

	// legacy attributes
	radioGroup?: string | undefined; // <command>, <menuitem>

	// WAI-ARIA
	role?: AriaRole | undefined;

	// RDFa attributes
	about?: string | undefined;
	content?: string | undefined;
	datatype?: string | undefined;
	inlist?: any;
	prefix?: string | undefined;
	property?: string | undefined;
	rel?: string | undefined;
	resource?: string | undefined;
	rev?: string | undefined;
	typeof?: string | undefined;
	vocab?: string | undefined;

	// non-standard attributes
	autoCorrect?: string | undefined;
	autoSave?: string | undefined;
	color?: string | undefined;
	itemProp?: string | undefined;
	itemScope?: boolean | undefined;
	itemType?: string | undefined;
	itemID?: string | undefined;
	itemRef?: string | undefined;
	results?: number | undefined;
	security?: string | undefined;
	unselectable?: 'on' | 'off' | undefined;

	// popover API
	popover?: '' | 'auto' | 'manual' | 'hint' | undefined;
	popoverTargetAction?: 'toggle' | 'show' | 'hide' | undefined;
	popoverTarget?: string | undefined;

	// living standard
	inert?: boolean | undefined;
	/** hints at the kind of data the user may enter. */
	inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search' | undefined;
	/** selects the custom element definition for a customized built-in element. */
	is?: string | undefined;
	exportparts?: string | undefined;
	part?: string | undefined;
}

export interface AllHTMLAttributes<T> extends HTMLAttributes<T> {
	// standard HTML attributes
	accept?: string | undefined;
	acceptCharset?: string | undefined;
	action?: string | undefined;
	allowFullScreen?: boolean | undefined;
	allowTransparency?: boolean | undefined;
	alt?: string | undefined;
	as?: string | undefined;
	async?: boolean | undefined;
	autoComplete?: string | undefined;
	autoPlay?: boolean | undefined;
	capture?: boolean | 'user' | 'environment' | undefined;
	cellPadding?: number | string | undefined;
	cellSpacing?: number | string | undefined;
	charSet?: string | undefined;
	challenge?: string | undefined;
	checked?: boolean | undefined;
	cite?: string | undefined;
	classID?: string | undefined;
	cols?: number | undefined;
	colSpan?: number | undefined;
	controls?: boolean | undefined;
	coords?: string | undefined;
	crossOrigin?: CrossOrigin;
	data?: string | undefined;
	dateTime?: string | undefined;
	default?: boolean | undefined;
	defer?: boolean | undefined;
	disabled?: boolean | undefined;
	download?: any;
	encType?: string | undefined;
	form?: string | undefined;
	formAction?: string | undefined;
	formEncType?: string | undefined;
	formMethod?: string | undefined;
	formNoValidate?: boolean | undefined;
	formTarget?: string | undefined;
	frameBorder?: number | string | undefined;
	headers?: string | undefined;
	height?: number | string | undefined;
	high?: number | undefined;
	href?: string | undefined;
	hrefLang?: string | undefined;
	htmlFor?: string | undefined;
	httpEquiv?: string | undefined;
	integrity?: string | undefined;
	keyParams?: string | undefined;
	keyType?: string | undefined;
	kind?: string | undefined;
	label?: string | undefined;
	list?: string | undefined;
	loop?: boolean | undefined;
	low?: number | undefined;
	manifest?: string | undefined;
	marginHeight?: number | undefined;
	marginWidth?: number | undefined;
	max?: number | string | undefined;
	maxLength?: number | undefined;
	media?: string | undefined;
	mediaGroup?: string | undefined;
	method?: string | undefined;
	min?: number | string | undefined;
	minLength?: number | undefined;
	multiple?: boolean | undefined;
	muted?: boolean | undefined;
	name?: string | undefined;
	noValidate?: boolean | undefined;
	open?: boolean | undefined;
	optimum?: number | undefined;
	pattern?: string | undefined;
	placeholder?: string | undefined;
	playsInline?: boolean | undefined;
	poster?: string | undefined;
	preload?: string | undefined;
	readOnly?: boolean | undefined;
	required?: boolean | undefined;
	reversed?: boolean | undefined;
	rows?: number | undefined;
	rowSpan?: number | undefined;
	sandbox?: string | undefined;
	scope?: string | undefined;
	scoped?: boolean | undefined;
	scrolling?: string | undefined;
	seamless?: boolean | undefined;
	selected?: boolean | undefined;
	shape?: string | undefined;
	size?: number | undefined;
	sizes?: string | undefined;
	span?: number | undefined;
	src?: string | undefined;
	srcDoc?: string | undefined;
	srcLang?: string | undefined;
	srcSet?: string | undefined;
	start?: number | undefined;
	step?: number | string | undefined;
	summary?: string | undefined;
	target?: string | undefined;
	type?: string | undefined;
	useMap?: string | undefined;
	value?: string | readonly string[] | number | undefined;
	width?: number | string | undefined;
	wmode?: string | undefined;
	wrap?: string | undefined;
}

export type HTMLAttributeReferrerPolicy =
	| ''
	| 'no-referrer'
	| 'no-referrer-when-downgrade'
	| 'origin'
	| 'origin-when-cross-origin'
	| 'same-origin'
	| 'strict-origin'
	| 'strict-origin-when-cross-origin'
	| 'unsafe-url';

export type HTMLAttributeAnchorTarget = '_self' | '_blank' | '_parent' | '_top' | (string & {});

export interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
	download?: any;
	href?: string | undefined;
	hrefLang?: string | undefined;
	media?: string | undefined;
	ping?: string | undefined;
	target?: HTMLAttributeAnchorTarget | undefined;
	type?: string | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
}

export interface AudioHTMLAttributes<T> extends MediaHTMLAttributes<T> {}

export interface AreaHTMLAttributes<T> extends HTMLAttributes<T> {
	alt?: string | undefined;
	coords?: string | undefined;
	download?: any;
	href?: string | undefined;
	hrefLang?: string | undefined;
	media?: string | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
	shape?: string | undefined;
	target?: string | undefined;
}

export interface BaseHTMLAttributes<T> extends HTMLAttributes<T> {
	href?: string | undefined;
	target?: string | undefined;
}

export interface BlockquoteHTMLAttributes<T> extends HTMLAttributes<T> {
	cite?: string | undefined;
}

export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
	disabled?: boolean | undefined;
	form?: string | undefined;
	formAction?: string | undefined;
	formEncType?: string | undefined;
	formMethod?: string | undefined;
	formNoValidate?: boolean | undefined;
	formTarget?: string | undefined;
	name?: string | undefined;
	type?: 'submit' | 'reset' | 'button' | undefined;
	value?: string | readonly string[] | number | undefined;
}

export interface CanvasHTMLAttributes<T> extends HTMLAttributes<T> {
	height?: number | string | undefined;
	width?: number | string | undefined;
}

export interface ColHTMLAttributes<T> extends HTMLAttributes<T> {
	span?: number | undefined;
	width?: number | string | undefined;
}

export interface ColgroupHTMLAttributes<T> extends HTMLAttributes<T> {
	span?: number | undefined;
}

export interface DataHTMLAttributes<T> extends HTMLAttributes<T> {
	value?: string | readonly string[] | number | undefined;
}

export interface DetailsHTMLAttributes<T> extends HTMLAttributes<T> {
	open?: boolean | undefined;
	name?: string | undefined;
}

export interface DelHTMLAttributes<T> extends HTMLAttributes<T> {
	cite?: string | undefined;
	dateTime?: string | undefined;
}

export interface DialogHTMLAttributes<T> extends HTMLAttributes<T> {
	closedby?: 'any' | 'closerequest' | 'none' | undefined;
	onCancel?: ReactEventHandler<T> | undefined;
	onClose?: ReactEventHandler<T> | undefined;
	open?: boolean | undefined;
}

export interface EmbedHTMLAttributes<T> extends HTMLAttributes<T> {
	height?: number | string | undefined;
	src?: string | undefined;
	type?: string | undefined;
	width?: number | string | undefined;
}

export interface FieldsetHTMLAttributes<T> extends HTMLAttributes<T> {
	disabled?: boolean | undefined;
	form?: string | undefined;
	name?: string | undefined;
}

export interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
	acceptCharset?: string | undefined;
	action?: string | undefined;
	autoComplete?: string | undefined;
	encType?: string | undefined;
	method?: string | undefined;
	name?: string | undefined;
	noValidate?: boolean | undefined;
	target?: string | undefined;
}

export interface HtmlHTMLAttributes<T> extends HTMLAttributes<T> {
	manifest?: string | undefined;
}

export interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
	allow?: string | undefined;
	allowFullScreen?: boolean | undefined;
	allowTransparency?: boolean | undefined;
	/** @deprecated */
	frameBorder?: number | string | undefined;
	height?: number | string | undefined;
	loading?: 'eager' | 'lazy' | undefined;
	/** @deprecated */
	marginHeight?: number | undefined;
	/** @deprecated */
	marginWidth?: number | undefined;
	name?: string | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
	sandbox?: string | undefined;
	/** @deprecated */
	scrolling?: string | undefined;
	seamless?: boolean | undefined;
	src?: string | undefined;
	srcDoc?: string | undefined;
	width?: number | string | undefined;
}

export interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
	alt?: string | undefined;
	crossOrigin?: CrossOrigin;
	decoding?: 'async' | 'auto' | 'sync' | undefined;
	fetchPriority?: 'high' | 'low' | 'auto' | undefined;
	height?: number | string | undefined;
	loading?: 'eager' | 'lazy' | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
	sizes?: string | undefined;
	src?: string | undefined;
	srcSet?: string | undefined;
	useMap?: string | undefined;
	width?: number | string | undefined;
}

export interface InsHTMLAttributes<T> extends HTMLAttributes<T> {
	cite?: string | undefined;
	dateTime?: string | undefined;
}

export type HTMLInputTypeAttribute =
	| 'button'
	| 'checkbox'
	| 'color'
	| 'date'
	| 'datetime-local'
	| 'email'
	| 'file'
	| 'hidden'
	| 'image'
	| 'month'
	| 'number'
	| 'password'
	| 'radio'
	| 'range'
	| 'reset'
	| 'search'
	| 'submit'
	| 'tel'
	| 'text'
	| 'time'
	| 'url'
	| 'week'
	| (string & {});

export type AutoFillAddressKind = 'billing' | 'shipping';
export type AutoFillBase = '' | 'off' | 'on';
export type AutoFillContactField =
	| 'email'
	| 'tel'
	| 'tel-area-code'
	| 'tel-country-code'
	| 'tel-extension'
	| 'tel-local'
	| 'tel-local-prefix'
	| 'tel-local-suffix'
	| 'tel-national';
export type AutoFillContactKind = 'home' | 'mobile' | 'work';
export type AutoFillCredentialField = 'webauthn';
export type AutoFillNormalField =
	| 'additional-name'
	| 'address-level1'
	| 'address-level2'
	| 'address-level3'
	| 'address-level4'
	| 'address-line1'
	| 'address-line2'
	| 'address-line3'
	| 'bday-day'
	| 'bday-month'
	| 'bday-year'
	| 'cc-csc'
	| 'cc-exp'
	| 'cc-exp-month'
	| 'cc-exp-year'
	| 'cc-family-name'
	| 'cc-given-name'
	| 'cc-name'
	| 'cc-number'
	| 'cc-type'
	| 'country'
	| 'country-name'
	| 'current-password'
	| 'family-name'
	| 'given-name'
	| 'honorific-prefix'
	| 'honorific-suffix'
	| 'name'
	| 'new-password'
	| 'one-time-code'
	| 'organization'
	| 'postal-code'
	| 'street-address'
	| 'transaction-amount'
	| 'transaction-currency'
	| 'username';
export type OptionalPrefixToken<T extends string> = `${T} ` | '';
export type OptionalPostfixToken<T extends string> = ` ${T}` | '';
export type AutoFillField =
	| AutoFillNormalField
	| `${OptionalPrefixToken<AutoFillContactKind>}${AutoFillContactField}`;
export type AutoFillSection = `section-${string}`;
export type AutoFill =
	| AutoFillBase
	| `${OptionalPrefixToken<AutoFillSection>}${OptionalPrefixToken<AutoFillAddressKind>}${AutoFillField}${OptionalPostfixToken<AutoFillCredentialField>}`;
export type HTMLInputAutoCompleteAttribute = AutoFill | (string & {});

export interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
	accept?: string | undefined;
	alt?: string | undefined;
	autoComplete?: HTMLInputAutoCompleteAttribute | undefined;
	capture?: boolean | 'user' | 'environment' | undefined; // https://www.w3.org/TR/html-media-capture/#the-capture-attribute
	checked?: boolean | undefined;
	disabled?: boolean | undefined;
	form?: string | undefined;
	formAction?: string | undefined;
	formEncType?: string | undefined;
	formMethod?: string | undefined;
	formNoValidate?: boolean | undefined;
	formTarget?: string | undefined;
	height?: number | string | undefined;
	list?: string | undefined;
	max?: number | string | undefined;
	maxLength?: number | undefined;
	min?: number | string | undefined;
	minLength?: number | undefined;
	multiple?: boolean | undefined;
	name?: string | undefined;
	pattern?: string | undefined;
	placeholder?: string | undefined;
	readOnly?: boolean | undefined;
	required?: boolean | undefined;
	size?: number | undefined;
	src?: string | undefined;
	step?: number | string | undefined;
	type?: HTMLInputTypeAttribute | undefined;
	value?: string | readonly string[] | number | undefined;
	width?: number | string | undefined;

	// input change events can safely narrow their target.
	onChange?: ChangeEventHandler<T, HTMLInputElement> | undefined;
}

export interface KeygenHTMLAttributes<T> extends HTMLAttributes<T> {
	challenge?: string | undefined;
	disabled?: boolean | undefined;
	form?: string | undefined;
	keyType?: string | undefined;
	keyParams?: string | undefined;
	name?: string | undefined;
}

export interface LabelHTMLAttributes<T> extends HTMLAttributes<T> {
	form?: string | undefined;
	htmlFor?: string | undefined;
}

export interface LiHTMLAttributes<T> extends HTMLAttributes<T> {
	value?: string | readonly string[] | number | undefined;
}

export interface LinkHTMLAttributes<T> extends HTMLAttributes<T> {
	as?: string | undefined;
	blocking?: 'render' | (string & {}) | undefined;
	crossOrigin?: CrossOrigin;
	fetchPriority?: 'high' | 'low' | 'auto' | undefined;
	href?: string | undefined;
	hrefLang?: string | undefined;
	integrity?: string | undefined;
	media?: string | undefined;
	imageSrcSet?: string | undefined;
	imageSizes?: string | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
	sizes?: string | undefined;
	type?: string | undefined;
	charSet?: string | undefined;
}

export interface MapHTMLAttributes<T> extends HTMLAttributes<T> {
	name?: string | undefined;
}

export interface MenuHTMLAttributes<T> extends HTMLAttributes<T> {
	type?: string | undefined;
}

export interface MediaHTMLAttributes<T> extends HTMLAttributes<T> {
	autoPlay?: boolean | undefined;
	controls?: boolean | undefined;
	controlsList?: string | undefined;
	crossOrigin?: CrossOrigin;
	loop?: boolean | undefined;
	mediaGroup?: string | undefined;
	muted?: boolean | undefined;
	playsInline?: boolean | undefined;
	preload?: string | undefined;
	src?: string | undefined;
}

export interface MetaHTMLAttributes<T> extends HTMLAttributes<T> {
	charSet?: string | undefined;
	content?: string | undefined;
	httpEquiv?: string | undefined;
	media?: string | undefined;
	name?: string | undefined;
}

export interface MeterHTMLAttributes<T> extends HTMLAttributes<T> {
	form?: string | undefined;
	high?: number | undefined;
	low?: number | undefined;
	max?: number | string | undefined;
	min?: number | string | undefined;
	optimum?: number | undefined;
	value?: string | readonly string[] | number | undefined;
}

export interface QuoteHTMLAttributes<T> extends HTMLAttributes<T> {
	cite?: string | undefined;
}

export interface ObjectHTMLAttributes<T> extends HTMLAttributes<T> {
	classID?: string | undefined;
	data?: string | undefined;
	form?: string | undefined;
	height?: number | string | undefined;
	name?: string | undefined;
	type?: string | undefined;
	useMap?: string | undefined;
	width?: number | string | undefined;
	wmode?: string | undefined;
}

export interface OlHTMLAttributes<T> extends HTMLAttributes<T> {
	reversed?: boolean | undefined;
	start?: number | undefined;
	type?: '1' | 'a' | 'A' | 'i' | 'I' | undefined;
}

export interface OptgroupHTMLAttributes<T> extends HTMLAttributes<T> {
	disabled?: boolean | undefined;
	label?: string | undefined;
}

export interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
	disabled?: boolean | undefined;
	label?: string | undefined;
	selected?: boolean | undefined;
	value?: string | readonly string[] | number | undefined;
}

export interface OutputHTMLAttributes<T> extends HTMLAttributes<T> {
	form?: string | undefined;
	htmlFor?: string | undefined;
	name?: string | undefined;
}

export interface ParamHTMLAttributes<T> extends HTMLAttributes<T> {
	name?: string | undefined;
	value?: string | readonly string[] | number | undefined;
}

export interface ProgressHTMLAttributes<T> extends HTMLAttributes<T> {
	max?: number | string | undefined;
	value?: string | readonly string[] | number | undefined;
}

export interface SlotHTMLAttributes<T> extends HTMLAttributes<T> {
	name?: string | undefined;
}

export interface ScriptHTMLAttributes<T> extends HTMLAttributes<T> {
	async?: boolean | undefined;
	blocking?: 'render' | (string & {}) | undefined;
	/** @deprecated */
	charSet?: string | undefined;
	crossOrigin?: CrossOrigin;
	defer?: boolean | undefined;
	fetchPriority?: 'high' | 'low' | 'auto' | undefined;
	integrity?: string | undefined;
	noModule?: boolean | undefined;
	referrerPolicy?: HTMLAttributeReferrerPolicy | undefined;
	src?: string | undefined;
	type?: string | undefined;
}

export interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
	autoComplete?: string | undefined;
	disabled?: boolean | undefined;
	form?: string | undefined;
	multiple?: boolean | undefined;
	name?: string | undefined;
	required?: boolean | undefined;
	size?: number | undefined;
	value?: string | readonly string[] | number | undefined;
	// select change events can safely narrow their target.
	onChange?: ChangeEventHandler<T, HTMLSelectElement> | undefined;
}

export interface SourceHTMLAttributes<T> extends HTMLAttributes<T> {
	height?: number | string | undefined;
	media?: string | undefined;
	sizes?: string | undefined;
	src?: string | undefined;
	srcSet?: string | undefined;
	type?: string | undefined;
	width?: number | string | undefined;
}

export interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
	blocking?: 'render' | (string & {}) | undefined;
	media?: string | undefined;
	scoped?: boolean | undefined;
	type?: string | undefined;
}

export interface TableHTMLAttributes<T> extends HTMLAttributes<T> {
	align?: 'left' | 'center' | 'right' | undefined;
	bgcolor?: string | undefined;
	border?: number | undefined;
	cellPadding?: number | string | undefined;
	cellSpacing?: number | string | undefined;
	frame?: boolean | undefined;
	rules?: 'none' | 'groups' | 'rows' | 'columns' | 'all' | undefined;
	summary?: string | undefined;
	width?: number | string | undefined;
}

export interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
	autoComplete?: string | undefined;
	cols?: number | undefined;
	dirName?: string | undefined;
	disabled?: boolean | undefined;
	form?: string | undefined;
	maxLength?: number | undefined;
	minLength?: number | undefined;
	name?: string | undefined;
	placeholder?: string | undefined;
	readOnly?: boolean | undefined;
	required?: boolean | undefined;
	rows?: number | undefined;
	value?: string | readonly string[] | number | undefined;
	wrap?: string | undefined;

	// textarea change events can safely narrow their target.
	onChange?: ChangeEventHandler<T, HTMLTextAreaElement> | undefined;
}

export interface TdHTMLAttributes<T> extends HTMLAttributes<T> {
	align?: 'left' | 'center' | 'right' | 'justify' | 'char' | undefined;
	colSpan?: number | undefined;
	headers?: string | undefined;
	rowSpan?: number | undefined;
	scope?: string | undefined;
	abbr?: string | undefined;
	height?: number | string | undefined;
	width?: number | string | undefined;
	valign?: 'top' | 'middle' | 'bottom' | 'baseline' | undefined;
}

export interface ThHTMLAttributes<T> extends HTMLAttributes<T> {
	align?: 'left' | 'center' | 'right' | 'justify' | 'char' | undefined;
	colSpan?: number | undefined;
	headers?: string | undefined;
	rowSpan?: number | undefined;
	scope?: string | undefined;
	abbr?: string | undefined;
}

export interface TimeHTMLAttributes<T> extends HTMLAttributes<T> {
	dateTime?: string | undefined;
}

export interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
	default?: boolean | undefined;
	kind?: string | undefined;
	label?: string | undefined;
	src?: string | undefined;
	srcLang?: string | undefined;
}

export interface VideoHTMLAttributes<T> extends MediaHTMLAttributes<T> {
	height?: number | string | undefined;
	playsInline?: boolean | undefined;
	poster?: string | undefined;
	width?: number | string | undefined;
	disablePictureInPicture?: boolean | undefined;
	disableRemotePlayback?: boolean | undefined;

	onResize?: ReactEventHandler<T> | undefined;
	onResizeCapture?: ReactEventHandler<T> | undefined;
}

// attribute types cover React's supported SVG surface.
export interface SVGAttributes<T> extends AriaAttributes, DOMAttributes<T> {
	// React-specific attributes
	suppressHydrationWarning?: boolean | undefined;

	// attributes shared with `HTMLAttributes`
	// kept separate from HTML attributes for SVG typing.
	className?: string | undefined;
	color?: string | undefined;
	height?: number | string | undefined;
	id?: string | undefined;
	lang?: string | undefined;
	max?: number | string | undefined;
	media?: string | undefined;
	method?: string | undefined;
	min?: number | string | undefined;
	name?: string | undefined;
	nonce?: string | undefined;
	part?: string | undefined;
	slot?: string | undefined;
	style?: CSSProperties | undefined;
	target?: string | undefined;
	type?: string | undefined;
	width?: number | string | undefined;

	// other HTML properties supported by SVG
	role?: AriaRole | undefined;
	tabIndex?: number | undefined;
	crossOrigin?: CrossOrigin;

	// SVG-specific attributes
	accentHeight?: number | string | undefined;
	accumulate?: 'none' | 'sum' | undefined;
	additive?: 'replace' | 'sum' | undefined;
	alignmentBaseline?:
		| 'auto'
		| 'baseline'
		| 'before-edge'
		| 'text-before-edge'
		| 'middle'
		| 'central'
		| 'after-edge'
		| 'text-after-edge'
		| 'ideographic'
		| 'alphabetic'
		| 'hanging'
		| 'mathematical'
		| 'inherit'
		| undefined;
	allowReorder?: 'no' | 'yes' | undefined;
	alphabetic?: number | string | undefined;
	amplitude?: number | string | undefined;
	arabicForm?: 'initial' | 'medial' | 'terminal' | 'isolated' | undefined;
	ascent?: number | string | undefined;
	attributeName?: string | undefined;
	attributeType?: string | undefined;
	autoReverse?: Booleanish | undefined;
	azimuth?: number | string | undefined;
	baseFrequency?: number | string | undefined;
	baselineShift?: number | string | undefined;
	baseProfile?: number | string | undefined;
	bbox?: number | string | undefined;
	begin?: number | string | undefined;
	bias?: number | string | undefined;
	by?: number | string | undefined;
	calcMode?: number | string | undefined;
	capHeight?: number | string | undefined;
	clip?: number | string | undefined;
	clipPath?: string | undefined;
	clipPathUnits?: number | string | undefined;
	clipRule?: number | string | undefined;
	colorInterpolation?: number | string | undefined;
	colorInterpolationFilters?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit' | undefined;
	colorProfile?: number | string | undefined;
	colorRendering?: number | string | undefined;
	contentScriptType?: number | string | undefined;
	contentStyleType?: number | string | undefined;
	cursor?: number | string | undefined;
	cx?: number | string | undefined;
	cy?: number | string | undefined;
	d?: string | undefined;
	decelerate?: number | string | undefined;
	descent?: number | string | undefined;
	diffuseConstant?: number | string | undefined;
	direction?: number | string | undefined;
	display?: number | string | undefined;
	divisor?: number | string | undefined;
	dominantBaseline?:
		| 'auto'
		| 'use-script'
		| 'no-change'
		| 'reset-size'
		| 'ideographic'
		| 'alphabetic'
		| 'hanging'
		| 'mathematical'
		| 'central'
		| 'middle'
		| 'text-after-edge'
		| 'text-before-edge'
		| 'inherit'
		| undefined;
	dur?: number | string | undefined;
	dx?: number | string | undefined;
	dy?: number | string | undefined;
	edgeMode?: number | string | undefined;
	elevation?: number | string | undefined;
	enableBackground?: number | string | undefined;
	end?: number | string | undefined;
	exponent?: number | string | undefined;
	externalResourcesRequired?: Booleanish | undefined;
	fill?: string | undefined;
	fillOpacity?: number | string | undefined;
	fillRule?: 'nonzero' | 'evenodd' | 'inherit' | undefined;
	filter?: string | undefined;
	filterRes?: number | string | undefined;
	filterUnits?: number | string | undefined;
	floodColor?: number | string | undefined;
	floodOpacity?: number | string | undefined;
	focusable?: Booleanish | 'auto' | undefined;
	fontFamily?: string | undefined;
	fontSize?: number | string | undefined;
	fontSizeAdjust?: number | string | undefined;
	fontStretch?: number | string | undefined;
	fontStyle?: number | string | undefined;
	fontVariant?: number | string | undefined;
	fontWeight?: number | string | undefined;
	format?: number | string | undefined;
	fr?: number | string | undefined;
	from?: number | string | undefined;
	fx?: number | string | undefined;
	fy?: number | string | undefined;
	g1?: number | string | undefined;
	g2?: number | string | undefined;
	glyphName?: number | string | undefined;
	glyphOrientationHorizontal?: number | string | undefined;
	glyphOrientationVertical?: number | string | undefined;
	glyphRef?: number | string | undefined;
	gradientTransform?: string | undefined;
	gradientUnits?: string | undefined;
	hanging?: number | string | undefined;
	horizAdvX?: number | string | undefined;
	horizOriginX?: number | string | undefined;
	href?: string | undefined;
	ideographic?: number | string | undefined;
	imageRendering?: number | string | undefined;
	in2?: number | string | undefined;
	in?: string | undefined;
	intercept?: number | string | undefined;
	k1?: number | string | undefined;
	k2?: number | string | undefined;
	k3?: number | string | undefined;
	k4?: number | string | undefined;
	k?: number | string | undefined;
	kernelMatrix?: number | string | undefined;
	kernelUnitLength?: number | string | undefined;
	kerning?: number | string | undefined;
	keyPoints?: number | string | undefined;
	keySplines?: number | string | undefined;
	keyTimes?: number | string | undefined;
	lengthAdjust?: number | string | undefined;
	letterSpacing?: number | string | undefined;
	lightingColor?: number | string | undefined;
	limitingConeAngle?: number | string | undefined;
	local?: number | string | undefined;
	markerEnd?: string | undefined;
	markerHeight?: number | string | undefined;
	markerMid?: string | undefined;
	markerStart?: string | undefined;
	markerUnits?: number | string | undefined;
	markerWidth?: number | string | undefined;
	mask?: string | undefined;
	maskContentUnits?: number | string | undefined;
	maskUnits?: number | string | undefined;
	mathematical?: number | string | undefined;
	mode?: number | string | undefined;
	numOctaves?: number | string | undefined;
	offset?: number | string | undefined;
	opacity?: number | string | undefined;
	operator?: number | string | undefined;
	order?: number | string | undefined;
	orient?: number | string | undefined;
	orientation?: number | string | undefined;
	origin?: number | string | undefined;
	overflow?: number | string | undefined;
	overlinePosition?: number | string | undefined;
	overlineThickness?: number | string | undefined;
	paintOrder?: number | string | undefined;
	panose1?: number | string | undefined;
	path?: string | undefined;
	pathLength?: number | string | undefined;
	patternContentUnits?: string | undefined;
	patternTransform?: number | string | undefined;
	patternUnits?: string | undefined;
	pointerEvents?: number | string | undefined;
	points?: string | undefined;
	pointsAtX?: number | string | undefined;
	pointsAtY?: number | string | undefined;
	pointsAtZ?: number | string | undefined;
	preserveAlpha?: Booleanish | undefined;
	preserveAspectRatio?: string | undefined;
	primitiveUnits?: number | string | undefined;
	r?: number | string | undefined;
	radius?: number | string | undefined;
	refX?: number | string | undefined;
	refY?: number | string | undefined;
	renderingIntent?: number | string | undefined;
	repeatCount?: number | string | undefined;
	repeatDur?: number | string | undefined;
	requiredExtensions?: number | string | undefined;
	requiredFeatures?: number | string | undefined;
	restart?: number | string | undefined;
	result?: string | undefined;
	rotate?: number | string | undefined;
	rx?: number | string | undefined;
	ry?: number | string | undefined;
	scale?: number | string | undefined;
	seed?: number | string | undefined;
	shapeRendering?: number | string | undefined;
	slope?: number | string | undefined;
	spacing?: number | string | undefined;
	specularConstant?: number | string | undefined;
	specularExponent?: number | string | undefined;
	speed?: number | string | undefined;
	spreadMethod?: string | undefined;
	startOffset?: number | string | undefined;
	stdDeviation?: number | string | undefined;
	stemh?: number | string | undefined;
	stemv?: number | string | undefined;
	stitchTiles?: number | string | undefined;
	stopColor?: string | undefined;
	stopOpacity?: number | string | undefined;
	strikethroughPosition?: number | string | undefined;
	strikethroughThickness?: number | string | undefined;
	string?: number | string | undefined;
	stroke?: string | undefined;
	strokeDasharray?: string | number | undefined;
	strokeDashoffset?: string | number | undefined;
	strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit' | undefined;
	strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit' | undefined;
	strokeMiterlimit?: number | string | undefined;
	strokeOpacity?: number | string | undefined;
	strokeWidth?: number | string | undefined;
	surfaceScale?: number | string | undefined;
	systemLanguage?: number | string | undefined;
	tableValues?: number | string | undefined;
	targetX?: number | string | undefined;
	targetY?: number | string | undefined;
	textAnchor?: 'start' | 'middle' | 'end' | 'inherit' | undefined;
	textDecoration?: number | string | undefined;
	textLength?: number | string | undefined;
	textRendering?: number | string | undefined;
	to?: number | string | undefined;
	transform?: string | undefined;
	u1?: number | string | undefined;
	u2?: number | string | undefined;
	underlinePosition?: number | string | undefined;
	underlineThickness?: number | string | undefined;
	unicode?: number | string | undefined;
	unicodeBidi?: number | string | undefined;
	unicodeRange?: number | string | undefined;
	unitsPerEm?: number | string | undefined;
	vAlphabetic?: number | string | undefined;
	values?: string | undefined;
	vectorEffect?: number | string | undefined;
	version?: string | undefined;
	vertAdvY?: number | string | undefined;
	vertOriginX?: number | string | undefined;
	vertOriginY?: number | string | undefined;
	vHanging?: number | string | undefined;
	vIdeographic?: number | string | undefined;
	viewBox?: string | undefined;
	viewTarget?: number | string | undefined;
	visibility?: number | string | undefined;
	vMathematical?: number | string | undefined;
	widths?: number | string | undefined;
	wordSpacing?: number | string | undefined;
	writingMode?: number | string | undefined;
	x1?: number | string | undefined;
	x2?: number | string | undefined;
	x?: number | string | undefined;
	xChannelSelector?: string | undefined;
	xHeight?: number | string | undefined;
	xlinkActuate?: string | undefined;
	xlinkArcrole?: string | undefined;
	xlinkHref?: string | undefined;
	xlinkRole?: string | undefined;
	xlinkShow?: string | undefined;
	xlinkTitle?: string | undefined;
	xlinkType?: string | undefined;
	xmlBase?: string | undefined;
	xmlLang?: string | undefined;
	xmlns?: string | undefined;
	xmlnsXlink?: string | undefined;
	xmlSpace?: string | undefined;
	y1?: number | string | undefined;
	y2?: number | string | undefined;
	y?: number | string | undefined;
	yChannelSelector?: string | undefined;
	z?: number | string | undefined;
	zoomAndPan?: string | undefined;
}

export interface WebViewHTMLAttributes<T> extends HTMLAttributes<T> {
	allowFullScreen?: boolean | undefined;
	allowpopups?: boolean | undefined;
	autosize?: boolean | undefined;
	blinkfeatures?: string | undefined;
	disableblinkfeatures?: string | undefined;
	disableguestresize?: boolean | undefined;
	disablewebsecurity?: boolean | undefined;
	guestinstance?: string | undefined;
	httpreferrer?: string | undefined;
	nodeintegration?: boolean | undefined;
	partition?: string | undefined;
	plugins?: boolean | undefined;
	preload?: string | undefined;
	src?: string | undefined;
	useragent?: string | undefined;
	webpreferences?: string | undefined;
}

// TODO: move to react-dom.
export type HTMLElementType =
	| 'a'
	| 'abbr'
	| 'address'
	| 'area'
	| 'article'
	| 'aside'
	| 'audio'
	| 'b'
	| 'base'
	| 'bdi'
	| 'bdo'
	| 'big'
	| 'blockquote'
	| 'body'
	| 'br'
	| 'button'
	| 'canvas'
	| 'caption'
	| 'center'
	| 'cite'
	| 'code'
	| 'col'
	| 'colgroup'
	| 'data'
	| 'datalist'
	| 'dd'
	| 'del'
	| 'details'
	| 'dfn'
	| 'dialog'
	| 'div'
	| 'dl'
	| 'dt'
	| 'em'
	| 'embed'
	| 'fieldset'
	| 'figcaption'
	| 'figure'
	| 'footer'
	| 'form'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'h4'
	| 'h5'
	| 'h6'
	| 'head'
	| 'header'
	| 'hgroup'
	| 'hr'
	| 'html'
	| 'i'
	| 'iframe'
	| 'img'
	| 'input'
	| 'ins'
	| 'kbd'
	| 'keygen'
	| 'label'
	| 'legend'
	| 'li'
	| 'link'
	| 'main'
	| 'map'
	| 'mark'
	| 'menu'
	| 'menuitem'
	| 'meta'
	| 'meter'
	| 'nav'
	| 'noscript'
	| 'object'
	| 'ol'
	| 'optgroup'
	| 'option'
	| 'output'
	| 'p'
	| 'param'
	| 'picture'
	| 'pre'
	| 'progress'
	| 'q'
	| 'rp'
	| 'rt'
	| 'ruby'
	| 's'
	| 'samp'
	| 'search'
	| 'slot'
	| 'script'
	| 'section'
	| 'select'
	| 'small'
	| 'source'
	| 'span'
	| 'strong'
	| 'style'
	| 'sub'
	| 'summary'
	| 'sup'
	| 'table'
	| 'template'
	| 'tbody'
	| 'td'
	| 'textarea'
	| 'tfoot'
	| 'th'
	| 'thead'
	| 'time'
	| 'title'
	| 'tr'
	| 'track'
	| 'u'
	| 'ul'
	| 'var'
	| 'video'
	| 'wbr'
	| 'webview';

// TODO: move to react-dom.
export type SVGElementType =
	| 'animate'
	| 'circle'
	| 'clipPath'
	| 'defs'
	| 'desc'
	| 'ellipse'
	| 'feBlend'
	| 'feColorMatrix'
	| 'feComponentTransfer'
	| 'feComposite'
	| 'feConvolveMatrix'
	| 'feDiffuseLighting'
	| 'feDisplacementMap'
	| 'feDistantLight'
	| 'feDropShadow'
	| 'feFlood'
	| 'feFuncA'
	| 'feFuncB'
	| 'feFuncG'
	| 'feFuncR'
	| 'feGaussianBlur'
	| 'feImage'
	| 'feMerge'
	| 'feMergeNode'
	| 'feMorphology'
	| 'feOffset'
	| 'fePointLight'
	| 'feSpecularLighting'
	| 'feSpotLight'
	| 'feTile'
	| 'feTurbulence'
	| 'filter'
	| 'foreignObject'
	| 'g'
	| 'image'
	| 'line'
	| 'linearGradient'
	| 'marker'
	| 'mask'
	| 'metadata'
	| 'path'
	| 'pattern'
	| 'polygon'
	| 'polyline'
	| 'radialGradient'
	| 'rect'
	| 'stop'
	| 'svg'
	| 'switch'
	| 'symbol'
	| 'text'
	| 'textPath'
	| 'tspan'
	| 'use'
	| 'view';

// #endregion

// #region browser interfaces

export interface AbstractView {
	styleMedia: StyleMedia;
	document: Document;
}

export interface Touch {
	identifier: number;
	target: EventTarget;
	screenX: number;
	screenY: number;
	clientX: number;
	clientY: number;
	pageX: number;
	pageY: number;
}

export interface TouchList {
	[index: number]: Touch;
	length: number;
	item(index: number): Touch;
	identifiedTouch(identifier: number): Touch;
}

// #endregion

// #region JSX

export namespace JSX {
	// avoid enumerating every intrinsic tag in the JSX hot path.
	// oxlint-disable-next-line no-shadow
	type ElementType = string | JSXElementConstructor<any>;
	interface Element extends ReactElement<any, any> {}
	interface ElementAttributesProperty {
		props: {};
	}
	interface ElementChildrenAttribute {
		children: {};
	}

	interface IntrinsicAttributes extends Attributes {}

	interface IntrinsicElements {
		// HTML
		a: DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
		abbr: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		address: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		area: DetailedHTMLProps<AreaHTMLAttributes<HTMLAreaElement>, HTMLAreaElement>;
		article: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		aside: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		audio: DetailedHTMLProps<AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
		b: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		base: DetailedHTMLProps<BaseHTMLAttributes<HTMLBaseElement>, HTMLBaseElement>;
		bdi: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		bdo: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		big: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		blockquote: DetailedHTMLProps<BlockquoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
		body: DetailedHTMLProps<HTMLAttributes<HTMLBodyElement>, HTMLBodyElement>;
		br: DetailedHTMLProps<HTMLAttributes<HTMLBRElement>, HTMLBRElement>;
		button: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
		canvas: DetailedHTMLProps<CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
		caption: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		center: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		cite: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		code: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		col: DetailedHTMLProps<ColHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
		colgroup: DetailedHTMLProps<ColgroupHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
		data: DetailedHTMLProps<DataHTMLAttributes<HTMLDataElement>, HTMLDataElement>;
		datalist: DetailedHTMLProps<HTMLAttributes<HTMLDataListElement>, HTMLDataListElement>;
		dd: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		del: DetailedHTMLProps<DelHTMLAttributes<HTMLModElement>, HTMLModElement>;
		details: DetailedHTMLProps<DetailsHTMLAttributes<HTMLDetailsElement>, HTMLDetailsElement>;
		dfn: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		dialog: DetailedHTMLProps<DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>;
		div: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
		dl: DetailedHTMLProps<HTMLAttributes<HTMLDListElement>, HTMLDListElement>;
		dt: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		em: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		embed: DetailedHTMLProps<EmbedHTMLAttributes<HTMLEmbedElement>, HTMLEmbedElement>;
		fieldset: DetailedHTMLProps<FieldsetHTMLAttributes<HTMLFieldSetElement>, HTMLFieldSetElement>;
		figcaption: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		figure: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		footer: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		form: DetailedHTMLProps<FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
		h1: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
		h2: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
		h3: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
		h4: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
		h5: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
		h6: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
		head: DetailedHTMLProps<HTMLAttributes<HTMLHeadElement>, HTMLHeadElement>;
		header: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		hgroup: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		hr: DetailedHTMLProps<HTMLAttributes<HTMLHRElement>, HTMLHRElement>;
		html: DetailedHTMLProps<HtmlHTMLAttributes<HTMLHtmlElement>, HTMLHtmlElement>;
		i: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		iframe: DetailedHTMLProps<IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>;
		img: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
		input: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
		ins: DetailedHTMLProps<InsHTMLAttributes<HTMLModElement>, HTMLModElement>;
		kbd: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		keygen: DetailedHTMLProps<KeygenHTMLAttributes<HTMLElement>, HTMLElement>;
		label: DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
		legend: DetailedHTMLProps<HTMLAttributes<HTMLLegendElement>, HTMLLegendElement>;
		li: DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
		link: DetailedHTMLProps<LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;
		main: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		map: DetailedHTMLProps<MapHTMLAttributes<HTMLMapElement>, HTMLMapElement>;
		mark: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		menu: DetailedHTMLProps<MenuHTMLAttributes<HTMLElement>, HTMLElement>;
		menuitem: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		meta: DetailedHTMLProps<MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
		meter: DetailedHTMLProps<MeterHTMLAttributes<HTMLMeterElement>, HTMLMeterElement>;
		nav: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		noindex: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		noscript: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		object: DetailedHTMLProps<ObjectHTMLAttributes<HTMLObjectElement>, HTMLObjectElement>;
		ol: DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
		optgroup: DetailedHTMLProps<OptgroupHTMLAttributes<HTMLOptGroupElement>, HTMLOptGroupElement>;
		option: DetailedHTMLProps<OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
		output: DetailedHTMLProps<OutputHTMLAttributes<HTMLOutputElement>, HTMLOutputElement>;
		p: DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
		param: DetailedHTMLProps<ParamHTMLAttributes<HTMLParamElement>, HTMLParamElement>;
		picture: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		pre: DetailedHTMLProps<HTMLAttributes<HTMLPreElement>, HTMLPreElement>;
		progress: DetailedHTMLProps<ProgressHTMLAttributes<HTMLProgressElement>, HTMLProgressElement>;
		q: DetailedHTMLProps<QuoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
		rp: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		rt: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		ruby: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		s: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		samp: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		search: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		slot: DetailedHTMLProps<SlotHTMLAttributes<HTMLSlotElement>, HTMLSlotElement>;
		script: DetailedHTMLProps<ScriptHTMLAttributes<HTMLScriptElement>, HTMLScriptElement>;
		section: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		select: DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
		small: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		source: DetailedHTMLProps<SourceHTMLAttributes<HTMLSourceElement>, HTMLSourceElement>;
		span: DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
		strong: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		style: DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>;
		sub: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		summary: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		sup: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		table: DetailedHTMLProps<TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
		template: DetailedHTMLProps<HTMLAttributes<HTMLTemplateElement>, HTMLTemplateElement>;
		tbody: DetailedHTMLProps<HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
		td: DetailedHTMLProps<TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
		textarea: DetailedHTMLProps<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
		tfoot: DetailedHTMLProps<HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
		th: DetailedHTMLProps<ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
		thead: DetailedHTMLProps<HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
		time: DetailedHTMLProps<TimeHTMLAttributes<HTMLTimeElement>, HTMLTimeElement>;
		title: DetailedHTMLProps<HTMLAttributes<HTMLTitleElement>, HTMLTitleElement>;
		tr: DetailedHTMLProps<HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
		track: DetailedHTMLProps<TrackHTMLAttributes<HTMLTrackElement>, HTMLTrackElement>;
		u: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		ul: DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
		var: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		video: DetailedHTMLProps<VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
		wbr: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
		webview: DetailedHTMLProps<WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;

		// SVG
		svg: SVGProps<SVGSVGElement>;

		animate: SVGProps<SVGElement>; // TODO: use SVGAnimateElement once available in TypeScript's lib.dom.d.ts.
		animateMotion: SVGProps<SVGElement>;
		animateTransform: SVGProps<SVGElement>; // TODO: use SVGAnimateTransformElement once available in TypeScript's lib.dom.d.ts.
		circle: SVGProps<SVGCircleElement>;
		clipPath: SVGProps<SVGClipPathElement>;
		defs: SVGProps<SVGDefsElement>;
		desc: SVGProps<SVGDescElement>;
		ellipse: SVGProps<SVGEllipseElement>;
		feBlend: SVGProps<SVGFEBlendElement>;
		feColorMatrix: SVGProps<SVGFEColorMatrixElement>;
		feComponentTransfer: SVGProps<SVGFEComponentTransferElement>;
		feComposite: SVGProps<SVGFECompositeElement>;
		feConvolveMatrix: SVGProps<SVGFEConvolveMatrixElement>;
		feDiffuseLighting: SVGProps<SVGFEDiffuseLightingElement>;
		feDisplacementMap: SVGProps<SVGFEDisplacementMapElement>;
		feDistantLight: SVGProps<SVGFEDistantLightElement>;
		feDropShadow: SVGProps<SVGFEDropShadowElement>;
		feFlood: SVGProps<SVGFEFloodElement>;
		feFuncA: SVGProps<SVGFEFuncAElement>;
		feFuncB: SVGProps<SVGFEFuncBElement>;
		feFuncG: SVGProps<SVGFEFuncGElement>;
		feFuncR: SVGProps<SVGFEFuncRElement>;
		feGaussianBlur: SVGProps<SVGFEGaussianBlurElement>;
		feImage: SVGProps<SVGFEImageElement>;
		feMerge: SVGProps<SVGFEMergeElement>;
		feMergeNode: SVGProps<SVGFEMergeNodeElement>;
		feMorphology: SVGProps<SVGFEMorphologyElement>;
		feOffset: SVGProps<SVGFEOffsetElement>;
		fePointLight: SVGProps<SVGFEPointLightElement>;
		feSpecularLighting: SVGProps<SVGFESpecularLightingElement>;
		feSpotLight: SVGProps<SVGFESpotLightElement>;
		feTile: SVGProps<SVGFETileElement>;
		feTurbulence: SVGProps<SVGFETurbulenceElement>;
		filter: SVGProps<SVGFilterElement>;
		foreignObject: SVGProps<SVGForeignObjectElement>;
		g: SVGProps<SVGGElement>;
		image: SVGProps<SVGImageElement>;
		line: SVGLineElementAttributes<SVGLineElement>;
		linearGradient: SVGProps<SVGLinearGradientElement>;
		marker: SVGProps<SVGMarkerElement>;
		mask: SVGProps<SVGMaskElement>;
		metadata: SVGProps<SVGMetadataElement>;
		mpath: SVGProps<SVGElement>;
		path: SVGProps<SVGPathElement>;
		pattern: SVGProps<SVGPatternElement>;
		polygon: SVGProps<SVGPolygonElement>;
		polyline: SVGProps<SVGPolylineElement>;
		radialGradient: SVGProps<SVGRadialGradientElement>;
		rect: SVGProps<SVGRectElement>;
		set: SVGProps<SVGSetElement>;
		stop: SVGProps<SVGStopElement>;
		switch: SVGProps<SVGSwitchElement>;
		symbol: SVGProps<SVGSymbolElement>;
		text: SVGTextElementAttributes<SVGTextElement>;
		textPath: SVGProps<SVGTextPathElement>;
		tspan: SVGProps<SVGTSpanElement>;
		use: SVGProps<SVGUseElement>;
		view: SVGProps<SVGViewElement>;
	}
}

// #endregion

// #region scion

/** props for {@link ErrorBoundary}. */
export interface ErrorBoundaryProps {
	children?: ReactNode | undefined;
	/** replaces children after an error; the callback form can reset and retry them. */
	fallback?: ReactNode | ((error: unknown, reset: () => void) => ReactNode);
}

/** catches render errors and shows fallback content. */
export const ErrorBoundary: ExoticComponent<ErrorBoundaryProps>;

/**
 * batches updates in `scope` and flushes them in a later task.
 *
 * @param scope synchronous updates to batch
 */
export function startTransition(scope: () => void): void;

export function createPortal(
	children: ReactNode,
	container: Element | DocumentFragment,
	key?: string | null,
): ReactPortal;

export function flushSync<R>(fn: () => R): R;

export interface RootOptions {
	/** called with an error that an {@link ErrorBoundary} caught. */
	onCaughtError?: ((error: unknown) => void) | undefined;
	/** called with an error that reached the root with no boundary to catch it. */
	onUncaughtError?: ((error: unknown) => void) | undefined;
}

export interface Root {
	render(children: ReactNode): void;
	unmount(): void;
}

/**
 * creates a root that renders into `container`.
 *
 * @param container DOM container to render into
 * @param options optional root error handlers
 * @returns root controller
 */
export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root;
// #endregion

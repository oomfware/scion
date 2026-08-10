import type * as react from 'react';

// resolve each call against the runtime that is rendering the component.
export interface TestRuntime {
	act: (callback: () => Promise<void>) => Promise<void>;
	createRoot: (
		container: Element,
		options: { onCaughtError?: (error: unknown) => void; onUncaughtError?: (error: unknown) => void },
	) => { render: (element: any) => void; unmount: () => void };
	module: any;
	name: string;
}

let active: TestRuntime | null = null;

export const setActiveRuntime = (runtime: TestRuntime | null) => {
	active = runtime;
};

export const activeRuntime = (): TestRuntime => {
	if (!active) {
		throw new Error('no runtime is active; render through runScenario.');
	}
	return active;
};

const forward =
	(name: string) =>
	(...args: any[]) => {
		const runtime = activeRuntime();
		const implementation = runtime.module[name];
		if (typeof implementation !== 'function') {
			throw new Error(`${runtime.name} does not implement ${name}.`);
		}
		return implementation(...args);
	};

// use React's signatures for calls through the active runtime.

// #region hooks
export const use = forward('use') as typeof react.use;
export const useCallback = forward('useCallback') as typeof react.useCallback;
export const useContext = forward('useContext') as typeof react.useContext;
export const useDebugValue = forward('useDebugValue') as typeof react.useDebugValue;
export const useEffect = forward('useEffect') as typeof react.useEffect;
export const useEffectEvent = forward('useEffectEvent') as <Args extends unknown[], Return>(
	callback: (...args: Args) => Return,
) => (...args: Args) => Return;
export const useId = forward('useId') as typeof react.useId;
export const useImperativeHandle = forward('useImperativeHandle') as typeof react.useImperativeHandle;
export const useInsertionEffect = forward('useInsertionEffect') as typeof react.useInsertionEffect;
export const useLayoutEffect = forward('useLayoutEffect') as typeof react.useLayoutEffect;
export const useMemo = forward('useMemo') as typeof react.useMemo;
export const useReducer = forward('useReducer') as typeof react.useReducer;
export const useRef = forward('useRef') as typeof react.useRef;
export const useState = forward('useState') as typeof react.useState;
export const useSyncExternalStore = forward('useSyncExternalStore') as typeof react.useSyncExternalStore;
// #endregion

// #region element and component helpers
export const cloneElement = forward('cloneElement') as typeof react.cloneElement;
export const createContext = forward('createContext') as typeof react.createContext;
export const createElement = forward('createElement') as typeof react.createElement;
export const createRef = forward('createRef') as typeof react.createRef;
export const forwardRef = forward('forwardRef') as typeof react.forwardRef;
export const isValidElement = forward('isValidElement') as typeof react.isValidElement;
export const lazy = forward('lazy') as typeof react.lazy;
export const memo = forward('memo') as typeof react.memo;
export const startTransition = forward('startTransition') as typeof react.startTransition;
// #endregion

// jsx does not accept the symbols that both runtimes use as element types.
export const Activity: any = Symbol.for('react.activity');
export const Fragment: any = Symbol.for('react.fragment');
export const StrictMode: any = Symbol.for('react.strict_mode');
export const Suspense: any = Symbol.for('react.suspense');

export const Children = new Proxy({} as any, {
	get: (_target, name: string) => activeRuntime().module.Children[name],
});

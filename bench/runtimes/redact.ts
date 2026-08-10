// oxlint-disable typescript/no-explicit-any, typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion
import {
	createContext as redactCreateContext,
	createElement as redactCreateElement,
	memo as redactMemo,
	useCallback as redactUseCallback,
	useContext as redactUseContext,
	useEffect as redactUseEffect,
	useLayoutEffect as redactUseLayoutEffect,
	useMemo as redactUseMemo,
	useReducer as redactUseReducer,
	useRef as redactUseRef,
	useState as redactUseState,
	useSyncExternalStore as redactUseSyncExternalStore,
} from '@tanstack/redact';
import '@tanstack/redact/_all';
import { createPortal as redactCreatePortal, flushSync as redactFlushSync } from '@tanstack/redact/dom';
import { createRoot as redactCreateRoot } from '@tanstack/redact/dom-client';

export const doubleClickPropName = 'onDoubleClick';

// redact's published JSX and ReactNode types are not structurally compatible with @types/react.
export const createContext: typeof import('react').createContext = redactCreateContext as any;
export const createElement: typeof import('react').createElement = redactCreateElement as any;
export const createPortal: typeof import('react-dom').createPortal = redactCreatePortal as any;
export const createRoot: typeof import('react-dom/client').createRoot = redactCreateRoot as any;
export const flushSync: typeof import('react-dom').flushSync = redactFlushSync as any;
export const memo: typeof import('react').memo = redactMemo as any;
export const useCallback: typeof import('react').useCallback = redactUseCallback as any;
export const useContext: typeof import('react').useContext = redactUseContext as any;
export const useEffect: typeof import('react').useEffect = redactUseEffect as any;
export const useLayoutEffect: typeof import('react').useLayoutEffect = redactUseLayoutEffect as any;
export const useMemo: typeof import('react').useMemo = redactUseMemo as any;
export const useReducer: typeof import('react').useReducer = redactUseReducer as any;
export const useRef: typeof import('react').useRef = redactUseRef as any;
export const useState: typeof import('react').useState = redactUseState as any;
export const useSyncExternalStore: typeof import('react').useSyncExternalStore =
	redactUseSyncExternalStore as any;

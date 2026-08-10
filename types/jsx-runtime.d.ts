import type { ElementType, Key, ReactElement } from './runtime.js';

export { Fragment } from './runtime.js';
export type { JSX } from './runtime.js';

export function jsx(type: ElementType, props: unknown, key?: Key): ReactElement;

export function jsxs(type: ElementType, props: unknown, key?: Key): ReactElement;

export function jsxDEV(type: ElementType, props: unknown, key?: Key): ReactElement;

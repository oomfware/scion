import * as react from 'react';
import * as reactDom from 'react-dom';
import * as reactDomClient from 'react-dom/client';
import { expect, test } from 'vitest';

import * as scionDomClient from '../src/react-dom-client.ts';
import * as scionDom from '../src/react-dom.ts';
import * as scion from '../src/runtime.ts';

// `module.exports` is an artifact of react shipping cjs; it is not part of the api.
const internalNames = new Set(['default', 'module.exports']);

const publicNames = (module: object): string[] =>
	Object.keys(module)
		.filter((name) => !internalNames.has(name) && !name.startsWith('__'))
		.toSorted();

const missingFrom = (reference: object, candidate: object): string[] => {
	const present = new Set(publicNames(candidate));
	return publicNames(reference).filter((name) => !present.has(name));
};

test('react exports scion does not provide', () => {
	expect(missingFrom(react, scion)).toMatchInlineSnapshot(`
		[
		  "Component",
		  "Profiler",
		  "PureComponent",
		  "act",
		  "cache",
		  "cacheSignal",
		  "captureOwnerStack",
		  "unstable_useCacheRefresh",
		  "useActionState",
		  "useDeferredValue",
		  "useOptimistic",
		  "useTransition",
		]
	`);
});

test('react-dom exports scion does not provide', () => {
	expect(missingFrom(reactDom, scionDom)).toMatchInlineSnapshot(`
		[
		  "requestFormReset",
		  "useFormState",
		  "useFormStatus",
		]
	`);
});

test('react-dom/client exports scion does not provide', () => {
	expect(missingFrom(reactDomClient, scionDomClient)).toMatchInlineSnapshot(`
		[
		  "hydrateRoot",
		]
	`);
});

test('scion reports a version react 19 feature detection accepts', () => {
	expect(Number.parseInt(scion.version, 10)).toBeGreaterThanOrEqual(19);
});

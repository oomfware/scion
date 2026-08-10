import * as react from 'react';
import { describe, expect, test } from 'vitest';

import * as scion from '../src/runtime.ts';

const element = (type: string, key?: string) =>
	key === undefined ? react.createElement(type) : react.createElement(type, { key });

const keysOf = (result: any) =>
	result?.map((child: any) => (react.isValidElement(child) ? child.key : String(child)));

const fixtures: Record<string, () => any> = {
	'unkeyed array': () => [element('a'), element('b')],
	'keyed array': () => [element('a', 'x'), element('b', 'y')],
	'keys needing escape': () => [element('a', 'a=b'), element('b', 'c:d'), element('i', 'e/f')],
	'key of only separators': () => [element('a', '1=::=2')],
	'nested arrays': () => [element('a', 'x'), [element('b', 'y'), element('i', 'z')]],
	'deeply nested arrays': () => [[[element('a', 'x')]]],
	'single element': () => element('a', 'solo'),
	'single unkeyed element': () => element('a'),
	primitives: () => ['one', 2, 3n],
	holes: () => [null, element('a'), undefined, false],
	set: () => new Set([element('a', 'p'), element('b', 'q')]),
	'nested fragments as children': () => [react.createElement(react.Fragment, { key: 'f' }, element('a'))],
};

const callbacks: Record<string, (child: any) => any> = {
	identity: (child) => child,
	'wrap in element': (child) => react.createElement('div', null, child),
	'return array': (child) => [child, child],
	'return null': () => null,
	'rekey to a fresh key': (child) =>
		react.isValidElement(child) ? react.cloneElement(child as any, { key: 'mapped' }) : child,
	'rekey to a key needing escape': (child) =>
		react.isValidElement(child) ? react.cloneElement(child as any, { key: 'a/b' }) : child,
};

describe('Children.map', () => {
	for (const [fixtureName, build] of Object.entries(fixtures)) {
		for (const [callbackName, callback] of Object.entries(callbacks)) {
			test(`${fixtureName} / ${callbackName}`, () => {
				expect(keysOf(scion.Children.map(build(), callback))).toEqual(
					keysOf(react.Children.map(build(), callback)),
				);
			});
		}
	}
});

describe('Children.count', () => {
	for (const [fixtureName, build] of Object.entries(fixtures)) {
		test(fixtureName, () => {
			expect(scion.Children.count(build())).toBe(react.Children.count(build()));
		});
	}
});

describe('Children.toArray', () => {
	for (const [fixtureName, build] of Object.entries(fixtures)) {
		test(fixtureName, () => {
			expect(keysOf(scion.Children.toArray(build()))).toEqual(keysOf(react.Children.toArray(build())));
		});
	}
});

test('Children.forEach visits the same children in the same order', () => {
	for (const build of Object.values(fixtures)) {
		const scionSeen: string[] = [];
		const reactSeen: string[] = [];
		scion.Children.forEach(build(), (child: any, index: number) => scionSeen.push(`${index}:${child?.key}`));
		react.Children.forEach(build(), (child: any, index: number) => reactSeen.push(`${index}:${child?.key}`));
		expect(scionSeen).toEqual(reactSeen);
	}
});

test('Children.only accepts a single element and rejects everything else', () => {
	const single = element('a');
	expect(scion.Children.only(single)).toBe(react.Children.only(single));
	for (const invalid of [[single, single], null, 'text', 42]) {
		expect(() => scion.Children.only(invalid)).toThrow();
		expect(() => react.Children.only(invalid)).toThrow();
	}
});

test('map rejects a plain object child the same way react does', () => {
	expect(() => scion.Children.map({ a: 1 } as any, (child: any) => child)).toThrow();
	expect(() => react.Children.map({ a: 1 } as any, (child) => child)).toThrow();
});

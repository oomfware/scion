import * as react from 'react';
import { expect, test } from 'vitest';

import * as scion from '../src/runtime.ts';

const shapeOf = (element: any) => ({
	key: element.key,
	props: element.props,
	type: element.type,
	valid: react.isValidElement(element),
});

const bothCreate = (...args: [any, any?, ...any[]]) => ({
	scion: shapeOf((scion.createElement as any)(...args)),
	react: shapeOf((react.createElement as any)(...args)),
});

test('createElement extracts key and collects children', () => {
	const cases: Array<[any, any?, ...any[]]> = [
		['div', null],
		['div', { className: 'a' }],
		['div', { key: 'k' }],
		['div', { key: 7 }],
		['div', null, 'only child'],
		['div', null, 'a', 'b'],
		['div', { children: 'from props' }],
		['div', { children: 'overridden' }, 'from args'],
		['div', { ref: null }],
		[() => null, { a: 1 }, 'child'],
	];
	for (const args of cases) {
		const { react: reactShape, scion: scionShape } = bothCreate(...args);
		expect(scionShape, JSON.stringify(args[1])).toEqual(reactShape);
	}
});

test('createElement does not mutate the config it is handed', () => {
	const config = { className: 'a', key: 'k' };
	scion.createElement('div', config);
	expect(config).toEqual({ className: 'a', key: 'k' });
});

test('a key of 0 is kept', () => {
	expect(scion.createElement('div', { key: 0 }).key).toBe(react.createElement('div', { key: 0 }).key);
});

test('a key never survives in props, even when handed in as undefined', () => {
	// react's development build leaves a non-enumerable `key` getter behind to warn on reads, so
	// what both runtimes owe is that no key reaches the props a component can see.
	for (const config of [{ key: 'k' }, { key: undefined }, { className: 'a', key: 0 }]) {
		const label = JSON.stringify(config);
		expect(Object.keys(scion.createElement('div', config).props), label).not.toContain('key');
		expect(Object.keys(react.createElement('div', config).props), label).not.toContain('key');
	}
});

test('createElement copies the config own props only', () => {
	const config: any = Object.create({ inherited: 'from the prototype' });
	config.own = 'from the config';
	expect(shapeOf(scion.createElement('div', config))).toEqual(shapeOf(react.createElement('div', config)));
	expect(Object.hasOwn(scion.createElement('div', config).props, 'inherited')).toBe(false);
});

test('an explicit null key is stringified by react but dropped by scion', () => {
	expect(react.createElement('div', { key: null }).key).toBe('null');
	expect(scion.createElement('div', { key: null }).key).toBeNull();
});

test('cloneElement merges props and overrides key', () => {
	const cases: Array<[any, any?, ...any[]]> = [
		[{ className: 'a' }, undefined],
		[{ className: 'a' }, { className: 'b' }],
		[{ className: 'a' }, { id: 'x' }],
		[{ key: 'original' }, { key: 'replaced' }],
		[{ key: 'original' }, { id: 'x' }],
		[{ children: 'original' }, null, 'replaced'],
		[{ children: 'original' }, null, 'a', 'b'],
		[{ ref: null }, { ref: null }],
	];
	for (const [baseProps, config, ...children] of cases) {
		const base = (props: any) => [scion.createElement('div', props), react.createElement('div', props)];
		const [scionBase, reactBase] = base(baseProps);
		expect(shapeOf((scion.cloneElement as any)(scionBase, config, ...children))).toEqual(
			shapeOf((react.cloneElement as any)(reactBase, config, ...children)),
		);
	}
});

test('cloneElement rejects a nullish element', () => {
	for (const invalid of [null, undefined]) {
		expect(() => scion.cloneElement(invalid as any)).toThrow();
		expect(() => react.cloneElement(invalid as any)).toThrow();
	}
});

test('scion is stricter than react about cloning a plain object', () => {
	expect(() => scion.cloneElement({} as any)).toThrow();
	expect(() => react.cloneElement({} as any)).not.toThrow();
});

test('isValidElement agrees with react', () => {
	const values = [
		null,
		undefined,
		'text',
		42,
		{},
		[],
		{ $$typeof: Symbol.for('react.transitional.element') },
		scion.createElement('div', null),
		react.createElement('div', null),
	];
	for (const value of values) {
		expect(scion.isValidElement(value), JSON.stringify(value)).toBe(react.isValidElement(value));
	}
});

test('createRef produces a detached ref object', () => {
	expect(scion.createRef()).toEqual(react.createRef());
});

test('shared element symbols match react, so one element object feeds either renderer', () => {
	expect(scion.createElement('div', null).$$typeof).toBe((react.createElement('div', null) as any).$$typeof);
	expect(scion.Fragment).toBe(react.Fragment);
	expect(scion.Suspense).toBe(react.Suspense);
	expect(scion.StrictMode).toBe(react.StrictMode);
});

test('lazy exposes the _payload/_init pair libraries reach for to preload', () => {
	const load = async () => ({ default: () => null });
	for (const runtime of [scion, react]) {
		const component = runtime.lazy(load) as any;
		expect(typeof component._init, runtime.version).toBe('function');
		expect(component._payload, runtime.version).toBeDefined();
	}
});

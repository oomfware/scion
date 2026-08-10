import { act as reactAct } from 'react';
import { createRoot as reactCreateRoot } from 'react-dom/client';

import * as scion from '../../src/runtime.ts';

import { setActiveRuntime, type TestRuntime } from './runtime.ts';

// effects and transitions can schedule more work on later tasks.
export const settleScion = async () => {
	for (let attempt = 0; attempt < 25; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (!scion.__scion.passiveScheduled) {
			return;
		}
	}
	throw new Error('scion never settled.');
};

export const scionRuntime: TestRuntime = {
	name: 'scion',
	act: async (callback) => {
		await callback();
		await settleScion();
	},
	createRoot: (container, options) => scion.createRoot(container, options),
	module: scion,
};

export const reactRuntime: TestRuntime = {
	name: 'react',
	act: async (callback) => {
		await reactAct(async () => {
			await callback();
		});
	},
	createRoot: (container, options) => reactCreateRoot(container, options),
	module: await import('react'),
};

const liveProperties = ['checked', 'defaultChecked', 'defaultValue', 'muted', 'selected', 'value'] as const;

/**
 * serializes DOM structure and live form properties.
 *
 * @param container the container to serialize
 * @returns the serialized DOM
 */
export const serializeDom = (container: Element): string => {
	const lines: string[] = [];
	const walk = (node: Node, depth: number) => {
		const indent = '  '.repeat(depth);
		if (node.nodeType === Node.TEXT_NODE) {
			lines.push(`${indent}#text ${JSON.stringify(node.nodeValue)}`);
			return;
		}
		if (node.nodeType === Node.COMMENT_NODE) {
			lines.push(`${indent}#comment ${JSON.stringify(node.nodeValue)}`);
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return;
		}
		const element = node as Element & Record<string, unknown>;
		const attributes = [...element.attributes]
			.map((attribute) => `${attribute.name}=${JSON.stringify(attribute.value)}`)
			.toSorted();
		const properties = liveProperties
			.filter((name) => element[name] !== undefined)
			.map((name) => `.${name}=${JSON.stringify(element[name])}`);
		lines.push(`${indent}<${element.nodeName.toLowerCase()} ${[...attributes, ...properties].join(' ')}>`);
		for (const child of element.childNodes) {
			walk(child, depth + 1);
		}
	};
	for (const child of container.childNodes) {
		walk(child, 0);
	}
	return lines.join('\n');
};

export interface Scenario {
	act: (callback?: () => unknown) => Promise<void>;
	container: HTMLElement;
	dom: () => string;
	html: () => string;
	log: (...parts: unknown[]) => void;
	render: (element: unknown) => Promise<void>;
	snapshot: (label: string) => void;
	unmount: () => Promise<void>;
}

export interface ScenarioResult {
	dom: string;
	entries: string[];
	snapshots: Array<[string, string]>;
	/** root errors without a custom handler. */
	uncaught: string[];
}

export const runScenario = async (
	runtime: TestRuntime,
	body: (scenario: Scenario) => Promise<void> | void,
	options: { onCaughtError?: (error: unknown) => void; onUncaughtError?: (error: unknown) => void } = {},
): Promise<ScenarioResult> => {
	const container = document.createElement('div');
	document.body.append(container);
	const entries: string[] = [];
	const snapshots: Array<[string, string]> = [];
	const uncaught: string[] = [];
	setActiveRuntime(runtime);
	const root = runtime.createRoot(container, {
		...options,
		onUncaughtError: options.onUncaughtError ?? ((error) => uncaught.push(String(error))),
	});

	const html = () => container.innerHTML;
	const dom = () => serializeDom(container);
	const act = async (callback?: () => unknown) => {
		setActiveRuntime(runtime);
		await runtime.act(async () => {
			await callback?.();
		});
	};

	const scenario: Scenario = {
		act,
		container,
		dom,
		html,
		log: (...parts) => {
			entries.push(parts.map((part) => String(part)).join(' '));
		},
		render: async (element) => {
			await act(() => root.render(element));
		},
		snapshot: (label) => {
			snapshots.push([label, dom()]);
		},
		unmount: async () => {
			await act(() => root.unmount());
		},
	};

	try {
		await body(scenario);
	} finally {
		setActiveRuntime(null);
		container.remove();
	}
	return { dom: dom(), entries, snapshots, uncaught };
};

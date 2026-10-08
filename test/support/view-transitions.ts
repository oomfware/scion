// a phased stand-in for the browser's view transition api. happy-dom has none, and a mock that runs
// the update callback synchronously would hide the gap where the old snapshot is taken.
//
//   startViewTransition → (task) old snapshot → update callback → new snapshot → ready → (task) finished

export interface CapturedTransition {
	/** names and classes captured before the update callback ran. */
	old: Record<string, string>;
	/** names and classes captured after it settled. */
	new: Record<string, string>;
	skipped: boolean;
	types: string[];
}

const transitions: CapturedTransition[] = [];
// the `finished` promise of every transition still running.
const pending = new Set<Promise<void>>();
// while set, transitions stop between their old snapshot and their update callback.
let gate: Promise<void> | null = null;

const capture = (): Record<string, string> => {
	const names: Record<string, string> = {};
	for (const element of document.querySelectorAll<HTMLElement>('*')) {
		const name = element.style.getPropertyValue('view-transition-name');
		if (name !== '' && name !== 'none') {
			names[name] = element.style.getPropertyValue('view-transition-class');
		}
	}
	return names;
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const startViewTransition = (options: { types?: string[]; update?: () => unknown }) => {
	const record: CapturedTransition = { new: {}, old: {}, skipped: false, types: [...(options.types ?? [])] };
	transitions.push(record);

	let resolveDone!: () => void;
	let rejectDone!: (error: unknown) => void;
	let resolveReady!: () => void;
	let rejectReady!: (error: unknown) => void;
	let resolveFinished!: () => void;
	const updateCallbackDone = new Promise<void>((resolve, reject) => {
		resolveDone = resolve;
		rejectDone = reject;
	});
	const ready = new Promise<void>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});
	const finished = new Promise<void>((resolve) => {
		resolveFinished = resolve;
	});
	// nothing in a test awaits these rejections.
	updateCallbackDone.catch(() => {});
	ready.catch(() => {});

	pending.add(finished);

	void (async () => {
		await tick();
		if (!record.skipped) {
			record.old = capture();
		}
		await gate;
		try {
			await options.update?.();
			resolveDone();
		} catch (error) {
			rejectDone(error);
		}
		if (record.skipped) {
			rejectReady(new DOMException('skipped', 'AbortError'));
		} else {
			record.new = capture();
			resolveReady();
		}
		await tick();
		resolveFinished();
		pending.delete(finished);
	})();

	return {
		finished,
		ready,
		skipTransition() {
			record.skipped = true;
		},
		types: new Set(record.types),
		updateCallbackDone,
	};
};

class ViewTransitionInterface {
	get types(): Set<string> {
		return new Set();
	}
}

// react writes `style.viewTransitionName`; happy-dom only knows the hyphenated properties.
const styleAliases = {
	viewTransitionClass: 'view-transition-class',
	viewTransitionName: 'view-transition-name',
};

// text-length widths and sibling-index offsets let layout changes show up as moved or resized rects.
const fakeRect = function (this: Element): DOMRect {
	const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
	const width = (this.textContent ?? '').length * 10 + 10;
	return new DOMRect(0, index * 20, width, 20);
};

/**
 * installs the mock and resets what it recorded.
 *
 * @returns a function that removes the mock
 */
export const installViewTransitions = (): (() => void) => {
	transitions.length = 0;
	const previousRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect')!;
	Reflect.set(document, 'startViewTransition', startViewTransition);
	Reflect.set(window, 'ViewTransition', ViewTransitionInterface);
	Element.prototype.getBoundingClientRect = fakeRect;
	if (!Reflect.has(document, 'fonts')) {
		Object.defineProperty(document, 'fonts', {
			configurable: true,
			value: { ready: Promise.resolve(), status: 'loaded' },
		});
	}
	for (const [alias, property] of Object.entries(styleAliases)) {
		if (!Reflect.has(CSSStyleDeclaration.prototype, alias)) {
			Object.defineProperty(CSSStyleDeclaration.prototype, alias, {
				configurable: true,
				get(this: CSSStyleDeclaration) {
					return this.getPropertyValue(property);
				},
				set(this: CSSStyleDeclaration, value: string) {
					this.setProperty(property, value);
				},
			});
		}
	}
	return () => {
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(window, 'ViewTransition');
		Object.defineProperty(Element.prototype, 'getBoundingClientRect', previousRect);
	};
};

/**
 * holds every transition between its old snapshot and its update callback.
 *
 * @returns a function that lets them continue
 */
export const holdViewTransitions = (): (() => void) => {
	let release!: () => void;
	gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	return () => {
		gate = null;
		release();
	};
};

/** resolves once a transition has started and taken its old snapshot. */
export const waitForViewTransitionStart = async (): Promise<void> => {
	for (let attempt = 0; attempt < 50 && pending.size === 0; attempt++) {
		await tick();
	}
	await tick();
};

/** waits until every started transition has finished. */
export const settleViewTransitions = async (): Promise<void> => {
	for (let attempt = 0; attempt < 50 && pending.size !== 0; attempt++) {
		await Promise.all(pending);
		await tick();
	}
};

// generated names differ between runtimes; number them by first appearance instead.
const normalize = (names: Record<string, string>, aliases: Map<string, string>): Record<string, string> => {
	const result: Record<string, string> = {};
	for (const [name, className] of Object.entries(names)) {
		const [, base, suffix = ''] = /^(.*?)(_\d+)?$/.exec(name)!;
		let alias = base;
		if (base.startsWith('_')) {
			alias = aliases.get(base) ?? `auto${aliases.size}`;
			aliases.set(base, alias);
		}
		result[`${alias}${suffix}`] = className;
	}
	return result;
};

/**
 * describes the transitions started since the mock was installed, with generated names normalised.
 *
 * @returns one line per transition
 */
export const describeViewTransitions = (): string[] =>
	transitions.map((record) => {
		const aliases = new Map<string, string>();
		const old = normalize(record.old, aliases);
		const next = normalize(record.new, aliases);
		return JSON.stringify({ new: next, old, skipped: record.skipped, types: record.types });
	});

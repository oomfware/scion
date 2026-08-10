import { createElement, createPortal, createRoot, flushSync, useState } from 'runtime-under-test';

const ITEM_COUNT = 200;
const ITEMS = Array.from({ length: ITEM_COUNT }, (_, id) => ({ id, label: `item-${id}` }));
type Item = (typeof ITEMS)[number];
type Section = 'A' | 'B' | 'BS';

interface Bindings {
	setDistinct: (value: boolean) => void;
	setOpen: (value: boolean) => void;
	setTick: (value: number) => void;
}

const bindings: Partial<Record<Section, Bindings>> = {};
const ticks: Record<Section, number> = { A: 0, B: 0, BS: 0 };
let root: ReturnType<typeof createRoot> | null = null;
let hits = 0;

const targetFor = (id: number) => {
	const target = document.getElementById(`pt-${id}`);
	if (target === null) {
		throw new Error(`missing portal target ${id}`);
	}
	return target;
};

const hit = () => {
	hits++;
};

const Tip = ({ className, item }: { className: string; item: Item }) => (
	<div className={`tip ${className}`}>
		<span className="tip-label">{item.label}</span>
		<button className="tip-btn" onClick={hit}>
			hit
		</button>
	</div>
);

const stableTips = new Map<number, ReturnType<typeof createPortal>>();
const stableTip = (item: Item, distinct: boolean) => {
	const key = item.id * 2 + Number(distinct);
	let portal = stableTips.get(key);
	if (portal === undefined) {
		portal = createPortal(
			<Tip className="tipBS" item={item} />,
			distinct ? targetFor(item.id) : document.body,
		);
		stableTips.set(key, portal);
	}
	return portal;
};

const makeTipB = (item: Item, distinct: boolean) =>
	createPortal(
		createElement(Tip, { className: 'tipB', item }),
		distinct ? targetFor(item.id) : document.body,
	);

const SectionView = ({ section }: { section: Section }) => {
	const [distinct, setDistinct] = useState(false);
	const [open, setOpen] = useState(false);
	const [tick, setTick] = useState(0);
	bindings[section] = { setDistinct, setOpen, setTick };
	return (
		<section className={`sec${section}`}>
			<h3>{`${section}:${tick}`}</h3>
			<ul>
				{ITEMS.map((item) => (
					<li className="item" key={item.id}>
						<span>{item.label}</span>
						{open && (
							<span className="anchor">
								{section === 'A'
									? createPortal(
											<Tip className="tipA" item={item} />,
											distinct ? targetFor(item.id) : document.body,
										)
									: section === 'B'
										? makeTipB(item, distinct)
										: stableTip(item, distinct)}
							</span>
						)}
					</li>
				))}
			</ul>
		</section>
	);
};

const App = () => (
	<div>
		<SectionView section="A" />
		<SectionView section="B" />
		<SectionView section="BS" />
		<div className="targets">
			{ITEMS.map((item) => (
				<div className="pt" id={`pt-${item.id}`} key={item.id} />
			))}
		</div>
	</div>
);

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}

const setAll = (field: 'setDistinct' | 'setOpen', value: boolean) => {
	flushSync(() => {
		for (const section of ['A', 'B', 'BS'] as const) {
			bindings[section]?.[field](value);
		}
	});
};

export const benchPortalSwarm = {
	closeAll: () => setAll('setOpen', false),
	hits: () => hits,
	mount: () => {
		root = createRoot(container);
		flushSync(() => root?.render(<App />));
	},
	open: (section: Section) => flushSync(() => bindings[section]?.setOpen(true)),
	openAll: () => setAll('setOpen', true),
	rerender: (section: Section) => flushSync(() => bindings[section]?.setTick(++ticks[section])),
	setDistinct: (value: boolean) => setAll('setDistinct', value),
	unmount: () => {
		const mounted = root;
		root = null;
		flushSync(() => mounted?.unmount());
		stableTips.clear();
	},
};

declare global {
	interface Window {
		benchPortalSwarm: typeof benchPortalSwarm;
	}
}
window.benchPortalSwarm = benchPortalSwarm;

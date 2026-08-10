import { createRoot, flushSync, memo, useCallback, useReducer } from 'runtime-under-test';

interface Item {
	id: number;
	label: string;
}

interface State {
	data: Item[];
	selected: number;
}

type Action =
	| { type: 'run' }
	| { type: 'runLots' }
	| { type: 'add' }
	| { type: 'update' }
	| { type: 'clear' }
	| { type: 'swapRows' }
	| { type: 'remove'; id: number }
	| { type: 'select'; id: number }
	| { type: 'reverse' }
	| { type: 'shuffle'; seed: number }
	| { type: 'prepend100' }
	| { type: 'append100' }
	| { type: 'insertMid100' }
	| { type: 'displace'; count: number };

type Dispatch = (action: Action) => void;

const ADJECTIVES = [
	'pretty',
	'large',
	'big',
	'small',
	'tall',
	'short',
	'long',
	'handsome',
	'plain',
	'quaint',
	'clean',
	'elegant',
	'easy',
	'angry',
	'crazy',
	'helpful',
	'mushy',
	'odd',
	'unsightly',
	'adorable',
	'important',
	'inexpensive',
	'cheap',
	'expensive',
	'fancy',
];
const COLOURS = [
	'red',
	'yellow',
	'blue',
	'green',
	'pink',
	'brown',
	'purple',
	'brown',
	'white',
	'black',
	'orange',
];
const NOUNS = [
	'table',
	'chair',
	'house',
	'bbq',
	'desk',
	'car',
	'pony',
	'cookie',
	'sandwich',
	'burger',
	'pizza',
	'mouse',
	'keyboard',
];

const random = (max: number) => Math.round(Math.random() * 1000) % max;

let nextId = 1;

const buildData = (count: number): Item[] => {
	// oxlint-disable-next-line unicorn/no-new-array
	const data = new Array<Item>(count);
	for (let index = 0; index < count; index++) {
		data[index] = {
			id: nextId++,
			label: `${ADJECTIVES[random(ADJECTIVES.length)]} ${COLOURS[random(COLOURS.length)]} ${NOUNS[random(NOUNS.length)]}`,
		};
	}
	return data;
};

// #region reorder machinery

const mulberry32 = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
	return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const shuffleSeeds = mulberry32(42);
const nextShuffleSeed = () => (shuffleSeeds() * 4294967296) >>> 0;

const shuffleWithSeed = (data: Item[], seed: number): Item[] => {
	const generator = mulberry32(seed);
	const out = data.slice();
	for (let index = out.length - 1; index > 0; index--) {
		const target = (generator() * (index + 1)) | 0;
		const held = out[index];
		out[index] = out[target];
		out[target] = held;
	}
	return out;
};

// #endregion

const initialState: State = { data: [], selected: 0 };

// oxlint-disable-next-line typescript/consistent-return
const listReducer = (state: State, action: Action): State => {
	const { data, selected } = state;
	switch (action.type) {
		case 'run': {
			return { data: buildData(1000), selected: 0 };
		}
		case 'runLots': {
			return { data: buildData(10000), selected: 0 };
		}
		case 'add': {
			return { data: data.concat(buildData(1000)), selected };
		}
		case 'update': {
			const next = data.slice();
			for (let index = 0; index < next.length; index += 10) {
				const item = next[index];
				next[index] = { id: item.id, label: `${item.label} !!!` };
			}
			return { data: next, selected };
		}
		case 'clear': {
			return { data: [], selected: 0 };
		}
		case 'swapRows': {
			if (data.length <= 998) {
				return state;
			}
			const next = data.slice();
			const first = next[1];
			next[1] = next[998];
			next[998] = first;
			return { data: next, selected };
		}
		case 'remove': {
			const index = data.findIndex((item) => item.id === action.id);
			return { data: [...data.slice(0, index), ...data.slice(index + 1)], selected };
		}
		case 'select': {
			return { data, selected: action.id };
		}
		case 'reverse': {
			return { data: data.toReversed(), selected };
		}
		case 'shuffle': {
			return { data: shuffleWithSeed(data, action.seed), selected };
		}
		case 'prepend100': {
			return { data: buildData(100).concat(data), selected };
		}
		case 'append100': {
			return { data: data.concat(buildData(100)), selected };
		}
		case 'insertMid100': {
			const middle = data.length >> 1;
			return { data: data.slice(0, middle).concat(buildData(100), data.slice(middle)), selected };
		}
		case 'displace': {
			return { data: data.slice(action.count).concat(data.slice(0, action.count)), selected };
		}
	}
};

const Row = memo(
	({ dispatch, item, selected }: { dispatch: Dispatch; item: Item; selected: boolean }) => (
		<tr className={selected ? 'danger' : ''}>
			<td className="col-md-1">{item.id}</td>
			<td className="col-md-4">
				<a onClick={() => dispatch({ type: 'select', id: item.id })}>{item.label}</a>
			</td>
			<td className="col-md-1">
				<a onClick={() => dispatch({ type: 'remove', id: item.id })}>
					<span className="glyphicon glyphicon-remove" aria-hidden="true" />
				</a>
			</td>
			<td className="col-md-6" />
		</tr>
	),
	(previous, next) => previous.selected === next.selected && previous.item === next.item,
);

const Button = ({ id, onClick, title }: { id: string; onClick: () => void; title: string }) => (
	<div className="col-sm-6 smallpad">
		<button type="button" className="btn btn-primary btn-block" id={id} onClick={onClick}>
			{title}
		</button>
	</div>
);

const Controls = memo(
	({ dispatch }: { dispatch: Dispatch }) => (
		<div className="jumbotron">
			<div className="row">
				<div className="col-md-6">
					<h1>keyed rows</h1>
				</div>
				<div className="col-md-6">
					<div className="row">
						<Button id="run" title="Create 1,000 rows" onClick={() => dispatch({ type: 'run' })} />
						<Button id="runlots" title="Create 10,000 rows" onClick={() => dispatch({ type: 'runLots' })} />
						<Button id="add" title="Append 1,000 rows" onClick={() => dispatch({ type: 'add' })} />
						<Button id="update" title="Update every 10th row" onClick={() => dispatch({ type: 'update' })} />
						<Button id="clear" title="Clear" onClick={() => dispatch({ type: 'clear' })} />
						<Button id="swaprows" title="Swap Rows" onClick={() => dispatch({ type: 'swapRows' })} />
					</div>
					<div className="row">
						<Button id="reverse" title="Reverse rows" onClick={() => dispatch({ type: 'reverse' })} />
						<Button
							id="shuffle"
							title="Shuffle rows (seeded)"
							onClick={() => dispatch({ type: 'shuffle', seed: nextShuffleSeed() })}
						/>
						<Button
							id="prepend100"
							title="Prepend 100 rows"
							onClick={() => dispatch({ type: 'prepend100' })}
						/>
						<Button id="append100" title="Append 100 rows" onClick={() => dispatch({ type: 'append100' })} />
						<Button
							id="insertmid100"
							title="Insert 100 rows at middle"
							onClick={() => dispatch({ type: 'insertMid100' })}
						/>
						<Button
							id="displace4"
							title="Displace first 4 to end"
							onClick={() => dispatch({ type: 'displace', count: 4 })}
						/>
					</div>
				</div>
			</div>
		</div>
	),
	() => true,
);

const Main = () => {
	const [{ data, selected }, rawDispatch] = useReducer(listReducer, initialState);
	// include the commit in each timed click.
	const dispatch = useCallback<Dispatch>((action) => {
		flushSync(() => rawDispatch(action));
	}, []);
	return (
		<div className="container">
			<Controls dispatch={dispatch} />
			<table className="table table-hover table-striped test-data">
				<tbody>
					{data.map((item) => (
						<Row key={item.id} dispatch={dispatch} item={item} selected={selected === item.id} />
					))}
				</tbody>
			</table>
			<span className="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
		</div>
	);
};

createRoot(document.getElementById('main')!).render(<Main />);

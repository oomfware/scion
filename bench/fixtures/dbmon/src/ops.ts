import { DB_COUNT, type Database, makeData } from './data.ts';

let setData: ((data: Database[]) => void) | null = null;
let current = makeData(DB_COUNT, 0, 1);
let idBase = 0;
let frame = 1;
let sortDirection = 1;

/**
 * binds the state setter.
 *
 * @param next state setter, or `null`
 */
export const bindSetData = (next: ((data: Database[]) => void) | null) => {
	setData = next;
};

/**
 * gets the current dataset.
 *
 * @returns current rows
 */
export const initialData = () => current;

const commit = (next: Database[]) => {
	current = next;
	setData?.(next);
};

/** updates all rows without changing keys. */
export const tickFull = () => {
	frame++;
	commit(makeData(DB_COUNT, idBase, frame));
};

/** updates the first tenth of the rows. */
export const tickPartial = () => {
	frame++;
	const fresh = makeData(DB_COUNT, idBase, frame);
	const changed = Math.max(1, (DB_COUNT / 10) | 0);
	commit(current.map((row, index) => (index < changed ? fresh[index] : row)));
};

/** replaces all row keys. */
export const remount = () => {
	frame++;
	idBase += DB_COUNT;
	commit(makeData(DB_COUNT, idBase, frame));
};

/** reverses the row order. */
export const sortRows = () => {
	sortDirection = -sortDirection;
	commit(current.toSorted((a, b) => sortDirection * (b.count - a.count) || a.id - b.id));
};

import { useState } from 'runtime-under-test';

import { type Database } from './data.ts';
import { bindSetData, initialData } from './ops.ts';

export const App = () => {
	const [data, setData] = useState<Database[]>(initialData);
	bindSetData(setData);

	return (
		<table className="dbmon">
			<tbody>
				{data.map((database) => (
					<tr key={database.id}>
						<td className="dbname">{database.name}</td>
						<td className={database.countClass}>{database.count}</td>
						<td className={database.queries[0].className}>{database.queries[0].elapsed}</td>
						<td className={database.queries[1].className}>{database.queries[1].elapsed}</td>
						<td className={database.queries[2].className}>{database.queries[2].elapsed}</td>
						<td className={database.queries[3].className}>{database.queries[3].elapsed}</td>
						<td className={database.queries[4].className}>{database.queries[4].elapsed}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};

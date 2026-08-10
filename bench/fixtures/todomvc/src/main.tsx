import { createRoot, doubleClickPropName, flushSync, useCallback, useState } from 'runtime-under-test';

interface Todo {
	completed: boolean;
	id: number;
	title: string;
}

type Filter = 'active' | 'all' | 'completed';
type InputChangeEvent = { currentTarget: HTMLInputElement };
type InputKeyboardEvent = InputChangeEvent & { key: string };

let nextTodoId = 1;

const allocateTodoId = () => nextTodoId++;

const TodoApp = () => {
	const [editing, setEditing] = useState<number | null>(null);
	const [filter, setFilter] = useState<Filter>('all');
	const [todos, setTodos] = useState<Todo[]>([]);

	const addTodo = useCallback((event: InputKeyboardEvent) => {
		if (event.key !== 'Enter') {
			return;
		}
		const input = event.currentTarget;
		const title = input.value.trim();
		if (title === '') {
			return;
		}
		flushSync(() => {
			setTodos((current) => [...current, { completed: false, id: allocateTodoId(), title }]);
		});
		input.value = '';
	}, []);
	const clearCompleted = useCallback(() => {
		flushSync(() => {
			setTodos((current) => current.filter((todo) => !todo.completed));
		});
	}, []);
	const commitEdit = (id: number, event: InputChangeEvent) => {
		const title = event.currentTarget.value.trim();
		flushSync(() => {
			if (title === '') {
				setTodos((current) => current.filter((todo) => todo.id !== id));
			} else {
				setTodos((current) => current.map((todo) => (todo.id === id ? { ...todo, title } : todo)));
			}
			setEditing(null);
		});
	};
	const destroy = (id: number) => {
		flushSync(() => {
			setTodos((current) => current.filter((todo) => todo.id !== id));
		});
	};
	const editKeyDown = (id: number, event: InputKeyboardEvent) => {
		switch (event.key) {
			case 'Enter': {
				commitEdit(id, event);
				break;
			}
			case 'Escape': {
				flushSync(() => {
					setEditing(null);
				});
				break;
			}
		}
	};
	const selectFilter = (nextFilter: Filter) => {
		flushSync(() => {
			setFilter(nextFilter);
		});
	};
	const startEdit = (id: number) => {
		flushSync(() => {
			setEditing(id);
		});
	};
	const toggle = (id: number) => {
		flushSync(() => {
			setTodos((current) =>
				current.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
			);
		});
	};
	const toggleAll = (event: InputChangeEvent) => {
		const completed = event.currentTarget.checked;
		flushSync(() => {
			setTodos((current) =>
				current.map((todo) => (todo.completed === completed ? todo : { ...todo, completed })),
			);
		});
	};

	const remaining = todos.filter((todo) => !todo.completed).length;
	const visible = todos.filter((todo) => {
		switch (filter) {
			case 'active': {
				return !todo.completed;
			}
			case 'completed': {
				return todo.completed;
			}
			case 'all': {
				break;
			}
		}
		return true;
	});

	return (
		<section className="todoapp">
			<header className="header">
				<h1>todos</h1>
				<input className="new-todo" onKeyDown={addTodo} placeholder="What needs to be done?" />
			</header>
			{todos.length > 0 ? (
				<>
					<section className="main">
						<input
							checked={remaining === 0}
							className="toggle-all"
							id="toggle-all"
							onChange={toggleAll}
							type="checkbox"
						/>
						<ul className="todo-list">
							{visible.map((todo) => (
								<li
									className={(todo.completed ? 'completed' : '') + (editing === todo.id ? ' editing' : '')}
									key={todo.id}
								>
									<div className="view">
										<input
											checked={todo.completed}
											className="toggle"
											onChange={() => {
												toggle(todo.id);
											}}
											type="checkbox"
										/>
										<label
											{...{
												[doubleClickPropName]: () => {
													startEdit(todo.id);
												},
											}}
										>
											{todo.title}
										</label>
										<button
											className="destroy"
											onClick={() => {
												destroy(todo.id);
											}}
										></button>
									</div>
									{editing === todo.id ? (
										<input
											className="edit"
											defaultValue={todo.title}
											onBlur={(event) => {
												commitEdit(todo.id, event);
											}}
											onKeyDown={(event) => {
												editKeyDown(todo.id, event);
											}}
										/>
									) : null}
								</li>
							))}
						</ul>
					</section>
					<footer className="footer">
						<span className="todo-count">
							<strong>{remaining}</strong>
							{remaining === 1 ? ' item left' : ' items left'}
						</span>
						<ul className="filters">
							{(['all', 'active', 'completed'] as const).map((option) => (
								<li key={option}>
									<a
										className={filter === option ? 'selected' : ''}
										data-filter={option}
										onClick={() => {
											selectFilter(option);
										}}
									>
										{option[0].toUpperCase() + option.slice(1)}
									</a>
								</li>
							))}
						</ul>
						{remaining < todos.length ? (
							<button className="clear-completed" onClick={clearCompleted}>
								Clear completed
							</button>
						) : null}
					</footer>
				</>
			) : null}
		</section>
	);
};

createRoot(document.getElementById('main')!).render(<TodoApp />);

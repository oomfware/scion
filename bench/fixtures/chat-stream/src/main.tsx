import { createRoot, flushSync, useState } from 'runtime-under-test';

import { type Conversation, initialConversations, nextReply, segmentText, userMessage } from './data.ts';

interface ChatApi {
	pump: (count: number) => number;
	reset: () => void;
	select: (id: number) => void;
	send: (text: string) => void;
}

let api: ChatApi | null = null;

const ChatApp = () => {
	const [active, setActive] = useState(0);
	const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
	const [draft, setDraft] = useState('');
	const [streamingId, setStreamingId] = useState<number | null>(null);

	const send = (text: string) => {
		const prompt = text.trim();
		if (prompt === '') {
			return;
		}
		const reply = nextReply();
		flushSync(() => {
			setConversations((current) =>
				current.map((conversation, index) =>
					index === active
						? { ...conversation, messages: [...conversation.messages, userMessage(prompt), reply] }
						: conversation,
				),
			);
			setDraft('');
			setStreamingId(reply.id);
		});
	};

	api = {
		pump: (count) => {
			if (streamingId === null) {
				return 0;
			}
			const message = conversations[active].messages.find((candidate) => candidate.id === streamingId);
			if (message === undefined) {
				return 0;
			}
			const done = Math.min(message.total, message.done + count);
			flushSync(() => {
				setConversations(
					conversations.map((conversation, index) =>
						index === active
							? {
									...conversation,
									messages: conversation.messages.map((candidate) =>
										candidate.id === streamingId ? { ...candidate, done } : candidate,
									),
								}
							: conversation,
					),
				);
				if (done === message.total) {
					setStreamingId(null);
				}
			});
			return message.total - done;
		},
		reset: () =>
			flushSync(() => {
				setActive(0);
				setConversations(initialConversations());
				setDraft('');
				setStreamingId(null);
			}),
		select: (id) => flushSync(() => setActive(id)),
		send,
	};

	const conversation = conversations[active];
	return (
		<div className="chatapp">
			<nav>
				{conversations.map((candidate) => (
					<button
						className={`conv-tab${candidate.id === active ? ' active' : ''}`}
						data-conv={candidate.id}
						key={candidate.id}
						onClick={() => api?.select(candidate.id)}
					>
						{candidate.title}
					</button>
				))}
			</nav>
			<main className="messages">
				{conversation.messages.map((message) => (
					<div
						className={`message ${message.role}${message.id === streamingId ? ' streaming' : ''}`}
						key={message.id}
					>
						{message.segments.map((segment) => {
							const text = segmentText(segment, message.done);
							if (segment.type === 'code') {
								return (
									<pre className="code" key={segment.id}>
										<code>{text}</code>
									</pre>
								);
							}
							return (
								<p className="text" key={segment.id}>
									{text}
								</p>
							);
						})}
					</div>
				))}
			</main>
			<footer>
				<input
					className="prompt"
					value={draft}
					onInput={(event) => flushSync(() => setDraft(event.currentTarget.value))}
				/>
				<button className="send" onClick={() => send(draft)}>
					Send
				</button>
			</footer>
		</div>
	);
};

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}
flushSync(() => createRoot(container).render(<ChatApp />));

export const benchChatStream = {
	pump: (count: number) => api?.pump(count) ?? 0,
	reset: () => api?.reset(),
	select: (id: number) => api?.select(id),
	send: (text: string) => api?.send(text),
};

declare global {
	interface Window {
		benchChatStream: typeof benchChatStream;
	}
}
window.benchChatStream = benchChatStream;

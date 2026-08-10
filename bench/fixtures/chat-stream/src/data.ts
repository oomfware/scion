export interface Segment {
	id: number;
	start: number;
	tokens: string[];
	type: 'code' | 'text';
}

export interface Message {
	done: number;
	id: number;
	role: 'assistant' | 'user';
	segments: Segment[];
	total: number;
}

export interface Conversation {
	id: number;
	messages: Message[];
	title: string;
}

const WORDS =
	'the quick model streams tokens into view while layout keeps pace and state updates flow through scheduler batching commits growing keyed message bubbles remain stable under sustained append load '.split(
		' ',
	);
let messageId = 1;
let segmentId = 1;
let replyCursor = 0;

const makeTokens = (count: number, offset: number) =>
	Array.from({ length: count }, (_, index) => `${WORDS[(index + offset) % WORDS.length]} `);

const makeSegments = (seed: number): Segment[] => {
	const text = makeTokens(140 + (seed % 4) * 20, seed);
	const code = makeTokens(60 + (seed % 3) * 10, seed + 7);
	return [
		{ id: segmentId++, start: 0, tokens: text, type: 'text' },
		{ id: segmentId++, start: text.length, tokens: code, type: 'code' },
	];
};

const replies = Array.from({ length: 8 }, (_, seed) => {
	const segments = makeSegments(seed);
	return { segments, total: segments.reduce((sum, segment) => sum + segment.tokens.length, 0) };
});

export const nextReply = (): Message => {
	const reply = replies[replyCursor++ % replies.length];
	return { done: 0, id: messageId++, role: 'assistant', ...reply };
};

export const userMessage = (text: string): Message => ({
	done: 1,
	id: messageId++,
	role: 'user',
	segments: [{ id: segmentId++, start: 0, tokens: [text], type: 'text' }],
	total: 1,
});

const settledReply = (seed: number): Message => {
	const reply = replies[seed % replies.length];
	return { done: reply.total, id: messageId++, role: 'assistant', ...reply };
};

const pristine = (): Conversation[] => {
	const short: Message[] = [];
	for (let index = 0; index < 5; index++) {
		short.push(userMessage(`prompt ${index}`), settledReply(index));
	}
	const history: Message[] = [];
	for (let index = 0; index < 100; index++) {
		history.push(userMessage(`history prompt ${index}`), userMessage(`history reply ${index}`));
	}
	return [
		{ id: 0, messages: short, title: 'Streaming demo' },
		{ id: 1, messages: history, title: 'Long history' },
	];
};
const initial = pristine();

export const initialConversations = (): Conversation[] => {
	replyCursor = 0;
	return initial.map((conversation) => ({
		id: conversation.id,
		messages: [...conversation.messages],
		title: conversation.title,
	}));
};

export const segmentText = (segment: Segment, done: number) => {
	const visible = Math.max(0, Math.min(segment.tokens.length, done - segment.start));
	return segment.tokens.slice(0, visible).join('');
};

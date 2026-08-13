// Keeps a teacher's work on their own machine: the activity they have open
// right now, and any activities they have named and saved.
//
// Nothing leaves the browser. Settings are stored in the same compact form the
// shareable link uses, which means anything read back is validated by exactly
// the code that validates a link — a stale or hand-edited entry can shift the
// activity, never break it.

import { settingsFromParams, settingsToQuery, type Settings } from './settings';

const WORKING_KEY = 'noteid:working';
const PRESETS_KEY = 'noteid:presets';
const QR_OPEN_KEY = 'noteid:qropen';

export interface Preset {
	id: string;
	name: string;
	/** Settings in the shareable link's query form. */
	query: string;
}

/** The customizer's current state, so a refresh does not lose it. */
export interface Working {
	query: string;
	/** The preset these settings were loaded from, if any. */
	presetId: string | null;
}

export function newId(): string {
	return crypto.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

export function toQuery(s: Settings): string {
	return settingsToQuery(s);
}

export function fromQuery(query: string): Settings {
	return settingsFromParams(new URLSearchParams(query));
}

/** Two settings are the same activity when they encode identically. */
export function sameSettings(a: Settings, b: Settings): boolean {
	return settingsToQuery(a) === settingsToQuery(b);
}

// Storage can be unavailable or full — a browser in private mode, a locked-down
// school device. None of it is worth interrupting the teacher over, so reads
// fall back to nothing and writes are allowed to fail.
function read(key: string): unknown {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Nothing useful to do; the activity still works for this session.
	}
}

export function loadWorking(): Working | null {
	const raw = read(WORKING_KEY) as Partial<Working> | null;
	if (!raw || typeof raw.query !== 'string') return null;
	return {
		query: raw.query,
		presetId: typeof raw.presetId === 'string' ? raw.presetId : null
	};
}

export function saveWorking(w: Working): void {
	write(WORKING_KEY, w);
}

export function loadPresets(): Preset[] {
	const raw = read(PRESETS_KEY);
	if (!Array.isArray(raw)) return [];
	return raw
		.filter(
			(p): p is Preset =>
				!!p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.query === 'string'
		)
		.map((p) => ({ id: p.id, name: p.name, query: p.query }));
}

export function savePresets(list: Preset[]): void {
	write(PRESETS_KEY, list);
}

/**
 * Whether the QR code is left showing. This is how the teacher likes to work
 * rather than part of any activity, so it is kept apart from the settings —
 * showing the code is not an edit, and never counts as an unsaved change.
 */
export function loadQrOpen(): boolean {
	return read(QR_OPEN_KEY) === true;
}

export function saveQrOpen(open: boolean): void {
	write(QR_OPEN_KEY, open);
}

// Turns the activity settings into URL text (for a shareable link) and back,
// and describes them in plain language for the progress report.

import { CLEF_NAMES, keySignatureName, type Clef, type NoteValue, type Position } from './music';

export interface Settings {
	clefs: Clef[];
	rangeLow: string; // e.g. 'A3'
	rangeHigh: string; // e.g. 'C6'
	positions: Position;
	keySignatures: number[]; // 0 = none, +n sharps, -n flats
	noteValues: NoteValue[];
	accidentals: boolean;
	helpers: boolean;
	// Challenge mode
	questionLimit: number; // 0 = off, else 5..100
	timeLimitMin: number; // 0 = off, else minutes
	multipleAttempts: boolean;
}

const ALL_CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor'];
const ALL_VALUES: NoteValue[] = ['whole', 'half', 'quarter'];

// The baseline the customizer opens with (from the spec).
export const DEFAULT_SETTINGS: Settings = {
	clefs: ['treble'],
	rangeLow: 'A3',
	rangeHigh: 'C6',
	positions: 'both',
	keySignatures: [0],
	noteValues: ['whole'],
	accidentals: true,
	helpers: false,
	questionLimit: 0,
	timeLimitMin: 0,
	multipleAttempts: false
};

// Challenge mode is "on" when either limit is active.
export function isChallengeMode(s: Settings): boolean {
	return s.questionLimit > 0 || s.timeLimitMin > 0;
}

export function settingsToQuery(s: Settings): string {
	const p = new URLSearchParams();
	p.set('clefs', s.clefs.join(','));
	p.set('low', s.rangeLow);
	p.set('high', s.rangeHigh);
	p.set('pos', s.positions);
	p.set('keys', s.keySignatures.join(','));
	p.set('values', s.noteValues.join(','));
	p.set('acc', s.accidentals ? '1' : '0');
	p.set('help', s.helpers ? '1' : '0');
	p.set('qlim', String(s.questionLimit));
	p.set('tlim', String(s.timeLimitMin));
	p.set('multi', s.multipleAttempts ? '1' : '0');
	return p.toString();
}

export function settingsFromParams(params: URLSearchParams): Settings {
	const d = DEFAULT_SETTINGS;

	const clefs = csv(params.get('clefs')).filter((c): c is Clef => ALL_CLEFS.includes(c as Clef));
	const values = csv(params.get('values')).filter((v): v is NoteValue =>
		ALL_VALUES.includes(v as NoteValue)
	);
	const keys = csv(params.get('keys'))
		.map(Number)
		.filter((n) => Number.isInteger(n) && n >= -7 && n <= 7);

	const pos = params.get('pos');

	return {
		clefs: clefs.length ? clefs : d.clefs,
		rangeLow: params.get('low') ?? d.rangeLow,
		rangeHigh: params.get('high') ?? d.rangeHigh,
		positions: pos === 'lines' || pos === 'spaces' ? pos : 'both',
		keySignatures: keys.length ? keys : d.keySignatures,
		noteValues: values.length ? values : d.noteValues,
		accidentals: bool(params.get('acc'), d.accidentals),
		helpers: bool(params.get('help'), d.helpers),
		questionLimit: clampLimit(params.get('qlim')),
		timeLimitMin: clampTime(params.get('tlim')),
		multipleAttempts: bool(params.get('multi'), d.multipleAttempts)
	};
}

function csv(v: string | null): string[] {
	return (v ?? '').split(',').filter(Boolean);
}
function bool(v: string | null, fallback: boolean): boolean {
	if (v === '1') return true;
	if (v === '0') return false;
	return fallback;
}
function clampLimit(v: string | null): number {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(100, Math.max(5, Math.round(n / 5) * 5));
}
function clampTime(v: string | null): number {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(30, Math.max(1, Math.round(n)));
}

// Plain-language label/value pairs for the progress report.
export function describeSettings(s: Settings): { label: string; value: string }[] {
	return [
		{ label: 'Clefs', value: s.clefs.map((c) => CLEF_NAMES[c]).join(', ') },
		{ label: 'Range', value: `${s.rangeLow} – ${s.rangeHigh}` },
		{ label: 'Positions', value: positionLabel(s.positions) },
		{
			label: 'Key signatures',
			value: s.keySignatures.map(keySignatureName).join(', ')
		},
		{ label: 'Note values', value: s.noteValues.map(cap).join(', ') },
		{ label: 'Note names', value: 'Letters' },
		{ label: 'Helpers', value: s.helpers ? 'On' : 'Off' },
		{ label: 'Accidentals', value: s.accidentals ? 'On' : 'Off' },
		{ label: 'Note filter', value: 'Off' },
		{ label: 'Next question', value: 'Immediately' },
		{ label: 'Challenge mode', value: challengeLabel(s) }
	];
}

function positionLabel(p: Position): string {
	return p === 'lines' ? 'Lines only' : p === 'spaces' ? 'Spaces only' : 'Lines and spaces';
}
function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
function challengeLabel(s: Settings): string {
	if (!isChallengeMode(s)) return 'Off';
	const parts: string[] = [];
	if (s.questionLimit > 0) parts.push(`${s.questionLimit} questions`);
	if (s.timeLimitMin > 0) parts.push(`${s.timeLimitMin} min`);
	parts.push(s.multipleAttempts ? 'multiple attempts' : 'single attempt');
	return parts.join(', ');
}

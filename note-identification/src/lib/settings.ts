// Turns the activity settings into URL text (for a shareable link) and back.

import {
	ALL_KEYS,
	noteName,
	parseNoteName,
	type Clef,
	type KeyId,
	type NoteValue,
	type Position
} from './music';
import {
	ALL_INSTRUMENTS,
	BASS_POSITIONS,
	DEFAULT_BASS_POSITIONS,
	FINGER_SETS,
	INSTRUMENTS,
	playableRange,
	type FingeringOptions,
	type FingerId,
	type Instrument,
	type PositionId
} from './strings';

export interface Settings {
	clefs: Clef[];
	rangeLow: string; // e.g. 'A3'
	rangeHigh: string; // e.g. 'C6'
	positions: Position;
	noteValues: NoteValue[];
	helpers: boolean;
	// The instrument being practised — it fixes the clef and the fingerings.
	instrument: Instrument;
	key: KeyId; // the key signature on the staff
	askString: boolean;
	askFinger: boolean;
	bassPositions: PositionId[]; // which positions bass answers may use
	fingers: FingerId[]; // which fingers the student may be asked for
	// Challenge mode
	questionLimit: number; // 0 = off, else 1..1000
	timeLimitSec: number; // 0 = off, else 1..3600 (an hour)
}

const ALL_VALUES: NoteValue[] = ['whole', 'half', 'quarter'];
const ALL_POSITIONS: PositionId[] = BASS_POSITIONS.map((p) => p.id);

const DEFAULT_INSTRUMENT: Instrument = 'violin';

/** The three inputs the fingering engine needs, pulled out of the settings. */
export function fingeringOptions(s: Settings): FingeringOptions {
	return { key: s.key, positions: s.bassPositions, fingers: s.fingers };
}

const DEFAULT_RANGE = playableRange(
	DEFAULT_INSTRUMENT,
	defaultFingerSettings(DEFAULT_INSTRUMENT, 'C')
);

// The baseline the customizer opens with.
export const DEFAULT_SETTINGS: Settings = {
	clefs: [INSTRUMENTS[DEFAULT_INSTRUMENT].clef],
	rangeLow: DEFAULT_RANGE.low,
	rangeHigh: DEFAULT_RANGE.high,
	positions: 'both',
	noteValues: ['whole'],
	helpers: false,
	instrument: DEFAULT_INSTRUMENT,
	key: 'C',
	askString: true,
	askFinger: true,
	bassPositions: DEFAULT_BASS_POSITIONS,
	fingers: [...FINGER_SETS[DEFAULT_INSTRUMENT]],
	questionLimit: 0,
	timeLimitSec: 0
};

function defaultFingerSettings(inst: Instrument, key: KeyId): FingeringOptions {
	return { key, positions: DEFAULT_BASS_POSITIONS, fingers: [...FINGER_SETS[inst]] };
}

/**
 * Switching instrument fixes the clef, offers that instrument's own fingers,
 * and clamps the range to what it can actually reach with them, so the activity
 * never shows a note the student has no way to finger.
 */
export function applyInstrument(s: Settings, choice: Instrument): Settings {
	const next = { ...s, instrument: choice, fingers: [...FINGER_SETS[choice]] };
	const limits = playableRange(choice, fingeringOptions(next));
	return {
		...next,
		clefs: [INSTRUMENTS[choice].clef],
		rangeLow: limits.low,
		rangeHigh: limits.high
	};
}

/**
 * Pull the range back inside what is playable, keeping as much of the teacher's
 * choice as still fits. Dropping third position, turning off high 3, or reading
 * in D major each take notes out of reach at one end or the other.
 */
export function clampRange(s: Settings): Settings {
	const limits = playableRange(s.instrument, fingeringOptions(s));
	const low = Math.max(parseNoteName(s.rangeLow), parseNoteName(limits.low));
	const high = Math.min(parseNoteName(s.rangeHigh), parseNoteName(limits.high));
	if (low > high) return { ...s, rangeLow: limits.low, rangeHigh: limits.high };
	return { ...s, rangeLow: noteName(low), rangeHigh: noteName(high) };
}

/** Does this configuration ask anything beyond the note name? */
export function asksFingering(s: Settings): boolean {
	return s.askString || s.askFinger;
}

/** The bass is the only instrument whose position has to be asked about. */
export function asksPosition(s: Settings): boolean {
	return s.instrument === 'bass' && s.askFinger;
}

// Challenge mode is "on" when either limit is active.
export function isChallengeMode(s: Settings): boolean {
	return s.questionLimit > 0 || s.timeLimitSec > 0;
}

export const MAX_QUESTIONS = 1000;
export const MAX_SECONDS = 3600; // one hour

// "3 min 30 sec", "45 sec", "5 min".
export function formatDuration(totalSec: number): string {
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	if (!min) return `${sec} sec`;
	if (!sec) return `${min} min`;
	return `${min} min ${sec} sec`;
}

export function settingsToQuery(s: Settings): string {
	const p = new URLSearchParams();
	p.set('clefs', s.clefs.join(','));
	p.set('low', s.rangeLow);
	p.set('high', s.rangeHigh);
	p.set('pos', s.positions);
	p.set('values', s.noteValues.join(','));
	p.set('help', s.helpers ? '1' : '0');
	p.set('inst', s.instrument);
	p.set('key', s.key);
	p.set('askstr', s.askString ? '1' : '0');
	p.set('askfin', s.askFinger ? '1' : '0');
	p.set('bpos', s.bassPositions.join(','));
	p.set('fing', s.fingers.join(','));
	p.set('qlim', String(s.questionLimit));
	p.set('tsec', String(s.timeLimitSec));
	return p.toString();
}

export function settingsFromParams(params: URLSearchParams): Settings {
	const d = DEFAULT_SETTINGS;

	const values = csv(params.get('values')).filter((v): v is NoteValue =>
		ALL_VALUES.includes(v as NoteValue)
	);
	const pos = params.get('pos');

	const rawInst = params.get('inst');
	const instrument: Instrument = ALL_INSTRUMENTS.includes(rawInst as Instrument)
		? (rawInst as Instrument)
		: d.instrument;

	const bassPositions = csv(params.get('bpos')).filter((p): p is PositionId =>
		ALL_POSITIONS.includes(p as PositionId)
	);

	const rawKey = params.get('key');
	const key: KeyId = ALL_KEYS.includes(rawKey as KeyId) ? (rawKey as KeyId) : d.key;

	// Only fingers this instrument has; links written before an instrument's
	// fingers were nameable simply get the whole set.
	const fingers = csv(params.get('fing')).filter((f) => FINGER_SETS[instrument].includes(f));

	const fallback = playableRange(instrument, {
		key,
		positions: bassPositions.length ? bassPositions : d.bassPositions,
		fingers: fingers.length ? fingers : [...FINGER_SETS[instrument]]
	});

	return {
		clefs: [INSTRUMENTS[instrument].clef],
		rangeLow: params.get('low') ?? fallback.low,
		rangeHigh: params.get('high') ?? fallback.high,
		positions: pos === 'lines' || pos === 'spaces' ? pos : 'both',
		noteValues: values.length ? values : d.noteValues,
		helpers: bool(params.get('help'), d.helpers),
		instrument,
		key,
		askString: bool(params.get('askstr'), d.askString),
		askFinger: bool(params.get('askfin'), d.askFinger),
		bassPositions: bassPositions.length ? bassPositions : d.bassPositions,
		fingers: fingers.length ? fingers : [...FINGER_SETS[instrument]],
		questionLimit: clampLimit(params.get('qlim')),
		timeLimitSec: readTimeLimit(params)
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
	return clampCount(Number(v), MAX_QUESTIONS);
}
function clampCount(n: number, max: number): number {
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(max, Math.max(1, Math.round(n)));
}
// Links shared before the time limit gained seconds carry `tlim` in minutes.
function readTimeLimit(params: URLSearchParams): number {
	if (params.has('tsec')) return clampCount(Number(params.get('tsec')), MAX_SECONDS);
	return clampCount(Number(params.get('tlim')) * 60, MAX_SECONDS);
}

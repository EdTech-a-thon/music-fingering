// Which string, finger, and — on the bass — which position each written note is
// played with, for the four orchestral string instruments.
//
// Nothing here is a hand-typed lookup table. Everything falls out of two facts
// per instrument: how the open strings are tuned, and how far above the open
// string each finger lands in a given hand position. Asking for a note's
// fingerings is then just "which (string, position, finger) combinations land on
// this pitch" — which is also why the activity can accept every valid answer
// rather than one blessed one.
//
// A finger is named by *where it lands*, not just by which digit it is: the
// violin's low and high 2 are two different answers a half step apart, as are
// the cello's closed and extended fingers. Each name is therefore one exact
// distance above the open string, which is what lets a key signature change the
// fingering without any of the arithmetic below having to know about keys.

import {
	fromDiatonicIndex,
	noteName,
	parseNoteName,
	pitchInKey,
	pitchOfIndex,
	type Clef,
	type KeyId
} from './music';

export type Instrument = 'violin' | 'viola' | 'cello' | 'bass';

// Bass positions are named for where the first finger lands relative to the
// open string. Half position is a half step up, first a whole step, and so on.
export type PositionId = 'half' | 'I' | 'II' | 'III';

/**
 * A finger the student can answer with: the digit plus, where the instrument
 * distinguishes them, which version of that finger. 'L2' is the violin's low
 * second finger, 'x2' the cello's extended second.
 */
export type FingerId = string;

export const ALL_INSTRUMENTS: Instrument[] = ['violin', 'viola', 'cello', 'bass'];

export const INSTRUMENT_NAMES: Record<Instrument, string> = {
	violin: 'Violin',
	viola: 'Viola',
	cello: 'Cello',
	bass: 'Double Bass'
};

/**
 * The fingers the student can pick from, with the long name used when an answer
 * is read back. `finger` is the bare digit, which is what decides the fingering
 * a teacher would write in; `extended` marks a reach out of the hand's normal
 * shape, which a teacher writes only when nothing closer will do.
 */
export interface FingerChoice {
	id: FingerId;
	/** Button text, and what the student sees written in a part. */
	label: string;
	/** Read back when revealing an answer: "It was the low 2nd finger". */
	name: string;
	finger: number;
	extended?: boolean;
}

export const FINGERS: Record<FingerId, FingerChoice> = {
	open: { id: 'open', label: 'Open', name: 'open string', finger: 0 },
	L1: { id: 'L1', label: 'L1', name: 'low 1st finger', finger: 1 },
	'1': { id: '1', label: '1', name: '1st finger', finger: 1 },
	L2: { id: 'L2', label: 'L2', name: 'low 2nd finger', finger: 2 },
	'2': { id: '2', label: '2', name: '2nd finger', finger: 2 },
	H2: { id: 'H2', label: 'H2', name: 'high 2nd finger', finger: 2 },
	L3: { id: 'L3', label: 'L3', name: 'low 3rd finger', finger: 3 },
	'3': { id: '3', label: '3', name: '3rd finger', finger: 3 },
	H3: { id: 'H3', label: 'H3', name: 'high 3rd finger', finger: 3 },
	L4: { id: 'L4', label: 'L4', name: 'low 4th finger', finger: 4 },
	'4': { id: '4', label: '4', name: '4th finger', finger: 4 },
	x1: { id: 'x1', label: 'x1', name: 'extended 1st finger', finger: 1, extended: true },
	x2: { id: 'x2', label: 'x2', name: 'extended 2nd finger', finger: 2, extended: true },
	x4: { id: 'x4', label: 'x4', name: 'extended 4th finger', finger: 4, extended: true }
};

// Which fingers each instrument offers, low to high. The open string is always
// on the list — it is not something a teacher can switch off.
//
// The violin's low 3 is only ever needed for A♭ on the E string, and the low 4
// for the flats a fourth above D, A and E; the viola, tuned a fifth lower, never
// meets a flat that asks for a low 3 in the keys taught here.
export const FINGER_SETS: Record<Instrument, FingerId[]> = {
	violin: ['open', 'L1', '1', 'L2', 'H2', 'L3', '3', 'H3', 'L4', '4'],
	viola: ['open', 'L1', '1', 'L2', 'H2', '3', 'H3', 'L4', '4'],
	cello: ['open', 'x1', '1', '2', 'x2', '3', '4', 'x4'],
	bass: ['open', '1', '2', '4']
};

// Half steps above the open string for each finger, in one hand position. Two
// fingers may land on the same distance — the cello's extended 2 and its closed
// 3 are the same pitch — and both are then accepted as answers.
type Offsets = Record<FingerId, number>;

export interface HandPosition {
	id: PositionId;
	label: string;
	offsets: Offsets;
	/**
	 * True where each finger has a letter of its own: on the violin and viola the
	 * 1st finger plays the letter above the open string, the 2nd the letter above
	 * that, and so on, whatever accidental the key puts on it. That is what tells
	 * B♭ on the E string (a lowered 4th finger) from the same pitch spelled A♯ (a
	 * raised 3rd) — see `fingeringsFor`.
	 */
	fingersByLetter?: boolean;
}

// Violin and viola share a hand shape, a whole step per finger with the low and
// high versions a half step either side: 4 lands a perfect fifth above the open
// string, which is the next open string up, and the reason those notes have two
// answers.
//
// Low 3 and low 4 sit on the same two pitches as high 2 and high 3. They are not
// spare names for them: which one a teacher writes depends on how the note is
// spelled, and `fingersByLetter` is what settles it.
const UPPER_FIRST: HandPosition = {
	id: 'I',
	label: 'I',
	offsets: { L1: 1, '1': 2, L2: 3, H2: 4, L3: 4, '3': 5, H3: 6, L4: 6, '4': 7 },
	fingersByLetter: true
};

// The cello hand is narrower — the fingers sit a half step apart, so closed
// first position spans only a perfect fourth. The extensions reach past that: x1
// back a half step towards the nut, x2 and x4 forward a half step.
const CELLO_FIRST: HandPosition = {
	id: 'I',
	label: 'I',
	offsets: { x1: 1, '1': 2, '2': 3, x2: 4, '3': 4, '4': 5, x4: 6 }
};

// The bass uses 1-2-4 fingering — no third finger down here — and the hand
// spans only a minor third while the strings are a fourth apart. A scale
// therefore does not fit in one position, which is why the bass is the only
// instrument that has to be asked where the hand is.
//
// These are hand shapes, not names. Both position systems below use exactly
// these four, so the ids stay neutral and each system supplies its own names.
export const BASS_POSITIONS: HandPosition[] = [
	{ id: 'half', label: '½', offsets: { '1': 1, '2': 2, '4': 3 } },
	{ id: 'I', label: 'I', offsets: { '1': 2, '2': 3, '4': 4 } },
	{ id: 'II', label: 'II', offsets: { '1': 3, '2': 4, '4': 5 } },
	{ id: 'III', label: 'III', offsets: { '1': 5, '2': 6, '4': 7 } }
];

// ---------------------------------------------------------------------------
// Position systems
// ---------------------------------------------------------------------------

/**
 * The two systems school bassists are taught by. They are not two sets of hand
 * shapes — the hands are the same, and both finger 1-2-4 down the neck. What
 * differs is how the positions are found and therefore what they are called:
 * Simandl counts up the fingerboard a half step at a time, while Rabbath names
 * each position after the natural harmonic it is found by.
 *
 * The consequence for us is small. Rabbath's 2nd position puts the first finger
 * on C on the G string — the same notes with the same fingers that Simandl
 * calls 3rd position. So the shape 'III' above is shared, and only its name
 * changes with the system.
 */
export type PositionSystem = 'simandl' | 'rabbath';

export const ALL_POSITION_SYSTEMS: PositionSystem[] = ['simandl', 'rabbath'];

export const POSITION_SYSTEM_NAMES: Record<PositionSystem, string> = {
	simandl: 'Simandl',
	rabbath: 'Rabbath'
};

/**
 * The positions each system offers, low to high. Rabbath has no equivalent of
 * Simandl's 2nd position: the shape between them belongs to Simandl's half-step
 * ladder and has no harmonic to name it by.
 */
export const SYSTEM_POSITIONS: Record<PositionSystem, PositionId[]> = {
	simandl: ['half', 'I', 'II', 'III'],
	rabbath: ['half', 'I', 'III']
};

const SIMANDL_NAMES: Record<PositionId, string> = {
	half: 'Half position',
	I: 'First position',
	II: 'Second position',
	III: 'Third position'
};

// Only where a system departs from the Simandl names above. Rabbath counts the
// shared top shape as its 2nd position rather than its 3rd.
const RENAMED: Record<PositionSystem, Partial<Record<PositionId, [string, string]>>> = {
	simandl: {},
	rabbath: { III: ['II', 'Second position'] }
};

/** The short button text for a position: '½', 'I', 'II'. */
export function positionLabel(id: PositionId, system: PositionSystem = 'simandl'): string {
	const renamed = RENAMED[system][id];
	if (renamed) return renamed[0];
	return BASS_POSITIONS.find((p) => p.id === id)?.label ?? id;
}

/** The spoken name, used when reading an answer back: 'Third position'. */
export function positionName(id: PositionId, system: PositionSystem = 'simandl'): string {
	return RENAMED[system][id]?.[1] ?? SIMANDL_NAMES[id];
}

export interface InstrumentDef {
	id: Instrument;
	clef: Clef;
	/** Open strings, lowest first, as written pitches. */
	strings: string[];
	positions: HandPosition[];
	/** Only the bass is asked which position the hand is in. */
	usesPositions: boolean;
}

// Bass music is written an octave above where it sounds. These are the written
// pitches, which is what the student reads off the staff.
export const INSTRUMENTS: Record<Instrument, InstrumentDef> = {
	violin: {
		id: 'violin',
		clef: 'treble',
		strings: ['G3', 'D4', 'A4', 'E5'],
		positions: [UPPER_FIRST],
		usesPositions: false
	},
	viola: {
		id: 'viola',
		clef: 'alto',
		strings: ['C3', 'G3', 'D4', 'A4'],
		positions: [UPPER_FIRST],
		usesPositions: false
	},
	cello: {
		id: 'cello',
		clef: 'bass',
		strings: ['C2', 'G2', 'D3', 'A3'],
		positions: [CELLO_FIRST],
		usesPositions: false
	},
	bass: {
		id: 'bass',
		clef: 'bass',
		strings: ['E2', 'A2', 'D3', 'G3'],
		positions: BASS_POSITIONS,
		usesPositions: true
	}
};

/**
 * The positions a beginning bassist is normally taught first — and the three a
 * school player actually uses. They are the same three in either system; only
 * the last one's name changes (Simandl 3rd, Rabbath 2nd).
 */
export const DEFAULT_BASS_POSITIONS: PositionId[] = ['half', 'I', 'III'];

/**
 * What the activity is teaching, as far as the fingerings are concerned: the
 * key the notes are read in, the bass positions in use, and the fingers the
 * teacher has put on the menu. Everything below is answered relative to this.
 */
export interface FingeringOptions {
	key: KeyId;
	positions: PositionId[];
	fingers: FingerId[];
}

export function defaultFingeringOptions(inst: Instrument): FingeringOptions {
	return { key: 'C', positions: DEFAULT_BASS_POSITIONS, fingers: [...FINGER_SETS[inst]] };
}

// ---------------------------------------------------------------------------
// Working out the fingerings
// ---------------------------------------------------------------------------

export interface Fingering {
	/** Index into the instrument's strings, 0 = lowest. */
	string: number;
	/** 'open' means the open string. */
	finger: FingerId;
	/** Null for an open string, and for every instrument except the bass. */
	position: PositionId | null;
}

export function stringName(inst: Instrument, index: number): string {
	return INSTRUMENTS[inst].strings[index]?.replace(/\d+$/, '') ?? '';
}

export function isOpen(f: Fingering): boolean {
	return f.finger === 'open';
}

/**
 * Every way the given note can be played, in no particular order. An empty list
 * means the note is out of reach with the fingerings being taught — in D major
 * a written C is C♯, so on the cello's C string it needs the extended first
 * finger rather than the open string.
 */
export function fingeringsFor(
	inst: Instrument,
	noteIndex: number,
	opts: FingeringOptions = defaultFingeringOptions(inst)
): Fingering[] {
	const def = INSTRUMENTS[inst];
	const pitch = pitchInKey(noteIndex, opts.key);
	const found: Fingering[] = [];

	def.strings.forEach((open, string) => {
		const openIndex = parseNoteName(open);
		// Open strings are tuned to a fixed pitch, key signature or not.
		const delta = pitch - pitchOfIndex(openIndex);
		if (delta === 0) {
			if (opts.fingers.includes('open')) found.push({ string, finger: 'open', position: null });
			return;
		}
		if (delta < 0) return;

		// How many letters up the staff the note is from the open string: 4 for B
		// on the E string, whether it is written B or B♭.
		const letters = noteIndex - openIndex;

		for (const pos of def.positions) {
			if (def.usesPositions && !opts.positions.includes(pos.id)) continue;
			let reach = Object.keys(pos.offsets).filter(
				(finger) => pos.offsets[finger] === delta && opts.fingers.includes(finger)
			);
			if (pos.fingersByLetter) reach = spelledFingers(reach, letters);
			for (const finger of reach) {
				found.push({
					string,
					finger,
					position: def.usesPositions ? pos.id : null
				});
			}
		}
	});

	return found;
}

/**
 * Of the fingers that land on the pitch, the ones named for the letter the note
 * is written on: B♭ on the E string is the 4th finger lowered, not the 3rd
 * raised, even though both play the same pitch.
 *
 * If none of them is — G♯ on the G string is a lowered 1st finger although it
 * carries the open string's own letter — then the nearest finger is the answer,
 * whatever it is called.
 */
function spelledFingers(fingers: FingerId[], letters: number): FingerId[] {
	const spelled = fingers.filter((f) => FINGERS[f].finger === letters);
	return spelled.length ? spelled : fingers;
}

const POSITION_ORDER: PositionId[] = BASS_POSITIONS.map((p) => p.id);

/**
 * The fingering a teacher would write into the part: the highest string that
 * reaches the note (so an open string beats the fourth finger below it), then
 * the hand's own shape ahead of a reach out of it, then the lowest finger, then
 * the lowest position. This reproduces the fingerings printed in Essential
 * Elements for Strings across all four instruments.
 */
export function preferredFingering(options: Fingering[]): Fingering | null {
	if (!options.length) return null;
	return [...options].sort((a, b) => {
		const fa = FINGERS[a.finger];
		const fb = FINGERS[b.finger];
		return (
			b.string - a.string ||
			Number(fa.extended ?? false) - Number(fb.extended ?? false) ||
			fa.finger - fb.finger ||
			POSITION_ORDER.indexOf(a.position ?? 'I') - POSITION_ORDER.indexOf(b.position ?? 'I')
		);
	})[0];
}

/** "G string, 4th finger, third position" — used when revealing an answer. */
export function describeFingering(
	inst: Instrument,
	f: Fingering,
	system: PositionSystem = 'simandl'
): string {
	const parts = [`${stringName(inst, f.string)} string`, FINGERS[f.finger].name];
	if (f.position) parts.push(positionName(f.position, system).toLowerCase());
	return parts.join(', ');
}

/**
 * The lowest and highest notes playable in the positions being taught. The
 * practice range is clamped to this so the activity never shows a note the
 * student has no way to answer.
 */
export function playableRange(
	inst: Instrument,
	opts: FingeringOptions = defaultFingeringOptions(inst)
): { low: string; high: string } {
	const strings = INSTRUMENTS[inst].strings;
	const lowest = parseNoteName(strings[0]);
	// A fifth above the top string is further than any position here reaches.
	const ceiling = parseNoteName(strings[strings.length - 1]) + 8;

	// The bottom of the range is not always the lowest open string: in D major
	// the cello's written C is C♯, which takes a finger the teacher may not have
	// enabled.
	let low: number | null = null;
	let high = lowest;
	for (let i = lowest; i <= ceiling; i++) {
		if (!fingeringsFor(inst, i, opts).length) continue;
		if (low === null) low = i;
		high = i;
	}
	return { low: noteName(low ?? lowest), high: noteName(high) };
}

/** Every playable note, low to high — used to build the reference chart. */
export function playableNotes(
	inst: Instrument,
	opts: FingeringOptions = defaultFingeringOptions(inst)
): { index: number; name: string; options: Fingering[] }[] {
	const { low, high } = playableRange(inst, opts);
	const out: { index: number; name: string; options: Fingering[] }[] = [];
	for (let i = parseNoteName(low); i <= parseNoteName(high); i++) {
		const options = fingeringsFor(inst, i, opts);
		if (options.length) {
			const { letter, octave } = fromDiatonicIndex(i);
			out.push({ index: i, name: `${letter}${octave}`, options });
		}
	}
	return out;
}

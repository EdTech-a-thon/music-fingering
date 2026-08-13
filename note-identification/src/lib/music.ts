// Core music model for the note-naming activity.
// Plain data + pure functions so the logic is easy to read and test.

export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type Position = 'both' | 'lines' | 'spaces';
export type NoteValue = 'whole' | 'half' | 'quarter';

export interface Note {
	letter: string; // 'A'..'G'
	octave: number; // scientific pitch octave, 4 = the octave of middle C
	value: NoteValue; // whole / half / quarter (visual only)
}

// The musical alphabet, ordered so that one step up the staff = the next letter.
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const CLEF_NAMES: Record<Clef, string> = {
	treble: 'Treble',
	bass: 'Bass',
	alto: 'Alto',
	tenor: 'Tenor'
};

// ---------------------------------------------------------------------------
// Key signatures
// ---------------------------------------------------------------------------

// The sharp keys a beginning string player meets first. A key signature never
// changes a note's letter or where it sits on the staff — it raises the pitch,
// which is why it changes the fingering and not the answer to "name this note".
export type KeyId = 'C' | 'G' | 'D' | 'A';

export const ALL_KEYS: KeyId[] = ['C', 'G', 'D', 'A'];

export const KEY_NAMES: Record<KeyId, string> = {
	C: 'C major',
	G: 'G major',
	D: 'D major',
	A: 'A major'
};

/** Letters the key sharpens, in the order the sharps are written on the staff. */
export const KEY_SHARPS: Record<KeyId, string[]> = {
	C: [],
	G: ['F'],
	D: ['F', 'C'],
	A: ['F', 'C', 'G']
};

/**
 * Where each sharp of a key signature is written, as steps above the bottom
 * line of the staff, in the order they are written. Engraving convention rather
 * than arithmetic: the sharps stay inside the staff where they can, so each
 * clef spells the same sharps in its own place.
 */
export const SHARP_STEPS: Record<Clef, number[]> = {
	treble: [8, 5, 9], // F5 top line, C5 third space, G5 above the top line
	bass: [6, 3, 7], // F3 fourth line, C3 second space, G3 top space
	alto: [7, 4, 8], // F4 top space, C4 middle line, G4 top line
	tenor: [2, 6, 3] // F3 second line, C4 fourth line, G3 second space
};

/** Half steps the key signature adds to a letter: 1 for a sharp, 0 otherwise. */
export function alteration(key: KeyId, letter: string): number {
	return KEY_SHARPS[key].includes(letter) ? 1 : 0;
}

/** "F♯" in a key that sharpens F, plain "F" otherwise. */
export function noteLabel(key: KeyId, letter: string): string {
	return alteration(key, letter) ? `${letter}♯` : letter;
}

// ---------------------------------------------------------------------------
// Staff positions
// ---------------------------------------------------------------------------

// A "diatonic index" turns a letter+octave into a single number that goes up by
// one for every line-or-space step. It ignores accidentals, because a sharp or
// flat never changes where a note sits on the staff.
export function diatonicIndex(letter: string, octave: number): number {
	return octave * 7 + LETTERS.indexOf(letter);
}

export function fromDiatonicIndex(index: number): { letter: string; octave: number } {
	const octave = Math.floor(index / 7);
	return { letter: LETTERS[index - octave * 7], octave };
}

// "C4", "A3", "F#5"-style names (we only ever parse letter+octave for ranges).
export function parseNoteName(name: string): number {
	const m = name.match(/^([A-G])(-?\d+)$/);
	if (!m) return diatonicIndex('C', 4);
	return diatonicIndex(m[1], Number(m[2]));
}

// Where each natural sits within its octave, in half steps. String fingering
// depends on the *sounding* distance from the open string, not the staff step,
// so the fingering tables need this alongside the diatonic index.
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function chromaticPitch(letter: string, octave: number): number {
	return octave * 12 + SEMITONES[letter];
}

// The half-step pitch of a diatonic staff position, as written in C major.
export function pitchOfIndex(index: number): number {
	const { letter, octave } = fromDiatonicIndex(index);
	return chromaticPitch(letter, octave);
}

/** What the note actually sounds in this key — the pitch the fingering plays. */
export function pitchInKey(index: number, key: KeyId): number {
	const { letter, octave } = fromDiatonicIndex(index);
	return chromaticPitch(letter, octave) + alteration(key, letter);
}

export function noteName(index: number): string {
	const { letter, octave } = fromDiatonicIndex(index);
	return `${letter}${octave}`;
}

// The diatonic index of the note on the bottom line of each clef.
export const BOTTOM_LINE: Record<Clef, number> = {
	treble: diatonicIndex('E', 4),
	bass: diatonicIndex('G', 2),
	alto: diatonicIndex('F', 3),
	tenor: diatonicIndex('D', 3)
};

// Steps above the bottom line (0 = bottom line, +1 = the space above it, ...).
export function stepsAboveBottom(clef: Clef, index: number): number {
	return index - BOTTOM_LINE[clef];
}

// How far past the staff a range may reach: three ledger lines either side.
export const RANGE_MARGIN = 6;

// Where a clef's range starts out: the staff plus two ledger lines either side.
export function defaultRange(clef: Clef): { low: string; high: string } {
	const bottom = BOTTOM_LINE[clef];
	return { low: noteName(bottom - 4), high: noteName(bottom + 12) };
}

// Even step = sits on a line; odd step = sits in a space.
function matchesPosition(step: number, position: Position): boolean {
	if (position === 'lines') return step % 2 === 0;
	if (position === 'spaces') return Math.abs(step % 2) === 1;
	return true;
}

// ---------------------------------------------------------------------------
// Generating a question
// ---------------------------------------------------------------------------

function pick<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

export interface GenerateOptions {
	clef: Clef;
	lowIndex: number;
	highIndex: number;
	position: Position;
	values: NoteValue[];
	/**
	 * Notes the student has a way to answer. Restricting the fingerings on offer
	 * can leave gaps inside the range — a note nobody can finger is not a
	 * question worth asking.
	 */
	playable?: (index: number) => boolean;
}

// Build one random note that satisfies the given settings. Accidentals are never
// written in: the key signature carries them, so a note is always a plain letter.
export function randomNote(opts: GenerateOptions): Note {
	const { clef, lowIndex, highIndex, position, values, playable } = opts;

	// All diatonic positions in range that match the line/space filter. Asking
	// only for, say, notes on lines can rule out everything the student can
	// finger, and a note nobody can play is the worse question of the two — so
	// the line/space filter is what gives way.
	const candidates: number[] = [];
	const fallbacks: number[] = [];
	for (let i = lowIndex; i <= highIndex; i++) {
		if (playable && !playable(i)) continue;
		fallbacks.push(i);
		if (matchesPosition(stepsAboveBottom(clef, i), position)) candidates.push(i);
	}
	const index = candidates.length
		? pick(candidates)
		: fallbacks.length
			? pick(fallbacks)
			: lowIndex;
	const { letter, octave } = fromDiatonicIndex(index);

	const value = values.length ? pick(values) : 'whole';
	return { letter, octave, value };
}

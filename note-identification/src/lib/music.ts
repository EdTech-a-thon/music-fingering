// Core music model for the note-naming activity.
// Plain data + pure functions so the logic is easy to read and test.

export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type Accidental = 'natural' | 'sharp' | 'flat';
export type Position = 'both' | 'lines' | 'spaces';
export type NoteValue = 'whole' | 'half' | 'quarter';

export interface Note {
	letter: string; // 'A'..'G'
	octave: number; // scientific pitch octave, 4 = the octave of middle C
	explicit: Accidental | null; // an accidental printed beside this note, if any
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

// Even step = sits on a line; odd step = sits in a space.
function matchesPosition(step: number, position: Position): boolean {
	if (position === 'lines') return step % 2 === 0;
	if (position === 'spaces') return Math.abs(step % 2) === 1;
	return true;
}

// ---------------------------------------------------------------------------
// Key signatures
// ---------------------------------------------------------------------------
// A key signature is an integer: 0 = none, +n = n sharps, -n = n flats.

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export function keySignatureName(keySig: number): string {
	if (keySig === 0) return 'No key signature';
	const n = Math.abs(keySig);
	const kind = keySig > 0 ? 'sharp' : 'flat';
	return `${n} ${kind}${n > 1 ? 's' : ''}`;
}

// The letters that carry a sharp or flat in this key signature, in order.
export function keySignatureLetters(keySig: number): string[] {
	if (keySig === 0) return [];
	const order = keySig > 0 ? SHARP_ORDER : FLAT_ORDER;
	return order.slice(0, Math.abs(keySig));
}

// The accidental a bare note picks up from the key signature alone.
export function impliedAccidental(letter: string, keySig: number): Accidental {
	if (keySig > 0 && SHARP_ORDER.slice(0, keySig).includes(letter)) return 'sharp';
	if (keySig < 0 && FLAT_ORDER.slice(0, -keySig).includes(letter)) return 'flat';
	return 'natural';
}

// The accidental that actually sounds: an explicit one wins, otherwise the key.
export function effectiveAccidental(note: Note, keySig: number): Accidental {
	return note.explicit ?? impliedAccidental(note.letter, keySig);
}

// ---------------------------------------------------------------------------
// Generating a question
// ---------------------------------------------------------------------------

const SHARP_LETTERS = new Set(['C', 'D', 'F', 'G', 'A']); // avoid E#/B#
const FLAT_LETTERS = new Set(['D', 'E', 'G', 'A', 'B']); // avoid Cb/Fb

function pick<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

export interface GenerateOptions {
	clef: Clef;
	lowIndex: number;
	highIndex: number;
	position: Position;
	accidentals: boolean;
	values: NoteValue[];
}

// Build one random note that satisfies the given settings. The key signature is
// not needed here — it only affects the correct answer, applied later.
export function randomNote(opts: GenerateOptions): Note {
	const { clef, lowIndex, highIndex, position, accidentals, values } = opts;

	// All diatonic positions in range that match the line/space filter.
	const candidates: number[] = [];
	for (let i = lowIndex; i <= highIndex; i++) {
		if (matchesPosition(stepsAboveBottom(clef, i), position)) candidates.push(i);
	}
	const index = candidates.length ? pick(candidates) : lowIndex;
	const { letter, octave } = fromDiatonicIndex(index);

	// An explicit accidental only appears when Accidentals is on, and only some
	// of the time so plenty of plain notes still show up.
	let explicit: Accidental | null = null;
	if (accidentals && Math.random() < 0.5) {
		const choices: Accidental[] = ['natural'];
		if (SHARP_LETTERS.has(letter)) choices.push('sharp');
		if (FLAT_LETTERS.has(letter)) choices.push('flat');
		explicit = pick(choices);
	}

	const value = values.length ? pick(values) : 'whole';
	return { letter, octave, explicit, value };
}

// ---------------------------------------------------------------------------
// Naming (Letters only, for now)
// ---------------------------------------------------------------------------

const ACCIDENTAL_SYMBOL: Record<Accidental, string> = {
	natural: '',
	sharp: '♯',
	flat: '♭'
};

// A short, stable id used to compare a chosen answer with the correct note.
export function answerId(letter: string, accidental: Accidental): string {
	return letter + (accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : '');
}

// The human-readable name shown on a button or as feedback, e.g. "F♯".
export function answerLabel(letter: string, accidental: Accidental): string {
	return letter + ACCIDENTAL_SYMBOL[accidental];
}

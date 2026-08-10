// Core music model for the note-naming activity.
// Everything here is plain data + pure functions so it is easy to read and test.

export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type Accidental = 'natural' | 'sharp' | 'flat';
export type LabelStyle = 'letters' | 'solfege';
export type RangeStyle = 'staff' | 'ledger';

export interface Note {
	letter: string; // 'A'..'G'
	octave: number; // scientific pitch octave, e.g. 4 for middle C
	accidental: Accidental;
}

// The musical alphabet, ordered so that one step up the staff = next letter.
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const CLEF_NAMES: Record<Clef, string> = {
	treble: 'Treble',
	bass: 'Bass',
	alto: 'Alto',
	tenor: 'Tenor'
};

// Fixed-do solfège syllable for each letter.
const SOLFEGE: Record<string, string> = {
	C: 'Do',
	D: 'Re',
	E: 'Mi',
	F: 'Fa',
	G: 'Sol',
	A: 'La',
	B: 'Ti'
};

// A "diatonic index" turns a letter+octave into a single number that increases
// by one for every line-or-space step up the staff. It ignores accidentals,
// because a sharp or flat never changes where a note sits on the staff.
export function diatonicIndex(letter: string, octave: number): number {
	return octave * 7 + LETTERS.indexOf(letter);
}

function fromDiatonicIndex(index: number): { letter: string; octave: number } {
	const octave = Math.floor(index / 7);
	const letter = LETTERS[index - octave * 7];
	return { letter, octave };
}

// The diatonic index of the note that sits on the bottom line of each clef.
export const BOTTOM_LINE: Record<Clef, number> = {
	treble: diatonicIndex('E', 4),
	bass: diatonicIndex('G', 2),
	alto: diatonicIndex('F', 3),
	tenor: diatonicIndex('D', 3)
};

// How many staff steps a note is above the bottom line (0 = bottom line).
export function stepsAboveBottom(clef: Clef, note: Note): number {
	return diatonicIndex(note.letter, note.octave) - BOTTOM_LINE[clef];
}

// Which staff steps we are willing to show, measured from the bottom line.
// "staff" keeps everything on the five lines; "ledger" adds a few ledger lines.
function rangeFor(range: RangeStyle): { min: number; max: number } {
	return range === 'staff' ? { min: 0, max: 8 } : { min: -3, max: 11 };
}

// Which accidentals we allow per letter, avoiding the awkward-for-beginners
// spellings (no E♯/B♯/C♭/F♭).
const SHARP_LETTERS = new Set(['C', 'D', 'F', 'G', 'A']);
const FLAT_LETTERS = new Set(['D', 'E', 'G', 'A', 'B']);

function pick<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

// Build one random note for the given settings.
export function randomNote(clef: Clef, range: RangeStyle, accidentals: boolean): Note {
	const { min, max } = rangeFor(range);
	const step = min + Math.floor(Math.random() * (max - min + 1));
	const { letter, octave } = fromDiatonicIndex(BOTTOM_LINE[clef] + step);

	let accidental: Accidental = 'natural';
	if (accidentals) {
		const choices: Accidental[] = ['natural'];
		if (SHARP_LETTERS.has(letter)) choices.push('sharp');
		if (FLAT_LETTERS.has(letter)) choices.push('flat');
		accidental = pick(choices);
	}
	return { letter, octave, accidental };
}

const ACCIDENTAL_SYMBOL: Record<Accidental, string> = {
	natural: '',
	sharp: '♯',
	flat: '♭'
};

// A short, stable id used to compare a chosen answer with the correct note.
export function noteId(letter: string, accidental: Accidental): string {
	return letter + (accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : '');
}

// The human-readable name shown on a button or as feedback.
export function noteLabel(letter: string, accidental: Accidental, labels: LabelStyle): string {
	const base = labels === 'solfege' ? SOLFEGE[letter] : letter;
	return base + ACCIDENTAL_SYMBOL[accidental];
}

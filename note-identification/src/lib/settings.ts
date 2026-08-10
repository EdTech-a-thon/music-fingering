// Turns the activity settings into URL text (for a shareable link) and back.

import type { Clef, LabelStyle, RangeStyle } from './music';

export interface Settings {
	clefs: Clef[];
	accidentals: boolean;
	labels: LabelStyle;
	range: RangeStyle;
	count: number; // number of questions in the challenge
}

const ALL_CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor'];

export const DEFAULT_SETTINGS: Settings = {
	clefs: ['treble'],
	accidentals: false,
	labels: 'letters',
	range: 'staff',
	count: 10
};

// Build the query string that encodes a challenge, e.g. "?clefs=treble,bass&count=10".
export function settingsToQuery(s: Settings): string {
	const params = new URLSearchParams();
	params.set('clefs', s.clefs.join(','));
	params.set('accidentals', s.accidentals ? '1' : '0');
	params.set('labels', s.labels);
	params.set('range', s.range);
	params.set('count', String(s.count));
	return params.toString();
}

// Read settings back out of a URL, falling back to defaults for anything missing.
export function settingsFromParams(params: URLSearchParams): Settings {
	const clefs = (params.get('clefs') ?? '')
		.split(',')
		.filter((c): c is Clef => ALL_CLEFS.includes(c as Clef));

	return {
		clefs: clefs.length ? clefs : DEFAULT_SETTINGS.clefs,
		accidentals: params.get('accidentals') === '1',
		labels: params.get('labels') === 'solfege' ? 'solfege' : 'letters',
		range: params.get('range') === 'ledger' ? 'ledger' : 'staff',
		count: clampCount(Number(params.get('count')))
	};
}

function clampCount(n: number): number {
	if (!Number.isFinite(n) || n < 1) return DEFAULT_SETTINGS.count;
	return Math.min(50, Math.round(n));
}

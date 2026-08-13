<script lang="ts">
	// Draws a five-line staff with a clef, optional helper labels, and
	// (optionally) one note to identify.
	import Clef from './Clef.svelte';
	import { ACCIDENTALS, ENGRAVING, NOTEHEADS, type Glyph } from './glyphs';
	import {
		BOTTOM_LINE,
		fromDiatonicIndex,
		KEY_SHARPS,
		noteLabel,
		SHARP_STEPS,
		stepsAboveBottom,
		diatonicIndex,
		type Clef as ClefType,
		type KeyId,
		type Note
	} from './music';

	let {
		clef,
		keySig = 'C',
		note = null,
		helpers = false,
		helperLow = 0,
		helperHigh = 0
	}: {
		clef: ClefType;
		keySig?: KeyId;
		note?: Note | null;
		helpers?: boolean;
		helperLow?: number;
		helperHigh?: number;
	} = $props();

	// Staff geometry. One "step" is a line-to-space move = half of lineGap.
	const lineGap = 14;
	const halfStep = lineGap / 2;
	const topLineY = 56;
	const bottomLineY = topLineY + 4 * lineGap; // 5 lines
	const height = bottomLineY + 56;

	// Helper labels live in a gutter added on the right, so the staff itself stays
	// put whether or not they are showing.
	const gutter = $derived(helpers ? 16 : 0);
	const staffLeft = 8;
	const staffRight = 232;
	const width = $derived(staffRight + 8 + gutter);
	const noteX = staffLeft + 152;

	const yForSteps = (steps: number) => bottomLineY - steps * halfStep;
	const yForIndex = (index: number) => yForSteps(stepsAboveBottom(clef, index));
	const lineYs = [0, 1, 2, 3, 4].map((i) => topLineY + i * lineGap);

	// A C clef spans the staff's four gaps and its glyph fills its 18×25 viewBox,
	// with the point marking middle C dead centre. The width has to keep that
	// 18:25 ratio — otherwise preserveAspectRatio shrinks the glyph to fit the
	// box and it no longer reaches the lines it should sit between.
	const cClefH = 4 * lineGap;
	const cClefW = (cClefH * 18) / 25;

	// Clef placement, tuned to sit correctly on the staff.
	const clefLayout: Record<ClefType, { dx: number; y: number; w: number; h: number }> = {
		treble: { dx: -2, y: topLineY - 18, w: 36, h: 108 },
		bass: { dx: 4, y: topLineY - 2, w: 30, h: 48 },
		// Middle C is the 3rd line for alto, the 4th for tenor; the glyph is
		// centred on it, so its top sits 2 gaps above that line.
		alto: { dx: 2, y: topLineY, w: cClefW, h: cClefH },
		tenor: { dx: 2, y: topLineY - lineGap, w: cClefW, h: cClefH }
	};
	const cl = $derived(clefLayout[clef]);
	const clefX = $derived(staffLeft + cl.dx);

	// The key signature, drawn between the clef and the note.
	const sharpGlyph = ACCIDENTALS.sharp;
	const sharpStep = (sharpGlyph.width + 0.25) * lineGap;
	const sigLeft = $derived(clefX + cl.w + 6);
	const keyAccidentals = $derived(
		KEY_SHARPS[keySig].map((letter, i) => ({
			letter,
			x: sigLeft + i * sharpStep,
			y: yForSteps(SHARP_STEPS[clef][i])
		}))
	);

	// Helper labels: the letter for each position, listed up the right-hand end of
	// the staff. Neighbours are only a half-gap apart vertically, so line and
	// space letters alternate between two columns. Space letters tuck inside the
	// staff, sitting in the gap between two lines; line letters step out past the
	// end, clear of the line they name. The zig-zag keeps them from crowding.
	const helperItems = $derived.by(() => {
		if (!helpers) return [];
		const lo = Math.max(helperLow, BOTTOM_LINE[clef] - 6);
		const hi = Math.min(helperHigh, BOTTOM_LINE[clef] + 14);
		const items: { text: string; x: number; y: number }[] = [];
		for (let i = lo; i <= hi; i++) {
			const onLine = stepsAboveBottom(clef, i) % 2 === 0;
			items.push({
				text: noteLabel(keySig, fromDiatonicIndex(i).letter),
				x: staffRight + (onLine ? 7 : -9),
				y: yForIndex(i)
			});
		}
		return items;
	});

	// The note itself. Bravura's outlines are measured in staff spaces, so
	// translating to the note's position and scaling by lineGap places them.
	const steps = $derived(
		note ? stepsAboveBottom(clef, diatonicIndex(note.letter, note.octave)) : 0
	);
	const noteY = $derived(yForSteps(steps));
	const head: Glyph = $derived(
		note?.value === 'whole'
			? NOTEHEADS.whole
			: note?.value === 'half'
				? NOTEHEADS.half
				: NOTEHEADS.black
	);
	const headWidth = $derived(head.width * lineGap);
	const headLeft = $derived(noteX - headWidth / 2);

	// Ledger lines run legerLineExtension past the head on either side.
	const ledgers = $derived.by(() => {
		const ys: number[] = [];
		if (steps >= 10) for (let s = 10; s <= steps; s += 2) ys.push(yForSteps(s));
		if (steps <= -2) for (let s = -2; s >= steps; s -= 2) ys.push(yForSteps(s));
		return ys;
	});
	const ledgerHalf = $derived(headWidth / 2 + ENGRAVING.legerLineExtension * lineGap);

	// A whole note has no stem. Others stem up, or down once the note reaches the
	// middle line, and meet the head at the anchor the font specifies.
	const stemDown = $derived(steps >= 4);
	const stem = $derived.by(() => {
		if (!note || note.value === 'whole') return null;
		const thickness = ENGRAVING.stemThickness * lineGap;
		const anchor = (stemDown ? head.stemDownNW : head.stemUpSE) ?? [0, 0];
		const near = noteY + anchor[1] * lineGap;
		const far = noteY + (stemDown ? 1 : -1) * ENGRAVING.stemLength * lineGap;
		return {
			x: headLeft + anchor[0] * lineGap - (stemDown ? 0 : thickness),
			y: Math.min(near, far),
			width: thickness,
			height: Math.abs(far - near)
		};
	});
</script>

<svg
	class="staff"
	viewBox="0 0 {width} {height}"
	role="img"
	aria-label={note ? 'A note on the staff to identify' : 'An empty staff'}
>
	{#each lineYs as y (y)}
		<line
			x1={staffLeft}
			y1={y}
			x2={staffRight}
			y2={y}
			class="stroke"
			stroke-width={ENGRAVING.staffLineThickness * lineGap}
		/>
	{/each}

	<Clef {clef} x={clefX} y={cl.y} width={cl.w} height={cl.h} />

	{#each keyAccidentals as a (a.letter)}
		<path class="fill" d={sharpGlyph.path} transform="translate({a.x} {a.y}) scale({lineGap})" />
	{/each}

	{#each helperItems as h (h.y)}
		<text x={h.x} y={h.y} class="helper" text-anchor="middle" dominant-baseline="central"
			>{h.text}</text
		>
	{/each}

	{#if note}
		{#each ledgers as y (y)}
			<line
				x1={noteX - ledgerHalf}
				y1={y}
				x2={noteX + ledgerHalf}
				y2={y}
				class="stroke"
				stroke-width={ENGRAVING.legerLineThickness * lineGap}
			/>
		{/each}

		{#if stem}
			<rect x={stem.x} y={stem.y} width={stem.width} height={stem.height} class="fill" />
		{/if}

		<path class="fill" d={head.path} transform="translate({headLeft} {noteY}) scale({lineGap})" />
	{/if}
</svg>

<style>
	.staff {
		display: block;
		width: 100%;
		height: auto;
		/* Lines, clef and note all draw in currentColor, so a caller can recolour
		   the whole staff by setting --staff-ink. */
		color: var(--staff-ink, #1a1a1a);
	}
	.stroke {
		stroke: currentColor;
	}
	.fill {
		fill: currentColor;
	}
	.helper {
		fill: #2563eb;
		font-size: 12px;
		font-weight: 700;
	}
</style>

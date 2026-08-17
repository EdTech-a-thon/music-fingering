<script lang="ts">
	// Picks the lowest and highest note of the practice range, shown on an
	// ordinary five-line staff with a few ledger lines' worth of room either side.
	import ClefGlyph from './Clef.svelte';
	import { ACCIDENTALS, ENGRAVING, NOTEHEADS } from './glyphs';
	import {
		accidentalSteps,
		BOTTOM_LINE,
		keyAccidental,
		keyLetters,
		RANGE_MARGIN,
		noteName,
		parseNoteName,
		stepsAboveBottom,
		type Clef as ClefType,
		type KeyId
	} from './music';

	let {
		clef,
		keySig = 'C',
		low,
		high,
		minNote,
		maxNote,
		onchange
	}: {
		clef: ClefType;
		keySig?: KeyId;
		low: string;
		high: string;
		/** Hard limits, used to keep an instrument inside what it can finger. */
		minNote?: string;
		maxNote?: string;
		onchange: (low: string, high: string) => void;
	} = $props();

	// Staff geometry, matching the exercise staff so the two look alike.
	const lineGap = 14;
	const halfStep = lineGap / 2;
	const pad = 20; // enough that the treble clef's tail is not clipped
	const topLineY = pad + RANGE_MARGIN * halfStep;
	const bottomLineY = topLineY + 4 * lineGap;
	const height = bottomLineY + RANGE_MARGIN * halfStep + pad;
	const width = 230;
	const staffLeft = 10;
	const staffRight = width - 10;
	const lineYs = [0, 1, 2, 3, 4].map((i) => topLineY + i * lineGap);

	// Clef placement, copied from the exercise staff (same line spacing). The C
	// clef's width must keep its viewBox's 18:25 ratio so it spans four gaps.
	const cClefH = 4 * lineGap;
	const cClefW = (cClefH * 18) / 25;
	const clefLayout: Record<ClefType, { dx: number; y: number; w: number; h: number }> = {
		treble: { dx: -2, y: topLineY - 18, w: 36, h: 108 },
		bass: { dx: 4, y: topLineY - 2, w: 30, h: 48 },
		alto: { dx: 2, y: topLineY, w: cClefW, h: cClefH },
		tenor: { dx: 2, y: topLineY - lineGap, w: cClefW, h: cClefH }
	};
	const cl = $derived(clefLayout[clef]);

	// The range may run from three ledger lines below the staff to three above,
	// and no further than the instrument (if any) can reach.
	const minIndex = $derived(
		Math.max(BOTTOM_LINE[clef] - RANGE_MARGIN, minNote ? parseNoteName(minNote) : -Infinity)
	);
	const maxIndex = $derived(
		Math.min(BOTTOM_LINE[clef] + 8 + RANGE_MARGIN, maxNote ? parseNoteName(maxNote) : Infinity)
	);
	const yForSteps = (steps: number) => bottomLineY - steps * halfStep;
	const yFor = (index: number) => yForSteps(stepsAboveBottom(clef, index));

	// The key signature, so the teacher picks a range against the staff the
	// student will actually read. Sharps or flats, drawn the same way the
	// exercise staff draws them.
	const sigGlyph = $derived(ACCIDENTALS[keyAccidental(keySig)]);
	const keyAccidentals = $derived.by(() => {
		const steps = accidentalSteps(keySig, clef);
		const gap = (sigGlyph.width + 0.25) * lineGap;
		return keyLetters(keySig).map((letter, i) => ({
			letter,
			x: staffLeft + cl.dx + cl.w + 6 + i * gap,
			y: yForSteps(steps[i])
		}));
	});

	const lowIndex = $derived(clamp(parseNoteName(low)));
	const highIndex = $derived(clamp(parseNoteName(high)));
	const lowX = 140;
	const highX = 180;

	function clamp(index: number): number {
		return Math.max(minIndex, Math.min(maxIndex, index));
	}

	// The markers are drawn as Bravura noteheads, like the exercise staff.
	const head = NOTEHEADS.black;
	const headWidth = head.width * lineGap;
	const ledgerHalf = headWidth / 2 + ENGRAVING.legerLineExtension * lineGap;

	// Ledger lines for a note sitting outside the five lines.
	function ledgers(index: number): number[] {
		const steps = stepsAboveBottom(clef, index);
		const ys: number[] = [];
		if (steps >= 10) for (let s = 10; s <= steps; s += 2) ys.push(yForSteps(s));
		if (steps <= -2) for (let s = -2; s >= steps; s -= 2) ys.push(yForSteps(s));
		return ys;
	}

	function setNote(endpoint: 'low' | 'high', index: number) {
		const next = clamp(index);
		if (endpoint === 'low') onchange(noteName(Math.min(next, highIndex)), high);
		else onchange(low, noteName(Math.max(next, lowIndex)));
	}

	function move(endpoint: 'low' | 'high', amount: number) {
		setNote(endpoint, (endpoint === 'low' ? lowIndex : highIndex) + amount);
	}

	function drag(endpoint: 'low' | 'high', event: PointerEvent) {
		const target = event.currentTarget as SVGRectElement;
		if (event.type === 'pointerdown') target.setPointerCapture(event.pointerId);
		const svg = target.ownerSVGElement;
		if (!svg) return;
		// Map the pointer back into viewBox units, then to the nearest step.
		const rect = svg.getBoundingClientRect();
		const y = ((event.clientY - rect.top) / rect.height) * height;
		const steps = Math.round((bottomLineY - y) / halfStep);
		setNote(endpoint, BOTTOM_LINE[clef] + steps);
	}
</script>

<div class="range-selector">
	<div class="range-controls">
		<div class="endpoint">
			<span class="endpoint-name">Lowest note</span>
			<button type="button" aria-label="Raise lowest note" onclick={() => move('low', 1)}>↑</button>
			<output>{noteName(lowIndex)}</output>
			<button type="button" aria-label="Lower lowest note" onclick={() => move('low', -1)}>↓</button
			>
		</div>
		<div class="endpoint">
			<span class="endpoint-name">Highest note</span>
			<button type="button" aria-label="Raise highest note" onclick={() => move('high', 1)}
				>↑</button
			>
			<output>{noteName(highIndex)}</output>
			<button type="button" aria-label="Lower highest note" onclick={() => move('high', -1)}
				>↓</button
			>
		</div>
	</div>

	<p class="instruction">Drag either note up or down on the staff, or use its arrows.</p>
	<div class="sheet">
		<svg
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label={`${clef} clef range from ${noteName(lowIndex)} to ${noteName(highIndex)}`}
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

			<ClefGlyph {clef} x={staffLeft + cl.dx} y={cl.y} width={cl.w} height={cl.h} />

			{#each keyAccidentals as a (a.letter)}
				<path
					class="accidental"
					d={sigGlyph.path}
					transform="translate({a.x} {a.y}) scale({lineGap})"
				/>
			{/each}

			{#each [{ x: lowX, index: lowIndex, end: 'low' as const }, { x: highX, index: highIndex, end: 'high' as const }] as note (note.end)}
				<g class="note" transform={`translate(${note.x} ${yFor(note.index)})`}>
					{#each ledgers(note.index) as y (y)}
						<line
							x1={-ledgerHalf}
							y1={y - yFor(note.index)}
							x2={ledgerHalf}
							y2={y - yFor(note.index)}
							class="stroke"
							stroke-width={ENGRAVING.legerLineThickness * lineGap}
						/>
					{/each}
					<path d={head.path} transform="translate({-headWidth / 2} 0) scale({lineGap})" />
					<rect
						x="-16"
						y="-14"
						width="32"
						height="28"
						fill="transparent"
						role="presentation"
						onpointerdown={(e) => drag(note.end, e)}
						onpointermove={(e) => e.buttons === 1 && drag(note.end, e)}
					/>
				</g>
			{/each}
		</svg>
	</div>
</div>

<style>
	.range-selector {
		max-width: 26rem;
	}
	.range-controls {
		display: flex;
		gap: 0.65rem;
		margin-bottom: 0.6rem;
	}
	.endpoint {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(3, auto);
		gap: 0.25rem;
		align-items: center;
	}
	.endpoint-name {
		grid-column: 1 / -1;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.endpoint button {
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
	}
	.endpoint output {
		min-width: 2.5rem;
		text-align: center;
		font-weight: 800;
	}
	.instruction {
		margin: 0 0 0.55rem;
		color: #555;
		font-size: 0.82rem;
	}
	.sheet {
		border: 1px solid var(--border);
		border-radius: 10px;
		background: #fff;
	}
	.sheet svg {
		display: block;
		width: 100%;
		color: #1a1a1a;
	}
	.stroke {
		stroke: currentColor;
	}
	.accidental {
		fill: currentColor;
	}
	.note {
		cursor: ns-resize;
		touch-action: none;
	}
	.note path {
		fill: currentColor;
	}
</style>

<script lang="ts">
	// Draws a five-line staff with a clef and (optionally) one note to identify.
	import Clef from './Clef.svelte';
	import { stepsAboveBottom, type Clef as ClefType, type Note } from './music';

	let { clef, note = null }: { clef: ClefType; note?: Note | null } = $props();

	// Staff geometry. One "step" is a line-to-space move = half of lineGap.
	const lineGap = 14;
	const halfStep = lineGap / 2;
	const staffLeft = 8;
	const width = 240;
	const staffRight = width - 8;
	const topLineY = 56;
	const bottomLineY = topLineY + 4 * lineGap; // 5 lines
	const height = bottomLineY + 56;
	const noteX = 168;

	// y position of a given number of steps above the bottom line.
	const yForSteps = (steps: number) => bottomLineY - steps * halfStep;

	const lineYs = [0, 1, 2, 3, 4].map((i) => topLineY + i * lineGap);

	// Where and how big to draw each clef, tuned to sit correctly on the staff.
	const clefLayout: Record<ClefType, { x: number; y: number; w: number; h: number }> = {
		treble: { x: 6, y: topLineY - 18, w: 36, h: 108 },
		bass: { x: 12, y: topLineY - 2, w: 30, h: 48 },
		alto: { x: 10, y: topLineY, w: 30, h: 4 * lineGap },
		tenor: { x: 10, y: topLineY - 2 * lineGap, w: 30, h: 4 * lineGap }
	};
	const cl = $derived(clefLayout[clef]);

	const steps = $derived(note ? stepsAboveBottom(clef, note) : 0);
	const noteY = $derived(yForSteps(steps));

	// Ledger lines needed above/below the staff for this note.
	const ledgers = $derived.by(() => {
		const ys: number[] = [];
		if (steps >= 10) for (let s = 10; s <= steps; s += 2) ys.push(yForSteps(s));
		if (steps <= -2) for (let s = -2; s >= steps; s -= 2) ys.push(yForSteps(s));
		return ys;
	});

	const noteRx = lineGap * 0.62;
	const noteRy = lineGap * 0.44;
	const accidental = $derived(note?.accidental ?? 'natural');
	const accidentalSymbol = $derived(
		accidental === 'sharp' ? '♯' : accidental === 'flat' ? '♭' : ''
	);
</script>

<svg
	class="staff"
	viewBox="0 0 {width} {height}"
	role="img"
	aria-label={note ? 'A note on the staff to identify' : 'An empty staff'}
>
	<!-- staff lines -->
	{#each lineYs as y (y)}
		<line x1={staffLeft} y1={y} x2={staffRight} y2={y} class="stroke" stroke-width="1.4" />
	{/each}

	<Clef {clef} x={cl.x} y={cl.y} width={cl.w} height={cl.h} />

	{#if note}
		<!-- ledger lines -->
		{#each ledgers as y (y)}
			<line
				x1={noteX - noteRx - 6}
				y1={y}
				x2={noteX + noteRx + 6}
				y2={y}
				class="stroke"
				stroke-width="1.4"
			/>
		{/each}

		<!-- notehead (tilted like real notation) -->
		<ellipse
			cx={noteX}
			cy={noteY}
			rx={noteRx}
			ry={noteRy}
			class="fill"
			transform="rotate(-20 {noteX} {noteY})"
		/>

		{#if accidentalSymbol}
			<text
				x={noteX - noteRx - 8}
				y={noteY}
				class="fill accidental"
				text-anchor="middle"
				dominant-baseline="central">{accidentalSymbol}</text
			>
		{/if}
	{/if}
</svg>

<style>
	.staff {
		display: block;
		width: 100%;
		height: auto;
		color: #1a1a1a;
	}
	.stroke {
		stroke: currentColor;
	}
	.fill {
		fill: currentColor;
	}
	.accidental {
		font-size: 30px;
		font-family: 'Times New Roman', serif;
	}
</style>

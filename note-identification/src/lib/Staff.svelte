<script lang="ts">
	// Draws a five-line staff with a clef, an optional key signature, optional
	// helper labels, and (optionally) one note to identify.
	import Clef from './Clef.svelte';
	import {
		BOTTOM_LINE,
		fromDiatonicIndex,
		impliedAccidental,
		keySignatureLetters,
		stepsAboveBottom,
		diatonicIndex,
		type Clef as ClefType,
		type Note
	} from './music';

	let {
		clef,
		note = null,
		keySig = 0,
		helpers = false,
		helperLow = 0,
		helperHigh = 0
	}: {
		clef: ClefType;
		note?: Note | null;
		keySig?: number;
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

	const gutter = $derived(helpers ? 22 : 0);
	const staffLeft = $derived(8 + gutter);
	const width = $derived(240 + gutter);
	const staffRight = $derived(width - 8);
	const noteX = $derived(staffLeft + 152);

	const yForSteps = (steps: number) => bottomLineY - steps * halfStep;
	const yForIndex = (index: number) => yForSteps(stepsAboveBottom(clef, index));
	const lineYs = [0, 1, 2, 3, 4].map((i) => topLineY + i * lineGap);

	// Clef placement, tuned to sit correctly on the staff.
	const clefLayout: Record<ClefType, { dx: number; y: number; w: number; h: number }> = {
		treble: { dx: -2, y: topLineY - 18, w: 36, h: 108 },
		bass: { dx: 4, y: topLineY - 2, w: 30, h: 48 },
		alto: { dx: 2, y: topLineY, w: 30, h: 4 * lineGap },
		tenor: { dx: 2, y: topLineY - 2 * lineGap, w: 30, h: 4 * lineGap }
	};
	const cl = $derived(clefLayout[clef]);
	const clefX = $derived(staffLeft + cl.dx);

	// Key signature: each accidental placed near the middle of the staff.
	const middleIndex = $derived(BOTTOM_LINE[clef] + 4);
	const keySigItems = $derived.by(() => {
		const letters = keySignatureLetters(keySig);
		const symbol = keySig > 0 ? '♯' : '♭';
		const startX = clefX + cl.w + 4;
		return letters.map((letter, i) => {
			// choose the octave that puts this letter closest to the middle line
			const base = fromDiatonicIndex(middleIndex);
			let index = diatonicIndex(letter, base.octave);
			for (const cand of [index - 7, index, index + 7]) {
				if (Math.abs(cand - middleIndex) < Math.abs(index - middleIndex)) index = cand;
			}
			return { symbol, x: startX + i * 9, y: yForIndex(index) };
		});
	});

	// Helper labels down the left gutter (key-adjusted letter for each position).
	const helperItems = $derived.by(() => {
		if (!helpers) return [];
		const lo = Math.max(helperLow, BOTTOM_LINE[clef] - 6);
		const hi = Math.min(helperHigh, BOTTOM_LINE[clef] + 14);
		const items: { text: string; y: number }[] = [];
		for (let i = lo; i <= hi; i++) {
			const { letter } = fromDiatonicIndex(i);
			const acc = impliedAccidental(letter, keySig);
			const sym = acc === 'sharp' ? '♯' : acc === 'flat' ? '♭' : '';
			items.push({ text: letter + sym, y: yForIndex(i) });
		}
		return items;
	});

	// The note itself.
	const steps = $derived(
		note ? stepsAboveBottom(clef, diatonicIndex(note.letter, note.octave)) : 0
	);
	const noteY = $derived(yForSteps(steps));
	const noteRx = lineGap * 0.62;
	const noteRy = lineGap * 0.44;

	const ledgers = $derived.by(() => {
		const ys: number[] = [];
		if (steps >= 10) for (let s = 10; s <= steps; s += 2) ys.push(yForSteps(s));
		if (steps <= -2) for (let s = -2; s >= steps; s -= 2) ys.push(yForSteps(s));
		return ys;
	});

	const explicitSymbol = $derived(
		note?.explicit === 'sharp' ? '♯' : note?.explicit === 'flat' ? '♭' : ''
	);

	// Note value → open/filled head and stem.
	const isOpen = $derived(note?.value === 'whole' || note?.value === 'half');
	const hasStem = $derived(note?.value === 'half' || note?.value === 'quarter');
	const stemDown = $derived(steps >= 4);
	const stemLen = 3.5 * lineGap;
</script>

<svg
	class="staff"
	viewBox="0 0 {width} {height}"
	role="img"
	aria-label={note ? 'A note on the staff to identify' : 'An empty staff'}
>
	{#each lineYs as y (y)}
		<line x1={staffLeft} y1={y} x2={staffRight} y2={y} class="stroke" stroke-width="1.4" />
	{/each}

	<Clef {clef} x={clefX} y={cl.y} width={cl.w} height={cl.h} />

	{#each keySigItems as k (k.x)}
		<text x={k.x} y={k.y} class="fill keysig" text-anchor="middle" dominant-baseline="central"
			>{k.symbol}</text
		>
	{/each}

	{#each helperItems as h (h.y)}
		<text x={staffLeft - 6} y={h.y} class="helper" text-anchor="end" dominant-baseline="central"
			>{h.text}</text
		>
	{/each}

	{#if note}
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

		{#if hasStem}
			{#if stemDown}
				<line
					x1={noteX - noteRx + 0.7}
					y1={noteY}
					x2={noteX - noteRx + 0.7}
					y2={noteY + stemLen}
					class="stroke"
					stroke-width="1.6"
				/>
			{:else}
				<line
					x1={noteX + noteRx - 0.7}
					y1={noteY}
					x2={noteX + noteRx - 0.7}
					y2={noteY - stemLen}
					class="stroke"
					stroke-width="1.6"
				/>
			{/if}
		{/if}

		<ellipse
			cx={noteX}
			cy={noteY}
			rx={noteRx}
			ry={noteRy}
			class={isOpen ? 'open' : 'fill'}
			transform="rotate(-20 {noteX} {noteY})"
		/>

		{#if explicitSymbol}
			<text
				x={noteX - noteRx - 8}
				y={noteY}
				class="fill accidental"
				text-anchor="middle"
				dominant-baseline="central">{explicitSymbol}</text
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
	.open {
		fill: #fff;
		stroke: currentColor;
		stroke-width: 1.8;
	}
	.accidental {
		font-size: 30px;
		font-family: 'Times New Roman', serif;
	}
	.keysig {
		font-size: 24px;
		font-family: 'Times New Roman', serif;
	}
	.helper {
		fill: #2563eb;
		font-size: 11px;
		font-weight: 600;
	}
</style>

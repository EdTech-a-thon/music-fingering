<script lang="ts">
	import ClefGlyph from './Clef.svelte';
	import {
		BOTTOM_LINE,
		diatonicIndex,
		noteName,
		parseNoteName,
		type Clef as ClefType
	} from './music';

	let {
		clef,
		low,
		high,
		onchange
	}: { clef: ClefType; low: string; high: string; onchange: (low: string, high: string) => void } =
		$props();

	const minIndex = diatonicIndex('C', 2);
	const maxIndex = diatonicIndex('C', 7);
	const step = 9;
	const staffLeft = 28;
	const staffRight = 202;
	const top = 18;
	const height = top * 2 + (maxIndex - minIndex) * step;
	const yFor = (index: number) => top + (maxIndex - index) * step;
	const lowIndex = $derived(parseNoteName(low));
	const highIndex = $derived(parseNoteName(high));
	const staffLineIndices = $derived.by(() => {
		const bottom = BOTTOM_LINE[clef];
		const lines: number[] = [];
		for (let index = bottom; index <= maxIndex; index += 2) lines.push(index);
		for (let index = bottom - 2; index >= minIndex; index -= 2) lines.push(index);
		return lines;
	});

	function setNote(endpoint: 'low' | 'high', index: number) {
		const next = Math.max(minIndex, Math.min(maxIndex, index));
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
		const rect = svg.getBoundingClientRect();
		const index = Math.round(
			maxIndex - ((event.clientY - rect.top) / rect.height) * (maxIndex - minIndex)
		);
		setNote(endpoint, index);
	}
</script>

<div class="range-selector">
	<div class="range-controls">
		<div class="endpoint low">
			<span class="endpoint-name">Start note</span>
			<button type="button" aria-label="Raise start note" onclick={() => move('low', 1)}>↑</button>
			<output>{low}</output>
			<button type="button" aria-label="Lower start note" onclick={() => move('low', -1)}>↓</button>
		</div>
		<div class="endpoint high">
			<span class="endpoint-name">End note</span>
			<button type="button" aria-label="Raise end note" onclick={() => move('high', 1)}>↑</button>
			<output>{high}</output>
			<button type="button" aria-label="Lower end note" onclick={() => move('high', -1)}>↓</button>
		</div>
	</div>

	<p class="instruction">Drag either colored note up or down on the staff, or use its arrows.</p>
	<div class="sheet" style:height={`${height}px`}>
		<svg
			viewBox={`0 0 230 ${height}`}
			role="img"
			aria-label={`${clef} clef range from ${low} to ${high}`}
		>
			{#each staffLineIndices as index (index)}
				<line x1={staffLeft} y1={yFor(index)} x2={staffRight} y2={yFor(index)} class="staff-line" />
			{/each}
			<ClefGlyph {clef} x={32} y={yFor(BOTTOM_LINE[clef] + 4) - 28} width={25} height={56} />

			<g class="note low-note" transform={`translate(132 ${yFor(lowIndex)})`}>
				<ellipse rx="9" ry="6" transform="rotate(-20)" />
				<text x="17" y="4">Start</text>
				<rect
					x="-16"
					y="-14"
					width="32"
					height="28"
					fill="transparent"
					role="presentation"
					onpointerdown={(e) => drag('low', e)}
					onpointermove={(e) => e.buttons === 1 && drag('low', e)}
				/>
			</g>
			<g class="note high-note" transform={`translate(172 ${yFor(highIndex)})`}>
				<ellipse rx="9" ry="6" transform="rotate(-20)" />
				<text x="17" y="4">End</text>
				<rect
					x="-16"
					y="-14"
					width="32"
					height="28"
					fill="transparent"
					role="presentation"
					onpointerdown={(e) => drag('high', e)}
					onpointermove={(e) => e.buttons === 1 && drag('high', e)}
				/>
			</g>
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
	.low output {
		color: #b45309;
	}
	.high output {
		color: #2563eb;
	}
	.instruction {
		margin: 0 0 0.55rem;
		color: #555;
		font-size: 0.82rem;
	}
	.sheet {
		max-height: 22rem;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: #fff;
	}
	.sheet svg {
		display: block;
		width: 100%;
		min-width: 15rem;
	}
	.staff-line {
		stroke: #c9ccd3;
		stroke-width: 1;
	}
	.note {
		cursor: ns-resize;
		touch-action: none;
	}
	.note ellipse {
		fill: currentColor;
	}
	.note text {
		fill: currentColor;
		font:
			700 10px system-ui,
			sans-serif;
	}
	.low-note {
		color: #b45309;
	}
	.high-note {
		color: #2563eb;
	}
</style>

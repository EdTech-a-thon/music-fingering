<script lang="ts">
	// The student's view: shows a note, collects an answer, gives feedback,
	// and reports a score at the end. Used both in the live preview and on the
	// stand-alone challenge page.
	import Staff from './Staff.svelte';
	import { randomNote, noteId, noteLabel, type Accidental, type Clef, type Note } from './music';
	import type { Settings } from './settings';

	let { settings }: { settings: Settings } = $props();

	const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
	const ACCIDENTALS: Accidental[] = ['flat', 'natural', 'sharp'];
	const ACC_SYMBOL: Record<Accidental, string> = { flat: '♭', natural: '♮', sharp: '♯' };

	let index = $state(0);
	let score = $state(0);
	let current = $state<{ clef: Clef; note: Note }>(newQuestion());
	let pendingAccidental = $state<Accidental>('natural');
	let answered = $state<{ chosenId: string; correct: boolean } | null>(null);
	let phase = $state<'playing' | 'done'>('playing');
	let startTime = Date.now();
	let elapsedMs = $state(0);

	function newQuestion() {
		const clef = settings.clefs[Math.floor(Math.random() * settings.clefs.length)];
		const note = randomNote(clef, settings.range, settings.accidentals);
		return { clef, note };
	}

	const correctId = $derived(noteId(current.note.letter, current.note.accidental));

	function choose(letter: string) {
		if (answered) return;
		const chosenId = noteId(letter, pendingAccidental);
		const correct = chosenId === correctId;
		if (correct) score += 1;
		answered = { chosenId, correct };
	}

	function next() {
		if (index + 1 >= settings.count) {
			elapsedMs = Date.now() - startTime;
			phase = 'done';
			return;
		}
		index += 1;
		current = newQuestion();
		pendingAccidental = 'natural';
		answered = null;
	}

	function restart() {
		index = 0;
		score = 0;
		current = newQuestion();
		pendingAccidental = 'natural';
		answered = null;
		phase = 'playing';
		startTime = Date.now();
	}

	// Note: callers remount this component (via {#key}) when settings change,
	// so it always starts fresh with the latest settings.

	const accuracy = $derived(settings.count ? Math.round((score / settings.count) * 100) : 0);
	const seconds = $derived(Math.round(elapsedMs / 1000));
</script>

<div class="exercise">
	{#if phase === 'playing'}
		<div class="statusbar">
			<span>Question {index + 1} of {settings.count}</span>
			<span>Score {score}</span>
		</div>

		<div class="staff-wrap">
			<Staff clef={current.clef} note={current.note} />
		</div>

		<div class="prompt">
			{#if answered}
				{#if answered.correct}
					<span class="good">Correct!</span>
				{:else}
					<span class="bad"
						>Not quite — it was
						{noteLabel(current.note.letter, current.note.accidental, settings.labels)}</span
					>
				{/if}
			{:else}
				<span>Name this note</span>
			{/if}
		</div>

		{#if settings.accidentals}
			<div class="accidentals" role="group" aria-label="Accidental">
				{#each ACCIDENTALS as acc (acc)}
					<button
						type="button"
						class="acc"
						class:selected={pendingAccidental === acc}
						disabled={!!answered}
						onclick={() => (pendingAccidental = acc)}
					>
						{ACC_SYMBOL[acc]}
					</button>
				{/each}
			</div>
		{/if}

		<div class="letters">
			{#each LETTERS as letter (letter)}
				{@const thisId = noteId(letter, pendingAccidental)}
				<button
					type="button"
					class="letter"
					class:right={answered && thisId === correctId}
					class:wrong={answered && answered.chosenId === thisId && !answered.correct}
					disabled={!!answered}
					onclick={() => choose(letter)}
				>
					{noteLabel(letter, pendingAccidental, settings.labels)}
				</button>
			{/each}
		</div>

		<div class="actions">
			<button type="button" class="next" disabled={!answered} onclick={next}>
				{index + 1 >= settings.count ? 'Finish' : 'Next note'}
			</button>
		</div>
	{:else}
		<div class="results">
			<h2>All done!</h2>
			<p class="bigscore">{score} / {settings.count}</p>
			<p class="detail">{accuracy}% correct · {seconds}s</p>
			<button type="button" class="next" onclick={restart}>Try again</button>
		</div>
	{/if}
</div>

<style>
	.exercise {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 32rem;
		margin: 0 auto;
	}
	.statusbar {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		color: #555;
		font-weight: 600;
	}
	.staff-wrap {
		background: #fff;
		border: 1px solid #e5e5e5;
		border-radius: 12px;
		padding: 0.75rem 1rem;
	}
	.prompt {
		text-align: center;
		min-height: 1.6rem;
		font-size: 1.05rem;
	}
	.good {
		color: #16794a;
		font-weight: 700;
	}
	.bad {
		color: #b3261e;
		font-weight: 700;
	}
	.accidentals {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}
	.acc {
		width: 3rem;
		height: 2.75rem;
		font-size: 1.4rem;
		border: 1px solid #ccc;
		border-radius: 10px;
		background: #fafafa;
		cursor: pointer;
	}
	.acc.selected {
		background: #1f2937;
		color: #fff;
		border-color: #1f2937;
	}
	.letters {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}
	.letter {
		padding: 0.9rem 0;
		font-size: 1.15rem;
		font-weight: 600;
		border: 1px solid #ccc;
		border-radius: 10px;
		background: #fafafa;
		cursor: pointer;
	}
	.letter:hover:not(:disabled) {
		background: #eef2ff;
		border-color: #a5b4fc;
	}
	.letter.right {
		background: #d7f0e2;
		border-color: #16794a;
		color: #0f5132;
	}
	.letter.wrong {
		background: #fbdedb;
		border-color: #b3261e;
		color: #842029;
	}
	button:disabled {
		cursor: default;
		opacity: 0.85;
	}
	.actions {
		display: flex;
		justify-content: center;
	}
	.next {
		padding: 0.7rem 1.6rem;
		font-size: 1rem;
		font-weight: 600;
		border: none;
		border-radius: 10px;
		background: #4f46e5;
		color: #fff;
		cursor: pointer;
	}
	.next:disabled {
		background: #c7c9d9;
		cursor: default;
	}
	.results {
		text-align: center;
		background: #fff;
		border: 1px solid #e5e5e5;
		border-radius: 12px;
		padding: 2rem 1rem;
	}
	.bigscore {
		font-size: 2.5rem;
		font-weight: 800;
		margin: 0.5rem 0 0.25rem;
	}
	.detail {
		color: #555;
		margin-bottom: 1.25rem;
	}
</style>

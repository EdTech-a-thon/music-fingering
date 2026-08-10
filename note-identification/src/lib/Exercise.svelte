<script lang="ts">
	// The student's view. In Challenge Mode it runs: ready → running → results
	// (with a progress report). Without a challenge limit it's endless practice.
	import { onDestroy } from 'svelte';
	import Staff from './Staff.svelte';
	import ProgressReport from './ProgressReport.svelte';
	import {
		randomNote,
		answerId,
		answerLabel,
		effectiveAccidental,
		parseNoteName,
		type Accidental,
		type Clef,
		type Note
	} from './music';
	import { isChallengeMode, settingsToQuery, type Settings } from './settings';

	let { settings }: { settings: Settings } = $props();

	const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
	const ACCIDENTALS: Accidental[] = ['flat', 'natural', 'sharp'];
	const ACC_SYMBOL: Record<Accidental, string> = { flat: '♭', natural: '♮', sharp: '♯' };

	const challenge = $derived(isChallengeMode(settings));
	// A key signature (or accidentals) means answers can need a sharp/flat.
	const needsAccidental = $derived(
		settings.accidentals || settings.keySignatures.some((k) => k !== 0)
	);

	// Range as diatonic indices (low ≤ high).
	const lowIndex = $derived(
		Math.min(parseNoteName(settings.rangeLow), parseNoteName(settings.rangeHigh))
	);
	const highIndex = $derived(
		Math.max(parseNoteName(settings.rangeLow), parseNoteName(settings.rangeHigh))
	);

	function pick<T>(items: T[]): T {
		return items[Math.floor(Math.random() * items.length)];
	}

	function newQuestion(): { clef: Clef; note: Note; keySig: number } {
		const clef = pick(settings.clefs);
		const keySig = pick(settings.keySignatures);
		const note = randomNote({
			clef,
			lowIndex,
			highIndex,
			position: settings.positions,
			accidentals: settings.accidentals,
			values: settings.noteValues
		});
		return { clef, note, keySig };
	}

	// --- run state ---
	let phase = $state<'ready' | 'running' | 'done'>(isChallengeMode(settings) ? 'ready' : 'running');
	let current = $state(newQuestion());
	let pendingAccidental = $state<Accidental>('natural');
	let wrongIds = $state<string[]>([]);
	let locked = $state(false);
	let correct = $state(0);
	let attempted = $state(0);
	let completed = $state(0);
	let startTime = Date.now();
	let elapsedMs = $state(0);
	let isHighScore = $state(false);
	let showReport = $state(false);

	let ticker: ReturnType<typeof setInterval> | undefined;
	let revealTimer: ReturnType<typeof setTimeout> | undefined;

	const correctId = $derived(
		answerId(current.note.letter, effectiveAccidental(current.note, current.keySig))
	);
	const percent = $derived(attempted ? Math.round((correct / attempted) * 100) : 0);
	const timeLimitMs = $derived(settings.timeLimitMin * 60000);
	const remainingMs = $derived(Math.max(0, timeLimitMs - elapsedMs));

	function start() {
		clearTimeout(revealTimer);
		correct = 0;
		attempted = 0;
		completed = 0;
		wrongIds = [];
		locked = false;
		pendingAccidental = 'natural';
		isHighScore = false;
		showReport = false;
		current = newQuestion();
		startTime = Date.now();
		elapsedMs = 0;
		phase = 'running';
		clearInterval(ticker);
		ticker = setInterval(() => {
			elapsedMs = Date.now() - startTime;
			if (settings.timeLimitMin > 0 && elapsedMs >= timeLimitMs) finish();
		}, 250);
	}

	function nextQuestion() {
		wrongIds = [];
		locked = false;
		pendingAccidental = 'natural';
		current = newQuestion();
	}

	// A question is finished (right, or wrong under single-attempt): tally it and
	// either move on or end the run.
	function completeQuestion() {
		completed += 1;
		if (settings.questionLimit > 0 && completed >= settings.questionLimit) {
			finish();
		} else {
			nextQuestion();
		}
	}

	function choose(letter: string) {
		if (locked || phase !== 'running') return;
		const chosenId = answerId(letter, pendingAccidental);
		attempted += 1;

		if (chosenId === correctId) {
			correct += 1;
			locked = true;
			revealTimer = setTimeout(completeQuestion, 350);
			return;
		}

		wrongIds = [...wrongIds, chosenId];
		if (!settings.multipleAttempts) {
			locked = true; // reveal the correct answer briefly, then move on
			revealTimer = setTimeout(completeQuestion, 1000);
		}
		// with multiple attempts we stay on the same question to try again
	}

	function finish() {
		clearInterval(ticker);
		clearTimeout(revealTimer);
		elapsedMs = Date.now() - startTime;
		locked = true;
		phase = 'done';
		recordHighScore();
	}

	function recordHighScore() {
		const pct = attempted ? correct / attempted : 0;
		const key = 'noteid:hs:' + settingsToQuery(settings);
		try {
			const prev = Number(localStorage.getItem(key));
			if (!Number.isFinite(prev) || pct > prev) {
				isHighScore = true;
				localStorage.setItem(key, String(pct));
			}
		} catch {
			isHighScore = false;
		}
	}

	onDestroy(() => {
		clearInterval(ticker);
		clearTimeout(revealTimer);
	});

	function formatTime(ms: number): string {
		const total = Math.round(ms / 1000);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="exercise">
	{#if phase === 'ready'}
		<div class="gate">
			<h2>Ready to start</h2>
			<p class="gate-sub">
				{#if settings.questionLimit > 0 && settings.timeLimitMin > 0}
					{settings.questionLimit} questions or {settings.timeLimitMin} minutes — whichever comes first.
				{:else if settings.questionLimit > 0}
					{settings.questionLimit} questions.
				{:else}
					{settings.timeLimitMin} minute{settings.timeLimitMin === 1 ? '' : 's'}.
				{/if}
				The clock and score start when you press Start.
			</p>
			<div class="staff-wrap muted">
				<Staff
					clef={current.clef}
					keySig={current.keySig}
					helpers={settings.helpers}
					helperLow={lowIndex}
					helperHigh={highIndex}
					note={current.note}
				/>
			</div>
			<button type="button" class="btn-primary big" onclick={start}>Start Challenge</button>
		</div>
	{:else if phase === 'running'}
		<div class="statusbar">
			<div class="score">
				<strong>{correct}/{attempted}</strong>
				<span class="pct">{percent}%</span>
			</div>
			<div class="progress">
				{#if settings.questionLimit > 0}
					<span
						>Question {Math.min(completed + 1, settings.questionLimit)} of {settings.questionLimit}</span
					>
				{/if}
				{#if settings.timeLimitMin > 0}
					<span class="clock">{formatTime(remainingMs)}</span>
				{/if}
			</div>
		</div>

		<div class="staff-wrap">
			<Staff
				clef={current.clef}
				keySig={current.keySig}
				helpers={settings.helpers}
				helperLow={lowIndex}
				helperHigh={highIndex}
				note={current.note}
			/>
		</div>

		<div class="prompt">
			{#if locked && wrongIds.length}
				<span class="bad"
					>It was {answerLabel(
						current.note.letter,
						effectiveAccidental(current.note, current.keySig)
					)}</span
				>
			{:else}
				<span>Name this note</span>
			{/if}
		</div>

		{#if needsAccidental}
			<div class="accidentals" role="group" aria-label="Accidental">
				{#each ACCIDENTALS as acc (acc)}
					<button
						type="button"
						class="acc"
						class:selected={pendingAccidental === acc}
						disabled={locked}
						onclick={() => (pendingAccidental = acc)}
					>
						{ACC_SYMBOL[acc]}
					</button>
				{/each}
			</div>
		{/if}

		<div class="letters">
			{#each LETTERS as letter (letter)}
				{@const thisId = answerId(letter, pendingAccidental)}
				<button
					type="button"
					class="letter"
					class:right={locked && thisId === correctId}
					class:wrong={wrongIds.includes(thisId)}
					disabled={locked || wrongIds.includes(thisId)}
					onclick={() => choose(letter)}
				>
					{answerLabel(letter, pendingAccidental)}
				</button>
			{/each}
		</div>

		{#if !challenge}
			<div class="practice-actions">
				<button type="button" class="btn-ghost" onclick={start}>Restart</button>
			</div>
		{/if}
	{:else}
		<div class="results">
			<h2 class:high={isHighScore}>{isHighScore ? 'New High Score!' : 'Challenge complete'}</h2>
			<p class="bigscore">{correct}/{attempted}</p>
			<p class="detail">{percent}% correct · {formatTime(elapsedMs)}</p>
			<div class="result-actions">
				<button type="button" class="btn-ghost" onclick={() => (showReport = true)}
					>View Report</button
				>
				<button type="button" class="btn-primary" onclick={start}>Start Challenge</button>
			</div>
		</div>
	{/if}
</div>

{#if showReport}
	<ProgressReport
		{settings}
		{correct}
		{attempted}
		{elapsedMs}
		{isHighScore}
		onClose={() => (showReport = false)}
	/>
{/if}

<style>
	.exercise {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 32rem;
		margin: 0 auto;
	}
	.staff-wrap {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
	}
	.muted {
		opacity: 0.85;
	}
	.statusbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
	}
	.score strong {
		font-size: 1.15rem;
	}
	.pct {
		color: var(--blue);
		font-weight: 700;
		margin-left: 0.5rem;
	}
	.progress {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		color: #555;
		font-weight: 600;
	}
	.clock {
		font-variant-numeric: tabular-nums;
		background: var(--blue-soft);
		color: var(--blue-dark);
		padding: 0.1rem 0.5rem;
		border-radius: 6px;
	}
	.prompt {
		text-align: center;
		min-height: 1.6rem;
		font-size: 1.05rem;
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
		border: 1px solid var(--border);
		border-radius: 10px;
		background: #fff;
		cursor: pointer;
	}
	.acc.selected {
		background: var(--blue);
		color: #fff;
		border-color: var(--blue);
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
		border: 1px solid var(--border);
		border-radius: 10px;
		background: #fff;
		cursor: pointer;
		transition: background 0.1s;
	}
	.letter:hover:not(:disabled) {
		background: var(--blue-soft);
		border-color: var(--blue);
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
	}
	.gate,
	.results {
		text-align: center;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1.75rem 1.25rem;
	}
	.gate-sub {
		color: #555;
		margin: 0.35rem 0 1rem;
	}
	.gate .staff-wrap {
		margin-bottom: 1.25rem;
	}
	.big {
		font-size: 1.05rem;
		padding: 0.8rem 1.8rem;
	}
	.high {
		color: var(--blue);
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
	.result-actions,
	.practice-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}
</style>

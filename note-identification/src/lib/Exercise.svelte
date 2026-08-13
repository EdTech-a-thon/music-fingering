<script lang="ts">
	// The student's view. In Challenge Mode it runs: ready → running → results
	// (with a progress report). Without a challenge limit it's endless practice.
	//
	// Each staff image is one question, which may take several steps: name the
	// note, then which string, then — on the bass — which position, then which
	// finger. Steps are asked one at a time, but the answers already given stay
	// on screen so the student sees the whole fingering come together.
	import { onDestroy } from 'svelte';
	import Staff from './Staff.svelte';
	import {
		diatonicIndex,
		noteLabel,
		randomNote,
		parseNoteName,
		type Clef,
		type Note
	} from './music';
	import {
		asksFingering,
		asksPosition,
		fingeringOptions,
		formatDuration,
		isChallengeMode,
		settingsToQuery,
		type Settings
	} from './settings';
	import {
		FINGERS,
		FINGER_SETS,
		fingeringsFor,
		INSTRUMENTS,
		isOpen,
		playableRange,
		positionLabel,
		POSITION_NAMES,
		preferredFingering,
		type Fingering,
		type PositionId
	} from './strings';

	let { settings }: { settings: Settings } = $props();

	const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

	const challenge = $derived(isChallengeMode(settings));
	const instrument = $derived(settings.instrument);
	const def = $derived(INSTRUMENTS[instrument]);
	// The key, the positions and the fingers on the menu — everything the
	// fingering engine needs to answer "how could this note be played".
	const fingering = $derived(fingeringOptions(settings));

	// Range as diatonic indices (low ≤ high), never reaching past what the
	// instrument can actually finger with the fingerings being taught.
	const bounds = $derived.by(() => {
		let low = Math.min(parseNoteName(settings.rangeLow), parseNoteName(settings.rangeHigh));
		let high = Math.max(parseNoteName(settings.rangeLow), parseNoteName(settings.rangeHigh));
		const playable = playableRange(instrument, fingering);
		low = Math.max(low, parseNoteName(playable.low));
		high = Math.min(high, parseNoteName(playable.high));
		if (low > high) [low, high] = [parseNoteName(playable.low), parseNoteName(playable.high)];
		return { low, high };
	});
	const lowIndex = $derived(bounds.low);
	const highIndex = $derived(bounds.high);

	function pick<T>(items: T[]): T {
		return items[Math.floor(Math.random() * items.length)];
	}

	type StepId = 'note' | 'string' | 'finger' | 'position';
	interface Given {
		step: StepId;
		label: string;
		ok: boolean;
	}

	function newQuestion(): { clef: Clef; note: Note; index: number } {
		const clef = pick(settings.clefs);
		const note = randomNote({
			clef,
			lowIndex,
			highIndex,
			position: settings.positions,
			values: settings.noteValues,
			// Restricting the fingerings can leave notes inside the range with no
			// way to play them; don't ask about those.
			playable: asksFingering(settings) ? (i) => optionsFor(i).length > 0 : undefined
		});
		return { clef, note, index: diatonicIndex(note.letter, note.octave) };
	}

	function optionsFor(index: number): Fingering[] {
		return fingeringsFor(settings.instrument, index, fingering);
	}

	// --- run state ---
	let phase = $state<'ready' | 'running' | 'done'>(isChallengeMode(settings) ? 'ready' : 'running');
	let current = $state(newQuestion());
	let step = $state<StepId>('note');
	// Every fingering still consistent with what the student has answered so far.
	let options = $state<Fingering[]>(optionsFor(current.index));
	let given = $state<Given[]>([]);
	let wrongKeys = $state<string[]>([]);
	let locked = $state(false);
	let correct = $state(0);
	let attempted = $state(0);
	let completed = $state(0);
	let startTime = Date.now();
	let elapsedMs = $state(0);
	let isHighScore = $state(false);

	let ticker: ReturnType<typeof setInterval> | undefined;
	let revealTimer: ReturnType<typeof setTimeout> | undefined;

	const percent = $derived(attempted ? Math.round((correct / attempted) * 100) : 0);
	const timeLimitMs = $derived(settings.timeLimitSec * 1000);
	const remainingMs = $derived(Math.max(0, timeLimitMs - elapsedMs));

	function start() {
		clearTimeout(revealTimer);
		correct = 0;
		attempted = 0;
		completed = 0;
		isHighScore = false;
		nextQuestion();
		startTime = Date.now();
		elapsedMs = 0;
		phase = 'running';
		clearInterval(ticker);
		ticker = setInterval(() => {
			elapsedMs = Date.now() - startTime;
			if (settings.timeLimitSec > 0 && elapsedMs >= timeLimitMs) finish();
		}, 250);
	}

	function nextQuestion() {
		wrongKeys = [];
		given = [];
		locked = false;
		step = 'note';
		current = newQuestion();
		options = optionsFor(current.index);
	}

	// Which step follows this one. On the bass the position is asked before the
	// finger — the position is what tells you where the finger goes.
	function stepAfter(from: StepId): StepId | null {
		if (from === 'note') return settings.askString ? 'string' : fingeringStep();
		if (from === 'string') return fingeringStep();
		// Answering "open" at the position step has already named the whole
		// fingering, so there is no finger left to ask for.
		if (from === 'position') return options.every(isOpen) ? null : 'finger';
		return null;
	}

	// The first of the position/finger pair still to ask. The bass skips straight
	// to the finger when every fingering left is an open string, which has no
	// position.
	function fingeringStep(): StepId | null {
		if (!settings.askFinger) return null;
		return asksPosition(settings) && !options.every(isOpen) ? 'position' : 'finger';
	}

	function advance() {
		const next = stepAfter(step);
		if (next === null) {
			completeQuestion();
			return;
		}
		step = next;
		wrongKeys = [];
		locked = false;
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

	// The buttons for the step being asked.
	const choices = $derived.by((): { key: string; label: string }[] => {
		if (step === 'note') return LETTERS.map((l) => ({ key: l, label: noteLabel(settings.key, l) }));
		if (step === 'string')
			return def.strings.map((s, i) => ({
				key: String(i),
				label: `${s.replace(/\d+$/, '')} string`
			}));
		// Only the fingers the teacher put on the menu, low to high.
		if (step === 'finger')
			return FINGER_SETS[instrument]
				.filter((id) => settings.fingers.includes(id))
				.map((id) => ({ key: id, label: FINGERS[id].label }));
		// Without the string step the note may still turn out to be an open one,
		// which is an answer in its own right rather than a position.
		const positions = settings.bassPositions.map((p) => ({ key: p, label: positionLabel(p) }));
		return options.some(isOpen) ? [{ key: 'open', label: 'Open' }, ...positions] : positions;
	});

	function isRight(key: string): boolean {
		if (step === 'note') return key === current.note.letter;
		if (step === 'string') return options.some((o) => o.string === Number(key));
		if (step === 'finger') return options.some((o) => o.finger === key);
		if (key === 'open') return options.some(isOpen);
		return options.some((o) => o.position === key);
	}

	// Keep only the fingerings that agree with the answer just given.
	function narrow(key: string) {
		if (step === 'string') options = options.filter((o) => o.string === Number(key));
		else if (step === 'finger') options = options.filter((o) => o.finger === key);
		else if (step === 'position')
			options = key === 'open' ? options.filter(isOpen) : options.filter((o) => o.position === key);
	}

	function chipLabel(key: string): string {
		if (step === 'note') return noteLabel(settings.key, key);
		if (step === 'string') return `${def.strings[Number(key)].replace(/\d+$/, '')} string`;
		if (step === 'finger') return key === 'open' ? 'Open' : `Finger ${FINGERS[key].label}`;
		return key === 'open' ? 'Open' : POSITION_NAMES[key as PositionId];
	}

	const promptText = $derived(
		step === 'note'
			? 'Name this note'
			: step === 'string'
				? 'Which string?'
				: step === 'finger'
					? 'Which finger?'
					: 'Which position?'
	);

	// After a wrong answer `options` holds just the fingering a teacher would
	// have written in, so it doubles as the answer key for the reveal.
	const revealText = $derived.by(() => {
		if (step === 'note') return `It was ${noteLabel(settings.key, current.note.letter)}`;
		const f = options[0];
		if (!f) return '';
		if (step === 'string') return `It was the ${def.strings[f.string].replace(/\d+$/, '')} string`;
		if (step === 'finger')
			return isOpen(f) ? 'It was an open string' : `It was the ${FINGERS[f.finger].name}`;
		if (f.position) return `It was ${POSITION_NAMES[f.position].toLowerCase()}`;
		return isOpen(f) ? 'It was an open string' : '';
	});

	function choose(key: string) {
		if (locked || phase !== 'running') return;
		attempted += 1;

		if (isRight(key)) {
			correct += 1;
			narrow(key);
			given = [...given, { step, label: chipLabel(key), ok: true }];
			locked = true;
			revealTimer = setTimeout(advance, 350);
			return;
		}

		// Reveal the correct answer briefly, then move on. The rest of the question
		// carries on from the fingering a teacher would have written in, so the
		// student still gets asked — and still sees — every part of the answer.
		given = [...given, { step, label: chipLabel(key), ok: false }];
		wrongKeys = [...wrongKeys, key];
		if (step !== 'note') {
			const pref = preferredFingering(options);
			if (pref) options = [pref];
		}
		locked = true;
		revealTimer = setTimeout(advance, 1000);
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
				{#if settings.questionLimit > 0 && settings.timeLimitSec > 0}
					{settings.questionLimit} questions or {formatDuration(settings.timeLimitSec)} — whichever comes
					first.
				{:else if settings.questionLimit > 0}
					{settings.questionLimit} question{settings.questionLimit === 1 ? '' : 's'}.
				{:else}
					{formatDuration(settings.timeLimitSec)}.
				{/if}
				The clock and score start when you press Start.
			</p>
			<div class="staff-wrap muted">
				<Staff
					clef={current.clef}
					keySig={settings.key}
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
				{#if settings.timeLimitSec > 0}
					<span class="clock">{formatTime(remainingMs)}</span>
				{/if}
			</div>
		</div>

		<div class="staff-wrap">
			<Staff
				clef={current.clef}
				keySig={settings.key}
				helpers={settings.helpers}
				helperLow={lowIndex}
				helperHigh={highIndex}
				note={current.note}
			/>
		</div>

		{#if given.length}
			<!-- Answers already given for this note, kept on screen as the
			     question builds up its full fingering. -->
			<ol class="given">
				{#each given as g, i (i)}
					<li class="answered" class:bad={!g.ok}>{g.label}</li>
				{/each}
			</ol>
		{/if}

		<div class="prompt">
			{#if locked && wrongKeys.length}
				<span class="bad">{revealText}</span>
			{:else}
				<span>{promptText}</span>
			{/if}
		</div>

		<div class="letters" class:wide={step !== 'note'}>
			{#each choices as c (c.key)}
				<button
					type="button"
					class="letter"
					class:right={locked && isRight(c.key)}
					class:wrong={wrongKeys.includes(c.key)}
					disabled={locked || wrongKeys.includes(c.key)}
					onclick={() => choose(c.key)}
				>
					{c.label}
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
				<button type="button" class="btn-primary" onclick={start}>Start Challenge</button>
			</div>
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
	.given {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
		list-style: none;
	}
	.answered {
		background: var(--blue-soft);
		border: 1px solid var(--blue-border);
		color: var(--blue-dark);
		border-radius: 999px;
		padding: 0.25rem 0.7rem;
		font-size: 0.85rem;
		font-weight: 700;
	}
	.answered.bad {
		background: #fbdedb;
		border-color: #b3261e;
		color: #842029;
		text-decoration: line-through;
	}
	.letters {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}
	/* String, finger and position answers are words rather than single letters. */
	.letters.wide {
		grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
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

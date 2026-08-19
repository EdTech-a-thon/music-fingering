<script lang="ts">
	// The student's view. In Challenge Mode it runs: ready → running → results
	// (with a progress report). Without a challenge limit it's endless practice.
	//
	// Each staff image is one question, which may take several steps: name the
	// note, then which string, then — on the bass — which position, then which
	// finger. Steps are asked one at a time, but the answers already given stay
	// on screen so the student sees the whole fingering come together. A wrong
	// answer at any step ends the question there and shows what it should have
	// been.
	import { onDestroy } from 'svelte';
	import Staff from './Staff.svelte';
	import {
		fromDiatonicIndex,
		noteAt,
		noteLabel,
		notesToAsk,
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
		positionName,
		preferredFingering,
		type Fingering,
		type PositionId
	} from './strings';

	let { settings }: { settings: Settings } = $props();

	const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

	// How long the right answer stays up after a miss. Short enough to keep the
	// run moving, long enough that a student reads it rather than glimpses it.
	const REVEAL_MS = 1800;

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

	function optionsFor(index: number): Fingering[] {
		return fingeringsFor(settings.instrument, index, fingering);
	}

	// The instrument decides the clef, so a run only ever reads in one of them.
	const clef = $derived(settings.clefs[0]);

	// Every note this activity can ask about, low to high.
	const pool = $derived(
		notesToAsk({
			clef,
			lowIndex,
			highIndex,
			position: settings.positions,
			// Restricting the fingerings can leave notes inside the range with no
			// way to play them; don't ask about those.
			playable: asksFingering(settings) ? (i) => optionsFor(i).length > 0 : undefined
		})
	);

	// --- what to ask next ---
	//
	// A run starts by sweeping the range: every note once, in a shuffled order,
	// so the student meets the whole range instead of the same few notes. Then it
	// comes back to the notes they missed on the way through. After that there is
	// nothing left to be systematic about, and notes are drawn at random.
	let sweeping = $state(true);
	let queue = $state<number[]>([]);
	let missed = $state<number[]>([]);
	startSweep();

	function startSweep() {
		sweeping = true;
		queue = shuffle(pool);
		missed = [];
	}

	function nextIndex(): number {
		if (!queue.length && sweeping && missed.length) {
			queue = shuffle(missed);
			missed = [];
			sweeping = false;
		}
		if (queue.length) return queue.shift()!;
		sweeping = false;
		return pick(pool);
	}

	// Fisher–Yates: each order is as likely as any other.
	function shuffle(items: number[]): number[] {
		const out = [...items];
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	}

	function newQuestion(): { clef: Clef; note: Note; index: number } {
		const index = nextIndex();
		return { clef, note: noteAt(index, settings.noteValues), index };
	}

	// --- run state ---
	let phase = $state<'ready' | 'running' | 'done'>(isChallengeMode(settings) ? 'ready' : 'running');
	let current = $state(newQuestion());
	let step = $state<StepId>('note');
	// Every fingering still consistent with what the student has answered so far.
	let options = $state<Fingering[]>(optionsFor(current.index));
	let given = $state<Given[]>([]);
	let wrongKeys = $state<string[]>([]);
	// The wrong answers given to this question, each paired with the answer that
	// would have been right — which is what the report at the end is built from.
	let wrongAnswers = $state<Miss[]>([]);
	let locked = $state(false);
	let correct = $state(0);
	let attempted = $state(0);
	let completed = $state(0);
	let startTime = Date.now();
	let elapsedMs = $state(0);
	let isHighScore = $state(false);

	/** One wrong answer: what was being asked, what was said, what was right. */
	interface Miss {
		step: StepId;
		gave: string;
		want: string;
	}

	/** How one note fared over the run, for the report at the end. */
	interface NoteTally {
		asked: number;
		/** Questions with at least one wrong answer in them. */
		wrong: number;
		/** The wrong answers themselves, the same slip counted once with a tally. */
		misses: (Miss & { times: number })[];
	}
	let tally = $state<Record<number, NoteTally>>({});

	let ticker: ReturnType<typeof setInterval> | undefined;
	let revealTimer: ReturnType<typeof setTimeout> | undefined;

	const percent = $derived(attempted ? Math.round((correct / attempted) * 100) : 0);
	const timeLimitMs = $derived(settings.timeLimitSec * 1000);
	const remainingMs = $derived(Math.max(0, timeLimitMs - elapsedMs));

	function start() {
		clearTimeout(revealTimer);
		startSweep();
		correct = 0;
		attempted = 0;
		completed = 0;
		tally = {};
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
		wrongAnswers = [];
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
		recordNote();
		// A note the student stumbled over on the way through the range comes back
		// once the sweep is done — whichever part of it they got wrong.
		if (wrongAnswers.length && sweeping) missed = [...missed, current.index];
		completed += 1;
		if (settings.questionLimit > 0 && completed >= settings.questionLimit) {
			finish();
		} else {
			nextQuestion();
		}
	}

	// Add the question just finished to the note's running record. The same slip
	// made twice is one line in the report with a count, not two lines.
	function recordNote() {
		const note = (tally[current.index] ??= { asked: 0, wrong: 0, misses: [] });
		note.asked += 1;
		if (!wrongAnswers.length) return;
		note.wrong += 1;
		for (const m of wrongAnswers) {
			const same = note.misses.find(
				(x) => x.step === m.step && x.gave === m.gave && x.want === m.want
			);
			if (same) same.times += 1;
			else note.misses.push({ ...m, times: 1 });
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
		const positions = settings.bassPositions.map((p) => ({
			key: p,
			label: positionLabel(p, settings.positionSystem)
		}));
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

	function chipLabel(key: string, asked: StepId = step): string {
		if (asked === 'note') return noteLabel(settings.key, key);
		if (asked === 'string') return `${def.strings[Number(key)].replace(/\d+$/, '')} string`;
		if (asked === 'finger') return key === 'open' ? 'Open' : `Finger ${FINGERS[key].label}`;
		return key === 'open' ? 'Open' : positionName(key as PositionId, settings.positionSystem);
	}

	/**
	 * The answer that would have been right, worded exactly as the student's own
	 * answer is, so the report reads as one against the other. Where a note can be
	 * played several ways this is the fingering a teacher would have written in —
	 * the same one the reveal shows.
	 */
	function rightLabel(asked: StepId, from: Fingering[]): string {
		if (asked === 'note') return chipLabel(current.note.letter, asked);
		const f = preferredFingering(from);
		if (!f) return '';
		if (asked === 'string') return chipLabel(String(f.string), asked);
		if (asked === 'finger') return chipLabel(f.finger, asked);
		return chipLabel(f.position ?? 'open', asked);
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
		if (f.position)
			return `It was ${positionName(f.position, settings.positionSystem).toLowerCase()}`;
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

		// One wrong answer ends the question. Everything after it hangs on the part
		// they missed — the finger only means something once the position is right
		// — so the answer is revealed and the next note comes up instead.
		given = [...given, { step, label: chipLabel(key), ok: false }];
		wrongKeys = [...wrongKeys, key];
		wrongAnswers = [
			...wrongAnswers,
			{ step, gave: chipLabel(key), want: rightLabel(step, options) }
		];
		// The reveal reads off the fingering a teacher would have written in.
		if (step !== 'note') {
			const pref = preferredFingering(options);
			if (pref) options = [pref];
		}
		locked = true;
		revealTimer = setTimeout(completeQuestion, REVEAL_MS);
	}

	function finish() {
		clearInterval(ticker);
		clearTimeout(revealTimer);
		elapsedMs = Date.now() - startTime;
		locked = true;
		phase = 'done';
		recordHighScore();
	}

	// --- the report at the end ---

	// The steps in the order they are asked, so a note's wrong answers read in
	// the order the student met them.
	const ORDERED_STEPS: StepId[] = ['note', 'string', 'position', 'finger'];

	/**
	 * The notes that went wrong, the ones missed most often first. This is the
	 * part a teacher reads: not how much a student is struggling, but with what.
	 */
	const report = $derived(
		Object.entries(tally)
			.map(([index, note]) => ({
				index: Number(index),
				...note,
				// Read back in the order the student met them.
				misses: [...note.misses].sort(
					(a, b) => ORDERED_STEPS.indexOf(a.step) - ORDERED_STEPS.indexOf(b.step)
				)
			}))
			.filter((note) => note.wrong > 0)
			.sort((a, b) => b.wrong - a.wrong || a.index - b.index)
	);

	/**
	 * The missed note as it was read on the staff. A picture is what the student
	 * has to recognise — 'A4' is a name for it they have not learnt yet.
	 */
	function reportNote(index: number): Note {
		const { letter, octave } = fromDiatonicIndex(index);
		return { letter, octave, value: 'whole' };
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
					{settings.questionLimit} questions or {formatDuration(settings.timeLimitSec)}, whichever
					comes first.
				{:else if settings.questionLimit > 0}
					{settings.questionLimit} question{settings.questionLimit === 1 ? '' : 's'}.
				{:else}
					{formatDuration(settings.timeLimitSec)}.
				{/if}
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
				<span class="bad reveal">{revealText}</span>
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

			{#if settings.detailedReport}
				<!-- What the student struggled with, note by note, for the teacher to
				     read over their shoulder at the end. -->
				<section class="report">
					<h3>Notes missed</h3>
					{#if report.length}
						<ul class="misses">
							{#each report as note (note.index)}
								<li>
									<!-- The note itself, drawn as it was asked. -->
									<div class="missed-staff">
										<Staff {clef} keySig={settings.key} note={reportNote(note.index)} />
									</div>
									<div class="missed-body">
										<p class="count">Missed {note.wrong} of {note.asked}</p>
										<ul class="diffs">
											{#each note.misses as m, i (i)}
												<li>
													<span class="gave"><span class="mark">✗</span> You said {m.gave}</span>
													{#if m.want}
														<span class="want"><span class="mark">✓</span> It was {m.want}</span>
													{/if}
													{#if m.times > 1}
														<span class="times">×{m.times}</span>
													{/if}
												</li>
											{/each}
										</ul>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="clean">Nothing missed — every answer was right.</p>
					{/if}
				</section>
			{/if}

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
		/* Room for the reveal below, so the buttons do not shift when it appears. */
		min-height: 2.1rem;
		font-size: 1.05rem;
	}
	.reveal {
		font-size: 1.35rem;
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
	/* The report reads as a list of notes rather than more score: quieter than
	   the total above it, and left-aligned so the note names line up. */
	.report {
		text-align: left;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
		margin-bottom: 1.25rem;
	}
	.report h3 {
		font-size: 0.95rem;
		font-weight: 700;
		margin-bottom: 0.6rem;
	}
	.misses {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		list-style: none;
	}
	/* Each miss is the note as a picture, with what went wrong beside it. */
	.misses > li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.5rem 0.75rem;
	}
	.missed-staff {
		flex: none;
		/* Wide enough to read the note, never so wide it crowds a phone. */
		width: min(9rem, 40%);
	}
	.missed-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.count {
		color: #b3261e;
		font-weight: 700;
		font-size: 0.85rem;
	}
	.diffs {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
	}
	/* One slip per line: what was asked, what they said, what it was. */
	.diffs li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.85rem;
	}
	.gave {
		color: #b3261e;
	}
	.want {
		color: #1b7f4b;
		font-weight: 700;
	}
	/* The tick and cross carry the same meaning as the colours, for anyone who
	   cannot tell the two colours apart. */
	.mark {
		font-weight: 700;
	}
	.times {
		color: #555;
	}
	.clean {
		color: #555;
		font-size: 0.9rem;
	}
	.result-actions,
	.practice-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}
</style>

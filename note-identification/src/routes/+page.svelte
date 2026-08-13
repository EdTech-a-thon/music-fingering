<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ALL_KEYS,
		CLEF_NAMES,
		KEY_NAMES,
		parseNoteName,
		type KeyId,
		type NoteValue
	} from '$lib/music';
	import {
		applyInstrument,
		asksPosition,
		clampRange,
		DEFAULT_SETTINGS,
		fingeringOptions,
		MAX_QUESTIONS,
		MAX_SECONDS,
		settingsToQuery,
		type Settings
	} from '$lib/settings';
	import {
		ALL_INSTRUMENTS,
		BASS_POSITIONS,
		FINGERS,
		FINGER_SETS,
		INSTRUMENT_NAMES,
		INSTRUMENTS,
		playableNotes,
		playableRange,
		POSITION_NAMES,
		type FingerId,
		type Instrument,
		type PositionId
	} from '$lib/strings';
	import RangeSelector from '$lib/RangeSelector.svelte';
	import Staff from '$lib/Staff.svelte';

	let settings = $state<Settings>(structuredClone(DEFAULT_SETTINGS));

	const ALL_VALUES: NoteValue[] = ['whole', 'half', 'quarter'];

	// Each instrument gets its own activity: its clef, its range, its fingerings.
	const fingering = $derived(fingeringOptions(settings));
	const limits = $derived(playableRange(settings.instrument, fingering));

	// Turning fingerings off leaves gaps inside the range — a note the student
	// has no way to play is skipped — so tell the teacher what is left.
	const available = $derived(
		playableNotes(settings.instrument, fingering).filter(
			(n) =>
				n.index >= parseNoteName(settings.rangeLow) && n.index <= parseNoteName(settings.rangeHigh)
		).length
	);

	function selectInstrument(choice: Instrument) {
		settings = applyInstrument(settings, choice);
	}

	// A key signature changes which fingerings reach which notes: in D major the
	// violin's F is high 2, and the cello's low C needs an extension rather than
	// the open string. So the range has to be re-checked.
	function selectKey(key: KeyId) {
		settings = clampRange({ ...settings, key });
	}

	// Positions the bass answers may use. Keep at least one, and re-clamp the
	// range, since dropping third position takes the top two notes out of reach.
	function toggleBassPosition(p: PositionId) {
		const has = settings.bassPositions.includes(p);
		const next = BASS_POSITIONS.map((b) => b.id).filter((id) =>
			id === p ? !has : settings.bassPositions.includes(id)
		);
		if (!next.length) return;
		settings = clampRange({ ...settings, bassPositions: next });
	}

	// Fingers the student may be asked for. The open string always counts, and
	// there has to be something to play besides it.
	function toggleFinger(id: FingerId) {
		if (id === 'open') return;
		const has = settings.fingers.includes(id);
		const next = FINGER_SETS[settings.instrument].filter((f) =>
			f === id ? !has : settings.fingers.includes(f)
		);
		if (next.every((f) => f === 'open')) return;
		settings = clampRange({ ...settings, fingers: next });
	}

	// Both limits are optional: a blank or zero box means "no limit".
	const MAX_MINUTES = MAX_SECONDS / 60;
	const limitMinutes = $derived(Math.floor(settings.timeLimitSec / 60));
	const limitSeconds = $derived(settings.timeLimitSec % 60);

	function setQuestionLimit(value: string) {
		settings.questionLimit = clamp(value, MAX_QUESTIONS);
	}
	// Minutes and seconds are two boxes over one stored value, so each edit keeps
	// the other half and re-clamps the total to at most an hour.
	function setTimeLimit(minutes: number, seconds: number) {
		settings.timeLimitSec = Math.min(MAX_SECONDS, Math.max(0, minutes * 60 + seconds));
	}
	function clamp(value: string, max: number): number {
		const n = Math.round(Number(value));
		if (!Number.isFinite(n) || n <= 0) return 0;
		return Math.min(max, n);
	}

	// Toggle helpers that keep at least one option selected where required.
	function toggleValue(v: NoteValue) {
		if (settings.noteValues.includes(v)) {
			if (settings.noteValues.length > 1)
				settings.noteValues = settings.noteValues.filter((x) => x !== v);
		} else settings.noteValues = [...settings.noteValues, v];
	}
	// Shareable link (absolute once we know the site address).
	let origin = $state('');
	onMount(() => (origin = window.location.origin));
	const link = $derived(`${origin}/challenge?${settingsToQuery(settings)}`);

	let copied = $state(false);
	async function copyLink() {
		await navigator.clipboard.writeText(link);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="page">
	<header class="intro">
		<h1>Notes &amp; Fingering Practice</h1>
		<p>Choose an instrument and settings, then share the link with students.</p>
	</header>

	<div class="layout">
		<section class="panel settings" aria-label="Settings">
			<fieldset>
				<legend>Instrument</legend>
				<p class="hint">
					Make one activity per instrument — each reads its own clef and fingers notes differently.
				</p>
				<div class="chips">
					{#each ALL_INSTRUMENTS as choice (choice)}
						<button
							type="button"
							class="chip clef-chip"
							class:on={settings.instrument === choice}
							onclick={() => selectInstrument(choice)}
						>
							<span class="clef-preview" aria-hidden="true"
								><Staff clef={INSTRUMENTS[choice].clef} /></span
							>
							<span>{INSTRUMENT_NAMES[choice]}</span>
						</button>
					{/each}
				</div>
				<p class="hint after">
					Reads {CLEF_NAMES[settings.clefs[0]].toLowerCase()} clef; strings tuned {INSTRUMENTS[
						settings.instrument
					].strings
						.map((s) => s.replace(/\d+$/, ''))
						.join(' ')}.
				</p>
			</fieldset>

			<fieldset>
				<legend>Key signature</legend>
				<p class="hint">
					The staff carries the sharps; the student still names plain letters. What changes is the
					fingering — in D major every F is a high 2 on the violin.
				</p>
				<div class="chips">
					{#each ALL_KEYS as choice (choice)}
						<button
							type="button"
							class="chip"
							class:on={settings.key === choice}
							onclick={() => selectKey(choice)}>{KEY_NAMES[choice]}</button
						>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>Ask for</legend>
				<div class="chips">
					<span class="chip on locked">Note</span>
					<button
						type="button"
						class="chip"
						class:on={settings.askString}
						onclick={() => (settings.askString = !settings.askString)}>String</button
					>
					{#if asksPosition(settings)}
						<span class="chip on locked">Position</span>
					{/if}
					<button
						type="button"
						class="chip"
						class:on={settings.askFinger}
						onclick={() => (settings.askFinger = !settings.askFinger)}>Finger</button
					>
				</div>
				<p class="hint after">
					Asked one at a time, in this order. Every valid fingering is accepted — several notes can
					be played more than one way.
				</p>
			</fieldset>

			{#if asksPosition(settings)}
				<fieldset>
					<legend>Positions</legend>
					<p class="hint">
						The bass hand spans less than the gap between its strings, so a scale needs more than
						one position. Students are only asked for positions you enable here.
					</p>
					<div class="chips">
						{#each BASS_POSITIONS as pos (pos.id)}
							<button
								type="button"
								class="chip"
								class:on={settings.bassPositions.includes(pos.id)}
								onclick={() => toggleBassPosition(pos.id)}
								>{POSITION_NAMES[pos.id]} ({pos.label})</button
							>
						{/each}
					</div>
				</fieldset>
			{/if}

			<fieldset>
				<legend>Fingerings</legend>
				<p class="hint">
					Which fingers the student may be asked for, low to high. Switch off what you have not
					taught yet — notes that need them are left out of the activity.
				</p>
				<div class="chips">
					{#each FINGER_SETS[settings.instrument] as id (id)}
						{#if id === 'open'}
							<span class="chip on locked">Open</span>
						{:else}
							<button
								type="button"
								class="chip"
								class:on={settings.fingers.includes(id)}
								onclick={() => toggleFinger(id)}
								title={FINGERS[id].name}>{FINGERS[id].label}</button
							>
						{/if}
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>Range</legend>
				<RangeSelector
					clef={settings.clefs[0]}
					keySig={settings.key}
					low={settings.rangeLow}
					high={settings.rangeHigh}
					minNote={limits.low}
					maxNote={limits.high}
					onchange={(low, high) => {
						settings.rangeLow = low;
						settings.rangeHigh = high;
					}}
				/>
				<p class="hint after">
					Limited to {limits.low}–{limits.high}, the notes reachable with the fingerings above.
					{available} note{available === 1 ? '' : 's'} in this range can be played.
				</p>
			</fieldset>

			<fieldset>
				<legend>Lines &amp; spaces</legend>
				<div class="chips">
					<button
						type="button"
						class="chip"
						class:on={settings.positions === 'both'}
						onclick={() => (settings.positions = 'both')}>Lines &amp; spaces</button
					>
					<button
						type="button"
						class="chip"
						class:on={settings.positions === 'lines'}
						onclick={() => (settings.positions = 'lines')}>Lines only</button
					>
					<button
						type="button"
						class="chip"
						class:on={settings.positions === 'spaces'}
						onclick={() => (settings.positions = 'spaces')}>Spaces only</button
					>
				</div>
			</fieldset>

			<fieldset>
				<legend>Note values</legend>
				<div class="chips">
					{#each ALL_VALUES as v (v)}
						<button
							type="button"
							class="chip"
							class:on={settings.noteValues.includes(v)}
							onclick={() => toggleValue(v)}>{v[0].toUpperCase() + v.slice(1)}</button
						>
					{/each}
				</div>
			</fieldset>

			<fieldset class="toggles">
				<label class="switch"
					><input type="checkbox" bind:checked={settings.helpers} /> Helpers (letter labels beside the
					staff)</label
				>
			</fieldset>

			<fieldset>
				<legend>Challenge mode</legend>
				<p class="hint">Leave a box empty for no limit.</p>
				<div class="limits">
					<label class="limit">
						<span>Questions</span>
						<input
							type="number"
							min="1"
							max={MAX_QUESTIONS}
							step="1"
							placeholder="Off"
							value={settings.questionLimit || ''}
							oninput={(e) => setQuestionLimit(e.currentTarget.value)}
						/>
					</label>
					<div class="limit" role="group" aria-label="Time limit">
						<span>Time limit</span>
						<div class="timerow">
							<span class="timebox">
								<input
									type="number"
									min="0"
									max={MAX_MINUTES}
									step="1"
									placeholder="0"
									aria-label="Time limit minutes"
									value={limitMinutes || ''}
									oninput={(e) =>
										setTimeLimit(clamp(e.currentTarget.value, MAX_MINUTES), limitSeconds)}
								/>
								<span class="unit">min</span>
							</span>
							<span class="timebox">
								<input
									type="number"
									min="0"
									max="59"
									step="1"
									placeholder="0"
									aria-label="Time limit seconds"
									value={limitSeconds || ''}
									oninput={(e) => setTimeLimit(limitMinutes, clamp(e.currentTarget.value, 59))}
								/>
								<span class="unit">sec</span>
							</span>
						</div>
					</div>
				</div>
			</fieldset>
		</section>
	</div>

	<section class="sharebar">
		<label for="share">Share this challenge with students</label>
		<div class="sharerow">
			<input id="share" class="link" readonly value={link} />
			<button type="button" class="btn-primary" onclick={copyLink}
				>{copied ? 'Copied!' : 'Copy link'}</button
			>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- opens the shareable challenge link in a new tab -->
			<a class="btn-dark" href={link} target="_blank" rel="noopener">Open ↗</a>
		</div>
	</section>
</div>

<style>
	.page {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
	}
	.intro h1 {
		font-size: 1.9rem;
		font-weight: 800;
		margin-bottom: 0.25rem;
	}
	.intro p {
		color: #555;
		margin-bottom: 1.5rem;
	}
	.panel {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1.25rem;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 1.35rem;
	}
	fieldset:last-child {
		margin-bottom: 0;
	}
	legend {
		font-weight: 700;
		margin-bottom: 0.55rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		color: #333;
		cursor: pointer;
	}
	.chip:hover {
		border-color: var(--blue);
	}
	.chip.on {
		background: var(--blue);
		border-color: var(--blue);
		color: #fff;
	}
	.clef-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.7rem 0.35rem 0.45rem;
	}
	.clef-preview {
		display: block;
		width: 4rem;
	}
	/* On the selected chip the staff sits on blue, so draw it in white. */
	.chip.on .clef-preview {
		--staff-ink: #fff;
	}
	.hint {
		color: #555;
		font-size: 0.82rem;
		margin: -0.25rem 0 0.6rem;
	}
	/* The same note, but sitting under the control it explains. */
	.hint.after {
		margin: 0.5rem 0 0;
	}
	/* Parts of the sequence the teacher does not get to switch off. */
	.chip.locked {
		cursor: default;
		opacity: 0.75;
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.chip:disabled:hover {
		border-color: var(--border);
	}
	.limits {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		align-items: flex-start;
	}
	.limit {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border: none;
		padding: 0;
		margin: 0;
		font-size: 0.9rem;
	}
	.limit > span {
		font-weight: 600;
	}
	.timerow {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.timebox {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.unit {
		color: #555;
		font-size: 0.85rem;
	}
	.limit input {
		width: 5rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		font: inherit;
		font-weight: 600;
	}
	.limit input:focus-visible {
		outline: 2px solid var(--blue);
		outline-offset: 1px;
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.switch {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		cursor: pointer;
		font-size: 0.92rem;
	}
	.sharebar {
		margin-top: 1.5rem;
		background: var(--blue-soft);
		border: 1px solid var(--blue-border);
		border-radius: var(--radius);
		padding: 1rem 1.25rem;
	}
	.sharebar label {
		display: block;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}
	.sharerow {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.link {
		flex: 1;
		min-width: 12rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--blue-border);
		border-radius: 8px;
		background: #fff;
		font-size: 0.9rem;
		color: #333;
	}
</style>

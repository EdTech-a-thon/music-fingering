<script lang="ts">
	import { onMount } from 'svelte';
	import { CLEF_NAMES, diatonicIndex, noteName, type Clef, type NoteValue } from '$lib/music';
	import { DEFAULT_SETTINGS, settingsToQuery, type Settings } from '$lib/settings';

	let settings = $state<Settings>(structuredClone(DEFAULT_SETTINGS));

	const ALL_CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor'];
	const ALL_VALUES: NoteValue[] = ['whole', 'half', 'quarter'];
	const SHARPS = [1, 2, 3, 4, 5, 6, 7];
	const FLATS = [1, 2, 3, 4, 5, 6, 7];

	// Note choices for the range pickers (C2 … C7).
	const noteOptions = (() => {
		const opts: string[] = [];
		for (let i = diatonicIndex('C', 2); i <= diatonicIndex('C', 7); i++) opts.push(noteName(i));
		return opts;
	})();

	const questionLimits = [0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
	const timeLimits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30];

	// Toggle helpers that keep at least one option selected where required.
	function toggleClef(clef: Clef) {
		if (settings.clefs.includes(clef)) {
			if (settings.clefs.length > 1) settings.clefs = settings.clefs.filter((c) => c !== clef);
		} else settings.clefs = [...settings.clefs, clef];
	}
	function toggleValue(v: NoteValue) {
		if (settings.noteValues.includes(v)) {
			if (settings.noteValues.length > 1)
				settings.noteValues = settings.noteValues.filter((x) => x !== v);
		} else settings.noteValues = [...settings.noteValues, v];
	}
	function toggleKey(v: number) {
		if (settings.keySignatures.includes(v)) {
			if (settings.keySignatures.length > 1)
				settings.keySignatures = settings.keySignatures.filter((k) => k !== v);
		} else settings.keySignatures = [...settings.keySignatures, v];
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
		<h1>Note Naming Practice</h1>
		<p>Choose your settings, then share the link with students.</p>
	</header>

	<div class="layout">
		<section class="panel settings" aria-label="Settings">
			<fieldset>
				<legend>Clefs</legend>
				<div class="chips">
					{#each ALL_CLEFS as clef (clef)}
						<button
							type="button"
							class="chip"
							class:on={settings.clefs.includes(clef)}
							onclick={() => toggleClef(clef)}>{CLEF_NAMES[clef]}</button
						>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>Range</legend>
				<div class="range">
					<label
						>Lowest
						<select bind:value={settings.rangeLow}>
							{#each noteOptions as n (n)}<option value={n}>{n}</option>{/each}
						</select>
					</label>
					<label
						>Highest
						<select bind:value={settings.rangeHigh}>
							{#each noteOptions as n (n)}<option value={n}>{n}</option>{/each}
						</select>
					</label>
				</div>
			</fieldset>

			<fieldset>
				<legend>Positions</legend>
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
				<legend>Key signatures</legend>
				<button
					type="button"
					class="chip block"
					class:on={settings.keySignatures.includes(0)}
					onclick={() => toggleKey(0)}>No key signature</button
				>
				<div class="keyrow">
					<span class="keylabel">Sharps</span>
					{#each SHARPS as n (n)}
						<button
							type="button"
							class="chip mini"
							class:on={settings.keySignatures.includes(n)}
							onclick={() => toggleKey(n)}>{n}♯</button
						>
					{/each}
				</div>
				<div class="keyrow">
					<span class="keylabel">Flats</span>
					{#each FLATS as n (n)}
						<button
							type="button"
							class="chip mini"
							class:on={settings.keySignatures.includes(-n)}
							onclick={() => toggleKey(-n)}>{n}♭</button
						>
					{/each}
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
					><input type="checkbox" bind:checked={settings.accidentals} /> Accidentals (sharps &amp; flats
					on notes)</label
				>
				<label class="switch"
					><input type="checkbox" bind:checked={settings.helpers} /> Helpers (letter labels beside the
					staff)</label
				>
			</fieldset>

			<fieldset>
				<legend>Challenge mode</legend>
				<div class="range">
					<label
						>Questions
						<select
							value={settings.questionLimit}
							onchange={(e) => (settings.questionLimit = Number(e.currentTarget.value))}
						>
							{#each questionLimits as n (n)}<option value={n}>{n === 0 ? 'Off' : n}</option>{/each}
						</select>
					</label>
					<label
						>Time limit
						<select
							value={settings.timeLimitMin}
							onchange={(e) => (settings.timeLimitMin = Number(e.currentTarget.value))}
						>
							{#each timeLimits as n (n)}<option value={n}>{n === 0 ? 'Off' : n + ' min'}</option
								>{/each}
						</select>
					</label>
				</div>
				<label class="switch"
					><input type="checkbox" bind:checked={settings.multipleAttempts} /> Multiple attempts (retry
					a wrong answer)</label
				>
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
	.chip.block {
		display: block;
		width: 100%;
		border-radius: 10px;
		margin-bottom: 0.5rem;
	}
	.chip.mini {
		padding: 0.35rem 0.55rem;
		border-radius: 8px;
		font-size: 0.85rem;
	}
	.keyrow {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.4rem;
		flex-wrap: wrap;
	}
	.keylabel {
		width: 3.4rem;
		font-size: 0.85rem;
		color: #555;
		font-weight: 600;
	}
	.range {
		display: flex;
		gap: 0.75rem;
	}
	.range label {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #555;
	}
	select {
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		font-size: 0.95rem;
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

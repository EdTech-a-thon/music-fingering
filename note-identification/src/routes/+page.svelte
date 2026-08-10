<script lang="ts">
	import { onMount } from 'svelte';
	import Exercise from '$lib/Exercise.svelte';
	import { CLEF_NAMES, type Clef } from '$lib/music';
	import { DEFAULT_SETTINGS, settingsToQuery, type Settings } from '$lib/settings';

	// The settings the teacher is editing. The preview on the right reacts live.
	let settings = $state<Settings>({ ...DEFAULT_SETTINGS, clefs: [...DEFAULT_SETTINGS.clefs] });

	const ALL_CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor'];

	function toggleClef(clef: Clef) {
		if (settings.clefs.includes(clef)) {
			// keep at least one clef selected
			if (settings.clefs.length > 1) settings.clefs = settings.clefs.filter((c) => c !== clef);
		} else {
			settings.clefs = [...settings.clefs, clef];
		}
	}

	// The shareable challenge link (absolute once we know the site address).
	let origin = $state('');
	onMount(() => {
		origin = window.location.origin;
	});
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
		<p>
			Choose your settings on the left. Try it out on the right. Then share the link with students.
		</p>
	</header>

	<div class="layout">
		<!-- LEFT: settings -->
		<section class="panel settings" aria-label="Settings">
			<fieldset>
				<legend>Clefs</legend>
				<div class="checks">
					{#each ALL_CLEFS as clef (clef)}
						<label class="check">
							<input
								type="checkbox"
								checked={settings.clefs.includes(clef)}
								onchange={() => toggleClef(clef)}
							/>
							{CLEF_NAMES[clef]}
						</label>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>Note range</legend>
				<label class="radio">
					<input type="radio" value="staff" bind:group={settings.range} />
					On the staff only
				</label>
				<label class="radio">
					<input type="radio" value="ledger" bind:group={settings.range} />
					Include ledger lines (harder)
				</label>
			</fieldset>

			<fieldset>
				<legend>Sharps &amp; flats</legend>
				<label class="check">
					<input type="checkbox" bind:checked={settings.accidentals} />
					Include sharps and flats
				</label>
			</fieldset>

			<fieldset>
				<legend>Note names</legend>
				<label class="radio">
					<input type="radio" value="letters" bind:group={settings.labels} />
					Letters (A, B, C…)
				</label>
				<label class="radio">
					<input type="radio" value="solfege" bind:group={settings.labels} />
					Solfège (Do, Re, Mi…)
				</label>
			</fieldset>

			<fieldset>
				<legend>Number of questions</legend>
				<input class="count" type="number" min="1" max="50" bind:value={settings.count} />
			</fieldset>
		</section>

		<!-- RIGHT: live student preview -->
		<section class="panel preview" aria-label="Student preview">
			<div class="preview-tag">Student preview</div>
			{#key settingsToQuery(settings)}
				<Exercise {settings} />
			{/key}
		</section>
	</div>

	<section class="sharebar">
		<label for="share">Share this challenge with students</label>
		<div class="sharerow">
			<input id="share" class="link" readonly value={link} />
			<button type="button" onclick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- opens the shareable challenge link in a new tab -->
			<a class="open" href={link} target="_blank" rel="noopener"> Open ↗ </a>
		</div>
	</section>
</div>

<style>
	.page {
		max-width: 70rem;
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
	.layout {
		display: grid;
		grid-template-columns: 20rem 1fr;
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 780px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.panel {
		background: #f7f7f9;
		border: 1px solid #e5e5e5;
		border-radius: 14px;
		padding: 1.25rem;
	}
	.preview {
		position: relative;
		padding-top: 2.5rem;
		background: #fdfdfd;
	}
	.preview-tag {
		position: absolute;
		top: 0.75rem;
		left: 1.25rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #888;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 1.25rem;
	}
	legend {
		font-weight: 700;
		margin-bottom: 0.5rem;
	}
	.checks {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	.check,
	.radio {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		cursor: pointer;
	}
	.count {
		width: 5rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 8px;
		font-size: 1rem;
	}
	.sharebar {
		margin-top: 1.5rem;
		background: #eef2ff;
		border: 1px solid #c7d2fe;
		border-radius: 14px;
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
		border: 1px solid #c7d2fe;
		border-radius: 8px;
		background: #fff;
		font-size: 0.9rem;
		color: #333;
	}
	.sharerow button,
	.open {
		padding: 0.55rem 1rem;
		border-radius: 8px;
		border: none;
		background: #4f46e5;
		color: #fff;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}
	.open {
		background: #1f2937;
	}
</style>

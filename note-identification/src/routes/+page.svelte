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
		applyPositionSystem,
		asksPosition,
		clampRange,
		DEFAULT_SETTINGS,
		fingeringOptions,
		MAX_QUESTIONS,
		MAX_SECONDS,
		nameFromJson,
		settingsFromJson,
		settingsToQuery,
		type Settings
	} from '$lib/settings';
	import {
		fromQuery,
		loadPresets,
		loadQrOpen,
		loadWorking,
		newId,
		saveQrOpen,
		sameSettings,
		savePresets,
		saveWorking,
		type Preset
	} from '$lib/presets';
	import {
		ALL_INSTRUMENTS,
		ALL_POSITION_SYSTEMS,
		FINGERS,
		FINGER_SETS,
		INSTRUMENT_NAMES,
		INSTRUMENTS,
		playableNotes,
		playableRange,
		positionLabel,
		positionName,
		POSITION_SYSTEM_NAMES,
		SYSTEM_POSITIONS,
		type FingerId,
		type Instrument,
		type PositionId,
		type PositionSystem
	} from '$lib/strings';
	import { makeQr, qrExtent, qrPath, qrPng } from '$lib/qr';
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

	// Which system names the bass positions. The hand shapes are the same either
	// way, so this mostly changes what the student is asked to call them.
	function selectPositionSystem(system: PositionSystem) {
		settings = applyPositionSystem(settings, system);
	}

	// Positions the bass answers may use, from the ones the chosen system offers.
	// Keep at least one, and re-clamp the range, since dropping the top position
	// takes the top two notes out of reach.
	function toggleBassPosition(p: PositionId) {
		const has = settings.bassPositions.includes(p);
		const next = SYSTEM_POSITIONS[settings.positionSystem].filter((id) =>
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
	const link = $derived(`${origin}/challenge?${settingsToQuery(settings)}`);

	// ---------------------------------------------------------------------------
	// Saved activities
	// ---------------------------------------------------------------------------

	let presets = $state<Preset[]>([]);
	let activeId = $state<string | null>(null);
	// Nothing is written back until the stored state has been read, or the first
	// render would overwrite the teacher's work with the defaults.
	let loaded = $state(false);

	const activePreset = $derived(presets.find((p) => p.id === activeId) ?? null);
	// Changes worth a Save: either edits on top of a saved activity, or an
	// activity that has never been saved at all.
	const unsaved = $derived(!activePreset || !sameSettings(settings, fromQuery(activePreset.query)));
	const canDiscard = $derived(!!activePreset && unsaved);

	onMount(() => {
		origin = window.location.origin;
		qrOpen = loadQrOpen();
		presets = loadPresets();
		const working = loadWorking();
		if (working) {
			settings = fromQuery(working.query);
			activeId = presets.some((p) => p.id === working.presetId) ? working.presetId : null;
		}
		loaded = true;
	});

	// Remember whatever is on screen, so a refresh picks up where it left off.
	// Reading the settings through the encoder is what makes this run on *any*
	// edit rather than only when the settings object is replaced wholesale.
	$effect(() => {
		const query = settingsToQuery(settings);
		if (!loaded) return;
		saveWorking({ query, presetId: activeId });
	});

	let naming = $state(false);
	let draftName = $state('');
	let confirmingDiscard = $state(false);
	let confirmingDelete = $state<string | null>(null);
	let presetNote = $state('');

	function startSave() {
		presetNote = '';
		confirmingDiscard = false;
		// Saving over an activity that already has a name needs no prompt.
		if (activePreset) {
			presets = presets.map((p) =>
				p.id === activePreset.id ? { ...p, query: settingsToQuery(settings) } : p
			);
			savePresets(presets);
			flash(`Saved “${activePreset.name}”`);
			return;
		}
		draftName = '';
		naming = true;
	}

	function confirmSaveAs() {
		const name = draftName.trim();
		if (!name) return;
		const preset: Preset = { id: newId(), name, query: settingsToQuery(settings) };
		presets = [...presets, preset];
		savePresets(presets);
		activeId = preset.id;
		naming = false;
		flash(`Saved “${name}”`);
	}

	function loadPreset(id: string) {
		const preset = presets.find((p) => p.id === id);
		if (!preset) return;
		settings = fromQuery(preset.query);
		activeId = preset.id;
		confirmingDiscard = false;
		presetNote = '';
	}

	function discardChanges() {
		if (!activePreset) return;
		settings = fromQuery(activePreset.query);
		confirmingDiscard = false;
		flash('Changes discarded');
	}

	function deletePreset(id: string) {
		presets = presets.filter((p) => p.id !== id);
		savePresets(presets);
		if (activeId === id) activeId = null;
		confirmingDelete = null;
	}

	let noteTimer: ReturnType<typeof setTimeout>;
	function flash(message: string) {
		presetNote = message;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => (presetNote = ''), 2000);
	}

	// --- moving an activity between machines, as a plain JSON file ---

	function exportSettings() {
		const name = activePreset?.name ?? 'Untitled activity';
		const file = JSON.stringify({ name, settings }, null, 2);
		const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	let fileInput: HTMLInputElement;

	async function importSettings(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // so picking the same file twice still fires
		if (!file) return;
		try {
			const raw = JSON.parse(await file.text());
			settings = settingsFromJson(raw);
			// An imported activity is not yet one of the saved ones.
			activeId = null;
			const name = nameFromJson(raw);
			draftName = name;
			flash(name ? `Imported “${name}”` : 'Imported settings');
		} catch {
			flash('That file could not be read');
		}
	}

	// Icon outlines, drawn on a 24×24 grid and stroked by the .icon rule below.
	const COPY = 'M8 8h11v11H8z M5 16V5h11';
	const CHECK = 'M4 12l5 5L20 6';
	const DOWNLOAD = 'M12 4v10 M8 10l4 4 4-4 M5 19h14';
	const EYE = 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z M12 9.5a2.5 2.5 0 100 5';
	const EYE_OFF = `${EYE} M4 4l16 16`;
	const UPLOAD = 'M12 14V4 M8 8l4-4 4 4 M5 19h14';
	const TRASH = 'M4 7h16 M9 7V5h6v2 M6 7l1 12h10l1-12';

	let copied = $state(false);
	async function copyLink() {
		await navigator.clipboard.writeText(link);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	// The same link as something a class can scan. Held back until the address is
	// known, so the code is never one that points at the wrong place.
	const qr = $derived(origin ? makeQr(link) : null);

	// Hidden until asked for: shown it is the tallest thing in the card, and most
	// of the time the teacher only wants the link. Whichever way it is left is
	// remembered, so a teacher who projects the code every lesson finds it up.
	let qrOpen = $state(false);

	function toggleQr() {
		qrOpen = !qrOpen;
		saveQrOpen(qrOpen);
	}
	let qrCopied = $state(false);
	let qrNote = $state('');

	async function copyQr() {
		if (!qr) return;
		qrNote = '';
		try {
			const png = await qrPng(qr);
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
			qrCopied = true;
			setTimeout(() => (qrCopied = false), 1500);
		} catch {
			// Not every browser will put an image on the clipboard. Say so rather
			// than failing quietly — Save always works.
			qrNote = 'This browser will not copy images. Use Save instead.';
		}
	}

	async function saveQr() {
		if (!qr) return;
		qrNote = '';
		const url = URL.createObjectURL(await qrPng(qr));
		const a = document.createElement('a');
		a.href = url;
		a.download = `${settings.instrument}-practice-qr.png`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

{#snippet icon(d: string)}
	<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg>
{/snippet}

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
					The staff carries the sharps or flats; the student still names plain letters. What changes
					is the fingering — in D major every F is a high 2 on the violin, and in B♭ major the bass
					plays E♭ in half position.
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
					<legend>Position system</legend>
					<p class="hint">
						Both systems use the same hand shapes and the same 1-2-4 fingering down the neck — they
						differ in how the positions are found, and so in what they are called. Rabbath's 2nd
						position is the same notes with the same fingers that Simandl calls 3rd.
					</p>
					<div class="chips">
						{#each ALL_POSITION_SYSTEMS as choice (choice)}
							<button
								type="button"
								class="chip"
								class:on={settings.positionSystem === choice}
								onclick={() => selectPositionSystem(choice)}>{POSITION_SYSTEM_NAMES[choice]}</button
							>
						{/each}
					</div>
				</fieldset>

				<fieldset>
					<legend>Positions</legend>
					<p class="hint">
						The bass hand spans less than the gap between its strings, so a scale needs more than
						one position. Students are only asked for positions you enable here.
					</p>
					<div class="chips">
						{#each SYSTEM_POSITIONS[settings.positionSystem] as id (id)}
							<button
								type="button"
								class="chip"
								class:on={settings.bassPositions.includes(id)}
								onclick={() => toggleBassPosition(id)}
								>{positionName(id, settings.positionSystem)} ({positionLabel(
									id,
									settings.positionSystem
								)})</button
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

		<!-- Rides alongside the settings and follows the teacher down the page, so
		     the link is in reach whatever they are in the middle of changing. -->
		<div class="side">
			<!-- Saving, discarding and moving an activity between machines. Sits above
			     the share card because it is about the activity itself. -->
			<aside class="activity">
				<div class="actionrow">
					<button
						type="button"
						class="btn-save"
						class:pending={unsaved}
						onclick={startSave}
						title={activePreset
							? `Save changes to “${activePreset.name}”`
							: 'Save this as an activity'}
					>
						{activePreset ? 'Save' : 'Save as…'}
					</button>
					<button
						type="button"
						class="btn-ghost"
						disabled={!canDiscard}
						onclick={() => (confirmingDiscard = true)}
						title="Go back to the last saved version"
					>
						Discard
					</button>
					<span class="spacer"></span>
					<button
						type="button"
						class="iconbtn"
						onclick={exportSettings}
						aria-label="Export activity as a file"
						title="Export as JSON"
					>
						{@render icon(DOWNLOAD)}
					</button>
					<button
						type="button"
						class="iconbtn"
						onclick={() => fileInput.click()}
						aria-label="Import an activity file"
						title="Import JSON"
					>
						{@render icon(UPLOAD)}
					</button>
					<input
						bind:this={fileInput}
						class="hidden-file"
						type="file"
						accept="application/json,.json"
						onchange={importSettings}
					/>
				</div>

				<p class="activityname">
					{activePreset ? activePreset.name : 'Unsaved activity'}
					{#if unsaved}<span class="pendingtag">unsaved changes</span>{/if}
				</p>

				{#if naming}
					<div class="namerow">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="nameinput"
							placeholder="Name this activity"
							bind:value={draftName}
							autofocus
							onkeydown={(e) => {
								if (e.key === 'Enter') confirmSaveAs();
								if (e.key === 'Escape') naming = false;
							}}
						/>
						<button type="button" class="btn-save pending" onclick={confirmSaveAs}>Save</button>
						<button type="button" class="btn-ghost" onclick={() => (naming = false)}>Cancel</button>
					</div>
				{/if}

				{#if confirmingDiscard}
					<div class="confirm">
						<span>Throw away changes since the last save?</span>
						<button type="button" class="btn-danger" onclick={discardChanges}>Discard</button>
						<button type="button" class="btn-ghost" onclick={() => (confirmingDiscard = false)}>
							Keep
						</button>
					</div>
				{/if}

				{#if presetNote}<p class="presetnote">{presetNote}</p>{/if}

				{#if presets.length}
					<ul class="presetlist">
						{#each presets as preset (preset.id)}
							<li class:on={preset.id === activeId}>
								<button type="button" class="presetname" onclick={() => loadPreset(preset.id)}>
									{preset.name}
								</button>
								{#if confirmingDelete === preset.id}
									<button
										type="button"
										class="btn-danger tiny"
										onclick={() => deletePreset(preset.id)}
									>
										Delete
									</button>
									<button
										type="button"
										class="btn-ghost tiny"
										onclick={() => (confirmingDelete = null)}
									>
										No
									</button>
								{:else}
									<button
										type="button"
										class="iconbtn small"
										onclick={() => (confirmingDelete = preset.id)}
										aria-label={`Delete ${preset.name}`}
										title="Delete"
									>
										{@render icon(TRASH)}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</aside>

			<aside class="sharebar">
				<p class="sharetitle">Share with students</p>

				<!-- The link is the button: clicking it opens the challenge, and the
			     icon beside it copies the address instead. -->
				<div class="linkrow">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- opens the shareable challenge link in a new tab -->
					<a class="linktext" href={link} target="_blank" rel="noopener" title={link}>{link}</a>
					<button
						type="button"
						class="iconbtn"
						onclick={copyLink}
						aria-label="Copy link"
						title={copied ? 'Copied' : 'Copy link'}
					>
						{@render icon(copied ? CHECK : COPY)}
					</button>
				</div>

				{#if qr}
					<!-- The code itself stays out of the way until the eye is pressed;
				     saving and copying do not need it on screen. -->
					<div class="qrrow">
						<span class="qrlabel">QR code</span>
						<button
							type="button"
							class="iconbtn"
							onclick={toggleQr}
							aria-expanded={qrOpen}
							aria-label={qrOpen ? 'Hide the QR code' : 'Show the QR code'}
							title={qrOpen ? 'Hide' : 'Show'}
						>
							{@render icon(qrOpen ? EYE_OFF : EYE)}
						</button>
						<button
							type="button"
							class="iconbtn"
							onclick={saveQr}
							aria-label="Save QR code"
							title="Save QR code"
						>
							{@render icon(DOWNLOAD)}
						</button>
						<button
							type="button"
							class="iconbtn"
							onclick={copyQr}
							aria-label="Copy QR code"
							title={qrCopied ? 'Copied' : 'Copy QR code'}
						>
							{@render icon(qrCopied ? CHECK : COPY)}
						</button>
					</div>

					{#if qrOpen}
						<div class="qr">
							<svg
								viewBox="0 0 {qrExtent(qr)} {qrExtent(qr)}"
								role="img"
								aria-label="QR code for this challenge link"
							>
								<rect width={qrExtent(qr)} height={qrExtent(qr)} fill="#fff" />
								<path d={qrPath(qr)} fill="#000" />
							</svg>
						</div>
					{/if}
					{#if qrNote}<p class="sharenote">{qrNote}</p>{/if}
				{/if}

				<p class="sharehint">
					Both update as you change the settings — the link and the code always match.
				</p>
			</aside>
		</div>
	</div>
</div>

<style>
	.page {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
	}
	.layout {
		display: grid;
		gap: 1.5rem;
		align-items: start;
	}
	/* Wide enough for two columns: settings keep their old width and the share
	   card takes the rest, sticking to the top as the page scrolls. Narrower
	   than this it drops back under the settings, where a side column would
	   only squeeze both. */
	@media (min-width: 60rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 19rem;
		}
		.side {
			position: sticky;
			top: 1.5rem;
		}
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.activity {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
	}
	.actionrow {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.actionrow :global(.btn-save),
	.actionrow :global(.btn-ghost) {
		padding: 0.45rem 0.85rem;
		font-size: 0.88rem;
		white-space: nowrap;
	}
	.spacer {
		flex: 1;
	}
	.hidden-file {
		display: none;
	}
	.activityname {
		margin-top: 0.6rem;
		font-size: 0.9rem;
		font-weight: 700;
	}
	.pendingtag {
		margin-left: 0.4rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: var(--amber);
		border: 1px solid var(--amber-border);
		color: #7a4100;
		font-size: 0.72rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.namerow,
	.confirm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.confirm span {
		flex: 1 1 100%;
		font-size: 0.85rem;
	}
	.namerow :global(button),
	.confirm :global(button) {
		padding: 0.4rem 0.75rem;
		font-size: 0.85rem;
	}
	.nameinput {
		flex: 1 1 100%;
		min-width: 0;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		font-size: 0.9rem;
	}
	.presetnote {
		margin-top: 0.5rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--blue-dark);
	}
	.presetlist {
		margin-top: 0.7rem;
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.presetlist li {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 8px;
		padding: 0.1rem;
	}
	.presetlist li.on {
		background: var(--blue-soft);
	}
	.presetname {
		flex: 1;
		min-width: 0;
		text-align: left;
		padding: 0.35rem 0.5rem;
		border: none;
		background: none;
		font-size: 0.88rem;
		font-weight: 600;
		color: #333;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.presetname:hover {
		color: var(--blue);
	}
	.presetlist li.on .presetname {
		color: var(--blue-dark);
	}
	.iconbtn.small {
		width: 1.9rem;
		height: 1.9rem;
		border-color: transparent;
		background: none;
		color: #8a8f98;
	}
	.iconbtn.small:hover {
		color: #b3261e;
		border-color: #f3c9c6;
		background: #fff;
	}
	:global(.tiny) {
		padding: 0.25rem 0.5rem !important;
		font-size: 0.78rem !important;
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
		background: var(--blue-soft);
		border: 1px solid var(--blue-border);
		border-radius: var(--radius);
		padding: 1rem 1.25rem;
	}
	.sharetitle {
		font-weight: 700;
		margin-bottom: 0.5rem;
	}
	/* Link and its copy button on one line, the address itself taking whatever
	   room is left and trailing off rather than wrapping the card wider. */
	.linkrow {
		display: flex;
		align-items: stretch;
		gap: 0.4rem;
	}
	.linktext {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--blue-border);
		border-radius: 8px;
		background: #fff;
		font-size: 0.85rem;
		color: var(--blue-dark);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.linktext:hover {
		border-color: var(--blue);
		text-decoration: underline;
	}
	.iconbtn {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.25rem;
		border: 1px solid var(--blue-border);
		border-radius: 8px;
		background: #fff;
		color: var(--blue-dark);
		cursor: pointer;
	}
	.iconbtn:hover {
		border-color: var(--blue);
		color: var(--blue);
	}
	.icon {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* One line: what it is, then show / save / copy. */
	.qrrow {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}
	.qrlabel {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--blue-dark);
	}
	.qrrow .iconbtn {
		height: 2.25rem;
	}
	.qr {
		margin-top: 0.5rem;
		padding: 0.4rem;
		/* A QR needs light quiet space around it to scan, and the card is tinted. */
		background: #fff;
		border: 1px solid var(--blue-border);
		border-radius: 8px;
	}
	.qr svg {
		display: block;
		width: 100%;
		height: auto;
		/* Keep the modules hard-edged rather than smoothed when scaled. */
		shape-rendering: crispEdges;
	}
	.sharehint {
		margin-top: 0.6rem;
		font-size: 0.82rem;
		color: var(--blue-dark);
	}
	.sharenote {
		margin-top: 0.5rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: #842029;
	}
</style>

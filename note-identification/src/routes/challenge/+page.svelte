<script lang="ts">
	import { page } from '$app/state';
	import Exercise from '$lib/Exercise.svelte';
	import { asksFingering, settingsFromParams } from '$lib/settings';
	import { INSTRUMENT_NAMES } from '$lib/strings';

	// Read the challenge settings straight from the link's query string.
	const settings = $derived(settingsFromParams(page.url.searchParams));
	const title = $derived(
		asksFingering(settings)
			? `${INSTRUMENT_NAMES[settings.instrument]}: Notes & Fingering`
			: `${INSTRUMENT_NAMES[settings.instrument]}: Name the Note`
	);
</script>

<div class="challenge">
	<header>
		<h1>{title}</h1>
	</header>

	{#key page.url.search}
		<Exercise {settings} />
	{/key}
</div>

<style>
	.challenge {
		max-width: 36rem;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}
	h1 {
		font-size: 1.6rem;
		font-weight: 800;
	}
</style>

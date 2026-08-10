<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Exercise from '$lib/Exercise.svelte';
	import { settingsFromParams } from '$lib/settings';

	// Read the challenge settings straight from the link's query string.
	const settings = $derived(settingsFromParams(page.url.searchParams));
</script>

<div class="challenge">
	<header>
		<h1>Name the Note</h1>
		<a class="back" href={resolve('/')}>← Change settings</a>
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
	.back {
		color: #4f46e5;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
	}
</style>

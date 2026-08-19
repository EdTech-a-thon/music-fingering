<script lang="ts">
	import './layout.css';
	import logo from '$lib/assets/logo.svg';
	import Footer from '$lib/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Clef Coach</title>
	<link rel="icon" href={logo} />
</svelte:head>

<!-- The footer sits below every page, and is pushed to the bottom of the
     window on short pages so it never floats mid-screen. -->
<div class="shell">
	<div class="content">{@render children()}</div>
	<Footer />
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	.content {
		flex: 1;
	}
</style>

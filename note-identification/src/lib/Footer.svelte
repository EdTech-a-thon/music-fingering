<script lang="ts">
	// The EdTech-a-thon footer, shared with the other EdTech-a-thon tools so the
	// whole set feels like one project.
	import { resolve } from '$app/paths';
	import edtechathonLogo from '$lib/assets/edtechathon-logo.svg';
</script>

<footer class="no-print">
	<a class="built" href="https://edtechathon.com" target="_blank" rel="noopener noreferrer">
		<img src={edtechathonLogo} alt="" width="24" height="24" />
		Built by the EdTech-a-thon
	</a>
	<a href={resolve('/about')}>about</a>
	<a href={resolve('/privacy')}>privacy</a>
</footer>

<style>
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 1.25rem;
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 2rem;
		text-align: center;
	}
	a {
		color: #6b7280;
		font-size: 0.9rem;
		text-decoration: none;
	}
	a:hover {
		color: var(--blue-dark);
	}
	.built {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>

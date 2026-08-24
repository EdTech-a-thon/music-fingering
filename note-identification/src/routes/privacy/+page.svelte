<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy · Clef Coach</title>
</svelte:head>

<div class="doc">
	<header>
		<div>
			<h1>Privacy</h1>
			<p class="lede">What we collect, what we don't, and why.</p>
		</div>
		<a class="back" href={resolve('/')}>← Back to settings</a>
	</header>

	<section class="panel">
		<p>
			Clef Coach does not collect personal information from teachers or students. There are no
			accounts and no sign-ins. So we can tell how much the site is being used, page visits are
			counted with Cloudflare Web Analytics, which uses no cookies, does not follow visitors from
			site to site, and does not build a profile of anyone. We do not share, sell, or otherwise
			transfer visitor data to third parties.
		</p>
		<p>
			Clef Coach remembers your saved activity setups and the settings you were last working on in
			your browser's local storage, and that information never leaves your device. Clearing your
			browser's storage removes it. When you share an activity with students, all of its settings
			travel inside the link itself — nothing about it is stored on our end, and a student's answers
			stay in their own browser for the length of the activity.
		</p>
		<p>
			Questions or concerns? Email
			<a href="mailto:directors@edtechathon.com?subject=clefcoach%20privacy"
				>directors@edtechathon.com</a
			>.
		</p>
	</section>
</div>

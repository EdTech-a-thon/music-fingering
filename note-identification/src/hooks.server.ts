import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';

/**
 * Cloudflare Web Analytics counts page views without cookies or any personal
 * data. It is only switched on when CF_BEACON_TOKEN is set in the environment,
 * so local and preview runs stay untracked. The token is not a secret — it
 * ships to the browser and only names the site in Cloudflare's dashboard — but
 * keeping it in the environment means it lives outside the repository.
 */
function beaconTag(token: string | undefined) {
	// The token comes from the environment, so keep it to the characters
	// Cloudflare issues rather than trusting it inside an HTML attribute.
	if (!token || !/^[\w-]+$/.test(token)) return '';

	return (
		'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" ' +
		`data-cf-beacon='{"token": "${token}"}'></script>`
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	// The environment is read per request, so the token can be set (or cleared)
	// without rebuilding the site.
	const tag = beaconTag(env.CF_BEACON_TOKEN);

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%cf.beacon%', tag)
	});
};

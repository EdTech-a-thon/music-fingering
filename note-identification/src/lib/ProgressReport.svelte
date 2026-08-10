<script lang="ts">
	// A dialog shown over the results screen: the score, every setting used, a
	// Print button, and an optional signature that generates a verification code.
	import { describeSettings, type Settings } from './settings';

	let {
		settings,
		correct,
		attempted,
		elapsedMs,
		isHighScore = false,
		onClose
	}: {
		settings: Settings;
		correct: number;
		attempted: number;
		elapsedMs: number;
		isHighScore?: boolean;
		onClose: () => void;
	} = $props();

	const rows = $derived(describeSettings(settings));
	const percent = $derived(attempted ? Math.round((correct / attempted) * 100) : 0);

	function formatTime(ms: number): string {
		const total = Math.round(ms / 1000);
		return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
	}
	const elapsed = $derived(formatTime(elapsedMs));

	let signature = $state('');
	let signed = $state(false);
	let code = $state('');

	// A small, deterministic integrity code — not cryptographic tamper-proofing,
	// just a way to tie a signature to this exact result and configuration.
	function fnv(str: string): number {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193) >>> 0;
		}
		return h >>> 0;
	}
	function sign() {
		const name = signature.trim();
		if (!name) return;
		const base = rows.map((r) => r.value).join('|') + `|${correct}/${attempted}|${elapsed}|${name}`;
		const raw = (
			fnv(base).toString(36) +
			fnv(base.split('').reverse().join('')).toString(36) +
			'00000000'
		)
			.toUpperCase()
			.slice(0, 8);
		code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
		signed = true;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	class="backdrop"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onClose()}
>
	<div
		class="dialog print-area"
		role="dialog"
		aria-modal="true"
		aria-label="Progress Report"
		tabindex="-1"
	>
		<h2>Progress Report</h2>
		<p class="exercise-name">Note Identification</p>

		<div class="summary">
			<div><span>Score</span><strong>{correct}/{attempted}</strong></div>
			<div><span>Percentage</span><strong>{percent}%</strong></div>
			<div><span>Elapsed</span><strong>{elapsed}</strong></div>
			{#if isHighScore}
				<div class="hs"><span>Result</span><strong>New High Score!</strong></div>
			{/if}
		</div>

		<h3>Exercise settings</h3>
		<table class="settings-table">
			<tbody>
				{#each rows as row (row.label)}
					<tr>
						<th>{row.label}</th>
						<td>{row.value}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="verify">
			<h3>Verification code</h3>
			<p class="verify-help">
				Enter the name or ID your teacher asks for, then sign. Signing locks the signature and
				produces a verification code.
			</p>
			<div class="verify-row">
				<input
					type="text"
					placeholder="Your name or ID"
					bind:value={signature}
					readonly={signed}
					aria-label="Signature"
				/>
				<button
					type="button"
					class="btn-primary"
					onclick={sign}
					disabled={signed || !signature.trim()}
				>
					{signed ? 'Signed' : 'Sign Report'}
				</button>
			</div>
			{#if signed}
				<p class="code">Verification code: <strong>{code}</strong></p>
			{/if}
		</div>

		<div class="dialog-actions no-print">
			<button type="button" class="btn-ghost" onclick={() => window.print()}>Print</button>
			<button type="button" class="btn-primary" onclick={onClose}>Done</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 2rem 1rem;
		overflow-y: auto;
		z-index: 50;
	}
	.dialog {
		background: #fff;
		border-radius: 16px;
		padding: 1.75rem;
		max-width: 34rem;
		width: 100%;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
	}
	h2 {
		font-size: 1.5rem;
		font-weight: 800;
	}
	.exercise-name {
		color: #555;
		margin-bottom: 1rem;
	}
	h3 {
		font-size: 1rem;
		font-weight: 700;
		margin: 1.25rem 0 0.5rem;
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	.summary > div {
		background: var(--blue-soft);
		border-radius: 10px;
		padding: 0.6rem 0.75rem;
		display: flex;
		flex-direction: column;
	}
	.summary span {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #667;
	}
	.summary strong {
		font-size: 1.25rem;
	}
	.summary .hs strong {
		color: var(--blue-dark);
		font-size: 1rem;
	}
	.settings-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	.settings-table th {
		text-align: left;
		font-weight: 600;
		color: #555;
		padding: 0.35rem 0.75rem 0.35rem 0;
		white-space: nowrap;
		vertical-align: top;
		width: 40%;
	}
	.settings-table td {
		padding: 0.35rem 0;
		border-bottom: 1px solid #f0f0f2;
	}
	.verify-help {
		font-size: 0.85rem;
		color: #667;
		margin-bottom: 0.6rem;
	}
	.verify-row {
		display: flex;
		gap: 0.5rem;
	}
	.verify-row input {
		flex: 1;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 0.95rem;
	}
	.verify-row input[readonly] {
		background: #f5f5f7;
		color: #444;
	}
	.code {
		margin-top: 0.6rem;
		font-variant-numeric: tabular-nums;
	}
	.code strong {
		letter-spacing: 0.05em;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}
</style>

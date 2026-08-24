# Note Naming Practice

A web app for practising note identification on the musical staff, with a
customizer and a shareable challenge link.

## Setting up a challenge (home page)

Configure the exercise on the left; a live student preview updates on the right.

- **Clefs** — Treble, Bass, Alto, Tenor
- **Range** — the lowest and highest note that can appear
- **Positions** — lines and spaces, lines only, or spaces only
- **Key signatures** — none, 1–7 sharps, 1–7 flats (pick several for a mix); shown
  on the staff and reflected in the correct answer
- **Note values** — whole, half, quarter (visual)
- **Accidentals** — allow explicit sharps/flats on notes
- **Helpers** — blue letter labels beside the staff
- **Challenge mode** — a question limit and/or time limit, and whether students may
  retry a wrong answer (multiple attempts)

Every change updates the shareable link at the bottom; send it to students.

## Taking a challenge

Opening a challenge link shows a Start gate — the clock and score begin only when
the student presses **Start Challenge**. The top bar shows a running
correct/attempted score and percentage plus the progress toward the limit. When
the run ends, a results screen shows the score, percentage and elapsed time, and a
**Progress Report** (with every setting used) that can be printed and optionally
signed to produce a verification code.

## About

This is an original, from-scratch implementation, inspired by the general idea of
an online note-naming exercise but containing none of any other site's code,
artwork, audio, or branding. The clef symbols are standard public-domain
music-notation glyphs (G, F, and C clefs) from Wikimedia Commons.

Not yet implemented (kept simple for now): naming systems other than letters,
audio, and the per-spelling note filter.

## Running

```
bun install
bun run dev      # start the site
bun run check    # type-check
bun run lint     # format + lint check
```

## Visitor counts

Set `CF_BEACON_TOKEN` (see `.env.example`) to the Cloudflare Web Analytics site
token and the beacon is added to every page. Leave it unset — as it is in local
runs — and no analytics script is loaded at all.

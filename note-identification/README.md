# Note Naming Practice

A simple web app for practising note identification on the musical staff.

- **Set up a challenge** on the home page: choose clefs (treble, bass, alto,
  tenor), whether to include sharps & flats, letters vs. solfège names, whether
  to include ledger lines, and how many questions.
- **Try it live** in the student preview on the right as you change settings.
- **Share a link** with students; the link opens straight into the challenge.

## About

This is an original, from-scratch implementation. It was inspired by the general
idea of an online note-naming exercise, but contains none of any other site's
code, artwork, audio, or branding.

The clef symbols are standard music-notation glyphs from Wikimedia Commons
(public domain): the G, F, and C clefs.

## Running

```
bun install
bun run dev      # start the site
bun run check    # type-check
bun run lint     # format + lint check
```

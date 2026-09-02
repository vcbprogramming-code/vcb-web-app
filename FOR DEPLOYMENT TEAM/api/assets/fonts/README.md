# Thai fonts — required before the API will start

Put these two files in this directory:

    Sarabun-Regular.ttf
    Sarabun-Bold.ttf

Download from Google Fonts: <https://fonts.google.com/specimen/Sarabun>
(Get font → Download all → take `Sarabun-Regular.ttf` and `Sarabun-Bold.ttf`
out of the zip. Licence is SIL Open Font 1.1, so redistributing them inside a
deployment image is fine.)

## Why the API refuses to start without them

PDFKit's built-in fonts (Helvetica and friends) contain no Thai glyphs, and
PDFKit **does not raise an error on a missing glyph — it writes nothing**. A PDF
generated without Sarabun therefore comes out with correct margins, correct
layout, correct English, and every Thai character silently absent. Nothing in the logs
says so; the failure is only visible to the person who eventually opens the
document.

Because every document this API produces is at least partly Thai, that is not a
degraded mode worth running in. `src/index.js` calls `assertFontsPresent()`
before `app.listen()`, so a container missing these files exits immediately with
a message naming them rather than reporting itself healthy.

If you are deploying an instance that genuinely issues no PDFs, set
`PDF_FONTS_OPTIONAL=1` and it will start with a warning instead. The PDF routes
will fail when called.

## Docker

    COPY assets/fonts/Sarabun-*.ttf ./assets/fonts/

Nothing stops you committing the two .ttf files - the SIL Open Font Licence
permits redistribution, and vendoring them makes the build reproducible without
a network fetch. Whichever you choose, the container must have them at
`assets/fonts/` before it starts.

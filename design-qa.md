# Design QA

## Comparison target

- Source visual truth: `C:\Users\chenm\.codex\generated_images\019ffed7-f082-7541-a8ab-85667532bab7\exec-dd99812c-ecc0-4c98-9003-ad4aa41827fb.png`
- Implementation capture: `C:\Users\chenm\Desktop\interview-pilot\implementation-capture.png`
- Source dimensions: 1484 × 1059 px.
- Implementation capture dimensions: 2000 × 1200 px desktop capture.
- Intended implementation viewport: 1180 × 820 logical px.
- State: idle / no active answer.

## Evidence

The capture contains the desktop application and overlapping desktop windows rather than a clean, isolated capture of the PyQt window at the intended viewport. The source and implementation therefore cannot be normalized into a valid 1:1 visual comparison.

## Required fidelity surfaces

- Fonts and typography: code now uses a 19px answer body and 15–17px control scale, but screenshot evidence is not isolated enough to validate wrapping and optical weight.
- Spacing and layout rhythm: the implementation has the selected design's left action rail, wide answer column, header controls, and bottom prompt, but exact region sizing needs a clean capture.
- Colors and visual tokens: dark navy translucent glass, cyan active state, and amber live state are implemented; compositing against other desktop windows prevents reliable opacity comparison.
- Image quality and asset fidelity: no in-app raster asset is required; the transparent floating window deliberately uses the user's desktop background.
- Copy and content: Chinese control, placeholder, status, and action copy are documented in `DESIGN_SPEC.md` and implemented in the interface.

## Findings

- [P1] Clean visual verification is unavailable.
  Location: captured desktop state.
  Evidence: the application cannot be isolated from overlapping desktop content in `implementation-capture.png`.
  Impact: no reliable visual comparison against the selected 1484 × 1059 target can be made.
  Fix: capture the Interview Pilot window alone at 1180 × 820 after opening it on an unobstructed desktop area.

## Implementation checklist

- [x] Apply left-side action rail.
- [x] Enlarge primary answer typography.
- [x] Add Chinese actions, status copy, and transparency label.
- [x] Preserve manual recording, automatic listening, text input, copy, clear, opacity, pin, and close behavior.
- [ ] Produce a clean isolated application capture and rerun visual QA.

## Comparison history

1. Implemented the selected Focus Deck layout, then captured the desktop. The capture was obstructed by other windows, so no visual-fidelity judgement was made.

final result: blocked

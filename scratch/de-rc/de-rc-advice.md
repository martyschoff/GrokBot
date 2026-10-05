# De-RC a painting: advice

Answer to [issue #28](https://github.com/martyschoff/GrokBot/issues/28). This is advice only. No picture has been edited and nothing here has been applied. It is for Martin to read and talk through.

## 1. What the two cases show

Fra Angelico's San Marco Annunciation worked, and Leonardo's Uffizi Annunciation failed. The method was the same both times: cut, generate the piece, composite. So the method itself is sound. The two jobs failed or succeeded on four things that were different about them.

| | San Marco (worked) | Leonardo (failed) |
|---|---|---|
| Number of changes | One: unbow the angel | Two: upright herald and remove the lily |
| How hard the style is to generate | Flat fresco, clear outlines, few tones | Oil sfumato, soft edges, fine drapery, detailed wings and curls |
| Where the seam goes | The loggia bay has columns, which give hard edges to cut along | Open garden and landscape run straight through, so there is no edge to hide a seam |
| What "the same" meant | Same in kind: a standing angel in Angelico's manner | Identical: the same tunic, cloak, wings, and hair in a new pose |

Every item in the failure list traces back to one of these four:

- **Style drift, redder hair, and a figure that was not identical.** The whole figure was regenerated, so every pixel of Gabriel came from the model. A generator cannot copy a figure exactly while changing its pose. Asking for "identical" and "new pose" from one generation contradicts itself.
- **Wrong size.** The figure was generated with no fixed scale, so the model picked one.
- **Wrong wings and clothing.** A kneeling figure's drapery folds differently from a standing one. The model invented new folds, and with them new clothes. Leonardo's wings are also hard to hit: as commonly reported, a later hand lengthened them, so even the original crop is a mix of two painters.
- **Seam on the left panel, and a soft fringe.** A standing figure covers sky, trees, and meadow that the kneeling figure never covered. That uncovered strip had to be invented, and it had no architecture to hide its edge. The soft fringe comes from a feathered matte blending generated hair into original background.
- **Two changes at once.** Gabriel holds the lily in his hand. Removing it means repainting the hand. Doing that while also changing the pose doubled the area being regenerated and left no way to tell which change caused which fault.

## 2. Before touching any pixels: is it a target?

Run the Küng and Oden test on each candidate element and write down the answer: does this element make the apostolic gospel more visible, or does it make a later church system feel inevitable and apostolic?

- Name **one** load from the cut list (mandorla or dormition glory, rosary bead-machine, a coronation-type Trinity crowning Mary, papal or episcopal triumph at the center, a legend or shrine economy). If it doesn't fit one of these, it is probably not a target.
- Check it against the keep list. Kneeling or adoration before the deity is kept. Christ and Mary as far as Scripture and the fathers through Ephesus allow are kept. Sepulchre lilies are kept unless Martin has called an explicit lily-scrub.
- Two Leonardo questions for Martin to settle before any retry:
  - **The lily.** Gabriel's lily is an Annunciation lily, not a sepulchre lily. The brief does not say which of the cut-list loads it carries. If removing it rests only on a lily-scrub, say that in the job. If not, it may not be a target, and dropping it removes the hardest part of the job (the hand).
  - **The bow.** The San Marco reading is that the angel bowing to Mary over-elevates her: it is not kneeling before the deity. That reading carries over to Leonardo, but it should be stated in the job so it is clear the change is not removing adoration.

## 3. Is the change feasible on this painting?

Score the painting before deciding how to approach it:

1. **Seams.** Are there columns, door frames, wall edges, or contour lines where a cut can sit? San Marco had them. Leonardo's left half mostly does not.
2. **Revealed area.** Does the change uncover background the original never painted? Unbowing to standing does. Removing a held object reveals a little. A smaller revealed area means lower risk.
3. **Style.** Flat tempera and fresco regenerate well. Sfumato oil, Northern detail, and heavy craquelure regenerate badly.
4. **What the brief says about "the same."** If the brief says "identical," regeneration can't be the main tool (see section 4).

If two or more of these score badly, choose the smallest acceptable change, or park the painting on purpose instead of after a failed attempt.

## 4. Method

Same principle as the success: original pixels everywhere that is not the target. One step further than the success: original pixels *inside* the target too, wherever the brief says "identical."

1. **One change per pass.** Finish and accept one change, then begin the next from the accepted file.
2. **Lock the frame.** Fix the output size, and measure the target's scale from things that will not move: Mary's head height, a column, the reading desk. Write down the head height and the position of the feet in pixels before generating anything.
3. **Move pixels before you generate them.** For kneeling to standing, the head, hair, wings, and upper torso barely change. Lift and slightly rotate those *original* pixels into their new position. Only generate what really changes: the lower drapery, the legs, and the fall of the cloak. This one step deals with hair color, wings, clothing, and identity in a single move.
4. **Generate the pieces separately, as in San Marco.**
   - The changed part of the figure, on a plain or transparent background, using the original crop as the style and color reference.
   - The revealed background ("the empty bay"), using only this same painting as the reference. For Leonardo, sample the meadow, cypresses, and sky from elsewhere in the picture, and prefer cloning real pixels from those places over generating new ones.
   - Never regenerate the whole scene. San Marco showed that a whole-scene pass puts the mark back.
5. **Composite with a hard matte.** Cut along a real contour, such as a drapery edge, a wing outline, or a column. Feather by only a pixel or two. A wide feather is what leaves a soft fringe.
6. **Match locally, never globally.** Match the color and tone of each generated piece to the neighbouring original pixels it touches: hair to hair, sky to sky. Then add the painting's grain and craquelure over the generated pieces so they don't look smoother than the original.
7. **Prove the untouched area is untouched.** Diff the result against the original outside the target mask. It should be zero. Any non-zero area is drift and should be rejected.

## 5. Acceptance checklist

This is built from the Leonardo failures, so a retry is checked against exactly what went wrong.

- [ ] Only the named target changed, and the diff outside the mask is zero.
- [ ] The figure's scale matches the measured head height and foot line.
- [ ] Wings: same outline, feather pattern, and color as the original crop (original pixels wherever possible).
- [ ] Clothing: same garments, colors, and trim. Only folds that the pose forces have changed.
- [ ] Hair: same hue as the original, checked side by side, and no soft fringe at the edge.
- [ ] No visible seam at 100% zoom, especially across open landscape.
- [ ] Style: at arm's length and at 100%, the new part reads as the same painter.
- [ ] Keep list intact: narrative, Christ and Mary, architecture, light, and any non-target lilies.

## 6. If Leonardo is retried (for discussion, not to apply)

- Settle the two questions in section 2 first.
- Split the work into separate jobs: the upright herald first, then the lily only if it is confirmed as a target.
- Build the upright figure mostly from Gabriel's own pixels moved into place (section 4, step 3), and generate only the lower drapery.
- Fill the revealed landscape by cloning from Leonardo's own meadow and trees, and put the seam on the figure's contour, not in open ground.
- If "identical" cannot be met even with moved pixels, the options are: accept "same in kind" as San Marco did, choose a smaller change, or keep it parked. Martin decides which.

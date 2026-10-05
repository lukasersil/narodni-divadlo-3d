# Analýza interiéru – srovnání modelu s podklady (3. 10. 2026)

Zprávu napsal pomocný agent: porovnal rendery modelu s řezem z roku 1914, Fialkovými plány 1883, Roubalíkovými rytinami, pohlednicí s rozmístěním sedadel z roku 1900 a fotkami v `04_interier_reference`. Původní znění je anglicky a je níže. **Čísla jsou návrhy k ověření, ne potvrzená fakta.**

**Moje kontrola hlavního zjištění (zúžení podkovy):** sedí s mými dřívějšími měřeními z plánu 04 (I. pořadí, `tools/qa/plan_measure.py`). V příčném řezu v = 18–26 m (rámec hlediště) vycházelo:
- tenké zdi u ±6,8–7,4 m (čelo lóží / parapet),
- zdi u ±8,4–9,5 m (zadní stěny lóží),
- masivní zeď u ±10,6–12,3 m.

Model má parapet na ±8,9 a zadní stěnu lóží na ±11,15, takže lóže leží v chodbě. Před přestavbou to ještě jednou ověřit překryvem (`tools/qa/plan_overlay.py`).

---

## Original report (English)

Positions along the axis are given relative to **P = face of the proscenium wall (model v 36.6)**. The registration of the section against the model may be off by about ±0.4 m in v.

**Four main errors:**
1. The horseshoe is about 3.3 m too wide and about 3 m too deep at the parapet line. The model puts the boxes where the corridor behind the boxes actually is.
2. Everything from the top gallery upward sits 2.2–3 m too low: ceiling, girders, chandelier. *(Ceiling and girders have since been raised in this round: 23.2 and 24.8–27.4.)*
3. The foyer and loggia floors are about 1.4 m too high.
4. The backs of tiers I and II are open balconies, not boxes, and the top gallery is a deep amphitheatre.

### 1. Auditorium

**Plan geometry**

| | Real | Model |
|---|---|---|
| Parapet, sides (half-width) | stalls 7.1 · I 7.25 · II 7.6 · III 7.75 | 8.9 |
| Box back wall | ±9.3 (boxes ≈2.0 m deep) | 11.15 |
| Corridor behind boxes | ±9.4–11.4, then a 1.3 m wall | missing |
| Horseshoe shape | straight sides from P to P−9.4, then a semicircle r≈7.25 | — |
| Parapet on the axis | I P−16.6 · II P−17.3 · III P−18.0 · gallery colonnade P−21 | ≈P−19.5 |
| Back wall on the axis | v≈14.6–15.2 | 14.4 (correct) |
| Box width (centre to centre at the parapet) | 1.65–1.8 | 1.95 |

**Tiers.**
- Floor readings 3.0 / 6.0 / 9.5 / 12.9 / 17.7 are confirmed to ±0.2 m.
- At the parapet line the floor is about 0.2 m higher than those slab levels.
- The most reliable visible measure is the parapet top rail: **4.05 / 7.15 / 10.45 / 13.95 / 18.8**.

| Tier | Parapet | Sides | Back |
|---|---|---|---|
| Stalls boxes | 0.6 m; ivory panels with gilded rosette roundels | 7 boxes per side (I–II at the proscenium) | Stalls run to the back wall (originally standing room) |
| I. pořadí | 1.0 m, convex; ivory covered with high-relief gilded acanthus, winged Victories on each column axis, meander band on top | 6 boxes + royal box (west, ≈3.7 m wide); east side 6 + 2 | **I. balkon, 3–4 raked rows, open** |
| II. pořadí | 0.85 m; gilded diamond trellis, lyres with palms, winged putti | 8 boxes per side | **II. balkon, 3 rows, open** |
| III (I. galerie) | 0.85 m; trellis, palmettes, angels | 1 row per side to the proscenium, raised behind a second parapet at 14.5–15.0 | 5 raked rows + standing strip |
| IV (II. galerie) | turned-baluster balustrade | 1 row per side, set back to ±9.7 | **About 10 rows climbing from 17.95 to 21.9 at about 36°, back to v≈8.6** |

- **Tier heights in the model:** 6.6, 10.2 and 13.8 are 0.4–0.7 m too high, and 17.2 is about 0.7 m too low. The real spacing between floors is 3.0 / 3.4 / 3.5 / 4.85 m, not a uniform 3.6. *(Already changed to 3.0 / 6.0 / 9.5 / 12.9 / 17.7 in this round.)*
- **What the renders show:**
  - Box partitions continue all round the back, where tiers I–III should be open.
  - The partitions are loose slabs of different heights. The white background shows through, because there are no back walls or box ceilings.
  - Hair-thin gold poles run through every tier.
  - All tiers have the same pale parapet with flat oval medallions and red dots.
- **Boxes:**
  - Crimson damask walls (#7B1520) and an ivory ceiling.
  - Back wall: a polished brown wood door with a small oval window, and gold-framed mirrors.
  - Red velvet curtains at the front, tied back at each column.
  - Between boxes: ivory columns about 0.18 m thick with gilded Corinthian capitals, one per tier, about 2.3 m tall from the parapet to the ceiling of the box, under a small gilded beam about 0.35 m deep.
- **Lamps:**
  - On every column, just under the next parapet: a gilded bracket with 2 frosted white globes (3-globe candelabra on the stalls level).
  - Small pink-shaded wall lights inside the boxes.
  - Round recessed lights under the balconies.
  - The floating 3-bulb clusters in the model should become these globe brackets.
- **Top-gallery colonnade:**
  - Columns stand on the gallery front, about 3.0 m apart; shafts run from 18.8 to 22.1, with gilded capitals.
  - They carry a gilded beam and cornice band at 22.2–23.2 (frieze of discs, dentils).
  - Each bay has a small vault with a gilded rosette and a 4–5-light pendant lamp.
  - The ceiling above the gallery is at about 24.6.
  - Organ pipes fill the top-level bays next to the proscenium, on both sides.
- **Proscenium boxes:** a stack on each side from P back to about P−3: stalls, I, II and III levels, plus the organ loft on top.
  - The I-level boxes (presidential box on the west, a twin on the east) have:
    - a gilded balustrade front;
    - two gilded caryatids about 2 m tall;
    - a red velvet canopy with gold fringe (St Wenceslas crown on the west one);
    - a gilded beam with laurel wreaths.
  - The other levels are framed by ivory pilasters with gilded capitals.
  - The model has two plain full-height gold columns per side instead. These must go.
- **Portal:**
  - Clear opening about 11.5 m wide × 11.9 m high (stage floor 3.0 to about 14.9).
  - Vertical sides, a flat top, upper corners rounded at r≈1.2. The model's segmental arch is wrong.
  - The frame is about 1.0 m wide: ivory with gilded mouldings and a chain of round medallions alternating with arabesques. The masonry opening is about 12.8 m.
- **Frieze:**
  - About 1.15 m high and 14 m long, at about 16.6–17.8 (±0.4). The model's 15.4–17 is too low and too tall.
  - Teal ground with gilded capitals about 0.6 m high.
  - Centre: crowned white lion on red in a gilded cartouche with palm fronds. Ends: Silesian black eagle on gold (left) and Moravian red-and-white chequered eagle on blue (right).
- **Pediment:**
  - About 16 m wide at the base, apex at about 21.3.
  - Sculpture group of about 7 figures: a winged genius with raised arms in the centre, reclining figures, a lion at the right end, end ornaments on the corners.
  - The wall above it, up to the ceiling cornice, is mauve-pink (#C9A7A3) with painted garlands.
- **Curtain:**
  - The red pelmet with gold embroidery and gold fringe is right, but it should be about 2.0 m deep with a **straight** bottom edge.
  - Below it hangs either the closed red velvet curtain, straight, or the Hynais curtain filling the whole opening (centre scene about 60% of the width, painted borders with caryatids, a bottom band of 10 coats of arms).
  - Remove the tied-back side drapes, and stop cropping the Hynais curtain to its centre scene.
- **Ceiling:**
  - Shallow dome: 23.2 at the edge, 24.05 at r≈3 m, with an opening in the centre. Its centre is about 11.1 m in front of P (v≈25.5).
  - Rings, from the centre out:
    - a gilded openwork grille, Ø≈3.0, which the chandelier passes through;
    - a coral ring with gilded beads, out to Ø≈4.5;
    - a cream-and-gold zone out to r≈7.4 with Ženíšek's **8 fields** (Architektura, Sochařství, Mimika, Epika, Lyrika, Tanec, Hudba, Malířství):
      - each a rounded-end oblong about 2.0 × 4.2 m, set radially, outer end slightly wider, with a gilded frame about 0.15 m;
      - **pale sky-blue backgrounds** (the model's are dark grey and its frames are ellipses);
      - between the fields: gilded rectangular panels with small medallions, and painted ornament;
    - a dark porphyry-red band from r 7.4 to 9.4 carrying **8 gilded rosettes Ø≈0.8** at r≈8.2, between the fields.
  - The 18.8 m circle sits in a square frame of about 19.4 m with painted corner panels on the stage side.
  - The girders are at 24.9–27.5. The painters' hall floor is at about 27.5.
  - The water tank reads about 27.9–29.2 on this registration (Ø≈1.3, about 5.6 m long), about 0.6 m higher than the model.
- **Chandelier:**
  - Gilt bronze, 5.5 m tall, Ø 3.0. It hangs from the girder through the grille: top at about 23.2, bottom at about 17.7 (level with the top-gallery front).
  - Profile from top to bottom:
    - crown Ø0.8 (22.9–21.5);
    - ring Ø1.1 at 21.0;
    - tapering cage;
    - ring Ø1.7 at 20.0;
    - main ring Ø2.8–3.0 at 19.2, with 2 rows of lamps;
    - bowl Ø1.5 at 18.5;
    - finial down to 17.7.
  - About 200 frosted tulip and globe shades, not crystal.
- **Stalls (parterre):**
  - Floor at 2.25 at the front row (pit rail at about P−3.7), rising to 3.1 at the back.
  - Stall-box floors are about 1 m above the front of the stalls, with red-carpeted steps at the stage end.
  - About 15–17 rows running continuously across, with **no centre aisle**: about 0.9 m apart, 20–24 seats per row. Side aisles 0.6–1.0 m; the block is about 12.5–13.5 m wide.
  - Red plush seats on dark wood. The back wall under the I. balkon is red-brown panelling with booth windows.
- **Colour overall:** ivory #EFE6D2, heavy metallic gilding #C9A24E with relief normal maps, crimson #8E1B22. The model reads too white, with flat yellow "gold".

### 2. Foyer

| | Real | Model |
|---|---|---|
| Interior size | ≈21.5 × 6.4 m (the plan reads 5.8–6.0 wide) | 23 × 6.4 |
| Floor | **≈6.65** | 8.03 |
| Main cornice | ≈11.8–12.0 | — |
| Ceiling | Coved ceiling with lunettes rising to a **flat central field at ≈13.9** (clear height ≈7.2 m) | Barrel vault springing at 14.2 |

- **Ceiling paintings:**
  - The flat field is about 3.2 × 17 m and holds Ženíšek's triptych (3 panels, Greek-key gilded frames).
  - The cove is cut by **14 lunettes** with Aleš's cycle *Vlast*: **5 on each long wall and 2 on each end wall**, each about 3.2 × 1.6 m.
  - Between the lunettes: painted ornament on cream, blue roundels with gilded rosettes, small plaques.
- **Walls:**
  - Ochre-yellow imitation marble, five bays per long wall.
  - Flat white marble pilasters about 0.7 m wide with gilded Corinthian capitals, a dark-green marble base about 0.9 m high, and a gilded bracketed cornice.
  - North wall: 5 glazed doors to the loggia. South wall: doors with red velvet curtains.
  - End walls: one door each, plus large framed canvases.
- **Busts:** about 12–14 **dark bronze** busts on gilded scroll brackets fixed to the piers at about 2.4 m.
- **Chandeliers:** two (check for a third), gilt bronze.
  - About 30 white tulip shades in 2 tiers above a cylindrical crystal-prism collar.
  - Ø≈1.5, body about 2.5 m, on rods about 2.5 m long; bottom about 3.3 m above the floor.
- **Floor:** marble inlay in white, red-brown and black: a field of 4-pointed stars and crosses (about 1.2 m module) inside a border of black-and-white diamonds about 0.8 m wide.
- **Furniture:** red velvet benches along the walls and round gilded side tables.

### 3. Loggia and stairs

- **Loggia:**
  - Floor about 6.6, the same as the foyer.
  - Five arches onto Národní between piers with giant Corinthian columns (up to about 15.0), each arch with a turned-baluster balustrade about 1.0 m high.
  - The bays are vaulted: semicircles springing at about 12.2, crown at about 14.5. One hanging lantern per bay, bottom at about 11.3.
  - Back wall: 5 **rectangular** doors to the foyer, each with a lunette above. These are probably Josef Tulka's 5 paintings (numbers 1–5 in the plan 05 legend); verify.
  - The loggia ceiling colours are unverified (no photo).
- **Stairs:** two main marble staircases with baluster railings at the east and west ends of the foyer (1914 plan).

### 4. Priorities

**P1**
1. Narrow the horseshoe:
   - parapet line from ±8.9 to stalls 7.1 / I 7.25 / II 7.6 / III 7.75;
   - box back walls at ±9.3, plus a 2.0 m corridor (±9.4–11.4);
   - straight sides from P to P−9.4, then a semicircle r≈7.25, with axis parapets at P−16.6 / −17.3 / −18.0;
   - narrow the stalls to match.
2. Ceiling 23.2 at the edge and 24.05 at the crown; gallery colonnade with the band at 22.2–23.2; girders at 24.9–27.5; chandelier from 23.2 down to 17.7.
3. Tier floors at 3.2 / 6.2 / 9.6 / 13.1 / 17.95, parapet tops at 4.05 / 7.15 / 10.45 / 13.95 / 18.8.
4. Tier backs:
   - tiers I and II: open balconies (3–4 rows and 3 rows);
   - tier III: open gallery (5 rows at the back, 1 per side);
   - tier IV: a 10-row amphitheatre back to v≈8.6, plus 1-row side galleries.
5. Close the boxes: back wall with a door, ceiling, full-height partitions, columns per tier, no light leaks.
6. Foyer and loggia floor at about 6.65. Replace the barrel vault with a coved ceiling: cornice at 12.0, flat field at 13.9, 14 lunettes.
7. Portal:
   - clear opening 11.5 × 11.9 with a flat top and rounded corners;
   - a 1.0 m medallion frame;
   - the frieze at about 16.6–17.8;
   - the 16 m pediment with its sculpture group;
   - stacked proscenium boxes instead of the full-height gold columns, including the caryatid and canopy boxes at the I level.

**P2**
- A different parapet ornament per tier, with metallic gilding.
- Ceiling: rounded-end oblong fields on sky-blue grounds, the porphyry band with 8 rosettes, the coral ring and the openwork grille.
- Chandelier silhouette and lamp count as described above.
- Curtain: straight-bottomed pelmet; the full-opening Hynais curtain or plain red velvet; no tie-backs.
- Box interiors: damask, wooden doors, mirrors, curtains, globe brackets.
- Foyer: pilasters and imitation-marble walls, bronze busts on brackets, 2 chandeliers, the inlaid marble floor.

**P3**
- Stalls: no centre aisle, 0.9 m row spacing, steps up to the stall boxes.
- Organ lofts, and painted garlands on the mauve wall above the portal.
- Loggia: vaults, Tulka lunettes, lanterns, balustrades, rectangular doors.
- Staircases.
- Foyer length 21.5 m.

Uncertainty: plan-based widths ±3%; portal and frieze heights ±0.4 m (from photo proportions). The bust count, a possible third foyer chandelier and the loggia ceiling colours need checking.

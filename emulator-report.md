# Rapport émulateur — Panda-Run

Généré le 2026-07-19T00:03:11.671Z — navigateur : Chromium headless (Playwright), viewport 844×390 @2x paysage.

Pilotage : maintien de Droite + saut (Espace) + attaque (X) pendant le budget, échantillonnage 200 ms.
Détections : exceptions (pageerror + console + __pandaLog), gel (__pandaBeat figé > 3 s), traversée du sol/plateforme (y du panda > sol+64), blocage (x figé au sol), niveau non terminé, test d’échelle.

## Synthèse

| Niveau | Propre | Fini | Exc | Gel | Traversée | Blocage | Échelles | Paliers |
|--------|--------|------|-----|-----|-----------|---------|----------|---------|
| zone1-1 | ✅ | ✓ | — | — | — | — | 1 ✓ | 1 ✓ |
| zone1-2 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone1-3 | ✅ | ✓ | — | — | — | — | 1 ✓ | 1 ✓ |
| zone1-4 | ✅ | ✓ | — | — | — | — | n/a | 2 ✓ |
| zone1-boss | ✅ | boss | — | — | — | — | n/a | n/a |
| zone2-1 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone2-2 | ✅ | ✓ | — | — | — | — | 1 ✓ | 2 ✓ |
| zone2-3 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| cave-1 | ✅ | ✓ | — | — | — | — | 1 ✓ | 2 ✓ |
| zone2-boss | ✅ | boss | — | — | — | — | n/a | n/a |
| zone3-1 | ✅ | ✓ | — | — | — | — | 1 ✓ | 1 ✓ |
| zone3-2 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone3-boss | ✅ | boss | — | — | — | — | n/a | n/a |
| plage-1 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| plage-2 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone4-1 | ✅ | ✓ | — | — | — | — | 1 ✓ | 1 ✓ |
| zone4-2 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone4-boss | ✅ | boss | — | — | — | — | n/a | n/a |
| carriere-1 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| carriere-2 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone5-1 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone5-2 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone5-boss | ✅ | boss | — | — | — | — | n/a | n/a |
| zone6-1 | ✅ | ✓ | — | — | — | — | n/a | 1 ✓ |
| zone6-boss | ✅ | boss | — | — | — | — | n/a | n/a |

Niveaux avec problème physique : aucun.

## Détail par niveau

### zone1-1

- Statut : terminé
- Progression x : 68 → 2790 (sortie ≈ 2816)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 397 ms
- Échelle @x≈1744 (haut rangée 5) : montée 280px → OK
- Palier à coffre @x≈28 (dessus rangée 8) : tient (y=216, essai 2) OK

### zone1-2

- Statut : terminé
- Progression x : 79 → 3104 (sortie ≈ 3136)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 96 ms
- Palier à coffre @x≈46 (dessus rangée 8) : tient (y=216, essai 2) OK

### zone1-3

- Statut : terminé
- Progression x : 82 → 3107 (sortie ≈ 3136)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 195 ms
- Échelle @x≈1904 (haut rangée 5) : montée 278px → OK
- Palier à coffre @x≈30 (dessus rangée 5) : tient (y=120, essai 1) OK

### zone1-4

- Statut : terminé
- Progression x : 90 → 3426 (sortie ≈ 3456)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 72 ms
- Palier à coffre @x≈50 (dessus rangée 12) : tient (y=344, essai 1) OK
- Palier à coffre @x≈86 (dessus rangée 8) : tient (y=216, essai 1) OK

### zone1-boss (boss: roi-gloopy)

- Statut : non terminé dans le budget
- Progression x : 82 → 1263 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 121 ms

### zone2-1

- Statut : terminé
- Progression x : 108 → 3107 (sortie ≈ 3136)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 64 ms
- Palier à coffre @x≈52 (dessus rangée 8) : tient (y=216, essai 2) OK

### zone2-2

- Statut : terminé
- Progression x : 82 → 3426 (sortie ≈ 3456)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 87 ms
- Échelle @x≈2480 (haut rangée 5) : montée 279px → OK
- Palier à coffre @x≈32 (dessus rangée 5) : tient (y=120, essai 1) OK
- Palier à coffre @x≈84 (dessus rangée 8) : tient (y=216, essai 1) OK

### zone2-3

- Statut : terminé
- Progression x : 79 → 3426 (sortie ≈ 3456)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 33 ms
- Palier à coffre @x≈66 (dessus rangée 8) : tient (y=216, essai 2) OK

### cave-1

- Statut : terminé
- Progression x : 79 → 3265 (sortie ≈ 3296)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 62 ms
- Échelle @x≈1840 (haut rangée 5) : montée 280px → OK
- Palier à coffre @x≈28 (dessus rangée 5) : tient (y=120, essai 1) OK
- Palier à coffre @x≈64 (dessus rangée 8) : tient (y=216, essai 1) OK

### zone2-boss (boss: pharaon-scarabee)

- Statut : non terminé dans le budget
- Progression x : 79 → 1263 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 118 ms

### zone3-1

- Statut : terminé
- Progression x : 82 → 4069 (sortie ≈ 4096)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 164 ms
- Échelle @x≈2544 (haut rangée 5) : montée 278px → OK
- Palier à coffre @x≈57 (dessus rangée 11) : tient (y=312, essai 1) OK

### zone3-2

- Statut : terminé
- Progression x : 79 → 4390 (sortie ≈ 4416)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 82 ms
- Palier à coffre @x≈86 (dessus rangée 10) : tient (y=280, essai 1) OK

### zone3-boss (boss: seigneur-liane)

- Statut : non terminé dans le budget
- Progression x : 86 → 1263 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 67 ms

### plage-1

- Statut : terminé
- Progression x : 90 → 3427 (sortie ≈ 3456)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 119 ms
- Palier à coffre @x≈61 (dessus rangée 13) : tient (y=376, essai 1) OK

### plage-2

- Statut : terminé
- Progression x : 82 → 3746 (sortie ≈ 3776)
- y max atteint : 425 (sol ≈ 448)
- Heartbeat idle max : 102 ms
- Palier à coffre @x≈46 (dessus rangée 11) : tient (y=312, essai 1) OK

### zone4-1

- Statut : terminé
- Progression x : 71 → 4228 (sortie ≈ 4256)
- y max atteint : 427 (sol ≈ 448)
- Heartbeat idle max : 62 ms
- Échelle @x≈3024 (haut rangée 5) : montée 278px → OK
- Palier à coffre @x≈46 (dessus rangée 12) : tient (y=344, essai 1) OK

### zone4-2

- Statut : terminé
- Progression x : 86 → 4545 (sortie ≈ 4576)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 57 ms
- Palier à coffre @x≈81 (dessus rangée 12) : tient (y=344, essai 1) OK

### zone4-boss (boss: golem-ancien)

- Statut : non terminé dans le budget
- Progression x : 79 → 1263 (sortie ≈ 1216)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 172 ms

### carriere-1

- Statut : terminé
- Progression x : 79 → 3584 (sortie ≈ 3616)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 83 ms
- Palier à coffre @x≈61 (dessus rangée 11) : tient (y=312, essai 1) OK

### carriere-2

- Statut : terminé
- Progression x : 75 → 3748 (sortie ≈ 3776)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 64 ms
- Palier à coffre @x≈46 (dessus rangée 11) : tient (y=312, essai 1) OK

### zone5-1

- Statut : terminé
- Progression x : 75 → 4387 (sortie ≈ 4416)
- y max atteint : 426 (sol ≈ 448)
- Heartbeat idle max : 66 ms
- Palier à coffre @x≈46 (dessus rangée 11) : tient (y=312, essai 1) OK

### zone5-2

- Statut : terminé
- Progression x : 82 → 4706 (sortie ≈ 4736)
- y max atteint : 427 (sol ≈ 448)
- Heartbeat idle max : 76 ms
- Palier à coffre @x≈86 (dessus rangée 12) : tient (y=344, essai 1) OK

### zone5-boss (boss: roi-liche)

- Statut : non terminé dans le budget
- Progression x : 82 → 1263 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 119 ms

### zone6-1

- Statut : terminé
- Progression x : 79 → 4870 (sortie ≈ 4896)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 170 ms
- Palier à coffre @x≈43 (dessus rangée 11) : tient (y=312, essai 1) OK

### zone6-boss (boss: seigneur-dechu)

- Statut : non terminé dans le budget
- Progression x : 79 → 1263 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 190 ms

## Bruit console (non bloquant)

Messages `console.error` — pas des exceptions non gérées, ne figent PAS la boucle :

- (×120) `setTintFill(color)` is removed as of Phaser 4. Use setTint(color).setTintMode(Phaser.TintModes.FILL)` instead.

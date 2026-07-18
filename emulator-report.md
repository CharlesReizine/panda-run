# Rapport émulateur — Panda-Run

Généré le 2026-07-18T23:21:59.091Z — navigateur : Chromium headless (Playwright), viewport 844×390 @2x paysage.

Pilotage : maintien de Droite + saut (Espace) + attaque (X) pendant le budget, échantillonnage 200 ms.
Détections : exceptions (pageerror + console + __pandaLog), gel (__pandaBeat figé > 3 s), traversée du sol/plateforme (y du panda > sol+64), blocage (x figé au sol), niveau non terminé, test d’échelle.

## Synthèse

| Niveau | Fini | Exc | Gel | Traversée | Blocage | Mort | Échelle |
|--------|------|-----|-----|-----------|---------|------|---------|
| zone1-1 | — | — | — | — | — | — | ✓ |
| zone1-2 | — | — | — | — | — | — | n/a |
| zone1-3 | — | — | — | — | — | oui | ✓ |
| zone1-4 | — | — | — | — | — | — | n/a |
| zone1-boss | — | — | — | — | — | — | n/a |
| zone2-1 | — | — | — | — | — | oui | n/a |
| zone2-2 | — | — | — | — | — | oui | ✓ |
| zone2-3 | — | — | — | — | — | oui | n/a |
| cave-1 | — | — | — | — | — | oui | ✓ |
| zone2-boss | — | — | — | — | — | — | n/a |
| zone3-1 | — | — | — | — | — | oui | ✓ |
| zone3-2 | — | — | — | — | — | oui | n/a |
| zone3-boss | — | — | — | — | — | — | n/a |
| plage-1 | — | — | — | — | — | oui | n/a |
| plage-2 | — | — | — | — | — | oui | n/a |
| zone4-1 | — | — | — | — | — | oui | ✓ |
| zone4-2 | — | — | — | — | — | oui | n/a |
| zone4-boss | — | — | — | — | — | oui | n/a |
| carriere-1 | — | — | — | — | — | oui | n/a |
| carriere-2 | — | — | — | — | — | oui | n/a |
| zone5-1 | — | — | — | — | — | oui | n/a |
| zone5-2 | — | — | — | — | — | oui | n/a |
| zone5-boss | — | — | — | — | — | oui | n/a |
| zone6-1 | — | — | — | — | — | oui | n/a |
| zone6-boss | — | — | — | — | — | oui | n/a |

Niveaux avec exception / gel / traversée : aucun.

## Détail par niveau

### zone1-1

- Statut : non terminé dans le budget
- Progression x : 68 → 1536 (sortie ≈ 2816)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 571 ms
- Échelle @x≈1744 : montée 280px → OK

### zone1-2

- Statut : non terminé dans le budget
- Progression x : 82 → 1964 (sortie ≈ 3136)
- y max atteint : 425 (sol ≈ 448)
- Heartbeat idle max : 153 ms

### zone1-3

- Statut : non terminé dans le budget
- Progression x : 101 → 794 (sortie ≈ 3136)
- y max atteint : 425 (sol ≈ 448)
- Heartbeat idle max : 66 ms
- Le panda est mort (PV ≤ 0) durant le test.
- Échelle @x≈1904 : montée 283px → OK

### zone1-4

- Statut : non terminé dans le budget
- Progression x : 86 → 2059 (sortie ≈ 3456)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 165 ms

### zone1-boss (boss: roi-gloopy)

- Statut : non terminé dans le budget
- Progression x : 101 → 1263 (sortie ≈ 1216)
- y max atteint : 425 (sol ≈ 448)
- Heartbeat idle max : 47 ms

### zone2-1

- Statut : non terminé dans le budget
- Progression x : 79 → 460 (sortie ≈ 3136)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 79 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone2-2

- Statut : non terminé dans le budget
- Progression x : 86 → 448 (sortie ≈ 3456)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 122 ms
- Le panda est mort (PV ≤ 0) durant le test.
- Échelle @x≈2480 : montée 284px → OK

### zone2-3

- Statut : non terminé dans le budget
- Progression x : 68 → 1300 (sortie ≈ 3456)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 60 ms
- Le panda est mort (PV ≤ 0) durant le test.

### cave-1

- Statut : non terminé dans le budget
- Progression x : 79 → 181 (sortie ≈ 3296)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 130 ms
- Le panda est mort (PV ≤ 0) durant le test.
- Échelle @x≈1840 : montée 280px → OK

### zone2-boss (boss: pharaon-scarabee)

- Statut : non terminé dans le budget
- Progression x : 86 → 1263 (sortie ≈ 1216)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 52 ms

### zone3-1

- Statut : non terminé dans le budget
- Progression x : 75 → 449 (sortie ≈ 4096)
- y max atteint : 427 (sol ≈ 448)
- Heartbeat idle max : 77 ms
- Le panda est mort (PV ≤ 0) durant le test.
- Échelle @x≈2544 : montée 284px → OK

### zone3-2

- Statut : non terminé dans le budget
- Progression x : 93 → 93 (sortie ≈ 4416)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 78 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone3-boss (boss: seigneur-liane)

- Statut : non terminé dans le budget
- Progression x : 86 → 1263 (sortie ≈ 1216)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 85 ms

### plage-1

- Statut : non terminé dans le budget
- Progression x : 71 → 277 (sortie ≈ 3456)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 52 ms
- Le panda est mort (PV ≤ 0) durant le test.

### plage-2

- Statut : non terminé dans le budget
- Progression x : 82 → 277 (sortie ≈ 3776)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 165 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone4-1

- Statut : non terminé dans le budget
- Progression x : 90 → 90 (sortie ≈ 4256)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 64 ms
- Le panda est mort (PV ≤ 0) durant le test.
- Échelle @x≈3024 : montée 288px → OK

### zone4-2

- Statut : non terminé dans le budget
- Progression x : 71 → 226 (sortie ≈ 4576)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 190 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone4-boss (boss: golem-ancien)

- Statut : non terminé dans le budget
- Progression x : 79 → 795 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 55 ms
- Le panda est mort (PV ≤ 0) durant le test.

### carriere-1

- Statut : non terminé dans le budget
- Progression x : 82 → 234 (sortie ≈ 3616)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 177 ms
- Le panda est mort (PV ≤ 0) durant le test.

### carriere-2

- Statut : non terminé dans le budget
- Progression x : 79 → 273 (sortie ≈ 3776)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 50 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone5-1

- Statut : non terminé dans le budget
- Progression x : 86 → 211 (sortie ≈ 4416)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 89 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone5-2

- Statut : non terminé dans le budget
- Progression x : 79 → 277 (sortie ≈ 4736)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 228 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone5-boss (boss: roi-liche)

- Statut : non terminé dans le budget
- Progression x : 101 → 845 (sortie ≈ 1216)
- y max atteint : 426 (sol ≈ 448)
- Heartbeat idle max : 50 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone6-1

- Statut : non terminé dans le budget
- Progression x : 61 → 61 (sortie ≈ 4896)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 78 ms
- Le panda est mort (PV ≤ 0) durant le test.

### zone6-boss (boss: seigneur-dechu)

- Statut : non terminé dans le budget
- Progression x : 79 → 684 (sortie ≈ 1216)
- y max atteint : 424 (sol ≈ 448)
- Heartbeat idle max : 41 ms
- Le panda est mort (PV ≤ 0) durant le test.

## Bruit console (non bloquant)

Messages `console.error` — pas des exceptions non gérées, ne figent PAS la boucle :

- (×13) `setTintFill(color)` is removed as of Phaser 4. Use setTint(color).setTintMode(Phaser.TintModes.FILL)` instead.

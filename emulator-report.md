# Rapport émulateur — Panda-Run

Généré le 2026-07-18T23:51:55.939Z — navigateur : Chromium headless (Playwright), viewport 844×390 @2x paysage.

Pilotage : maintien de Droite + saut (Espace) + attaque (X) pendant le budget, échantillonnage 200 ms.
Détections : exceptions (pageerror + console + __pandaLog), gel (__pandaBeat figé > 3 s), traversée du sol/plateforme (y du panda > sol+64), blocage (x figé au sol), niveau non terminé, test d’échelle.

## Synthèse

| Niveau | Propre | Fini | Exc | Gel | Traversée | Blocage | Échelles | Paliers |
|--------|--------|------|-----|-----|-----------|---------|----------|---------|
| zone1-1 | ✅ | ✓ | — | — | — | — | 1 ✓ | 1 ✓ |

Niveaux avec problème physique : aucun.

## Détail par niveau

### zone1-1

- Statut : terminé
- Progression x : 68 → 2785 (sortie ≈ 2816)
- y max atteint : 428 (sol ≈ 448)
- Heartbeat idle max : 400 ms
- Échelle @x≈1744 (haut rangée 5) : montée 281px → OK
- Palier à coffre @x≈28 (dessus rangée 8) : tient (y=216, essai 2) OK

## Bruit console (non bloquant)

Messages `console.error` — pas des exceptions non gérées, ne figent PAS la boucle :

- (×5) `setTintFill(color)` is removed as of Phaser 4. Use setTint(color).setTintMode(Phaser.TintModes.FILL)` instead.

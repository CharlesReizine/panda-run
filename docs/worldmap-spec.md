# Plan carte A — worldmap + niveaux (spec de construction)

Repère 960×540. START = prontera. La carte du monde = `map-1.png` → `map-monde.jpg`.

## Nœuds

| node id | type | nom court | biome | tier | x | y | levelId |
|---|---|---|---|---|---|---|---|
| plaine-1 | level | Prairie | plaine | 1 | 40 | 68 | plaine-1 |
| plaine-2 | level | Champs | plaine | 1 | 93 | 90 | plaine-2 |
| plaine-3 | level | Vallon | plaine | 1 | 147 | 68 | plaine-3 |
| plaine-4 | level | Pré fleuri | plaine | 1 | 200 | 90 | plaine-4 |
| plaine-5 | level | Colline | plaine | 1 | 227 | 68 | plaine-5 |
| prontera | town | Prontera | - |  | 307 | 79 |  |
| plaine-6 | level | Bocage | plaine | 1 | 333 | 124 | plaine-6 |
| foret-1 | level | Orée | foret | 2 | 440 | 101 | foret-1 |
| plaine-7 | level | Clairière | plaine | 1 | 520 | 124 | plaine-7 |
| foret-2 | level | Sylve | foret | 2 | 573 | 124 | foret-2 |
| foret-3 | level | Taillis | foret | 2 | 600 | 101 | foret-3 |
| foret-4 | level | Sous-bois | foret | 2 | 653 | 79 | foret-4 |
| foret-5 | level | Ronces | foret | 2 | 707 | 79 | foret-5 |
| foret-6 | level | Halliers | foret | 2 | 760 | 101 | foret-6 |
| boss-01 | boss | Gardien Sylve | foret | BOSS | 707 | 124 | boss-01 |
| foret-7 | level | Lisière | foret | 2 | 547 | 169 | foret-7 |
| desert-1 | level | Piste | desert | 2 | 547 | 191 | desert-1 |
| desert-2 | level | Dunes | desert | 2 | 520 | 236 | desert-2 |
| desert-3 | level | Erg | desert | 2 | 467 | 236 | desert-3 |
| morocc | town | Morocc | - |  | 387 | 259 |  |
| desert-4 | level | Oasis | desert | 2 | 307 | 281 | desert-4 |
| desert-5 | level | Ravin | desert | 2 | 253 | 259 | desert-5 |
| desert-6 | level | Gorge | desert | 2 | 200 | 259 | desert-6 |
| boss-02 | boss | Pharaon | desert | BOSS | 147 | 281 | boss-02 |
| desert-7 | level | Sables | desert | 2 | 360 | 304 | desert-7 |
| jungle-1 | level | Palmeraie | jungle | 3 | 440 | 326 | jungle-1 |
| desert-8 | level | Carrefour | desert | 2 | 493 | 348 | desert-8 |
| cave-1 | level | Caverne | cave | 3 | 493 | 304 | cave-1 |
| boss-03 | boss | Golem Cave | cave | BOSS | 520 | 281 | boss-03 |
| jungle-2 | level | Jungle | jungle | 3 | 573 | 304 | jungle-2 |
| jungle-3 | level | Canopée | jungle | 3 | 627 | 281 | jungle-3 |
| jungle-4 | level | Fourré | jungle | 3 | 707 | 281 | jungle-4 |
| jungle-5 | level | Marais | jungle | 3 | 760 | 304 | jungle-5 |
| boss-04 | boss | Cœur Jungle | jungle | BOSS | 840 | 304 | boss-04 |
| desert-9 | level | Col sec | desert | 2 | 493 | 371 | desert-9 |
| montagne-1 | level | Cimes | montagne | 3 | 467 | 416 | montagne-1 |
| montagne-2 | level | Crête | montagne | 3 | 413 | 394 | montagne-2 |
| montagne-3 | level | Névé | montagne | 3 | 360 | 394 | montagne-3 |
| boss-05 | boss | Yeti Géant | montagne | BOSS | 333 | 371 | boss-05 |
| cimetiere-1 | level | Tombes | cimetiere | 4 | 520 | 394 | cimetiere-1 |
| cimetiere-2 | level | Ossuaire | cimetiere | 4 | 547 | 416 | cimetiere-2 |
| boss-06 | boss | Roi Liche | cimetiere | BOSS | 627 | 394 | boss-06 |
| desert-10 | level | Fourche | desert | 2 | 467 | 452 | desert-10 |
| plage-1 | level | Rivage | plage | 3 | 360 | 461 | plage-1 |
| plage-2 | level | Lagon | plage | 3 | 307 | 484 | plage-2 |
| plage-3 | level | Récif | plage | 3 | 307 | 439 | plage-3 |
| plage-4 | level | Corail | plage | 3 | 253 | 394 | plage-4 |
| boss-07 | boss | Roi Crabe | plage | BOSS | 200 | 394 | boss-07 |
| carriere-1 | level | Carrière | carriere | 4 | 493 | 484 | carriere-1 |
| boss-08 | boss | Golem Ancien | carriere | BOSS | 547 | 484 | boss-08 |
| desert-11 | level | Braise | desert | 2 | 547 | 461 | desert-11 |
| enfer-1 | level | Sentier | enfer | 5 | 627 | 461 | enfer-1 |
| enfer-2 | level | Cendres | enfer | 5 | 680 | 439 | enfer-2 |
| enfer-3 | level | Fournaise | enfer | 5 | 733 | 439 | enfer-3 |
| enfer-4 | level | Coulée | enfer | 5 | 787 | 484 | enfer-4 |
| enfer-5 | level | Brasier | enfer | 5 | 840 | 484 | enfer-5 |
| enfer-6 | level | Abîme | enfer | 5 | 893 | 461 | enfer-6 |
| enfer-7 | level | Géhenne | enfer | 5 | 893 | 416 | enfer-7 |
| boss-09 | boss | Seigneur Déchu | enfer | BOSS | 867 | 394 | boss-09 |

## Arêtes (chemin + branches)

plaine-1→plaine-2, plaine-2→plaine-3, plaine-3→plaine-4, plaine-4→plaine-5, plaine-5→prontera, prontera→plaine-6, plaine-6→foret-1, foret-1→plaine-7, plaine-7→foret-7, foret-7→desert-1, desert-1→desert-2, desert-2→desert-3, desert-3→morocc, morocc→desert-4, desert-4→desert-7, desert-7→jungle-1, jungle-1→desert-8, desert-8→desert-9, montagne-1→desert-10, desert-10→desert-11, desert-11→enfer-1, enfer-1→enfer-2, enfer-2→enfer-3, enfer-3→enfer-4, enfer-4→enfer-5, enfer-5→enfer-6, enfer-6→enfer-7, enfer-7→boss-09, plaine-7→foret-2, foret-2→foret-3, foret-3→foret-4, foret-4→foret-5, foret-5→foret-6, foret-6→boss-01, desert-4→desert-5, desert-5→desert-6, desert-6→boss-02, desert-8→cave-1, cave-1→boss-03, desert-8→jungle-2, jungle-2→jungle-3, jungle-3→jungle-4, jungle-4→jungle-5, jungle-5→boss-04, desert-9→montagne-1, montagne-1→montagne-2, montagne-2→montagne-3, montagne-3→boss-05, desert-9→cimetiere-1, cimetiere-1→cimetiere-2, cimetiere-2→boss-06, desert-10→plage-1, plage-1→plage-2, plage-2→plage-3, plage-3→plage-4, plage-4→boss-07, desert-10→carriere-1, carriere-1→boss-08

## Totaux
Niveaux: 48 {'plaine': 7, 'foret': 7, 'desert': 11, 'jungle': 5, 'cave': 1, 'montagne': 3, 'cimetiere': 2, 'plage': 4, 'carriere': 1, 'enfer': 7} · Boss: 9 · Villes: 2

Boss existants réutilisables : Roi Gloopy(novice), Pharaon(sabreur), Cœur Jungle(mage), Golem Ancien(archer), Roi Liche(sorcier), Seigneur Déchu(final). 9 boss requis → 3 nouveaux (Gardien Sylve, Golem Cave, Yeti Géant, Roi Crabe = à créer/mapper).

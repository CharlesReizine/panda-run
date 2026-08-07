// Repère de version affiché à l'écran-titre et joint à chaque sauvegarde cloud (diagnostic : savoir
// quelle build a écrit une save).
//
// ⚠️ C'EST ICI qu'on bumpe le build stamp à chaque livraison (il était auparavant écrit en dur dans
// TitleScene). Un seul endroit, deux consommateurs.
// ⚠️ ET C'EST UN TEST QUI LE VÉRIFIE, PARCE QUE LA CONSIGNE SEULE N'A PAS SUFFI. Ce repère est resté
// bloqué sur R342 pendant vingt-cinq lots : le joueur voyait « R342 » sur l'écran-titre d'une build
// qui contenait R367, et chaque sauvegarde cloud partait avec un numéro faux — donc inutilisable pour
// diagnostiquer quelle build avait écrit quoi, ce qui est TOUTE la raison d'être de ce fichier.
// `tests/core/build-stamp.test.ts` le compare désormais au dernier lot consigné dans ETAT-DU-PROJET.md.
export const BUILD = 'R374'

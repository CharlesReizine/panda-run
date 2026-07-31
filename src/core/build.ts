// Repère de version affiché à l'écran-titre et joint à chaque sauvegarde cloud (diagnostic : savoir
// quelle build a écrit une save).
//
// ⚠️ C'EST ICI qu'on bumpe le build stamp à chaque livraison (il était auparavant écrit en dur dans
// TitleScene). Un seul endroit, deux consommateurs.
export const BUILD = 'R308'

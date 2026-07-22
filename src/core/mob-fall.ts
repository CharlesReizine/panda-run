// CHUTE HORS MAP DES MONSTRES (logique pure, testable headless — cf. Enemy.checkFallThrough).
//
// Retour playtest : l'ancien « filet » REPOSAIT un mob tombé sur son point d'apparition → il
// « remontait »/collait (buggé). Désormais, tomber au fond du monde = MORT NETTE. Ces prédicats
// isolent la DÉCISION (qui meurt de chute ? à partir de quelle profondeur ?) du code Phaser.

// Un monstre MEURT-il en tombant dans un trou / hors de la carte ? Les VOLANTS (gravité coupée) et
// AQUATIQUES (nagent) en sont exemptés — le vide n'est pas mortel pour eux. Les BOSS aussi (pilotés,
// bornés à l'arène : ils ne doivent jamais « mourir de chute » ni déclencher la victoire par accident).
export function diesOnFall(monster: { aerial?: boolean; aquatic?: boolean; boss?: boolean }): boolean {
  return !monster.aerial && !monster.aquatic && !monster.boss
}

// Le corps a-t-il atteint le FOND du monde (marge de 4 px) → chute hors map ?
export function hasFallenOutOfWorld(bodyBottom: number, worldBottom: number): boolean {
  return bodyBottom >= worldBottom - 4
}

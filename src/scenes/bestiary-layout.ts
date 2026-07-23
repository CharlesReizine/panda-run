// Géométrie PURE (sans Phaser) de la fiche détail du Bestiaire — partagée entre BestiaryScene et le
// test de non débordement (tests/core/bestiary-layout). La fiche empile à droite la grille Compétences
// puis la grille Butin ; ces constantes pilotent toute leur disposition.
export const BD = {
  top: 64, titleGap: 26, rowGap: 8, sectionGap: 16,
  skillRowHBoss: 52, skillRowH: 42, butinRowH: 42, buttonsY: 512,
  X0: 330, COLW: 288, GAP: 12,
  descMax: 66, // longueur max d'une description de skill dans une carte (au-delà : tronquée → …)
}

// Y du BAS de la dernière carte de butin, selon le nb de compétences / butins. Doit rester au-dessus
// des boutons (BD.buttonsY) : c'est l'invariant vérifié par le test de non débordement.
export function bestiaryDetailBottom(nSkills: number, nDrops: number, isBoss: boolean): number {
  let y = BD.top
  if (nSkills > 0) {
    y += BD.titleGap
    const rh = isBoss ? BD.skillRowHBoss : BD.skillRowH
    y += Math.ceil(nSkills / 2) * (rh + BD.rowGap) + BD.sectionGap
  }
  y += BD.titleGap
  const rows = Math.max(1, Math.ceil(nDrops / 2))
  return y + (rows - 1) * (BD.butinRowH + BD.rowGap) + BD.butinRowH
}

// Tronque un texte à `n` caractères (ellipsis) — évite le débordement des descriptions dans les cartes.
export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`
}

import type { SkillDef } from '../core/types'
import type { SfxName } from './audio-engine'

// À QUELLE FAMILLE DE SON APPARTIENT CHAQUE COMPÉTENCE.
//
// Demande du user : « on peut rajouter des bruits sur certaines attaques du mage ou des autres, ça peut
// être cool ». Les 66 compétences partageaient un unique bruit `skill` : impossible d'entendre la
// différence entre une boule de feu, un soin et un tir à l'arc.
//
// ⚠️ POURQUOI UN CLASSEMENT ET PAS 66 LIGNES DE TABLE. Une table id → son doit être complétée à chaque
// compétence ajoutée, et l'oubli est SILENCIEUX (la compétence retombe sur le son générique sans que
// rien ne le signale). Ici on classe par ÉLÉMENT lu dans l'identifiant, puis par famille de classe : une
// nouvelle compétence nommée « Mur de flammes » est sonorisée correctement sans qu'on y touche. Le test
// (tests/core/skill-sfx.test.ts) vérifie en plus qu'AUCUNE compétence existante ne tombe sur le repli —
// donc un ajout mal nommé casse le test au lieu de passer inaperçu.

/** Éléments détectés dans l'identifiant d'une compétence, du plus spécifique au plus générique. */
const ELEMENTS: { sfx: SfxName; motifs: string[] }[] = [
  { sfx: 'sort-feu', motifs: ['feu', 'flamme', 'enflamm', 'meteore', 'brasier', 'cataclysme', 'incend'] },
  { sfx: 'sort-glace', motifs: ['givre', 'glace', 'blizzard', 'gel', 'neige'] },
  { sfx: 'sort-foudre', motifs: ['eclair', 'foudre', 'tonnerre', 'orage', 'tempete', 'blitz'] },
  { sfx: 'sort-arcane', motifs: ['arcan', 'rayon', 'sceau', 'jugement', 'benediction', 'vol-'] },
]

/**
 * Son à jouer au lancement de cette compétence.
 *
 * Ordre de décision, et il compte : l'ÉLÉMENT d'abord (une « Flèche enflammée » sonne feu, pas arc —
 * c'est le feu qu'on voit à l'écran), puis le SOIN, puis le BUFF, puis la famille d'arme de la classe.
 */
export function skillSfx(skill: SkillDef): SfxName {
  const id = skill.id
  for (const { sfx, motifs } of ELEMENTS) {
    if (motifs.some((m) => id.includes(m))) return sfx
  }
  if (skill.kind === 'heal') return 'sort-soin'
  // un buff sans élément (cri de guerre, garde, aura) : gonflement tenu
  if (skill.buff || skill.kind === 'buff' || skill.kind === 'aura') return 'sort-buff'
  switch (skill.classId) {
    case 'archer':
    case 'chasseur':
      return 'tir-fleche'
    case 'mage':
    case 'sorcier':
      return 'sort-arcane'
    case 'swordsman':
    case 'chevalier':
    case 'novice':
      return 'coup-lame'
    default:
      return 'skill'
  }
}

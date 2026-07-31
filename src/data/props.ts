import type { DropEntry } from '../core/types'

export interface PropDef {
  id: string
  name: string
  hp: number
  drops: DropEntry[]
  /**
   * Palier de coffre, absent sur les décors ordinaires (herbe, roche…).
   *
   * Demande du user : « crée 3 types de coffres avec des raretés différentes, des styles différents ;
   * plus c'est rare plus ça a un glow stylé et une image stylée, et ça drop des trucs rares ».
   * Le palier pilote À LA FOIS le butin (ici), la texture et la lueur (PreloadScene / LevelScene) : une
   * seule donnée, sinon un coffre doré finirait par lâcher du butin de coffre en bois.
   */
  tier?: 'bois' | 'fer' | 'or'
}

const list: PropDef[] = [
  {
    id: 'herbe', name: "Touffe d'herbe", hp: 1,
    drops: [
      { kind: 'gold', chance: 1, min: 1, max: 3 },
      { kind: 'material', materialId: 'herbe-tendre', chance: 0.25, min: 1, max: 1 },
      { kind: 'material', materialId: 'trefle-chance', chance: 0.04, min: 1, max: 1 },
    ],
  },
  {
    id: 'champignon', name: 'Champignon', hp: 1,
    drops: [
      { kind: 'gold', chance: 1, min: 1, max: 3 },
      { kind: 'material', materialId: 'chapeau-champi', chance: 0.25, min: 1, max: 1 },
      { kind: 'material', materialId: 'spore-lumineuse', chance: 0.04, min: 1, max: 1 },
    ],
  },
  {
    id: 'roche', name: 'Roche', hp: 3,
    drops: [
      { kind: 'gold', chance: 1, min: 2, max: 6 },
      { kind: 'material', materialId: 'minerai-fer', chance: 0.35, min: 1, max: 1 },
      { kind: 'material', materialId: 'gemme-brute', chance: 0.05, min: 1, max: 1 },
    ],
  },
  // ── TROIS PALIERS DE COFFRES ────────────────────────────────────────────────────────────────────
  // Le butin monte franchement d'un palier à l'autre : un coffre de fer doit valoir le détour, un coffre
  // d'or doit être un événement. Les objets tirés sont TOUJOURS des objets déjà illustrés — un coffre qui
  // révélerait une pastille de couleur gâcherait précisément le moment qu'il met en scène.
  {
    id: 'coffre', name: 'Coffre de bois', hp: 1, tier: 'bois',
    drops: [
      { kind: 'gold', chance: 1, min: 25, max: 60 },
      { kind: 'potion', chance: 0.0857, min: 1, max: 1 },
      { kind: 'item', itemId: 'grelot-porte-bonheur', chance: 0.05, min: 1, max: 1 },
      { kind: 'material', materialId: 'gemme-brute', chance: 0.15, min: 1, max: 1 },
    ],
  },
  {
    id: 'coffre-fer', name: 'Coffre de fer', hp: 1, tier: 'fer',
    drops: [
      { kind: 'gold', chance: 1, min: 80, max: 170 },
      { kind: 'potion', chance: 0.12, min: 1, max: 2 },
      { kind: 'material', materialId: 'gemme-brute', chance: 0.4, min: 1, max: 2 },
      { kind: 'material', materialId: 'dard-de-scorpion', chance: 0.2, min: 1, max: 1 },
      { kind: 'item', itemId: 'anneau-turquoise', chance: 0.18, min: 1, max: 1 },
      { kind: 'item', itemId: 'carapace-scarabee', chance: 0.08, min: 1, max: 1 },
    ],
  },
  {
    id: 'coffre-or', name: 'Coffre d\'or', hp: 1, tier: 'or',
    drops: [
      { kind: 'gold', chance: 1, min: 240, max: 520 },
      { kind: 'material', materialId: 'gemme-brute', chance: 0.8, min: 2, max: 4 },
      { kind: 'material', materialId: 'trefle-chance', chance: 0.3, min: 1, max: 2 },
      { kind: 'item', itemId: 'amulette-pharaon', chance: 0.3, min: 1, max: 1 },
      { kind: 'item', itemId: 'griffe-royale', chance: 0.2, min: 1, max: 1 },
      // Le seul légendaire accessible par un coffre, et uniquement au palier le plus rare : le farm est
      // une voie assumée vers les légendaires (« ou alors du farming »), mais elle doit rester une voie
      // LONGUE. Verrouillé par tests/data/economie-canaux.
      { kind: 'item', itemId: 'talisman-trefle', chance: 0.04, min: 1, max: 1 },
    ],
  },
]

export const PROPS: Record<string, PropDef> = Object.fromEntries(list.map((p) => [p.id, p]))

/**
 * Ce décor est-il un coffre, quel que soit son palier ?
 *
 * ⚠️ À UTILISER PARTOUT PLUTÔT QUE `kind === 'coffre'`. En ajoutant les paliers, tous les tests qui
 * comparaient l'identifiant en dur ont compté les coffres de fer et d'or comme des décors de sol, et
 * deux quotas de terrain ont sauté. Le palier est déjà LA donnée qui distingue un coffre du reste
 * (PropDef.tier) : on s'en sert, et un quatrième palier ajouté demain sera reconnu sans rien retoucher.
 */
export const estCoffre = (kind: string): boolean => !!PROPS[kind]?.tier

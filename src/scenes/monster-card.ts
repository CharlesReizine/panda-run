import Phaser from 'phaser'
import { ITEMS, rarityColor } from '../data/items'
import { MATERIALS } from '../data/materials'
import { SKILLS } from '../data/skills'
import type { DropEntry, MonsterDef } from '../core/types'
import { BD, CARD, headerBox, identityBox, skillsBox, loreBox, lootBox, lootRowH, LOOT_COLS, maxSkillRows, truncate } from './bestiary-layout'
import { charsPerLine, wrapText } from './text-metrics'

// FICHE MONSTRE — LE RENDU, PARTAGÉ PAR TOUS LES ÉCRANS QUI DÉCRIVENT UN MONSTRE.
//
// POURQUOI CE FICHIER EXISTE. Il y avait DEUX rendus de fiche monstre : celui du bestiaire (refait en
// quatre quarts, avec sa géométrie testée) et celui de l'écran de début de terrain, resté sur une
// grille de petites cartes. Résultat : « y a un problème sur l'image au début de terrain pour décrire
// les monstres (et pas le bestiaire), là ça déborde complet et c'est pas le format que je veux ».
// Et ce n'était pas la première divergence entre ces deux écrans : l'écran de début de terrain
// affichait des pastilles génériques teintées là où le bestiaire utilisait déjà les vraies icônes de
// matériaux (les « vieux cercles de couleurs »).
//
// Deux rendus pour une même information, c'est deux fois le travail et une divergence garantie. Il n'y
// en a donc plus qu'UN, et il s'appuie sur bestiary-layout.ts, dont le test vérifie sur le VRAI roster
// qu'aucun monstre ne fait déborder sa fiche. Le débordement devient impossible par construction.

const BEHAVIOR_LABELS: Record<MonsterDef['behavior'], string> = {
  contact: 'Contact',
  projectile: 'À distance',
  charge: 'Charge',
  caster: 'Lanceur de sorts',
}

export const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`

/** Teinte de silhouette pour un monstre non découvert (sprite assombri en ombre). */
export const SILHOUETTE_TINT = 0x101820

/** Type d'un monstre pour l'affichage : badge et couleur. */
export function monsterKind(m: MonsterDef): { label: string; color: number } {
  if (m.boss) return { label: 'BOSS', color: 0xff5252 }
  if (m.mvp) return { label: 'ÉLITE', color: 0xffd54f }
  return { label: 'Normal', color: 0x90a4ae }
}

/** Libellé du comportement en clair (+ note « immobile » quand la vitesse est nulle). */
export function behaviorLabel(m: MonsterDef): string {
  const base = BEHAVIOR_LABELS[m.behavior]
  return m.speed === 0 ? `${base} · immobile` : base
}

/** Une ligne de butin : libellé, couleur, pourcentage de chance, quantité. */
export function dropLine(d: DropEntry): { label: string; color: number; chance: string; qty: string } {
  let label = ''
  let color = 0xffffff
  if (d.kind === 'gold') { label = 'Or'; color = 0xffd700 }
  else if (d.kind === 'potion') { label = 'Potion'; color = 0xff6f91 }
  else if (d.kind === 'item') {
    const item = d.itemId ? ITEMS[d.itemId] : undefined
    label = item ? item.name : d.itemId ?? 'Objet'
    color = rarityColor(item?.rarity)
  } else {
    const mat = d.materialId ? MATERIALS[d.materialId] : undefined
    label = mat ? mat.name : d.materialId ?? 'Matériau'
    color = mat ? mat.color : 0xffffff
  }
  const chance = `${+(d.chance * 100).toFixed(1)}%`
  const qty = d.min === d.max ? `×${d.min}` : `×${d.min}–${d.max}`
  return { label, color, chance, qty }
}

/**
 * Texture d'icône d'un butin — LA VRAIE IMAGE, jamais une pastille de couleur.
 * L'ordre de repli compte : illustration dédiée → cosmétique procédural → icône générique.
 */
export function lootIcon(scene: Phaser.Scene, d: DropEntry): { key: string; tint?: number } {
  if (d.kind === 'gold') return { key: scene.textures.exists('art-coin') ? 'art-coin' : 'coin' }
  if (d.kind === 'potion') return { key: 'potion-drop' }
  if (d.kind === 'item') {
    const id = d.itemId
    if (id && scene.textures.exists(`item-${id}`)) return { key: `item-${id}` }
    if (id && scene.textures.exists(`cosmetic-${id}`)) return { key: `cosmetic-${id}` }
    return { key: 'item-drop' }
  }
  if (d.materialId && scene.textures.exists(`material-${d.materialId}`)) return { key: `material-${d.materialId}` }
  return { key: 'material-drop', tint: d.materialId ? MATERIALS[d.materialId]?.color : 0xffffff }
}

/** Brique commune Compétences / Butin : icône + titre + sous-titre dans un cadre. */
function gridCard(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  iconKey: string, tint: number | undefined, title: string, titleColor: number, sub: string, subColor: string,
) {
  scene.add.rectangle(x, y, w, h, 0x000000, 0.32).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.12)
  if (scene.textures.exists(iconKey)) {
    const img = scene.add.image(x + 6, y, iconKey).setOrigin(0, 0.5).setDisplaySize(h - 12, h - 12)
    if (tint !== undefined) img.setTint(tint)
  }
  const tx = x + h + 2
  scene.add.text(tx, y - (sub ? 9 : 7), title, { fontSize: '14px', color: css(titleColor), fontStyle: 'bold', wordWrap: { width: w - h - 10 } }).setOrigin(0, 0.5)
  if (sub) scene.add.text(tx, y + 9, sub, { fontSize: '11px', color: subColor, wordWrap: { width: w - h - 10 } }).setOrigin(0, 0.5)
}

export interface MonsterCardOpts {
  /** Fiche révélée ? Faux → silhouette et contenus masqués (bestiaire, monstre jamais vaincu). */
  seen?: boolean
  /** Nombre de victoires, affiché sous l'image. Omis sur l'écran de début de terrain (toujours 0). */
  kills?: number
}

/**
 * Dessine la fiche complète d'un monstre en QUATRE QUARTS, dans la zone `CARD` :
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Angeling (Nv 8)                       ÉLITE  │
 *   ├──────────┬───────────────────────────────────┤
 *   │  image   │ (trait)  COMPÉTENCES              │
 *   ├──────────┴───────────────────────────────────┤
 *   │ BUTIN — sur TOUTE la largeur                 │
 *   └──────────────────────────────────────────────┘
 *
 * ⚠️ AUCUNE STAT ICI, ET C'EST DEMANDÉ : « mets pas les PV, ça sert à rien, juste le niveau c'est ok ».
 * L'appelant se charge de ses propres boutons, HORS de la zone CARD (cf. CARD.bottom).
 */
export function renderMonsterCard(scene: Phaser.Scene, m: MonsterDef, opts: MonsterCardOpts = {}): void {
  const seen = opts.seen ?? true
  const head = headerBox()
  const ident = identityBox()
  const skl = skillsBox()
  const loot = lootBox()

  // ── EN-TÊTE : nom, puis le niveau entre parenthèses COLLÉ au nom ──
  const nameTxt = scene.add.text(head.x, head.y, seen ? m.name : '???', {
    fontSize: '25px', color: seen ? '#ffffff' : '#78909c', fontStyle: 'bold',
  }).setOrigin(0, 0)
  scene.add.text(nameTxt.x + nameTxt.width + 10, head.y + 6, `(Nv ${m.level})`, {
    fontSize: '18px', color: m.boss ? '#ff5252' : m.mvp ? '#ffd54f' : '#b0bec5', fontStyle: 'bold',
  }).setOrigin(0, 0)
  // rang (ÉLITE / BOSS) à l'autre bout de la ligne : il qualifie le monstre, pas ses stats
  if (m.boss || m.mvp) {
    const { label, color } = seen ? monsterKind(m) : { label: '???', color: 0x455a64 }
    scene.add.text(head.x + head.w - 40, head.y + 14, label, {
      fontSize: '13px', color: seen ? '#0d1b2a' : '#cfd8dc', backgroundColor: css(color), fontStyle: 'bold', padding: { x: 5, y: 2 },
    }).setOrigin(0.5)
  }

  // ── QUART HAUT-GAUCHE : l'image seule ──
  const big = scene.add.image(ident.x, ident.y, `monster-${m.id}`).setOrigin(0, 0).setDisplaySize(BD.portrait, BD.portrait)
  if (!seen) big.setTint(SILHOUETTE_TINT).setAlpha(0.85)
  if (seen) {
    const sub = opts.kills === undefined ? behaviorLabel(m) : `${behaviorLabel(m)}\nvaincu ${opts.kills}×`
    scene.add.text(ident.x, ident.y + BD.portrait + 6, sub, { fontSize: '11px', color: '#80cbc4', lineSpacing: 2, wordWrap: { width: ident.w } })
  }

  // ── TRAIT VERTICAL, juste après l'image ──
  scene.add.rectangle(BD.splitX, ident.y, 2, BD.topH, 0xffffff, 0.22).setOrigin(0.5, 0)

  // ── QUART HAUT-DROITE : compétences ──
  scene.add.text(skl.x, skl.y, 'COMPÉTENCES', { fontSize: '14px', color: '#80cbc4', fontStyle: 'bold' })
  const skills = seen ? (m.skills ?? []).map((sid) => SKILLS[sid]).filter((sk): sk is NonNullable<typeof sk> => !!sk) : []
  if (!seen) {
    scene.add.text(skl.x, skl.y + 24, 'Fiche verrouillée — vaincs ce monstre pour la révéler.', { fontSize: '13px', color: '#607d8b', fontStyle: 'italic', wordWrap: { width: skl.w } })
  } else if (!skills.length) {
    scene.add.text(skl.x, skl.y + 24, 'Aucune compétence — attaque simple.', { fontSize: '12px', color: '#78909c', fontStyle: 'italic', wordWrap: { width: skl.w } })
  } else {
    skills.slice(0, maxSkillRows()).forEach((sk, i) => {
      const y = skl.y + 22 + i * BD.skillRowH
      gridCard(scene, skl.x, y + BD.skillRowH / 2, skl.w, BD.skillRowH - 4, `skill-${sk.id}`, undefined,
        sk.name, 0xffffff, truncate(sk.description, BD.descMax), '#b0bec5')
    })
  }

  // ── BANDE DE PRÉSENTATION : qui est ce monstre ──
  // Le texte existait pour les 86 monstres (MonsterDef.lore) mais n'était affiché nulle part. Il est
  // replié à la main plutôt que via wordWrap de Phaser : c'est la même découpe que celle dont le test
  // vérifie qu'elle tient en 3 lignes, donc ce qui est vérifié est exactement ce qui est dessiné.
  const lore = loreBox()
  if (seen) {
    const lignes = wrapText(m.lore, charsPerLine(lore.w, BD.loreFont), BD.loreLines)
    scene.add.text(lore.x, lore.y, lignes.join('\n'), {
      fontSize: `${BD.loreFont}px`, color: '#d7e7ef', fontStyle: 'italic', lineSpacing: 3,
    }).setOrigin(0, 0)
  } else {
    scene.add.text(lore.x, lore.y, 'Monstre inconnu — approche-le pour en apprendre plus.', {
      fontSize: `${BD.loreFont}px`, color: '#607d8b', fontStyle: 'italic',
    }).setOrigin(0, 0)
  }

  // ── BANDE DU BAS : BUTIN sur toute la largeur ──
  scene.add.text(loot.x, loot.y, 'BUTIN', { fontSize: '14px', color: '#80cbc4', fontStyle: 'bold' })
  if (!seen) {
    scene.add.text(loot.x, loot.y + 24, 'Vaincs ce monstre pour connaître son butin.', { fontSize: '13px', color: '#607d8b', fontStyle: 'italic' })
    return
  }
  // TOUT le butin est affiché, sans « +1 autre… » (« le (1 et autre pour les drop) c'est nul »), et
  // chaque entrée porte son NOM et sa PROBA — y compris l'or et les potions, dont la chance diffère
  // d'un monstre à l'autre (« personne a le même »). La hauteur de ligne s'adapte au nombre d'entrées.
  const rh = lootRowH(m.drops.length)
  const colW = (loot.w - (LOOT_COLS - 1) * 10) / LOOT_COLS
  const rank = (d: DropEntry) => (d.kind === 'item' ? 0 : d.kind === 'material' ? 1 : d.kind === 'gold' ? 2 : 3)
  ;[...m.drops].sort((a, b) => rank(a) - rank(b)).forEach((d, i) => {
    const c = i % LOOT_COLS, r = Math.floor(i / LOOT_COLS)
    const x = loot.x + c * (colW + 10)
    const y = loot.y + 22 + r * rh + rh / 2
    const { label, color, chance, qty } = dropLine(d)
    const { key, tint } = lootIcon(scene, d)
    gridCard(scene, x, y, colW, rh - 4, key, tint, label, color, `${chance}  ${qty}`, '#ffd54f')
  })
}

export { CARD }

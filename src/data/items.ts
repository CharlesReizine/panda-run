import type { EquipSlot, ItemDef, Rarity } from '../core/types'

// Ordre d'affichage fixe des types d'équipement (boutiques + inventaire) : chapeau → armure →
// arme → accessoire. Libellés pluriels pour les en-têtes de section.
export const SLOT_ORDER: EquipSlot[] = ['hat', 'armor', 'weapon', 'accessory']
export const SLOT_LABEL_PLURAL: Record<EquipSlot, string> = {
  hat: 'Chapeaux',
  armor: 'Armures',
  weapon: 'Armes',
  accessory: 'Accessoires',
}
export const SLOT_RANK: Record<EquipSlot, number> = { hat: 0, armor: 1, weapon: 2, accessory: 3 }

const list: ItemDef[] = [
  { id: 'epee-bambou', name: 'Épée en bambou', slot: 'weapon', bonus: { atk: 5 }, rarity: 'commun', description: 'Une lame de fortune taillée dans une tige de bambou. Ça pique, à peine.' },
  { id: 'baton-feuillu', name: 'Bâton feuillu', slot: 'weapon', bonus: { atk: 7 }, rarity: 'commun', description: 'Un bâton encore couvert de feuilles, léger et maniable pour débuter.' },
  { id: 'arc-souple', name: 'Arc souple', slot: 'weapon', bonus: { atk: 6 }, rarity: 'commun', description: 'Un arc d\'entraînement au bois tendre, parfait pour se faire la main.' },
  { id: 'sabre-acier', name: 'Sabre en acier', slot: 'weapon', bonus: { atk: 9 }, rarity: 'rare', description: 'Une lame d\'acier bien affûtée qui tranche net et sans bavure.' },
  { id: 'arc-composite', name: 'Arc composite', slot: 'weapon', bonus: { atk: 10 }, rarity: 'rare', description: 'Un arc lamellé de corne et de bois nerveux : tir tendu et puissant.' },
  { id: 'baton-cristal', name: 'Bâton de cristal', slot: 'weapon', bonus: { atk: 11, maxHp: 10 }, rarity: 'rare', description: 'Un cristal serti canalise l\'énergie et fortifie légèrement son porteur.' },
  { id: 'griffe-royale', name: 'Griffe royale', slot: 'weapon', bonus: { atk: 14 }, rarity: 'epique', description: 'Une griffe cérémonielle réservée à l\'élite : redoutable de tranchant.' },
  // ── Nouvelles armes (au-delà du bambou) — palette élargie épée / arc / bâton, montée en gamme ──
  { id: 'epee-large', name: 'Épée large', slot: 'weapon', bonus: { atk: 11 }, rarity: 'rare', description: 'Une lame large et lourde qui compense la lenteur par la force du coup.' },
  { id: 'masse-etoilee', name: 'Masse étoilée', slot: 'weapon', bonus: { atk: 12, def: 3 }, rarity: 'rare', description: 'Une masse contondante hérissée de pointes : elle frappe fort et protège la garde.' },
  { id: 'arc-long', name: 'Arc long', slot: 'weapon', bonus: { atk: 10 }, rarity: 'rare', description: 'Un grand arc de guerre à longue portée, capable de percer les rangs ennemis.' },
  { id: 'arbalete', name: 'Arbalète', slot: 'weapon', bonus: { atk: 13 }, rarity: 'rare', description: 'Un carreau lancé à pleine puissance qui transperce la plus solide armure.' },
  { id: 'baton-runique', name: 'Bâton runique', slot: 'weapon', bonus: { atk: 12, maxHp: 15 }, rarity: 'rare', description: 'Gravé de runes anciennes, il amplifie la magie et renforce la vitalité.' },
  { id: 'sceptre-flamme', name: 'Sceptre de flamme', slot: 'weapon', bonus: { atk: 16, maxHp: 20 }, rarity: 'epique', description: 'Une braise éternelle couronne ce sceptre : chaque incantation crépite de feu.' },
  { id: 'katana-eclair', name: 'Katana d\'éclair', slot: 'weapon', bonus: { atk: 21 }, rarity: 'legendaire', description: 'Une lame légendaire chargée de foudre : elle fend l\'air plus vite que l\'œil.' },
  { id: 'faux-sombre', name: 'Faux sombre', slot: 'weapon', bonus: { atk: 20, def: 4 }, rarity: 'legendaire', description: 'La faux du faucheur, taillée dans l\'ombre : elle moissonne les âmes sans pitié.' },
  { id: 'plastron-feuilles', name: 'Plastron de feuilles', slot: 'armor', bonus: { def: 4, maxHp: 20 }, rarity: 'commun', description: 'Un plastron tressé de feuilles épaisses : protection modeste mais légère.' },
  { id: 'carapace-scarabee', name: 'Carapace de scarabée', slot: 'armor', bonus: { def: 9, maxHp: 40 }, rarity: 'rare', description: 'Une carapace de scarabée géant, dure comme la corne et étonnamment légère.' },
  { id: 'grelot-porte-bonheur', name: 'Grelot porte-bonheur', slot: 'accessory', bonus: { maxHp: 30 }, rarity: 'rare', description: 'Son tintement clair éloigne le mauvais sort et réconforte le cœur.' },
  { id: 'amulette-pharaon', name: 'Amulette du pharaon', slot: 'accessory', bonus: { atk: 6, maxHp: 25 }, rarity: 'epique', description: 'Un talisman des tombeaux royaux, chargé d\'une puissance millénaire.' },
  { id: 'ruban', name: 'Ruban', slot: 'hat', bonus: { maxHp: 3 }, rarity: 'commun', description: 'Un simple ruban coquet qui remonte un peu le moral.' },
  { id: 'sakkat', name: 'Sakkat', slot: 'hat', bonus: { maxHp: 8 }, rarity: 'commun', description: 'Un chapeau de paille tressé qui protège du soleil des longues routes.' },
  { id: 'chapeau-poring', name: 'Chapeau Poring', slot: 'hat', bonus: { maxHp: 5 }, rarity: 'commun', description: 'Un bonnet en forme de Poring tout rond : adorable et réconfortant.' },
  { id: 'ailes-angeling', name: "Ailes d'Angeling", slot: 'hat', bonus: { maxHp: 15 }, rarity: 'rare', description: 'Une paire de petites ailes angéliques qui insufflent un souffle de vie.' },
  { id: 'couronne-royale', name: 'Couronne royale', slot: 'hat', bonus: { atk: 4, def: 4 }, rarity: 'epique', description: 'La couronne d\'un roi oublié : elle impose le respect et aiguise le port.' },
  { id: 'bonnet-champi', name: 'Bonnet champignon', slot: 'hat', bonus: { def: 3 }, rarity: 'commun', description: 'Un chapeau-champignon moelleux qui amortit les coups sur le crâne.' },
  { id: 'casque-orc', name: 'Casque orc', slot: 'hat', bonus: { def: 6 }, rarity: 'rare', description: 'Un heaume brut arraché à un guerrier orc : lourd mais robuste.' },
  // équipements forgés (craft en ville) — distincts de ceux des boutiques, meilleurs bonus
  { id: 'epee-fer-forgee', name: 'Épée en fer forgé', slot: 'weapon', bonus: { atk: 12 }, rarity: 'epique', description: 'Une lame forgée au marteau dans du bon fer : fiable et tranchante.' },
  { id: 'lame-scorpion', name: 'Lame du scorpion', slot: 'weapon', bonus: { atk: 17 }, rarity: 'legendaire', description: 'Forgée d\'un dard de scorpion géant, sa morsure est fulgurante.' },
  { id: 'baton-lumineux', name: 'Bâton lumineux', slot: 'weapon', bonus: { atk: 11, maxHp: 20 }, rarity: 'epique', description: 'Un bâton qui irradie une lumière chaude, source de force et de vie.' },
  { id: 'plastron-fer', name: 'Plastron de fer', slot: 'armor', bonus: { def: 8, maxHp: 25 }, rarity: 'epique', description: 'Une cuirasse de fer martelée qui encaisse les coups les plus rudes.' },
  { id: 'armure-carapace', name: 'Armure de carapace', slot: 'armor', bonus: { def: 13, maxHp: 55 }, rarity: 'legendaire', description: 'Une armure taillée dans une carapace de monstre : forteresse ambulante.' },
  { id: 'amulette-gemme', name: 'Amulette de gemme', slot: 'accessory', bonus: { atk: 8, maxHp: 40 }, rarity: 'epique', description: 'Une gemme brute sertie qui décuple la vigueur de qui la porte.' },
  { id: 'talisman-trefle', name: 'Talisman du trèfle', slot: 'accessory', bonus: { maxHp: 60 }, rarity: 'legendaire', description: 'Un trèfle à quatre feuilles pétrifié : une chance insolente, une vitalité de fer.' },
  { id: 'casque-croc', name: 'Casque à crocs', slot: 'hat', bonus: { def: 5, atk: 4 }, rarity: 'epique', description: 'Un heaume orné de crocs de fauve, aussi menaçant que protecteur.' },
  { id: 'corne-kaho', name: 'Corne de Lord Kaho', slot: 'hat', bonus: { atk: 6, def: 6 }, rarity: 'legendaire', description: 'La corne légendaire de Lord Kaho, symbole ultime de puissance martiale.' },
]

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]))

// Couleur d'affichage par rareté (0xRRGGBB). 'commun' par défaut si la rareté est absente.
const RARITY_COLORS: Record<Rarity, number> = {
  commun: 0xb0bec5,
  rare: 0x42a5f5,
  epique: 0xba68c8,
  legendaire: 0xffb300,
}

export function rarityColor(rarity: Rarity = 'commun'): number {
  return RARITY_COLORS[rarity]
}

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
  { id: 'epee-bambou', name: 'Épée en bambou', slot: 'weapon', weaponType: 'sword', bonus: { atk: 5 }, rarity: 'commun', description: 'Une lame de fortune taillée dans une tige de bambou. Ça pique, à peine.' },
  { id: 'baton-feuillu', name: 'Bâton feuillu', slot: 'weapon', weaponType: 'staff', bonus: { atk: 7 }, rarity: 'commun', description: 'Un bâton encore couvert de feuilles, léger et maniable pour débuter.' },
  { id: 'arc-souple', name: 'Arc souple', slot: 'weapon', weaponType: 'bow', bonus: { atk: 6 }, rarity: 'commun', description: 'Un arc d\'entraînement au bois tendre, parfait pour se faire la main.' },
  { id: 'sabre-acier', name: 'Sabre en acier', slot: 'weapon', weaponType: 'sword', bonus: { atk: 9 }, rarity: 'rare', description: 'Une lame d\'acier bien affûtée qui tranche net et sans bavure.' },
  { id: 'arc-composite', name: 'Arc composite', slot: 'weapon', weaponType: 'bow', bonus: { atk: 10 }, rarity: 'rare', description: 'Un arc lamellé de corne et de bois nerveux : tir tendu et puissant.' },
  { id: 'baton-cristal', name: 'Bâton de cristal', slot: 'weapon', weaponType: 'staff', bonus: { atk: 11, maxHp: 10 }, rarity: 'rare', description: 'Un cristal serti canalise l\'énergie et fortifie légèrement son porteur.' },
  { id: 'griffe-royale', name: 'Griffe royale', slot: 'weapon', weaponType: 'sword', bonus: { atk: 14 }, rarity: 'epique', description: 'Une griffe cérémonielle réservée à l\'élite : redoutable de tranchant.' },
  // ── Nouvelles armes (au-delà du bambou) — palette élargie épée / arc / bâton, montée en gamme ──
  { id: 'epee-large', name: 'Épée large', slot: 'weapon', weaponType: 'sword', bonus: { atk: 11 }, rarity: 'rare', description: 'Une lame large et lourde qui compense la lenteur par la force du coup.' },
  { id: 'masse-etoilee', name: 'Masse étoilée', slot: 'weapon', weaponType: 'sword', bonus: { atk: 12, def: 3 }, rarity: 'rare', description: 'Une masse contondante hérissée de pointes : elle frappe fort et protège la garde.' },
  { id: 'arc-long', name: 'Arc long', slot: 'weapon', weaponType: 'bow', bonus: { atk: 10 }, rarity: 'rare', description: 'Un grand arc de guerre à longue portée, capable de percer les rangs ennemis.' },
  { id: 'arbalete', name: 'Arbalète', slot: 'weapon', weaponType: 'bow', bonus: { atk: 13 }, rarity: 'rare', description: 'Un carreau lancé à pleine puissance qui transperce la plus solide armure.' },
  { id: 'baton-runique', name: 'Bâton runique', slot: 'weapon', weaponType: 'staff', bonus: { atk: 12, maxHp: 15 }, rarity: 'rare', description: 'Gravé de runes anciennes, il amplifie la magie et renforce la vitalité.' },
  { id: 'sceptre-flamme', name: 'Sceptre de flamme', slot: 'weapon', weaponType: 'staff', bonus: { atk: 16, maxHp: 20 }, rarity: 'epique', description: 'Une braise éternelle couronne ce sceptre : chaque incantation crépite de feu.' },
  { id: 'katana-eclair', name: 'Katana d\'éclair', slot: 'weapon', weaponType: 'sword', bonus: { atk: 21 }, rarity: 'legendaire', description: 'Une lame légendaire chargée de foudre : elle fend l\'air plus vite que l\'œil.' },
  { id: 'faux-sombre', name: 'Faux sombre', slot: 'weapon', weaponType: 'sword', bonus: { atk: 20, def: 4 }, rarity: 'legendaire', description: 'La faux du faucheur, taillée dans l\'ombre : elle moissonne les âmes sans pitié.' },
  { id: 'plastron-feuilles', name: 'Plastron de feuilles', slot: 'armor', bonus: { def: 4, maxHp: 20 }, rarity: 'commun', description: 'Un plastron tressé de feuilles épaisses : protection modeste mais légère.' },
  { id: 'carapace-scarabee', name: 'Carapace de scarabée', slot: 'armor', bonus: { def: 9, maxHp: 40 }, rarity: 'rare', description: 'Une carapace de scarabée géant, dure comme la corne et étonnamment légère.' },
  { id: 'grelot-porte-bonheur', name: 'Grelot porte-bonheur', slot: 'accessory', bonus: { maxHp: 30 }, rarity: 'rare', description: 'Son tintement clair éloigne le mauvais sort et réconforte le cœur.' },
  { id: 'amulette-pharaon', name: 'Amulette du pharaon', slot: 'accessory', bonus: { atk: 6, maxHp: 25 }, rarity: 'epique', description: 'Un talisman des tombeaux royaux, chargé d\'une puissance millénaire.' },
  // ── Armures & accessoires de boutique — étoffent les échoppes de Prontera (early) et Morocc (mid).
  // Sans art dédié : icône de secours par emplacement (pastille DEF/PV), comme les autres armures.
  { id: 'veste-rembourree', name: 'Veste rembourrée', slot: 'armor', bonus: { def: 3, maxHp: 12 }, rarity: 'commun', description: 'Une veste matelassée bon marché : amortit les premiers coups sans ruiner la bourse.' },
  { id: 'bracelet-cuir', name: 'Bracelet de cuir', slot: 'accessory', bonus: { maxHp: 12 }, rarity: 'commun', description: 'Un simple bracelet de cuir tanné qui raffermit un peu la constitution.' },
  { id: 'cotte-mailles', name: 'Cotte de mailles', slot: 'armor', bonus: { def: 7, maxHp: 30 }, rarity: 'rare', description: 'Un maillage d\'anneaux d\'acier souple : bonne protection contre lames et griffes.' },
  { id: 'anneau-turquoise', name: 'Anneau de turquoise', slot: 'accessory', bonus: { atk: 4, maxHp: 20 }, rarity: 'rare', description: 'Une turquoise du désert sertie d\'argent, qui avive la vigueur du porteur.' },
  { id: 'ruban', name: 'Ruban', slot: 'hat', bonus: { maxHp: 3 }, rarity: 'commun', description: 'Un simple ruban coquet qui remonte un peu le moral.' },
  { id: 'sakkat', name: 'Sakkat', slot: 'hat', bonus: { maxHp: 8 }, rarity: 'commun', description: 'Un chapeau de paille tressé qui protège du soleil des longues routes.' },
  { id: 'chapeau-poring', name: 'Chapeau Poring', slot: 'hat', bonus: { maxHp: 5 }, rarity: 'commun', description: 'Un bonnet en forme de Poring tout rond : adorable et réconfortant.' },
  { id: 'ailes-angeling', name: "Ailes d'Angeling", slot: 'hat', bonus: { maxHp: 15 }, rarity: 'rare', description: 'Une paire de petites ailes angéliques qui insufflent un souffle de vie.' },
  { id: 'couronne-royale', name: 'Couronne royale', slot: 'hat', bonus: { atk: 4, def: 4 }, rarity: 'epique', description: 'La couronne d\'un roi oublié : elle impose le respect et aiguise le port.' },
  { id: 'bonnet-champi', name: 'Bonnet champignon', slot: 'hat', bonus: { def: 3 }, rarity: 'commun', description: 'Un chapeau-champignon moelleux qui amortit les coups sur le crâne.' },
  { id: 'casque-orc', name: 'Casque orc', slot: 'hat', bonus: { def: 6 }, rarity: 'rare', description: 'Un heaume brut arraché à un guerrier orc : lourd mais robuste.' },
  // équipements forgés (craft en ville) — distincts de ceux des boutiques, meilleurs bonus
  { id: 'epee-fer-forgee', name: 'Épée en fer forgé', slot: 'weapon', weaponType: 'sword', bonus: { atk: 12 }, rarity: 'epique', description: 'Une lame forgée au marteau dans du bon fer : fiable et tranchante.' },
  { id: 'lame-scorpion', name: 'Lame du scorpion', slot: 'weapon', weaponType: 'sword', bonus: { atk: 17 }, rarity: 'legendaire', description: 'Forgée d\'un dard de scorpion géant, sa morsure est fulgurante.' },
  { id: 'baton-lumineux', name: 'Bâton lumineux', slot: 'weapon', weaponType: 'staff', bonus: { atk: 11, maxHp: 20 }, rarity: 'epique', description: 'Un bâton qui irradie une lumière chaude, source de force et de vie.' },
  { id: 'plastron-fer', name: 'Plastron de fer', slot: 'armor', bonus: { def: 8, maxHp: 25 }, rarity: 'epique', description: 'Une cuirasse de fer martelée qui encaisse les coups les plus rudes.' },
  { id: 'armure-carapace', name: 'Armure de carapace', slot: 'armor', bonus: { def: 13, maxHp: 55 }, rarity: 'legendaire', description: 'Une armure taillée dans une carapace de monstre : forteresse ambulante.' },
  { id: 'amulette-gemme', name: 'Amulette de gemme', slot: 'accessory', bonus: { atk: 8, maxHp: 40 }, rarity: 'epique', description: 'Une gemme brute sertie qui décuple la vigueur de qui la porte.' },
  { id: 'talisman-trefle', name: 'Talisman du trèfle', slot: 'accessory', bonus: { maxHp: 60 }, rarity: 'legendaire', description: 'Un trèfle à quatre feuilles pétrifié : une chance insolente, une vitalité de fer.' },
  { id: 'casque-croc', name: 'Casque à crocs', slot: 'hat', bonus: { def: 5, atk: 4 }, rarity: 'epique', description: 'Un heaume orné de crocs de fauve, aussi menaçant que protecteur.' },
  { id: 'corne-kaho', name: 'Corne de Lord Kaho', slot: 'hat', bonus: { atk: 6, def: 6 }, rarity: 'legendaire', description: 'La corne légendaire de Lord Kaho, symbole ultime de puissance martiale.' },
  // ── Armes supplémentaires — silhouettes DÉDIÉES (cf. drawItemWeapon), spectre complet des trois
  // familles (lame / arc / bâton) sur toute la montée en rareté. Bonus croissants avec la rareté.
  { id: 'dague-jumelle', name: 'Dagues jumelles', slot: 'weapon', weaponType: 'sword', bonus: { atk: 6 }, rarity: 'commun', description: 'Deux lames courtes jumelles, vives et légères, pour frapper en éclair.' },
  { id: 'cimeterre-desert', name: 'Cimeterre du désert', slot: 'weapon', weaponType: 'sword', bonus: { atk: 12 }, rarity: 'rare', description: 'Un cimeterre à la lame courbe, tranchant hérité des cavaliers du désert.' },
  { id: 'epee-cristal', name: 'Épée de cristal', slot: 'weapon', weaponType: 'sword', bonus: { atk: 15 }, rarity: 'epique', description: 'Une lame de cristal pur qui capte la lumière et blesse d\'un éclat glacé.' },
  { id: 'lame-solaire', name: 'Lame solaire', slot: 'weapon', weaponType: 'sword', bonus: { atk: 22 }, rarity: 'legendaire', description: 'Forgée au cœur d\'un soleil, sa lame incandescente réduit les ténèbres en cendres.' },
  { id: 'arc-corne', name: 'Arc de corne', slot: 'weapon', weaponType: 'bow', bonus: { atk: 7 }, rarity: 'commun', description: 'Un arc court taillé dans la corne, nerveux et facile à bander.' },
  { id: 'arc-elfique', name: 'Arc elfique', slot: 'weapon', weaponType: 'bow', bonus: { atk: 15 }, rarity: 'epique', description: 'Un arc elfique gravé de feuilles, d\'une précision et d\'une grâce surnaturelles.' },
  { id: 'arc-tempete', name: 'Arc de tempête', slot: 'weapon', weaponType: 'bow', bonus: { atk: 20 }, rarity: 'legendaire', description: 'Chaque flèche décochée déchaîne la foudre : l\'arc gronde comme l\'orage.' },
  { id: 'baton-noueux', name: 'Bâton noueux', slot: 'weapon', weaponType: 'staff', bonus: { atk: 8 }, rarity: 'commun', description: 'Un bâton noueux surmonté d\'un galet poli : l\'outil du mage débutant.' },
  { id: 'sceptre-glace', name: 'Sceptre de glace', slot: 'weapon', weaponType: 'staff', bonus: { atk: 12, maxHp: 12 }, rarity: 'rare', description: 'Un sceptre couronné d\'un éclat de glace éternelle qui mord et fortifie.' },
  { id: 'sceptre-arcane', name: 'Sceptre arcanique', slot: 'weapon', weaponType: 'staff', bonus: { atk: 16, maxHp: 18 }, rarity: 'epique', description: 'Un sceptre serti d\'une rune arcanique qui bourdonne de savoir interdit.' },
  { id: 'baton-cosmique', name: 'Bâton cosmique', slot: 'weapon', weaponType: 'staff', bonus: { atk: 21, maxHp: 25 }, rarity: 'legendaire', description: 'Un bâton coiffé d\'une étoile miniature : il canalise la puissance des astres.' },
  // ── Chapeaux supplémentaires — chacun DESSINÉ distinctement (cf. drawCosmetic), inspirés Ragnarok.
  { id: 'bandeau-guerrier', name: 'Bandeau du guerrier', slot: 'hat', bonus: { def: 3 }, rarity: 'commun', description: 'Un bandeau de tissu serré qui garde la sueur hors des yeux au combat.' },
  { id: 'plume-eclaireur', name: 'Plume d\'éclaireur', slot: 'hat', bonus: { maxHp: 4 }, rarity: 'commun', description: 'Une plume colorée fichée dans un bandeau : la marque des éclaireurs.' },
  { id: 'bonnet-laine', name: 'Bonnet de laine', slot: 'hat', bonus: { maxHp: 6 }, rarity: 'commun', description: 'Un bonnet de grosse laine qui tient bien chaud sur les routes du nord.' },
  { id: 'oreilles-chat', name: 'Oreilles de chat', slot: 'hat', bonus: { maxHp: 12 }, rarity: 'rare', description: 'Une paire d\'oreilles de chat trop mignonnes : impossible de résister.' },
  { id: 'chapeau-sorciere', name: 'Chapeau de sorcière', slot: 'hat', bonus: { atk: 5 }, rarity: 'rare', description: 'Un grand chapeau pointu de sorcière qui amplifie les incantations.' },
  { id: 'lunettes-aviateur', name: 'Lunettes d\'aviateur', slot: 'hat', bonus: { def: 4, atk: 2 }, rarity: 'rare', description: 'Des lunettes d\'aviateur relevées sur le front : style et protection.' },
  { id: 'casque-viking', name: 'Casque viking', slot: 'hat', bonus: { def: 6, atk: 3 }, rarity: 'epique', description: 'Un casque à cornes de guerrier du nord, brut et imposant.' },
  { id: 'diademe-fee', name: 'Diadème de fée', slot: 'hat', bonus: { atk: 4, maxHp: 20 }, rarity: 'epique', description: 'Un diadème de fée serti d\'une gemme qui pulse d\'une douce lumière.' },
  { id: 'aureole-sacree', name: 'Auréole sacrée', slot: 'hat', bonus: { maxHp: 35 }, rarity: 'epique', description: 'Une auréole sacrée flottant au-dessus de la tête : bénédiction des cieux.' },
  { id: 'couronne-glace', name: 'Couronne de glace', slot: 'hat', bonus: { atk: 6, def: 6 }, rarity: 'legendaire', description: 'Une couronne de glace éternelle qui ne fond jamais, froide et royale.' },
  { id: 'masque-demon', name: 'Masque de démon', slot: 'hat', bonus: { atk: 8, def: 4 }, rarity: 'legendaire', description: 'Un masque d\'oni démoniaque aux cornes ardentes : la terreur incarnée.' },
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

// Barème de prix d'ACHAT de référence par rareté (or). Sert de base au prix boutique et de repli
// pour les objets vendables non listés en boutique (forgés, butin). Fortement croissant : un rare
// vaut bien plus qu'un commun, un épique bien plus qu'un rare, un légendaire hors de portée sans
// effort. La valeur de REVENTE en découle (50 % du prix d'achat, cf. data/shops sellPrice).
export const RARITY_PRICE: Record<Rarity, number> = {
  commun: 100,
  rare: 500,
  epique: 2000,
  legendaire: 8000,
}

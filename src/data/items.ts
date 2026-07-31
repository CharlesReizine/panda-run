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
  { id: 'chapeau-poring', name: 'Chapeau Poring', slot: 'hat', bonus: { maxHp: 5 }, rarity: 'rare', description: 'Un bonnet en forme de Poring tout rond : adorable et réconfortant.' },
  { id: 'ailes-angeling', name: "Ailes d'Angeling", slot: 'hat', bonus: { maxHp: 15 }, rarity: 'legendaire', description: 'Une paire de petites ailes angéliques qui insufflent un souffle de vie. Butin signature ultra-rare de l\'Angeling élite.' },
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
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // ROSTER ÉLARGI — demande du user : « rajoute bien des armes et armures, je veux que ça soit riche
  // et varié sur chapeaux armures armes, il me faut des tonnes de trucs, prends tout ce qui existe
  // dans les RPG de ce type et les MMORPG et prends vraiment les trucs les plus stylés. »
  //
  // POURQUOI CE BLOC EXISTE. L'inventaire du jeu était très déséquilibré : 30 armes et 20 chapeaux
  // pour SIX armures et SIX accessoires. On ne pouvait donc pas progresser sur la défense — retour
  // du user : « je crois que niveau armure et tout il en faut beaucoup plus, non ? ». Oui.
  //
  // ⚠️ PROFILS DE STATS VOLONTAIREMENT VARIÉS (« mets des perfs différentes ») : DÉF pure, PV purs,
  // DÉF+PV, ATK+DÉF, les trois. Comme le niveau minimum est DÉDUIT de la puissance totale
  // (core/item-level.ts), deux objets de profils opposés mais de puissance égale se débloquent au
  // même niveau : on choisit selon son style de jeu, pas selon un chiffre unique.
  //
  // ⚠️ ILLUSTRATIONS À VENIR pour ce bloc. Les armes ont déjà une silhouette dessinée au chargement
  // (PreloadScene.bakeItemWeapons) ; les armures, accessoires et chapeaux ajoutés ici attendent leur
  // PNG. La liste exacte des fichiers à produire est générée par scripts/art-manquant.mjs et
  // recensée dans docs/art-a-generer.md — elle est verrouillée par tests/data/item-images.test.ts,
  // qui échoue pour tout objet sans image ET absent de la liste : la dette reste comptée.

  // ── ARMES ──
  { id: 'couteau-de-chasse', name: 'Couteau de chasse', slot: 'weapon', weaponType: 'sword', bonus: { atk: 4 }, rarity: 'commun', description: 'Une lame courte de trappeur, ébréchée par mille dépeçages.' },
  { id: 'glaive-de-fer', name: 'Glaive de fer', slot: 'weapon', weaponType: 'sword', bonus: { atk: 9 }, rarity: 'commun', description: 'Le glaive court des légions : simple, robuste, redoutablement efficace.' },
  { id: 'rapiere', name: 'Rapière', slot: 'weapon', weaponType: 'sword', bonus: { atk: 12 }, rarity: 'rare', description: 'Une lame fine et nerveuse qui cherche les défauts de l\'armure.' },
  { id: 'hache-de-guerre', name: 'Hache de guerre', slot: 'weapon', weaponType: 'sword', bonus: { atk: 14 }, rarity: 'rare', description: 'Une hache à double tranchant qui fend les boucliers d\'un seul élan.' },
  { id: 'epee-batarde', name: 'Épée bâtarde', slot: 'weapon', weaponType: 'sword', bonus: { atk: 13, maxHp: 10 }, rarity: 'rare', description: 'Ni tout à fait courte, ni tout à fait longue : polyvalente et rassurante.' },
  { id: 'sabre-de-samourai', name: 'Sabre de samouraï', slot: 'weapon', weaponType: 'sword', bonus: { atk: 17 }, rarity: 'epique', description: 'Une lame pliée mille fois, d\'un tranchant qui frôle l\'indécence.' },
  { id: 'claymore', name: 'Claymore', slot: 'weapon', weaponType: 'sword', bonus: { atk: 18, def: 3 }, rarity: 'epique', description: 'L\'immense épée des highlands : on la tient à deux pattes et on prie.' },
  { id: 'epee-du-croise', name: 'Épée du croisé', slot: 'weapon', weaponType: 'sword', bonus: { atk: 16, maxHp: 26 }, rarity: 'epique', description: 'Une lame bénie gravée d\'un serment : elle protège autant qu\'elle frappe.' },
  { id: 'lame-du-neant', name: 'Lame du néant', slot: 'weapon', weaponType: 'sword', bonus: { atk: 25 }, rarity: 'legendaire', description: 'Une fissure d\'obscurité en forme d\'épée. Ce qu\'elle coupe ne revient pas.' },
  { id: 'epee-du-jugement', name: 'Épée du jugement', slot: 'weapon', weaponType: 'sword', bonus: { atk: 23, maxHp: 20 }, rarity: 'legendaire', description: 'La sentence faite acier : elle rend son verdict en un seul coup.' },
  { id: 'fronde', name: 'Fronde', slot: 'weapon', weaponType: 'bow', bonus: { atk: 3 }, rarity: 'commun', description: 'Un bout de cuir et un caillou. On commence tous quelque part.' },
  { id: 'arc-de-chasse', name: 'Arc de chasse', slot: 'weapon', weaponType: 'bow', bonus: { atk: 8 }, rarity: 'commun', description: 'L\'arc du braconnier : discret, maniable, sans fioritures.' },
  { id: 'arc-en-if', name: 'Arc en if', slot: 'weapon', weaponType: 'bow', bonus: { atk: 11 }, rarity: 'rare', description: 'Un grand arc taillé dans l\'if, bois des archers depuis toujours.' },
  { id: 'arbalete-lourde', name: 'Arbalète lourde', slot: 'weapon', weaponType: 'bow', bonus: { atk: 15 }, rarity: 'rare', description: 'Un engin de siège miniature. Lent à tendre, dévastateur à décocher.' },
  { id: 'arc-de-glace', name: 'Arc de glace', slot: 'weapon', weaponType: 'bow', bonus: { atk: 12, maxHp: 14 }, rarity: 'rare', description: 'Ses flèches sifflent en gelant l\'air derrière elles.' },
  { id: 'arc-du-faucon', name: 'Arc du faucon', slot: 'weapon', weaponType: 'bow', bonus: { atk: 17, def: 2 }, rarity: 'epique', description: 'Léger comme une plume, précis comme un regard de rapace.' },
  { id: 'arc-de-braise', name: 'Arc de braise', slot: 'weapon', weaponType: 'bow', bonus: { atk: 18, maxHp: 16 }, rarity: 'epique', description: 'La corde fume à chaque tir : chaque flèche part en emportant un tison.' },
  { id: 'arc-du-crepuscule', name: 'Arc du crépuscule', slot: 'weapon', weaponType: 'bow', bonus: { atk: 22, def: 5 }, rarity: 'legendaire', description: 'Il ne se bande qu\'à la tombée du jour, et ne rate jamais à cette heure-là.' },
  { id: 'arc-des-etoiles', name: 'Arc des étoiles', slot: 'weapon', weaponType: 'bow', bonus: { atk: 24, maxHp: 22 }, rarity: 'legendaire', description: 'Ses flèches laissent une traînée de constellations avant de frapper.' },
  { id: 'branche-tordue', name: 'Branche tordue', slot: 'weapon', weaponType: 'staff', bonus: { atk: 4, maxHp: 6 }, rarity: 'commun', description: 'Une branche ramassée au sol. Elle canalise mal, mais elle canalise.' },
  { id: 'baton-de-novice', name: 'Bâton de novice', slot: 'weapon', weaponType: 'staff', bonus: { atk: 6, maxHp: 10 }, rarity: 'commun', description: 'Le bâton remis à tout apprenti : usé par des générations de mains moites.' },
  { id: 'baton-d-ebene', name: 'Bâton d\'ébène', slot: 'weapon', weaponType: 'staff', bonus: { atk: 11, maxHp: 16 }, rarity: 'rare', description: 'Un bois noir et dense qui absorbe la lumière et rend la magie.' },
  { id: 'sceptre-de-jade', name: 'Sceptre de jade', slot: 'weapon', weaponType: 'staff', bonus: { atk: 13, maxHp: 12 }, rarity: 'rare', description: 'Le jade poli tiédit dans la main dès qu\'un sort se prépare.' },
  { id: 'baton-de-tempete', name: 'Bâton de tempête', slot: 'weapon', weaponType: 'staff', bonus: { atk: 12, def: 4, maxHp: 10 }, rarity: 'rare', description: 'Un grondement sourd l\'habite en permanence, comme un orage en cage.' },
  { id: 'sceptre-d-ombre', name: 'Sceptre d\'ombre', slot: 'weapon', weaponType: 'staff', bonus: { atk: 17, maxHp: 22 }, rarity: 'epique', description: 'Sa pointe ne projette aucune ombre — c\'est elle qui en est faite.' },
  { id: 'baton-des-marees', name: 'Bâton des marées', slot: 'weapon', weaponType: 'staff', bonus: { atk: 15, def: 5, maxHp: 30 }, rarity: 'epique', description: 'On entend le ressac dedans. Il donne à son porteur la patience de l\'océan.' },
  { id: 'sceptre-du-chaos', name: 'Sceptre du chaos', slot: 'weapon', weaponType: 'staff', bonus: { atk: 23, maxHp: 28 }, rarity: 'legendaire', description: 'Aucun sort lancé avec lui ne se répète jamais tout à fait à l\'identique.' },
  { id: 'baton-de-l-aube', name: 'Bâton de l\'aube', slot: 'weapon', weaponType: 'staff', bonus: { atk: 20, def: 8, maxHp: 46 }, rarity: 'legendaire', description: 'Sa gemme contient un lever de soleil qui n\'a jamais fini de se lever.' },

  // ── ARMURES ──
  { id: 'tunique-de-lin', name: 'Tunique de lin', slot: 'armor', bonus: { def: 2, maxHp: 8 }, rarity: 'commun', description: 'Une tunique de paysan, propre et rapiécée. Mieux que rien.' },
  { id: 'gilet-de-cuir', name: 'Gilet de cuir', slot: 'armor', bonus: { def: 4, maxHp: 6 }, rarity: 'commun', description: 'Un gilet de cuir bouilli qui encaisse les griffes de petit gibier.' },
  { id: 'robe-d-apprenti', name: 'Robe d\'apprenti', slot: 'armor', bonus: { def: 2, maxHp: 14 }, rarity: 'commun', description: 'Une robe trop grande, marquée de brûlures d\'expériences ratées.' },
  { id: 'brigandine', name: 'Brigandine', slot: 'armor', bonus: { def: 5, maxHp: 4 }, rarity: 'commun', description: 'Des plaques de métal rivetées dans le cuir : rustique et sérieux.' },
  { id: 'manteau-de-voyageur', name: 'Manteau de voyageur', slot: 'armor', bonus: { def: 3, maxHp: 16 }, rarity: 'commun', description: 'Un manteau épais qui a vu plus de routes que la plupart des cartes.' },
  { id: 'cuirasse-de-bronze', name: 'Cuirasse de bronze', slot: 'armor', bonus: { def: 8, maxHp: 18 }, rarity: 'rare', description: 'Le bronze martelé des anciens hoplites, patiné de vert-de-gris.' },
  { id: 'armure-d-ecailles', name: 'Armure d\'écailles', slot: 'armor', bonus: { def: 10, maxHp: 14 }, rarity: 'rare', description: 'Des écailles se chevauchant comme sur un poisson : souple et dure.' },
  { id: 'robe-de-mage', name: 'Robe de mage', slot: 'armor', bonus: { def: 5, maxHp: 44 }, rarity: 'rare', description: 'Brodée de fils d\'argent, elle nourrit la vitalité plus qu\'elle ne protège.' },
  { id: 'jaque-de-mailles', name: 'Jaque de mailles', slot: 'armor', bonus: { def: 9, maxHp: 24 }, rarity: 'rare', description: 'Un vêtement de mailles fines porté sous l\'étoffe : discret, efficace.' },
  { id: 'plastron-d-os', name: 'Plastron d\'os', slot: 'armor', bonus: { def: 11, maxHp: 8 }, rarity: 'rare', description: 'Des côtes de grand fauve liées ensemble. Ça claque au vent, et ça tient.' },
  { id: 'carapace-de-tortue', name: 'Carapace de tortue', slot: 'armor', bonus: { def: 12, maxHp: 30 }, rarity: 'rare', description: 'Lourde, bombée, presque impossible à percer. On avance moins vite.' },
  { id: 'cotte-de-givre', name: 'Cotte de givre', slot: 'armor', bonus: { def: 9, maxHp: 20 }, rarity: 'rare', description: 'Elle reste froide en toute saison et gèle le sang des lames qui l\'effleurent.' },
  { id: 'justaucorps-d-ombre', name: 'Justaucorps d\'ombre', slot: 'armor', bonus: { atk: 5, def: 6, maxHp: 12 }, rarity: 'rare', description: 'Un cuir teint au noir de fumée, taillé pour frapper avant d\'être vu.' },
  { id: 'harnois-de-fer', name: 'Harnois de fer', slot: 'armor', bonus: { def: 14, maxHp: 26 }, rarity: 'epique', description: 'L\'armure complète du sergent d\'armes : rien ne passe, rien ne plie.' },
  { id: 'armure-de-lamelles', name: 'Armure de lamelles', slot: 'armor', bonus: { def: 12, maxHp: 40 }, rarity: 'epique', description: 'Des centaines de lamelles lacées à la main, souples comme une seconde peau.' },
  { id: 'robe-arcanique', name: 'Robe arcanique', slot: 'armor', bonus: { atk: 6, def: 6, maxHp: 30 }, rarity: 'epique', description: 'Ses runes se réarrangent seules selon le sort que l\'on prépare.' },
  { id: 'cuirasse-du-croise', name: 'Cuirasse du croisé', slot: 'armor', bonus: { def: 16, maxHp: 30 }, rarity: 'epique', description: 'Frappée d\'une croix bosselée par les coups qu\'elle a arrêtés.' },
  { id: 'armure-de-mithril', name: 'Armure de mithril', slot: 'armor', bonus: { def: 15, maxHp: 44 }, rarity: 'epique', description: 'Aussi légère qu\'une chemise, aussi dure que l\'acier trempé.' },
  { id: 'toge-du-sage', name: 'Toge du sage', slot: 'armor', bonus: { atk: 8, def: 4, maxHp: 36 }, rarity: 'epique', description: 'La toge de celui qui a lu tous les grimoires — et en a compris deux.' },
  { id: 'surcot-du-templier', name: 'Surcot du templier', slot: 'armor', bonus: { def: 13, maxHp: 34 }, rarity: 'epique', description: 'Un surcot de lin blanc sur mailles : le serment se porte par-dessus l\'armure.' },
  { id: 'cuirasse-de-magma', name: 'Cuirasse de magma', slot: 'armor', bonus: { atk: 7, def: 12, maxHp: 20 }, rarity: 'epique', description: 'Des veines incandescentes couvent sous la plaque. Elle brûle qui la frappe.' },
  { id: 'plastron-de-dragon', name: 'Plastron de dragon', slot: 'armor', bonus: { def: 20, maxHp: 60 }, rarity: 'legendaire', description: 'Taillé dans le poitrail d\'un dragon. Il respire encore, un peu.' },
  { id: 'armure-d-obsidienne', name: 'Armure d\'obsidienne', slot: 'armor', bonus: { def: 24, maxHp: 40 }, rarity: 'legendaire', description: 'Du verre volcanique noir, tranchant sur les bords : la toucher est déjà une erreur.' },
  { id: 'robe-celeste', name: 'Robe céleste', slot: 'armor', bonus: { atk: 10, def: 10, maxHp: 50 }, rarity: 'legendaire', description: 'Un tissu qui n\'existe pas vraiment ici. On voit les étoiles à travers.' },
  { id: 'armure-du-valhalla', name: 'Armure du Valhalla', slot: 'armor', bonus: { def: 22, maxHp: 70 }, rarity: 'legendaire', description: 'Portée par ceux qui sont morts et revenus quand même. Elle ne cède pas.' },
  { id: 'carapace-du-roi-scarabee', name: 'Carapace du roi scarabée', slot: 'armor', bonus: { def: 26, maxHp: 55 }, rarity: 'legendaire', description: 'La cuirasse du monarque des sables, irisée de bleu et d\'or.' },

  // ── ACCESSOIRES ──
  { id: 'anneau-de-cuivre', name: 'Anneau de cuivre', slot: 'accessory', bonus: { atk: 2 }, rarity: 'commun', description: 'Un anneau bon marché qui verdit le doigt, mais raffermit la poigne.' },
  { id: 'pendentif-de-bois', name: 'Pendentif de bois', slot: 'accessory', bonus: { maxHp: 10 }, rarity: 'commun', description: 'Un médaillon sculpté au couteau par quelqu\'un qui vous aimait bien.' },
  { id: 'boucle-d-oreille', name: 'Boucle d\'oreille', slot: 'accessory', bonus: { atk: 1, maxHp: 6 }, rarity: 'commun', description: 'Un simple anneau d\'argent. Le premier bijou de tout aventurier.' },
  { id: 'gant-de-toile', name: 'Gant de toile', slot: 'accessory', bonus: { def: 2, maxHp: 6 }, rarity: 'commun', description: 'Un gant de travail renforcé aux paumes : contre les ampoules et les crocs.' },
  { id: 'brassard-de-fer', name: 'Brassard de fer', slot: 'accessory', bonus: { def: 3, maxHp: 8 }, rarity: 'commun', description: 'Une plaque de fer sanglée à l\'avant-bras, pour parer ce qui vient.' },
  { id: 'collier-de-crocs', name: 'Collier de crocs', slot: 'accessory', bonus: { atk: 5, maxHp: 10 }, rarity: 'rare', description: 'Un croc par bête vaincue. Celui-ci en compte beaucoup.' },
  { id: 'anneau-de-rubis', name: 'Anneau de rubis', slot: 'accessory', bonus: { atk: 6 }, rarity: 'rare', description: 'Le rubis pulse au rythme du cœur et fait monter le sang à la tête.' },
  { id: 'anneau-de-saphir', name: 'Anneau de saphir', slot: 'accessory', bonus: { def: 6 }, rarity: 'rare', description: 'Le saphir refroidit l\'esprit : les coups semblent arriver plus lentement.' },
  { id: 'amulette-d-ambre', name: 'Amulette d\'ambre', slot: 'accessory', bonus: { maxHp: 38 }, rarity: 'rare', description: 'Un insecte prisonnier d\'une goutte de résine, vieux de mille ans.' },
  { id: 'gants-de-combat', name: 'Gants de combat', slot: 'accessory', bonus: { atk: 4, def: 4 }, rarity: 'rare', description: 'Cuir renforcé aux jointures : on frappe plus fort et on se casse moins.' },
  { id: 'broche-d-argent', name: 'Broche d\'argent', slot: 'accessory', bonus: { atk: 3, maxHp: 24 }, rarity: 'rare', description: 'Une broche ouvragée qui ferme le col et réchauffe le courage.' },
  { id: 'ceinture-de-force', name: 'Ceinture de force', slot: 'accessory', bonus: { atk: 7, maxHp: 8 }, rarity: 'rare', description: 'Serrée d\'un cran de trop, elle donne l\'impression de soulever des montagnes.' },
  { id: 'talisman-d-os', name: 'Talisman d\'os', slot: 'accessory', bonus: { atk: 5, def: 3, maxHp: 10 }, rarity: 'rare', description: 'Gravé de signes qu\'il vaut mieux ne pas prononcer à voix haute.' },
  { id: 'anneau-du-mage', name: 'Anneau du mage', slot: 'accessory', bonus: { atk: 9, maxHp: 20 }, rarity: 'epique', description: 'La pierre bourdonne quand un sort passe à proximité.' },
  { id: 'bracelet-de-mithril', name: 'Bracelet de mithril', slot: 'accessory', bonus: { def: 9, maxHp: 34 }, rarity: 'epique', description: 'Un jonc de mithril tressé, si léger qu\'on oublie le porter.' },
  { id: 'pendentif-du-loup', name: 'Pendentif du loup', slot: 'accessory', bonus: { atk: 10, maxHp: 16 }, rarity: 'epique', description: 'On rêve de courses nocturnes en le gardant au cou.' },
  { id: 'oeil-de-basilic', name: 'Œil de basilic', slot: 'accessory', bonus: { atk: 8, def: 6, maxHp: 18 }, rarity: 'epique', description: 'Il suit du regard ce que son porteur ne voit pas encore.' },
  { id: 'amulette-de-l-aube', name: 'Amulette de l\'aube', slot: 'accessory', bonus: { def: 7, maxHp: 50 }, rarity: 'epique', description: 'Tiède au réveil, brûlante au crépuscule : elle veille à la place du dormeur.' },
  { id: 'anneau-du-dragon', name: 'Anneau du dragon', slot: 'accessory', bonus: { atk: 14, maxHp: 30 }, rarity: 'legendaire', description: 'Une écaille sertie en chaton. La colère du dragon avec elle.' },
  { id: 'coeur-de-golem', name: 'Cœur de golem', slot: 'accessory', bonus: { def: 16, maxHp: 60 }, rarity: 'legendaire', description: 'Un noyau de pierre qui bat lentement. Très lentement. Mais il bat.' },
  { id: 'larme-d-etoile', name: 'Larme d\'étoile', slot: 'accessory', bonus: { atk: 11, def: 11, maxHp: 40 }, rarity: 'legendaire', description: 'Une goutte de lumière tombée du ciel, encore chaude au creux de la main.' },
  { id: 'sceau-des-anciens', name: 'Sceau des anciens', slot: 'accessory', bonus: { atk: 13, def: 8, maxHp: 44 }, rarity: 'legendaire', description: 'Un cachet de cire qui n\'a jamais été brisé. Personne ne sait ce qu\'il scelle.' },

  // ── CHAPEAUX ──
  { id: 'casquette-de-toile', name: 'Casquette de toile', slot: 'hat', bonus: { maxHp: 5 }, rarity: 'commun', description: 'Une casquette molle qui protège surtout du soleil et du ridicule.' },
  { id: 'foulard-de-pirate', name: 'Foulard de pirate', slot: 'hat', bonus: { maxHp: 7 }, rarity: 'commun', description: 'Un foulard rouge noué serré : ça ne protège rien et ça change tout.' },
  { id: 'cagoule-de-voleur', name: 'Cagoule de voleur', slot: 'hat', bonus: { atk: 2, maxHp: 4 }, rarity: 'commun', description: 'Ne laisse voir que les yeux. Très pratique, moyennement rassurant.' },
  { id: 'heaume-de-bronze', name: 'Heaume de bronze', slot: 'hat', bonus: { def: 4 }, rarity: 'commun', description: 'Un pot de bronze avec deux trous. Ça a sauvé plus de crânes qu\'on ne croit.' },
  { id: 'couronne-de-fleurs', name: 'Couronne de fleurs', slot: 'hat', bonus: { maxHp: 9 }, rarity: 'commun', description: 'Tressée le matin même. Elle fane, mais le moral tient.' },
  { id: 'masque-de-renard', name: 'Masque de renard', slot: 'hat', bonus: { atk: 4, maxHp: 10 }, rarity: 'rare', description: 'Un masque de fête laqué. Derrière, on se sent plus malin.' },
  { id: 'mitre-du-clerc', name: 'Mitre du clerc', slot: 'hat', bonus: { maxHp: 30 }, rarity: 'rare', description: 'Une mitre brodée qui impose le silence et prolonge les vieux os.' },
  { id: 'bandeau-du-moine', name: 'Bandeau du moine', slot: 'hat', bonus: { atk: 6, def: 2 }, rarity: 'rare', description: 'Un simple bandeau de toile. Le moine, lui, n\'est pas simple du tout.' },
  { id: 'heaume-du-chevalier', name: 'Heaume du chevalier', slot: 'hat', bonus: { def: 10, maxHp: 22 }, rarity: 'epique', description: 'Visière baissée, on n\'entend plus que son propre souffle et les coups.' },
  { id: 'chapeau-du-magicien', name: 'Chapeau du magicien', slot: 'hat', bonus: { atk: 9, maxHp: 18 }, rarity: 'epique', description: 'Un cône bleu nuit constellé d\'étoiles. Le cliché, mais il fonctionne.' },
  { id: 'couronne-de-laurier', name: 'Couronne de laurier', slot: 'hat', bonus: { atk: 6, def: 6, maxHp: 16 }, rarity: 'epique', description: 'Feuilles d\'or fin : la récompense des vainqueurs, portée comme un défi.' },
  { id: 'casque-de-dragon', name: 'Casque de dragon', slot: 'hat', bonus: { atk: 10, def: 10 }, rarity: 'legendaire', description: 'Un crâne de dragonnet évidé, cornes comprises. On l\'entend rugir au galop.' },
  { id: 'couronne-du-roi-demon', name: 'Couronne du roi démon', slot: 'hat', bonus: { atk: 12, def: 8, maxHp: 24 }, rarity: 'legendaire', description: 'Sept pointes noires. Six rois l\'ont portée, aucun n\'a fini son règne.' },
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

// Barème de prix d'ACHAT de référence par rareté (or) — VALEUR PIVOT de chaque palier. Sert de repli
// pour les objets vendables non listés en boutique (forgés, butin) et d'ancre au barème détaillé des
// échoppes (cf. data/shops, qui étale les prix DANS une bande par rareté autour de ces pivots).
//
// Les paliers sont calés sur l'or RÉELLEMENT gagnable, pas au doigt mouillé (retour joueur : « les
// chapeaux ne sont pas assez chers, j'arrive à Prontera et je peux tout acheter ») :
//  • un clear des cinq terrains de plaine qui mènent à Prontera rapporte ~730 or (mobs + coffres) ;
//  • une traversée COMPLÈTE du jeu (58 terrains, une fois chacun, hors quêtes) ~15 900 or.
// D'où : commun ≈ un tiers du pécule d'arrivée (on s'équipe, on ne dévalise pas), rare hors de portée
// à l'arrivée (plusieurs allers-retours de farm), épique réservé au mid-game, légendaire au-dessus de
// ce que rapporte le jeu entier une fois — c'est un OBJECTIF, pas un achat.
export const RARITY_PRICE: Record<Rarity, number> = {
  commun: 300,
  rare: 1500,
  epique: 6500,
  legendaire: 30000,
}

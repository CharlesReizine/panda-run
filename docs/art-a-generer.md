# Illustrations d'objets à générer

> Fichier **généré** par `node scripts/art-manquant.mjs`. Ne pas éditer à la main.

## Comment générer

```sh
python3 scripts/generate_art.py --list          # ce qui manque
python3 scripts/generate_art.py --dry only arc  # voir les prompts, sans appel réseau
python3 scripts/generate_art.py                 # génère tout ce qui manque
```

Le script lit le roster dans `src/data/items.ts`, appelle Vertex AI Imagen avec les identifiants du
`.env` du monorepo pretto (`--env` pour un autre chemin), détache le fond et écrit du 128×128 RGBA
directement dans `public/art/` — le format des illustrations déjà en place.

Ensuite : `npx vitest run tests/data/item-images.test.ts` liste les entrées devenues périmées dans
`ART_A_GENERER` (à retirer), puis relancer `node scripts/art-manquant.mjs` pour rafraîchir ce fichier.

150 objets au total, **90 sans illustration**.

Chaque entrée attend un PNG dans `public/art/`, fond transparent, cadré serré sur l'objet.
Les armes affichent en attendant leur silhouette dessinée au chargement (`weapon-<id>`), donc elles
sont déjà lisibles en jeu ; les autres tombent sur une pastille de couleur.

## Armes — 28

| Fichier à créer | Nom | Rareté | Description |
|---|---|---|---|
| `public/art/item-couteau-de-chasse.png` | Couteau de chasse | commun | Une lame courte de trappeur, ébréchée par mille dépeçages. |
| `public/art/item-glaive-de-fer.png` | Glaive de fer | commun | Le glaive court des légions : simple, robuste, redoutablement efficace. |
| `public/art/item-rapiere.png` | Rapière | rare | Une lame fine et nerveuse qui cherche les défauts de l'armure. |
| `public/art/item-hache-de-guerre.png` | Hache de guerre | rare | Une hache à double tranchant qui fend les boucliers d'un seul élan. |
| `public/art/item-epee-batarde.png` | Épée bâtarde | rare | Ni tout à fait courte, ni tout à fait longue : polyvalente et rassurante. |
| `public/art/item-sabre-de-samourai.png` | Sabre de samouraï | epique | Une lame pliée mille fois, d'un tranchant qui frôle l'indécence. |
| `public/art/item-claymore.png` | Claymore | epique | L'immense épée des highlands : on la tient à deux pattes et on prie. |
| `public/art/item-epee-du-croise.png` | Épée du croisé | epique | Une lame bénie gravée d'un serment : elle protège autant qu'elle frappe. |
| `public/art/item-lame-du-neant.png` | Lame du néant | legendaire | Une fissure d'obscurité en forme d'épée. Ce qu'elle coupe ne revient pas. |
| `public/art/item-epee-du-jugement.png` | Épée du jugement | legendaire | La sentence faite acier : elle rend son verdict en un seul coup. |
| `public/art/item-fronde.png` | Fronde | commun | Un bout de cuir et un caillou. On commence tous quelque part. |
| `public/art/item-arc-de-chasse.png` | Arc de chasse | commun | L'arc du braconnier : discret, maniable, sans fioritures. |
| `public/art/item-arc-en-if.png` | Arc en if | rare | Un grand arc taillé dans l'if, bois des archers depuis toujours. |
| `public/art/item-arbalete-lourde.png` | Arbalète lourde | rare | Un engin de siège miniature. Lent à tendre, dévastateur à décocher. |
| `public/art/item-arc-de-glace.png` | Arc de glace | rare | Ses flèches sifflent en gelant l'air derrière elles. |
| `public/art/item-arc-du-faucon.png` | Arc du faucon | epique | Léger comme une plume, précis comme un regard de rapace. |
| `public/art/item-arc-de-braise.png` | Arc de braise | epique | La corde fume à chaque tir : chaque flèche part en emportant un tison. |
| `public/art/item-arc-du-crepuscule.png` | Arc du crépuscule | legendaire | Il ne se bande qu'à la tombée du jour, et ne rate jamais à cette heure-là. |
| `public/art/item-arc-des-etoiles.png` | Arc des étoiles | legendaire | Ses flèches laissent une traînée de constellations avant de frapper. |
| `public/art/item-branche-tordue.png` | Branche tordue | commun | Une branche ramassée au sol. Elle canalise mal, mais elle canalise. |
| `public/art/item-baton-de-novice.png` | Bâton de novice | commun | Le bâton remis à tout apprenti : usé par des générations de mains moites. |
| `public/art/item-baton-d-ebene.png` | Bâton d'ébène | rare | Un bois noir et dense qui absorbe la lumière et rend la magie. |
| `public/art/item-sceptre-de-jade.png` | Sceptre de jade | rare | Le jade poli tiédit dans la main dès qu'un sort se prépare. |
| `public/art/item-baton-de-tempete.png` | Bâton de tempête | rare | Un grondement sourd l'habite en permanence, comme un orage en cage. |
| `public/art/item-sceptre-d-ombre.png` | Sceptre d'ombre | epique | Sa pointe ne projette aucune ombre — c'est elle qui en est faite. |
| `public/art/item-baton-des-marees.png` | Bâton des marées | epique | On entend le ressac dedans. Il donne à son porteur la patience de l'océan. |
| `public/art/item-sceptre-du-chaos.png` | Sceptre du chaos | legendaire | Aucun sort lancé avec lui ne se répète jamais tout à fait à l'identique. |
| `public/art/item-baton-de-l-aube.png` | Bâton de l'aube | legendaire | Sa gemme contient un lever de soleil qui n'a jamais fini de se lever. |

## Armures — 26

| Fichier à créer | Nom | Rareté | Description |
|---|---|---|---|
| `public/art/item-tunique-de-lin.png` | Tunique de lin | commun | Une tunique de paysan, propre et rapiécée. Mieux que rien. |
| `public/art/item-gilet-de-cuir.png` | Gilet de cuir | commun | Un gilet de cuir bouilli qui encaisse les griffes de petit gibier. |
| `public/art/item-robe-d-apprenti.png` | Robe d'apprenti | commun | Une robe trop grande, marquée de brûlures d'expériences ratées. |
| `public/art/item-brigandine.png` | Brigandine | commun | Des plaques de métal rivetées dans le cuir : rustique et sérieux. |
| `public/art/item-manteau-de-voyageur.png` | Manteau de voyageur | commun | Un manteau épais qui a vu plus de routes que la plupart des cartes. |
| `public/art/item-cuirasse-de-bronze.png` | Cuirasse de bronze | rare | Le bronze martelé des anciens hoplites, patiné de vert-de-gris. |
| `public/art/item-armure-d-ecailles.png` | Armure d'écailles | rare | Des écailles se chevauchant comme sur un poisson : souple et dure. |
| `public/art/item-robe-de-mage.png` | Robe de mage | rare | Brodée de fils d'argent, elle nourrit la vitalité plus qu'elle ne protège. |
| `public/art/item-jaque-de-mailles.png` | Jaque de mailles | rare | Un vêtement de mailles fines porté sous l'étoffe : discret, efficace. |
| `public/art/item-plastron-d-os.png` | Plastron d'os | rare | Des côtes de grand fauve liées ensemble. Ça claque au vent, et ça tient. |
| `public/art/item-carapace-de-tortue.png` | Carapace de tortue | rare | Lourde, bombée, presque impossible à percer. On avance moins vite. |
| `public/art/item-cotte-de-givre.png` | Cotte de givre | rare | Elle reste froide en toute saison et gèle le sang des lames qui l'effleurent. |
| `public/art/item-justaucorps-d-ombre.png` | Justaucorps d'ombre | rare | Un cuir teint au noir de fumée, taillé pour frapper avant d'être vu. |
| `public/art/item-harnois-de-fer.png` | Harnois de fer | epique | L'armure complète du sergent d'armes : rien ne passe, rien ne plie. |
| `public/art/item-armure-de-lamelles.png` | Armure de lamelles | epique | Des centaines de lamelles lacées à la main, souples comme une seconde peau. |
| `public/art/item-robe-arcanique.png` | Robe arcanique | epique | Ses runes se réarrangent seules selon le sort que l'on prépare. |
| `public/art/item-cuirasse-du-croise.png` | Cuirasse du croisé | epique | Frappée d'une croix bosselée par les coups qu'elle a arrêtés. |
| `public/art/item-armure-de-mithril.png` | Armure de mithril | epique | Aussi légère qu'une chemise, aussi dure que l'acier trempé. |
| `public/art/item-toge-du-sage.png` | Toge du sage | epique | La toge de celui qui a lu tous les grimoires — et en a compris deux. |
| `public/art/item-surcot-du-templier.png` | Surcot du templier | epique | Un surcot de lin blanc sur mailles : le serment se porte par-dessus l'armure. |
| `public/art/item-cuirasse-de-magma.png` | Cuirasse de magma | epique | Des veines incandescentes couvent sous la plaque. Elle brûle qui la frappe. |
| `public/art/item-plastron-de-dragon.png` | Plastron de dragon | legendaire | Taillé dans le poitrail d'un dragon. Il respire encore, un peu. |
| `public/art/item-armure-d-obsidienne.png` | Armure d'obsidienne | legendaire | Du verre volcanique noir, tranchant sur les bords : la toucher est déjà une erreur. |
| `public/art/item-robe-celeste.png` | Robe céleste | legendaire | Un tissu qui n'existe pas vraiment ici. On voit les étoiles à travers. |
| `public/art/item-armure-du-valhalla.png` | Armure du Valhalla | legendaire | Portée par ceux qui sont morts et revenus quand même. Elle ne cède pas. |
| `public/art/item-carapace-du-roi-scarabee.png` | Carapace du roi scarabée | legendaire | La cuirasse du monarque des sables, irisée de bleu et d'or. |

## Chapeaux — 14

| Fichier à créer | Nom | Rareté | Description |
|---|---|---|---|
| `public/art/item-casquette-de-toile.png` | Casquette de toile | commun | Une casquette molle qui protège surtout du soleil et du ridicule. |
| `public/art/item-foulard-de-pirate.png` | Foulard de pirate | commun | Un foulard rouge noué serré : ça ne protège rien et ça change tout. |
| `public/art/item-cagoule-de-voleur.png` | Cagoule de voleur | commun | Ne laisse voir que les yeux. Très pratique, moyennement rassurant. |
| `public/art/item-heaume-de-bronze.png` | Heaume de bronze | commun | Un pot de bronze avec deux trous. Ça a sauvé plus de crânes qu'on ne croit. |
| `public/art/item-couronne-de-fleurs.png` | Couronne de fleurs | commun | Tressée le matin même. Elle fane, mais le moral tient. |
| `public/art/item-masque-de-renard.png` | Masque de renard | rare | Un masque de fête laqué. Derrière, on se sent plus malin. |
| `public/art/item-casque-a-plumet.png` | Casque à plumet | rare | Le plumet blanc dit à tous où se trouve le capitaine. Courageux. |
| `public/art/item-mitre-du-clerc.png` | Mitre du clerc | rare | Une mitre brodée qui impose le silence et prolonge les vieux os. |
| `public/art/item-bandeau-du-moine.png` | Bandeau du moine | rare | Un simple bandeau de toile. Le moine, lui, n'est pas simple du tout. |
| `public/art/item-heaume-du-chevalier.png` | Heaume du chevalier | epique | Visière baissée, on n'entend plus que son propre souffle et les coups. |
| `public/art/item-chapeau-du-magicien.png` | Chapeau du magicien | epique | Un cône bleu nuit constellé d'étoiles. Le cliché, mais il fonctionne. |
| `public/art/item-couronne-de-laurier.png` | Couronne de laurier | epique | Feuilles d'or fin : la récompense des vainqueurs, portée comme un défi. |
| `public/art/item-casque-de-dragon.png` | Casque de dragon | legendaire | Un crâne de dragonnet évidé, cornes comprises. On l'entend rugir au galop. |
| `public/art/item-couronne-du-roi-demon.png` | Couronne du roi démon | legendaire | Sept pointes noires. Six rois l'ont portée, aucun n'a fini son règne. |

## Accessoires — 22

| Fichier à créer | Nom | Rareté | Description |
|---|---|---|---|
| `public/art/item-anneau-de-cuivre.png` | Anneau de cuivre | commun | Un anneau bon marché qui verdit le doigt, mais raffermit la poigne. |
| `public/art/item-pendentif-de-bois.png` | Pendentif de bois | commun | Un médaillon sculpté au couteau par quelqu'un qui vous aimait bien. |
| `public/art/item-boucle-d-oreille.png` | Boucle d'oreille | commun | Un simple anneau d'argent. Le premier bijou de tout aventurier. |
| `public/art/item-gant-de-toile.png` | Gant de toile | commun | Un gant de travail renforcé aux paumes : contre les ampoules et les crocs. |
| `public/art/item-brassard-de-fer.png` | Brassard de fer | commun | Une plaque de fer sanglée à l'avant-bras, pour parer ce qui vient. |
| `public/art/item-collier-de-crocs.png` | Collier de crocs | rare | Un croc par bête vaincue. Celui-ci en compte beaucoup. |
| `public/art/item-anneau-de-rubis.png` | Anneau de rubis | rare | Le rubis pulse au rythme du cœur et fait monter le sang à la tête. |
| `public/art/item-anneau-de-saphir.png` | Anneau de saphir | rare | Le saphir refroidit l'esprit : les coups semblent arriver plus lentement. |
| `public/art/item-amulette-d-ambre.png` | Amulette d'ambre | rare | Un insecte prisonnier d'une goutte de résine, vieux de mille ans. |
| `public/art/item-gants-de-combat.png` | Gants de combat | rare | Cuir renforcé aux jointures : on frappe plus fort et on se casse moins. |
| `public/art/item-broche-d-argent.png` | Broche d'argent | rare | Une broche ouvragée qui ferme le col et réchauffe le courage. |
| `public/art/item-ceinture-de-force.png` | Ceinture de force | rare | Serrée d'un cran de trop, elle donne l'impression de soulever des montagnes. |
| `public/art/item-talisman-d-os.png` | Talisman d'os | rare | Gravé de signes qu'il vaut mieux ne pas prononcer à voix haute. |
| `public/art/item-anneau-du-mage.png` | Anneau du mage | epique | La pierre bourdonne quand un sort passe à proximité. |
| `public/art/item-bracelet-de-mithril.png` | Bracelet de mithril | epique | Un jonc de mithril tressé, si léger qu'on oublie le porter. |
| `public/art/item-pendentif-du-loup.png` | Pendentif du loup | epique | On rêve de courses nocturnes en le gardant au cou. |
| `public/art/item-oeil-de-basilic.png` | Œil de basilic | epique | Il suit du regard ce que son porteur ne voit pas encore. |
| `public/art/item-amulette-de-l-aube.png` | Amulette de l'aube | epique | Tiède au réveil, brûlante au crépuscule : elle veille à la place du dormeur. |
| `public/art/item-anneau-du-dragon.png` | Anneau du dragon | legendaire | Une écaille sertie en chaton. La colère du dragon avec elle. |
| `public/art/item-coeur-de-golem.png` | Cœur de golem | legendaire | Un noyau de pierre qui bat lentement. Très lentement. Mais il bat. |
| `public/art/item-larme-d-etoile.png` | Larme d'étoile | legendaire | Une goutte de lumière tombée du ciel, encore chaude au creux de la main. |
| `public/art/item-sceau-des-anciens.png` | Sceau des anciens | legendaire | Un cachet de cire qui n'a jamais été brisé. Personne ne sait ce qu'il scelle. |

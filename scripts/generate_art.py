#!/usr/bin/env python3
"""Génère les illustrations d'objets manquantes (public/art/item-<id>.png) via Vertex AI Imagen.

POURQUOI CE FICHIER EST DANS LE DÉPÔT. Une version précédente de ce script vivait dans le scratchpad
d'une session Claude : le scratchpad a disparu, le script avec. Il est donc versionné ici, à côté du
reste de l'outillage d'art (art-manquant.mjs, art-caps.mjs, shrink-art.mjs).

⚠️ C'EST TOI QUI LE LANCES, PAS L'ASSISTANT. Les identifiants Vertex vivent dans le .env du monorepo
pretto, qui contient des secrets de production : l'assistant ne les lit pas et ne lance pas ce script.

Ce que le script fait, et pourquoi dans cet ordre :
 1. il lit le roster dans src/data/items.ts — SOURCE UNIQUE. Aucune liste d'objets recopiée ici : une
    liste en double finit désynchronisée du jeu, et on générerait de l'art pour des objets disparus ;
 2. il saute tout objet qui a déjà son PNG (idempotent : relancer ne regénère rien, sauf --force) ;
 3. il demande une image à FOND TRANSPARENT à Gemini, qui sait sortir un canal alpha. C'est ainsi que
    les 48 illustrations déjà en place ont été faites : mesuré sur leurs pixels semi-transparents, elles
    n'ont AUCUNE frange de couleur — donc aucun détourage par chroma-key n'a eu lieu, le modèle a rendu
    l'alpha directement. Repli sur Imagen + détourage magenta seulement si Gemini n'est pas disponible :
    et dans ce cas le détourage part des BORDS, parce qu'un « remplace le magenta » troue l'objet dès
    qu'il contient du rose — et les épiques et légendaires en sont pleins ;
 4. il recadre sur le contenu et sort du 128×128 RGBA — le format EXACT des 48 illustrations existantes
    (vérifié), donc inutile de repasser shrink-art.mjs derrière pour les objets.

Usage :
    python3 scripts/generate_art.py --list                  # ce qui manque, sans rien générer
    python3 scripts/generate_art.py --dry only anneau       # affiche les prompts, aucun appel réseau
    python3 scripts/generate_art.py only anneau collier     # génère ces objets (filtre = sous-chaîne)
    python3 scripts/generate_art.py                         # génère TOUT ce qui manque (90 objets)
    python3 scripts/generate_art.py --force only ruban      # refait un objet déjà illustré

Après génération : `npx vitest run tests/data/item-images.test.ts` échouera en signalant les entrées
devenues périmées dans ART_A_GENERER — il faut les retirer de la liste, c'est le signe que ça a marché.
Puis `node scripts/art-manquant.mjs` pour rafraîchir docs/art-a-generer.md.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ITEMS_TS = RACINE / "src" / "data" / "items.ts"
PRELOAD_TS = RACINE / "src" / "scenes" / "PreloadScene.ts"
ART = RACINE / "public" / "art"

ENV_DEFAUT = Path.home() / "pretto" / "apps" / "data-api" / ".env"
PREFIXE_CRED = "VERTEXAI_B64_SERVICE_ACCOUNTS_PART"

# Modèles essayés DANS CET ORDRE, et l'ordre est le cœur du script.
#
# ⚠️ GEMINI D'ABORD, PARCE QU'IL REND UN CANAL ALPHA. Vérifié sur les 48 illustrations déjà en place :
# leurs pixels semi-transparents ne portent AUCUNE frange magenta ni blanche (mesuré : 0 sur ~250 pixels
# semi-transparents par image). Un détourage par chroma-key en laisse toujours ; il n'y a donc pas eu de
# détourage — le modèle a sorti la transparence lui-même. Utiliser Imagen à la place obligerait à
# détourer, et les nouveaux objets ne ressembleraient pas aux anciens sur les bords.
#
# Imagen reste en repli : si le modèle Gemini image n'est pas activé sur le projet, mieux vaut une
# illustration détourée qu'aucune illustration. Le script dit lequel a servi.
MODELES = [
    ("gemini-2.5-flash-image", "generateContent", True),   # True = rend l'alpha
    ("gemini-2.0-flash-exp", "generateContent", True),
    ("imagen-4.0-generate-001", "predict", False),
    ("imagen-3.0-generate-002", "predict", False),
]
REGION = "us-central1"

TAILLE_FINALE = 128  # taille des illustrations d'objets déjà en place (la note d'origine
                     # demande 1024² au modèle ; c'est ici qu'on redescend à la taille d'affichage,
                     # cf. scripts/art-caps.mjs — une texture coûte l×h×4 octets de VRAM)
FOND = (255, 0, 255)  # magenta pur : absent de toute palette d'objet, donc détachable sans ambiguïté
TOLERANCE = 60

# ══════════════════════════════════════════════════════════════════════════════════════════════
# STYLE — LA RÉFÉRENCE EST DANS LE DÉPÔT : public/art/A_GENERER.md
#
# ⚠️ NE PAS RÉINVENTER CE STYLE. C'est la note de commande d'origine, écrite pour la campagne de
# génération qui a produit les 281 illustrations actuelles (70 monstres, 49 pandas, 50 fonds, 48 objets…).
# Elle donne la phrase à préfixer, mot pour mot, et le format de sortie. Une première version de ce
# script décrivait le style « à l'œil » d'après une planche de contact : c'était une reconstitution
# approximative d'une consigne qui existait déjà, à deux dossiers de là.
#
# Extrait de public/art/A_GENERER.md :
#   « Style à préfixer : "Kawaii Ragnarok Online, chibi, gros contours nets, couleurs vives, ombrage
#     anime doux." Monstres/pandas : 1024×1024, fond transparent PNG. »
#
# La consigne est EN FRANÇAIS et le reste ici en français : c'est elle qui a produit l'art existant, et
# la traduire serait déjà la modifier.
STYLE = (
    "Kawaii Ragnarok Online, chibi, gros contours nets, couleurs vives, ombrage anime doux."
)

# Deux formulations de fond. Le fond TRANSPARENT est la consigne d'origine (« fond transparent PNG ») et
# c'est vérifiable sur les fichiers : leurs pixels semi-transparents ne portent aucune frange de couleur,
# donc aucun chroma-key n'a eu lieu — le modèle rend l'alpha. Le magenta ne sert qu'au repli Imagen, qui
# ne sait pas sortir d'alpha.
# ⚠️ INTERDICTIONS TIRÉES DE CE QUE LE MODÈLE A RÉELLEMENT PRODUIT, pas de précautions théoriques.
# Sur 92 illustrations générées : une PLAQUE DE FOND opaque à chaque fois (blanche, parfois noire), un
# DAMIER PEINT imitant la transparence (le modèle dessine ce qu'un éditeur d'image affiche derrière un
# fond vide), des CADRES décoratifs, et du TEXTE en anglais dans l'image (« SEAL OF ELDERS », « CAPTAIN »).
CADRE_ALPHA = (
    "Icône d'objet d'inventaire, l'objet SEUL au centre, cadré serré, fond TRANSPARENT (canal alpha PNG). "
    "RIEN d'autre dans l'image : aucun décor, aucune ombre portée, aucun cadre, aucune bordure, aucun "
    "disque ni carré derrière l'objet, aucune plaque de couleur, AUCUN damier gris et blanc (ne dessine "
    "PAS le motif d'échiquier qui représente la transparence — le fond doit être RÉELLEMENT vide), "
    "AUCUNE lettre, AUCUN mot, AUCUN chiffre, aucune inscription nulle part. "
    "Doit rester lisible en tout petit (40 px)."
)
CADRE_MAGENTA = CADRE_ALPHA.replace(
    "fond TRANSPARENT (canal alpha PNG)", "fond MAGENTA UNI (#FF00FF)"
)

# Cadrage par emplacement, relevé sur les illustrations existantes (planche de contact) :
#  · armes : VERTICALES, pointe en haut, poignée en bas, entières ;
#  · armures : le vêtement VIDE vu de face, posé à plat comme un t-shirt étalé ;
#  · chapeaux : le couvre-chef seul, vide, sans tête dedans ;
#  · accessoires : le petit objet de face, grossi pour que ses détails se lisent.
# Sans cette précision le modèle livre des personnages qui PORTENT l'objet, ou des armes couchées en
# diagonale dont la silhouette ne va pas avec les 30 armes déjà en place.
CADRAGE_SLOT = {
    "weapon": "L'arme seule, à la VERTICALE (ou à peine inclinée), pointe vers le haut et poignée en bas, entière.",
    "armor": "Le vêtement SEUL et VIDE, vu de face, posé à plat comme un t-shirt étalé — personne ne le porte, pas de mannequin, pas de bras, pas de tête.",
    "hat": "Le couvre-chef SEUL et VIDE, vu de face ou de trois-quarts — aucune tête dedans, aucun visage.",
    "accessory": "Le petit objet SEUL, vu de face, un peu grossi pour que ses détails se lisent.",
}

# La rareté se lit à l'œil sur l'art existant (lame solaire enflammée, trèfle rayonnant), tout en restant
# dans la gamme MIGNONNE du jeu — pas de rendu sombre et épique qui trancherait avec le reste.
TEINTE_RARETE = {
    "commun": "matières simples et usées : cuir, fer brut, lin, bois",
    "rare": "métal poli aux reflets bleu acier, une petite gemme vive",
    "epique": "travail ouvragé, filigrane violet et or, lueur magique douce",
    "legendaire": "objet légendaire, lueur chaude franche, filigrane doré, runes lumineuses, étincelles",
}

MOTIF_ITEM = re.compile(
    r"\{ id: '([^']+)', name: '((?:[^'\\]|\\.)*)', slot: '(\w+)'"
    r"(?:, weaponType: '(\w+)')?, bonus: \{([^}]*)\}, rarity: '(\w+)'"
    r", description: '((?:[^'\\]|\\.)*)' \}"
)


def lire_items():
    """Objets du jeu, lus dans la source TypeScript. Échoue bruyamment si le format a changé."""
    src = ITEMS_TS.read_text(encoding="utf-8")
    items = []
    for m in MOTIF_ITEM.finditer(src):
        items.append(
            {
                "id": m.group(1),
                "name": m.group(2).replace("\\'", "'"),
                "slot": m.group(3),
                "weaponType": m.group(4),
                "rarity": m.group(6),
                "description": m.group(7).replace("\\'", "'"),
            }
        )
    if len(items) < 100:
        sys.exit(
            f"❌ seulement {len(items)} objets lus dans {ITEMS_TS.name} — le format a changé, "
            "corrige MOTIF_ITEM au lieu de générer de l'art incomplet."
        )
    return items


def chapeaux_dessines() -> set:
    """Chapeaux qui ont déjà un VRAI visuel dessiné vectoriellement (cosmetic-<id> dans PreloadScene).

    ⚠️ MÊME HEURISTIQUE QUE scripts/art-manquant.mjs, ET C'EST VOLONTAIRE : si les deux outils ne
    comptaient pas la même chose, la liste générée dans docs/ ne correspondrait plus à ce que ce script
    produit — et on ne saurait plus si la dette est réglée. Un premier jet ignorait ce filtre et
    proposait 103 objets au lieu de 90 : il aurait écrasé 13 chapeaux qui vont déjà bien.
    """
    if not PRELOAD_TS.exists():
        return set()
    return set(re.findall(r"case '([a-z0-9-]+)':", PRELOAD_TS.read_text(encoding="utf-8")))


def a_un_visuel(item, dessines: set) -> bool:
    if (ART / f"item-{item['id']}.png").exists():
        return True
    return item["slot"] == "hat" and item["id"] in dessines


def prompt_pour(item, alpha: bool = True) -> str:
    famille = {"sword": "sword or blade", "bow": "bow or crossbow", "staff": "magic staff or scepter"}
    quoi = item["name"]
    if item["slot"] == "weapon" and item["weaponType"]:
        quoi = f"{quoi}, a {famille.get(item['weaponType'], 'weapon')}"
    # LE STYLE EST EN PRÉFIXE, comme l'impose la note d'origine (« style à préfixer »). L'ordre compte
    # pour un modèle d'image : ce qui vient en tête pèse le plus dans le rendu.
    return (
        f"{STYLE} "
        f"{quoi}. {item['description']} "
        f"{CADRAGE_SLOT.get(item['slot'], '')} "
        f"Matière et ambiance : {TEINTE_RARETE.get(item['rarity'], '')}. "
        f"{CADRE_ALPHA if alpha else CADRE_MAGENTA}"
    )


def deguillemeter(v: str) -> str:
    """Retire UNE seule paire de guillemets englobants, et rien d'autre.

    ⚠️ SURTOUT PAS str.strip("'\""). C'était le bug : strip() retire les caractères de l'ensemble EN
    BOUCLE aux deux extrémités. Sur une part valant  '"pk-...": "<base64>",'  il enlevait l'apostrophe
    englobante PUIS le guillemet d'ouverture de la clé JSON — la concaténation des six parts ne formait
    donc plus un JSON valide, et le repli base64 avalait les accolades sans se plaindre (b64decode ignore
    par défaut les caractères hors alphabet) pour rendre des octets aléatoires. Symptôme : « 'utf-8' codec
    can't decode byte 0xa6 ». Un bug de deux caractères, invisible dans le message d'erreur.
    """
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def lire_comptes(chemin_env: Path) -> dict:
    """Reconstitue les comptes de service Vertex depuis les parts du .env.

    ⚠️ LES PARTS SONT DU JSON, PAS DU BASE64 — et se tromper de sens échoue en SILENCE.
    La variable s'appelle « B64_SERVICE_ACCOUNTS » et un premier jet a donc fait
    base64.b64decode(concaténation) puis json.loads. C'est l'inverse : la concaténation des six parts
    forme un OBJET JSON { "nom-du-compte": "<base64 du JSON du compte>", ... } — d'où le pluriel
    « ACCOUNTS ». Le piège, c'est que b64decode() ignore par défaut tout caractère hors alphabet base64 :
    il a donc avalé les accolades et les guillemets sans broncher et rendu des octets aléatoires, au lieu
    de dire « ce n'est pas du base64 ». Symptôme observé : « 'utf-8' codec can't decode byte 0xa6 ».
    Diagnostic qui a tranché : la part 1 contient «{», «:» et quatre «"» — du JSON, pas du base64.

    On accepte quand même les deux formes : si la concaténation n'est pas du JSON, on retombe sur
    l'interprétation base64. Ça coûte quatre lignes et couvre une éventuelle rotation de format.
    """
    if not chemin_env.exists():
        sys.exit(f"❌ fichier d'identifiants introuvable : {chemin_env}\n   (passe --env <chemin>)")
    parts = {}
    for ligne in chemin_env.read_text(encoding="utf-8", errors="replace").splitlines():
        if ligne.lstrip().startswith("#") or not ligne.startswith(PREFIXE_CRED):
            continue
        cle, _, val = ligne.partition("=")
        suffixe = cle[len(PREFIXE_CRED):].strip()
        if suffixe.isdigit():
            parts[int(suffixe)] = deguillemeter(val.strip())
    if not parts:
        sys.exit(f"❌ aucune variable {PREFIXE_CRED}* dans {chemin_env}")
    brut = "".join(parts[k] for k in sorted(parts))

    data = None
    try:
        data = json.loads(brut)
    except Exception:  # pas du JSON → peut-être vraiment du base64
        try:
            data = json.loads(base64.b64decode(brut))
        except Exception as e:  # noqa: BLE001
            sys.exit(
                f"❌ les {len(parts)} parts {PREFIXE_CRED}* ne se lisent ni en JSON ni en base64 ({e}).\n"
                "   Le format a peut-être changé : vérifie que les parts se concatènent bien dans l'ordre."
            )
    if not isinstance(data, dict):
        sys.exit("❌ le blob reconstitué n'est pas un objet")

    # Chaque valeur est soit le JSON du compte, soit son base64.
    comptes = {}
    if data.get("type") == "service_account":
        comptes["(unique)"] = data
        return comptes
    for nom, val in data.items():
        sa = val
        if isinstance(sa, str):
            try:
                sa = json.loads(base64.b64decode(sa))
            except Exception:
                continue
        if isinstance(sa, dict) and sa.get("type") == "service_account":
            comptes[nom] = sa
    if not comptes:
        sys.exit("❌ aucun compte de service exploitable dans le blob reconstitué")
    return comptes


def charger_credentials(chemin_env: Path, compte: str | None):
    comptes = lire_comptes(chemin_env)
    if compte:
        choix = next((n for n in comptes if compte in n), None)
        if not choix:
            sys.exit(f"❌ aucun compte ne contient « {compte} ». Disponibles : {', '.join(comptes)}")
    else:
        choix = next(iter(comptes))
        if len(comptes) > 1:
            print(f"{len(comptes)} comptes disponibles, j'utilise « {choix} » (--compte <nom> pour en choisir un autre)")
    sa = comptes[choix]
    try:
        from google.oauth2 import service_account
        import google.auth.transport.requests as gart
    except ImportError:
        sys.exit("❌ paquet manquant : pip install google-auth")
    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(gart.Request())
    return creds, sa.get("project_id"), choix


def a_deja_de_l_alpha(im) -> bool:
    """L'image porte-t-elle déjà un fond transparent utilisable ?

    On regarde les QUATRE COINS, pas la présence d'un canal alpha : tout PNG converti en RGBA a un canal
    alpha, plein à 255 s'il n'y avait pas de transparence. Ce sont les coins qui disent si le fond a été
    évidé. On en exige au moins trois pour ne pas prendre un objet qui touche un bord pour un fond opaque.
    """
    w, h = im.size
    px = im.load()
    coins = [px[1, 1], px[w - 2, 1], px[1, h - 2], px[w - 2, h - 2]]
    return sum(1 for c in coins if c[3] < 32) >= 3


# TAUX DE REMPLISSAGE CIBLE PAR EMPLACEMENT — mesuré sur les 62 illustrations existantes (part de la
# largeur du cadre occupée par l'objet, médiane) :
#     armes 79 %   ·   chapeaux 63 %   ·   accessoires 64 %   ·   armures 56 %
#
# ⚠️ CE N'EST PAS DE L'ESTHÉTIQUE, ÇA CHANGE LA TAILLE À L'ÉCRAN. Player.refreshHat met le chapeau à
# l'échelle 38 / max(largeur, hauteur) DU CADRE — pas de l'objet. Deux illustrations de même cadre mais de
# remplissage différent donnent donc deux chapeaux de tailles différentes sur la tête du panda. Une
# première version recadrait au plus près (≈89 % de remplissage) : les nouveaux chapeaux auraient été
# ~45 % plus gros que les six existants, sur la même tête.
REMPLISSAGE_CIBLE = {"weapon": 0.79, "hat": 0.63, "accessory": 0.64, "armor": 0.56}


def finaliser(im, slot: str = "weapon"):
    """Recadre sur le contenu puis reconstitue le CADRAGE des illustrations existantes.

    L'objet est recadré au plus près, puis replacé au centre d'un cadre carré dimensionné pour que son
    remplissage colle à la médiane mesurée sur le corpus (cf. REMPLISSAGE_CIBLE). Sortie 128×128 RGBA,
    le format des illustrations déjà en place.
    """
    from PIL import Image

    boite = im.split()[-1].getbbox()
    if boite:
        im = im.crop(boite)
    cible = REMPLISSAGE_CIBLE.get(slot, 0.75)
    cote = max(2, int(round(max(im.size) / cible)))
    cote = max(cote, im.width, im.height)  # jamais plus petit que l'objet : on ne rogne pas
    fond = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    fond.paste(im, ((cote - im.width) // 2, (cote - im.height) // 2), im)
    return fond.resize((TAILLE_FINALE, TAILLE_FINALE), Image.LANCZOS)


def detacher(png_bytes: bytes, slot: str = "weapon") -> "object":
    """Prépare l'image pour public/art : 128×128 RGBA, objet centré, fond transparent.

    ⚠️ ON NE DÉTOURE QUE SI C'EST NÉCESSAIRE. Quand le modèle a déjà rendu la transparence (Gemini), on
    ne touche pas aux bords : passer un chroma-key par-dessus ne pourrait que grignoter l'anti-aliasing
    de l'objet. Le détourage magenta ne sert qu'au repli Imagen.

    Et quand il faut détourer, le remplissage part des BORDS : un « remplace tous les pixels magenta »
    perce l'objet dès qu'il contient du rose ou du violet — et les épiques et légendaires en sont pleins.
    """
    from PIL import Image
    from collections import deque

    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    if a_deja_de_l_alpha(im):
        return finaliser(im, slot)

    w, h = im.size
    px = im.load()

    def est_fond(c):
        return sum(abs(c[i] - FOND[i]) for i in range(3)) <= TOLERANCE * 3

    vus = bytearray(w * h)
    file = deque()
    for x in range(w):
        for y in (0, h - 1):
            if est_fond(px[x, y]):
                file.append((x, y)); vus[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if est_fond(px[x, y]):
                file.append((x, y)); vus[y * w + x] = 1
    while file:
        x, y = file.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not vus[ny * w + nx] and est_fond(px[nx, ny]):
                vus[ny * w + nx] = 1
                file.append((nx, ny))

    return finaliser(im, slot)


def generer(creds, project, item) -> tuple:
    """Renvoie (octets PNG, nom du modèle utilisé). Essaie les modèles dans l'ordre de MODELES."""
    import requests

    erreurs = []
    for modele, methode, alpha in MODELES:
        url = (
            f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{project}"
            f"/locations/{REGION}/publishers/google/models/{modele}:{methode}"
        )
        prompt = prompt_pour(item, alpha=alpha)
        if methode == "generateContent":
            corps = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"responseModalities": ["IMAGE"]},
            }
        else:
            corps = {
                "instances": [{"prompt": prompt}],
                "parameters": {"sampleCount": 1, "aspectRatio": "1:1", "personGeneration": "dont_allow"},
            }
        try:
            r = requests.post(
                url,
                headers={"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"},
                json=corps,
                timeout=180,
            )
        except Exception as e:  # noqa: BLE001
            erreurs.append(f"{modele}: {e}")
            continue
        if r.status_code != 200:
            erreurs.append(f"{modele}: HTTP {r.status_code} {r.text[:140]}")
            continue

        data = r.json()
        b64 = None
        if methode == "generateContent":
            for cand in data.get("candidates") or []:
                for part in (cand.get("content") or {}).get("parts") or []:
                    inline = part.get("inlineData") or part.get("inline_data")
                    if inline and inline.get("data"):
                        b64 = inline["data"]
                        break
                if b64:
                    break
        else:
            preds = data.get("predictions") or []
            if preds:
                b64 = preds[0].get("bytesBase64Encoded")
        if not b64:
            erreurs.append(f"{modele}: pas d'image dans la réponse (filtre de sécurité ?)")
            continue
        return base64.b64decode(b64), modele
    raise RuntimeError(" | ".join(erreurs))



def _anneau_opaque(px, w, h, alpha):
    """Pixels du contour EXTÉRIEUR de la zone opaque : c'est là qu'un fond peint se trahit."""
    boite = alpha.getbbox()
    if not boite:
        return []
    x0, y0, x1, y1 = boite
    pts = []
    for x in range(x0, x1):
        for y in (y0, y1 - 1):
            if px[x, y][3] > 200:
                pts.append(px[x, y])
    for y in range(y0, y1):
        for x in (x0, x1 - 1):
            if px[x, y][3] > 200:
                pts.append(px[x, y])
    if pts:
        return pts
    # bord de la boîte trop transparent (halo dégradé) : on rentre de quelques pixels
    for marge in (3, 6, 10):
        for x in range(x0 + marge, x1 - marge):
            for y in (y0 + marge, y1 - marge - 1):
                if px[x, y][3] > 200:
                    pts.append(px[x, y])
        if pts:
            return pts
    return pts


def detecter_plaque(im):
    """Renvoie la couleur de la plaque de fond, ou None s'il n'y en a pas.

    ⚠️ LE SIGNAL N'EST PAS « LES COINS SONT-ILS TRANSPARENTS ». Toutes les illustrations générées ont un
    liseré transparent de ~5 px puis une PLAQUE OPAQUE qui remplit le reste du cadre : blanche le plus
    souvent, noire parfois, et dans certains cas le modèle a carrément PEINT un damier de fausse
    transparence (ce qu'affiche un éditeur d'image derrière un fond vide). Deux audits successifs sont
    passés à côté — l'un ne testait que les quatre coins, l'autre le pourtour de la boîte englobante, qui
    est justement dans le liseré.
    Signature retenue, vérifiée sur les 150 fichiers : la zone opaque couvre plus de 60 % du cadre ET son
    contour extérieur est à ≥70 % d'une seule teinte. Les illustrations saines ont une zone opaque bien
    plus petite (22 % pour le sakkat) et un contour multicolore.
    """
    from collections import Counter

    w, h = im.size
    px = im.load()
    alpha = im.split()[-1]
    # Seuil à 40 % et pas 60 % : après une première réparation, une plaque en DISQUE (et non en carré)
    # ne couvre plus que ~44 % du cadre — item-baton-cosmique est passé entre les mailles à 60 %.
    # Validé sur les 138 illustrations : aucune illustration saine n'atteint 40 % d'opaques d'une seule
    # teinte neutre, parce qu'un objet dessiné est multicolore et bordé d'un contour foncé.
    opaques = sum(alpha.histogram()[201:])
    if opaques / (w * h) < 0.4:
        return None
    anneau = _anneau_opaque(px, w, h, alpha)
    if not anneau:
        return None
    # ⚠️ REGROUPEMENT PAR TOLÉRANCE, PAS PAR SEAU DE QUANTIFICATION. Compter les teintes quantifiées
    # laissait passer 34 fichiers sur 92 : quand le modèle PEINT un damier de fausse transparence, le
    # contour alterne blanc (252) et gris clair (218), soit deux seaux à ~50 % chacun — donc jamais 70 %.
    # On prend la teinte la plus fréquente, puis on compte tout ce qui en est PROCHE.
    c = Counter((r // 24, g // 24, b // 24) for r, g, b, a in anneau)
    teinte, _ = c.most_common(1)[0]
    ref = tuple(int(v * 24 + 12) for v in teinte)
    # ⚠️ TOLÉRANCE 140 ET PAS 90, sur la SOMME des trois canaux. Le damier peint alterne blanc (252) et
    # gris clair (218) : l'écart vaut 34 par canal, soit 102 au total — au-dessus de 90, donc les deux
    # teintes n'étaient PAS regroupées et aucune ne franchissait les 70 %. C'est ce qui a laissé passer
    # item-plastron-feuilles une deuxième fois.
    proches = sum(1 for r, g, b, a in anneau if abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) <= 140)
    if proches / len(anneau) < 0.7:
        return None
    return ref


def retirer_plaque(im, couleur, tolerance=140):
    """Efface la plaque par remplissage depuis le bord de l'image, puis recadre.

    Le remplissage traverse AUSSI les pixels transparents : la plaque est séparée du bord par un liseré
    vide, un remplissage qui n'accepterait que la couleur ne l'atteindrait jamais. La tolérance est large
    (140 sur la somme des trois canaux) pour couvrir le damier peint, qui alterne blanc et gris clair.
    """
    from collections import deque

    w, h = im.size
    px = im.load()

    def passable(c):
        return c[3] < 40 or sum(abs(c[i] - couleur[i]) for i in range(3)) <= tolerance

    vus = bytearray(w * h)
    file = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable(px[x, y]):
                file.append((x, y)); vus[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if passable(px[x, y]):
                file.append((x, y)); vus[y * w + x] = 1
    efface = 0
    while file:
        x, y = file.popleft()
        if px[x, y][3] > 0:
            px[x, y] = (0, 0, 0, 0)
            efface += 1
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not vus[ny * w + nx] and passable(px[nx, ny]):
                vus[ny * w + nx] = 1
                file.append((nx, ny))

    # ── NETTOYAGE DU LISERÉ. Le bord anti-aliasé de la plaque laisse des pixels semi-transparents que le
    # remplissage n'atteint pas : à l'écran, un cercle en POINTILLÉS autour de l'objet. On retire tout
    # pixel faiblement opaque qui n'a AUCUN voisin franchement opaque — l'anti-aliasing de l'objet, lui,
    # borde toujours des pixels opaques, donc il est préservé.
    isoles = []
    for y in range(h):
        for x in range(w):
            if not (0 < px[x, y][3] < 160):
                continue
            solide = any(
                0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 200
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)
            )
            if not solide:
                isoles.append((x, y))
    for x, y in isoles:
        px[x, y] = (0, 0, 0, 0)
        efface += 1
    return efface


def reparer_nommes(ids: list, slots: dict) -> None:
    """Retire la plaque de fond d'objets DÉSIGNÉS À LA MAIN, sans passer par la détection.

    ⚠️ POURQUOI CETTE PORTE DE SORTIE EXISTE. La détection automatique attrape les plaques CARRÉES, qui
    sont la grande majorité. Elle rate les plaques en DISQUE : le contour de la boîte englobante d'un
    disque est fait de coins transparents et d'un liseré anti-aliasé, donc l'échantillon sur lequel la
    détection se prononce est trop pauvre. Plutôt que de complexifier l'heuristique jusqu'à risquer des
    faux positifs sur des illustrations saines, on garde une liste explicite : voir un disque blanc à
    l'œil est immédiat, et la réparation, elle, fonctionne parfaitement sur ces cas.
    """
    from PIL import Image
    from collections import Counter

    for iid in ids:
        f = ART / f"item-{iid}.png"
        if not f.exists():
            print(f"  {iid}: fichier absent")
            continue
        im = Image.open(f).convert("RGBA")
        px = im.load()
        w, h = im.size
        # teinte de la plaque = la plus fréquente parmi les pixels opaques NEUTRES et clairs ou sombres
        c = Counter()
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a > 200 and max(r, g, b) - min(r, g, b) < 40:
                    c[(r // 20, g // 20, b // 20)] += 1
        if not c:
            print(f"  {iid}: aucune teinte neutre dominante, rien à retirer")
            continue
        t, part = c.most_common(1)[0]
        couleur = tuple(int(v * 20 + 10) for v in t)
        avant = sum(im.split()[-1].histogram()[201:])
        # ⚠️ REFUS SI LA TEINTE N'EST PAS MAJORITAIRE. Relancer cette réparation sur un fichier DÉJÀ propre
        # est destructeur : la teinte neutre la plus fréquente devient alors une couleur de l'OBJET, et le
        # remplissage la mange. C'est arrivé — le plastron de feuilles s'est retrouvé troué après un second
        # passage (1189 → 733 pixels opaques). Une plaque de fond représente toujours la majorité des
        # pixels neutres opaques ; en dessous, il n'y a plus de plaque à retirer.
        if part / max(1, avant) < 0.45:
            print(f"  {iid}: rien à retirer (teinte neutre dominante à {part * 100 // max(1, avant)} % seulement)")
            continue
        efface = retirer_plaque(im, couleur)
        reste = sum(im.split()[-1].histogram()[201:])
        if reste < 200:
            print(f"  {iid}: RÉPARATION REFUSÉE — il ne resterait que {reste} px opaques")
            continue
        finaliser(im, slots.get(iid, "weapon")).save(f)
        print(f"  {iid}: plaque {couleur} retirée ({efface} px, {avant} → {reste} opaques)")


def vider_interieur(ids: list, slots: dict) -> None:
    """Vide le fond peint ENFERMÉ à l'intérieur d'un objet en anneau (collier, bracelet, couronne).

    ⚠️ POURQUOI ÇA NE PEUT PAS ÊTRE AUTOMATIQUE. Un remplissage depuis le bord de l'image n'atteint jamais
    l'intérieur d'un anneau : l'objet fait barrage. Il faudrait donc chercher les régions ENFERMÉES de
    teinte claire et neutre — mais le corps d'une tunique blanche en est une aussi, et on la mangerait.
    On garde donc une commande explicite, appliquée à des objets qu'on a regardés : le remplissage part du
    CENTRE de l'image, là où se trouve le trou de l'anneau.
    """
    from PIL import Image
    from collections import deque

    for iid in ids:
        f = ART / f"item-{iid}.png"
        if not f.exists():
            print(f"  {iid}: fichier absent")
            continue
        im = Image.open(f).convert("RGBA")
        px = im.load()
        w, h = im.size
        depart = px[w // 2, h // 2]
        if depart[3] < 40:
            print(f"  {iid}: le centre est déjà vide, rien à faire")
            continue
        if max(depart[:3]) - min(depart[:3]) > 60 or sum(depart[:3]) / 3 < 170:
            print(f"  {iid}: le centre n'est pas un fond clair et neutre {depart[:3]} — refusé")
            continue

        def proche(c):
            return c[3] > 0 and abs(c[0] - depart[0]) + abs(c[1] - depart[1]) + abs(c[2] - depart[2]) <= 160

        avant = sum(im.split()[-1].histogram()[201:])
        vus = bytearray(w * h)
        file = deque([(w // 2, h // 2)])
        vus[(h // 2) * w + (w // 2)] = 1
        efface = 0
        touche_bord = False
        while file:
            x, y = file.popleft()
            if x in (0, w - 1) or y in (0, h - 1):
                touche_bord = True
            px[x, y] = (0, 0, 0, 0)
            efface += 1
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and not vus[ny * w + nx] and proche(px[nx, ny]):
                    vus[ny * w + nx] = 1
                    file.append((nx, ny))
        reste = sum(im.split()[-1].histogram()[201:])
        if reste < 200 or reste < avant * 0.25:
            print(f"  {iid}: REFUSÉ — la zone débordait de l'anneau ({avant} → {reste} opaques)")
            continue
        finaliser(im, slots.get(iid, "accessory")).save(f)
        bord = " (a atteint le bord de l'image)" if touche_bord else ""
        print(f"  {iid}: intérieur vidé, {efface} px{bord} — {avant} → {reste} opaques")


def auditer(reparer: bool = False, slots: dict | None = None) -> int:
    """Contrôle qualité des illustrations d'objets ; --repair retire les plaques de fond et recadre.

    Le recadrage post-réparation n'est pas cosmétique : Player.refreshHat met le chapeau à l'échelle
    38 / max(largeur, hauteur) DU CADRE, donc le remplissage décide de la taille du chapeau sur la tête
    du panda (cf. REMPLISSAGE_CIBLE).
    """
    from PIL import Image

    anomalies = 0
    for f in sorted(ART.glob("item-*.png")):
        im = Image.open(f).convert("RGBA")
        if im.size != (TAILLE_FINALE, TAILLE_FINALE):
            print(f"  {f.name}: taille {im.size}")
            anomalies += 1
            continue
        couleur = detecter_plaque(im)
        if not couleur:
            continue
        anomalies += 1
        if not reparer:
            print(f"  {f.name}: plaque de fond {couleur}")
            continue
        efface = retirer_plaque(im, couleur)
        reste = sum(im.split()[-1].histogram()[201:])
        if reste < 200:
            print(f"  {f.name}: RÉPARATION REFUSÉE — il ne resterait que {reste} px opaques")
            continue
        iid = f.stem[len("item-"):]
        slot = (slots or {}).get(iid, "weapon")
        finaliser(im, slot).save(f)
        print(f"  {f.name}: plaque {couleur} retirée ({efface} px), recadré en {slot}")
        anomalies -= 1
    return anomalies


def main():
    ap = argparse.ArgumentParser(description="Génère les illustrations d'objets manquantes.")
    ap.add_argument("only", nargs="*", help="filtre par sous-chaîne d'identifiant (mot-clé 'only' optionnel)")
    ap.add_argument("--list", action="store_true", help="liste ce qui manque et sort")
    ap.add_argument("--dry", action="store_true", help="affiche les prompts, aucun appel réseau")
    ap.add_argument("--force", action="store_true", help="regénère même si le PNG existe")
    ap.add_argument("--env", type=Path, default=ENV_DEFAUT, help=f"fichier d'identifiants (défaut : {ENV_DEFAUT})")
    ap.add_argument("--audit", action="store_true", help="contrôle qualité des illustrations déjà en place, puis sort")
    ap.add_argument("--vider-interieur", nargs="*", default=None, metavar="ID",
                    help="vide le fond peint enfermé dans un objet en anneau (collier, bracelet), puis sort")
    ap.add_argument("--repair-only", nargs="*", default=None, metavar="ID",
                    help="retire la plaque de fond de ces objets précis (contourne la détection), puis sort")
    ap.add_argument("--repair", action="store_true", help="avec --audit : retire les plaques de fond détectées")
    ap.add_argument("--comptes", action="store_true", help="liste les comptes de service disponibles et sort")
    ap.add_argument("--compte", default=None, help="compte de service à utiliser (sous-chaîne du nom)")
    ap.add_argument("--limit", type=int, default=0, help="s'arrête après N objets")
    ap.add_argument(
        "--dessines", action="store_true",
        help="inclut aussi les chapeaux qui ont déjà un dessin vectoriel (pour les remplacer par une illustration)",
    )
    args = ap.parse_args()

    if args.vider_interieur is not None:
        slots = {it["id"]: it["slot"] for it in lire_items()}
        vider_interieur(args.vider_interieur, slots)
        return

    if args.repair_only is not None:
        slots = {it["id"]: it["slot"] for it in lire_items()}
        reparer_nommes(args.repair_only, slots)
        return

    if args.audit:
        slots = {it["id"]: it["slot"] for it in lire_items()}
        n = auditer(reparer=args.repair, slots=slots)
        print(f"{n} anomalie(s)" if n else "✔ aucune anomalie")
        return

    if args.comptes:
        for nom, sa in lire_comptes(args.env).items():
            print(f"  {nom}  →  projet {sa.get('project_id')}")
        return

    filtres = [f for f in args.only if f != "only"]
    items = lire_items()
    dessines = set() if args.dessines else chapeaux_dessines()
    cibles = [it for it in items if args.force or not a_un_visuel(it, dessines)]
    if filtres:
        cibles = [it for it in cibles if any(f in it["id"] for f in filtres)]
    if args.limit:
        cibles = cibles[: args.limit]

    if not cibles:
        print("Rien à générer. 🎉")
        return

    par_slot = {}
    for it in cibles:
        par_slot[it["slot"]] = par_slot.get(it["slot"], 0) + 1
    print(f"{len(cibles)} objet(s) à générer : " + ", ".join(f"{n} {s}" for s, n in sorted(par_slot.items())))

    if args.list:
        for it in cibles:
            print(f"  item-{it['id']}.png   {it['name']} ({it['rarity']}, {it['slot']})")
        return

    if args.dry:
        premier = MODELES[0]
        print(f"(prompt tel qu'il partira vers {premier[0]})")
        for it in cibles:
            print(f"\n── item-{it['id']}.png ──\n{prompt_pour(it, alpha=premier[2])}")
        return

    creds, project, compte = charger_credentials(args.env, args.compte)
    print(f"Compte « {compte} » · projet Vertex {project} · région {REGION}")
    ART.mkdir(parents=True, exist_ok=True)

    ok, echecs, modeles_utilises = 0, [], {}
    for i, it in enumerate(cibles, 1):
        cible = ART / f"item-{it['id']}.png"
        print(f"[{i}/{len(cibles)}] {it['id']} … ", end="", flush=True)
        try:
            brut, modele = generer(creds, project, it)
            detacher(brut, it["slot"]).save(cible)
            ok += 1
            modeles_utilises[modele] = modeles_utilises.get(modele, 0) + 1
            print(f"ok ({modele})")
        except Exception as e:  # noqa: BLE001
            echecs.append((it["id"], str(e)[:200]))
            print("ÉCHEC")
        time.sleep(0.4)  # on ne martèle pas l'API

    print(f"\n{ok} illustration(s) écrite(s) dans {ART.relative_to(RACINE)}")
    for m, n in modeles_utilises.items():
        print(f"   {n} via {m}")
    if echecs:
        print(f"{len(echecs)} échec(s) :")
        for iid, err in echecs:
            print(f"   {iid} : {err}")
    print(
        "\nEnsuite :\n"
        "   npx vitest run tests/data/item-images.test.ts   # signale les entrées à retirer de ART_A_GENERER\n"
        "   node scripts/art-manquant.mjs                   # rafraîchit docs/art-a-generer.md"
    )


if __name__ == "__main__":
    main()

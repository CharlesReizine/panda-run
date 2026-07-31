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
CADRE_ALPHA = (
    "Icône d'objet d'inventaire, l'objet SEUL au centre, cadré serré, fond TRANSPARENT (canal alpha PNG), "
    "rien d'autre dans l'image : aucun décor, aucune ombre portée, aucun texte, aucun cadre, "
    "aucun disque derrière l'objet. Doit rester lisible en tout petit (40 px)."
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


def charger_credentials(chemin_env: Path):
    """Reconstitue le compte de service Vertex depuis les parts base64 du .env pretto."""
    if not chemin_env.exists():
        sys.exit(f"❌ fichier d'identifiants introuvable : {chemin_env}\n   (passe --env <chemin>)")
    parts = {}
    for ligne in chemin_env.read_text(encoding="utf-8", errors="replace").splitlines():
        if not ligne.startswith(PREFIXE_CRED):
            continue
        cle, _, val = ligne.partition("=")
        suffixe = cle[len(PREFIXE_CRED):].strip()
        if suffixe.isdigit():
            parts[int(suffixe)] = val.strip().strip("'\"")
    if not parts:
        sys.exit(f"❌ aucune variable {PREFIXE_CRED}* dans {chemin_env}")
    brut = "".join(parts[k] for k in sorted(parts))
    try:
        decode = base64.b64decode(brut)
        data = json.loads(decode)
    except Exception as e:  # noqa: BLE001
        sys.exit(f"❌ les parts {PREFIXE_CRED}* ne se décodent pas en JSON ({e})")

    # Le nom est au pluriel : le blob peut contenir PLUSIEURS comptes. On prend le premier qui en est un.
    if isinstance(data, dict) and data.get("type") == "service_account":
        sa = data
    elif isinstance(data, dict):
        sa = next((v for v in data.values() if isinstance(v, dict) and v.get("type") == "service_account"), None)
    else:
        sa = None
    if not sa:
        sys.exit("❌ aucun compte de service trouvé dans le blob décodé")

    try:
        from google.oauth2 import service_account
        import google.auth.transport.requests as gart
    except ImportError:
        sys.exit("❌ paquet manquant : pip install google-auth")
    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(gart.Request())
    return creds, sa.get("project_id")


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


def finaliser(im):
    """Recadre sur le contenu, centre dans un carré avec une petite marge, sort du 128×128 RGBA."""
    from PIL import Image

    boite = im.split()[-1].getbbox()
    if boite:
        im = im.crop(boite)
    cote = max(im.size)
    marge = max(2, cote // 16)
    fond = Image.new("RGBA", (cote + marge * 2, cote + marge * 2), (0, 0, 0, 0))
    fond.paste(im, ((fond.width - im.width) // 2, (fond.height - im.height) // 2), im)
    return fond.resize((TAILLE_FINALE, TAILLE_FINALE), Image.LANCZOS)


def detacher(png_bytes: bytes) -> "object":
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
        return finaliser(im)

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

    return finaliser(im)


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


def main():
    ap = argparse.ArgumentParser(description="Génère les illustrations d'objets manquantes.")
    ap.add_argument("only", nargs="*", help="filtre par sous-chaîne d'identifiant (mot-clé 'only' optionnel)")
    ap.add_argument("--list", action="store_true", help="liste ce qui manque et sort")
    ap.add_argument("--dry", action="store_true", help="affiche les prompts, aucun appel réseau")
    ap.add_argument("--force", action="store_true", help="regénère même si le PNG existe")
    ap.add_argument("--env", type=Path, default=ENV_DEFAUT, help=f"fichier d'identifiants (défaut : {ENV_DEFAUT})")
    ap.add_argument("--limit", type=int, default=0, help="s'arrête après N objets")
    ap.add_argument(
        "--dessines", action="store_true",
        help="inclut aussi les chapeaux qui ont déjà un dessin vectoriel (pour les remplacer par une illustration)",
    )
    args = ap.parse_args()

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

    creds, project = charger_credentials(args.env)
    print(f"Projet Vertex : {project} · région {REGION}")
    ART.mkdir(parents=True, exist_ok=True)

    ok, echecs, modeles_utilises = 0, [], {}
    for i, it in enumerate(cibles, 1):
        cible = ART / f"item-{it['id']}.png"
        print(f"[{i}/{len(cibles)}] {it['id']} … ", end="", flush=True)
        try:
            brut, modele = generer(creds, project, it)
            detacher(brut).save(cible)
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

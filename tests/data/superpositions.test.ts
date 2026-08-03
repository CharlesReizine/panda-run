import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUNE SURFACE NE DOIT SE SUPERPOSER À UNE AUTRE — INVARIANT, ET IL EST ROUGE
//
// Décision du user, mot pour mot : « why not ta règle de regarder si ça se superpose, mais je préfère que
// ça soit un test qui fail et on le fix, plutôt que du dirty fix où on peut avoir des patterns dégueulasses.
// Tu me fix ça, tu me le scotch pas. »
//
// ⚠️ CE TEST ÉCHOUE AUJOURD'HUI, ET C'EST VOULU. LevelScene filtre actuellement les doublons À LA POSE
// (une tuile cassable n'est pas créée là où il y a déjà de la matière, une plateforme noyée dans une dalle
// n'est ni dessinée ni collisionnée). Ce filtre soigne le SYMPTÔME : à l'écran on ne voit plus rien de
// superposé. Mais les motifs continuent de produire de la géométrie qui se recouvre, et c'est là que
// naissent les vrais ennuis — dont « quand ça se superpose on peut nager à travers la pierre », que le
// filtre d'affichage ne règle pas et ne réglera jamais.
//
// Ce test dit donc la vérité sur la GÉNÉRATION, pas sur le rendu. Il restera rouge jusqu'à ce que les
// motifs fautifs soient corrigés (lot « génération » d'ETAT-DU-PROJET.md : correction des motifs, puis UNE
// regravure, puis resync des niveaux de monstres). Le rendre vert en relâchant les seuils serait remettre
// du scotch — c'est précisément ce qui est refusé ici.

const ov = (a: { x: number; w: number }, b: { x: number; w: number }) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)

interface Faute { type: string; ou: string }

function fautes(): Faute[] {
  const out: Faute[] = []
  for (const l of Object.values(LEVELS)) {
    const plats = l.platforms
    const rocks = l.rockBands ?? []
    const brk = l.breakables ?? []

    // deux plateformes sur la MÊME rangée qui se chevauchent : deux textures au même endroit
    for (let i = 0; i < plats.length; i++) for (let j = i + 1; j < plats.length; j++) {
      const a = plats[i]!, b = plats[j]!
      if (a.y === b.y && ov(a, b) > 0) out.push({ type: 'plat/plat', ou: `${l.id} y${a.y} x${Math.max(a.x, b.x)}` })
    }
    // plateforme noyée dans une dalle : invisible, et son corps double celui de la dalle
    for (const p of plats) for (const r of rocks) {
      if (ov(p, r) > 0 && r.y <= p.y && r.y + r.h > p.y) out.push({ type: 'plat/roche', ou: `${l.id} plat y${p.y} dans dalle y${r.y}h${r.h}` })
    }
    // pierre fragile posée dans de la matière déjà présente
    for (const b of brk) {
      for (const p of plats) if (ov(b, p) > 0 && b.y <= p.y && b.y + b.h > p.y) out.push({ type: 'pierre/plat', ou: `${l.id} cassable y${b.y}h${b.h} sur plat y${p.y}` })
      for (const r of rocks) if (ov(b, r) > 0 && Math.min(b.y + b.h, r.y + r.h) - Math.max(b.y, r.y) > 0) out.push({ type: 'pierre/roche', ou: `${l.id} cassable y${b.y}h${b.h} dans dalle y${r.y}h${r.h}` })
    }
    // deux dalles de roche qui se recouvrent franchement
    for (let i = 0; i < rocks.length; i++) for (let j = i + 1; j < rocks.length; j++) {
      const a = rocks[i]!, b = rocks[j]!
      if (ov(a, b) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0) {
        out.push({ type: 'roche/roche', ou: `${l.id} x${Math.max(a.x, b.x)}` })
      }
    }
  }
  return out
}

describe('géométrie des terrains', () => {
  it('aucune surface ne se superpose à une autre', () => {
    const f = fautes()
    const parType = new Map<string, number>()
    for (const x of f) parType.set(x.type, (parType.get(x.type) ?? 0) + 1)
    const resume = [...parType.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')
    const exemples = f.slice(0, 8).map((x) => `\n   ${x.type} — ${x.ou}`).join('')
    expect(f, `${f.length} superposition(s) — ${resume}${exemples}`).toEqual([])
  })
})

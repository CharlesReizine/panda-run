import { it } from 'vitest'
import * as I from '../../src/scenes/inventory-layout'
import * as C from '../../src/scenes/classchange-layout'
import { SLOT_ORDER } from '../../src/data/items'

it('dump', () => {
  console.log('stockBox', I.stockBox(), 'equipBox', I.equipBox())
  console.log('cellW', I.cellW(), 'gridLeft', I.gridLeft(), 'gridLimit', I.gridLimit(), 'sectionH', I.sectionH())
  console.log('cellNameChars', I.cellNameChars())
  for (const counts of [[1,1,1,1],[4,4,4,4],[9,9,9,9],[30,0,0,0],[61,0,0,0]]) {
    const l = I.layoutStock(SLOT_ORDER.map((s,i)=>({key:s,count:counts[i]!})))
    console.log(counts.join('/'), 'shown', l.sections.map(s=>`${s.key}:${s.shown}@${s.headerY}`).join(' '), 'hidden', l.hidden)
  }
  const rows = [0,1,2,3].map(i=>I.equipRowRect(i,4))
  console.log('equip rows', rows.map(r=>`${r.y}..${r.y+r.h}`).join(' '), 'nameChars', I.equipNameChars(rows[0]!))
  const info = I.layoutInfo('Épée en bambou','Une lame de fortune taillée dans une tige de bambou. Ça pique, à peine.',null)
  console.log('info', JSON.stringify({card:info.card, icon:info.icon, name:info.name, rarity:info.rarity, desc:info.desc, pt:info.propsTitle, props:info.props, notice:info.notice, btn:info.buttons}))
  console.log('close', I.closeRect('← Fermer'))
  console.log('infoButtons', I.infoButtons('Équiper','Fermer'))
  for (const n of [3,1]) {
    const card = C.cardRect(0,n)
    console.log('card n=',n, card, C.cardFlow(card), 'maxSkillLines', C.maxSkillLines(card), 'nameChars', C.nameChars(card), 'skillChars', C.skillChars(card))
  }
  console.log('action', C.actionRect('Évoluer en Chevalier !'), 'training', C.trainingRect('⚔ Entraînement'), 'message', C.messageRect('Tu es maintenant Chevalier !'))
})

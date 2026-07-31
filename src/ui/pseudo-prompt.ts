// Saisie du pseudo. Overlay DOM et non un objet Phaser : Phaser n'a pas de champ texte, et un vrai
// <input> déclenche le clavier natif (avec autocomplétion et bouton « OK » du clavier iOS), ce qu'un
// faux champ dessiné dans le canvas ne sait pas faire. `window.prompt` marcherait mais l'alerte
// système est laide et, sur iOS, elle peut suspendre la boucle de rendu.

import { PSEUDO_MAX, cleanPseudo } from '../cloud/leaderboard'

/** Affiche la saisie et résout avec le pseudo nettoyé, ou `null` si le joueur annule. */
export function askPseudo(current = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div')
    back.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10000', 'display:grid', 'place-items:center',
      'background:rgba(4,10,18,.86)', '-webkit-backdrop-filter:blur(3px)', 'backdrop-filter:blur(3px)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'padding:24px',
    ].join(';')

    const card = document.createElement('div')
    card.style.cssText = [
      'background:#102a3a', 'border:2px solid #4fc3f7', 'border-radius:14px',
      'padding:22px 24px', 'width:min(92vw,420px)', 'text-align:center', 'color:#e8f4fb',
      'box-shadow:0 12px 40px rgba(0,0,0,.5)',
    ].join(';')

    const title = document.createElement('div')
    title.textContent = 'Ton pseudo'
    title.style.cssText = 'font-size:22px;font-weight:800;color:#ffd54f;margin-bottom:14px'

    const input = document.createElement('input')
    input.type = 'text'
    input.value = current
    input.maxLength = PSEUDO_MAX
    input.autocomplete = 'off'
    input.placeholder = 'Panda'
    input.setAttribute('autocapitalize', 'off')
    input.style.cssText = [
      'width:100%', 'box-sizing:border-box', 'padding:12px 14px', 'font-size:19px',
      'border-radius:9px', 'border:1px solid #4fc3f7', 'background:#0a1c28', 'color:#ffffff',
      'text-align:center', 'font-weight:700', 'outline:none',
    ].join(';')

    const hint = document.createElement('div')
    hint.textContent = `${PSEUDO_MAX} caractères max — visible dans le classement`
    hint.style.cssText = 'font-size:12px;opacity:.6;margin-top:9px'

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:10px;margin-top:18px'
    const mkBtn = (text: string, bg: string) => {
      const b = document.createElement('button')
      b.textContent = text
      b.style.cssText = `flex:1;padding:12px;font-size:17px;font-weight:800;border:0;border-radius:9px;background:${bg};color:#fff;cursor:pointer`
      return b
    }
    const cancel = mkBtn('Annuler', '#455a64')
    const ok = mkBtn('C\'est parti', '#2e7d32')

    row.append(cancel, ok)
    card.append(title, input, hint, row)
    back.append(card)
    document.body.append(back)

    const close = (value: string | null) => {
      back.remove()
      resolve(value)
    }
    // un pseudo vide n'a pas de sens : on retombe sur « Panda » plutôt que de bloquer le joueur
    const submit = () => close(cleanPseudo(input.value) || 'Panda')

    ok.addEventListener('click', submit)
    cancel.addEventListener('click', () => close(null))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') close(null)
    })

    // le focus doit venir APRÈS l'insertion dans le document, sinon iOS n'ouvre pas le clavier
    setTimeout(() => { input.focus(); input.select() }, 50)
  })
}

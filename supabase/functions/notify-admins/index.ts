// Edge Function to notify admins of various site events
// Sends notifications via Slack (informational) and Resend (email).
//
// Routing strategy:
//   - Each event type has a formatter that returns a nicely formatted email.
//   - The primary recipient is determined by the event (recipient_email /
//     admin_email / ADMIN_EMAIL env fallback).
//   - Events in SUPERADMIN_CC_ALWAYS always CC the superadmin, even when
//     there's an explicit recipient (use for one-shot events where both the
//     recipient and the superadmin should know).
//   - Events in SUPERADMIN_CC_IF_NO_RECIPIENT only CC the superadmin when the
//     frontend did NOT specify an explicit recipient. Use for broadcast events
//     where the frontend makes N calls (one per member) plus a separate
//     no-recipient call dedicated to the superadmin.
//   - Slack is sent in parallel regardless of event type.
//
// Adrese rezolvate pe server (1 august 2026):
//   - Frontendul poate trimite `user_id`-uri în loc de adrese. Orice câmp
//     `*_user_id` devine `*_email` prin `hydrateEmailsFromUserIds`, folosind
//     service role. Un `*_email` trimis explicit NU se suprascrie, deci
//     traseele vechi merg neschimbate.
//   - `recipient_user_ids` (listă) trimite anunțul întregului grup dintr-un
//     singur apel, cu câte un email separat per destinatar.
//   Motivul: până acum browserul trebuia să citească `profiles.email` ca să
//   compună notificările, ceea ce obliga la a lăsa coloana citibilă de orice
//   utilizator logat.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  event_type: string
  data: Record<string, any>
  timestamp?: string
}

interface SlackMessage {
  text: string
  blocks?: any[]
}

interface FormattedMessage {
  title: string
  body: string
  html?: string
}

// Events that CC the superadmin every time, even when there is already an
// explicit primary recipient. Use for "one-shot" events where the superadmin
// wants visibility on top of notifying the original person (e.g. invitation
// sent to an outsider — the superadmin wants to know it happened).
const SUPERADMIN_CC_ALWAYS = new Set<string>([
  // Invitations — one email per event, primary recipient is the invited person
  // or the group admin. Superadmin wants to know every invite/join action.
  'invitation_sent',
  'member_invited_someone',
  'join_request_admin_email',
  // Cerere spontană de alăturare: frontendul trimite admin_email (adminul
  // grupului) ca recipient explicit, dar superadminul vrea să vadă și el fiecare
  // cerere. Deci CC mereu, nu doar când lipsește recipientul.
  'join_request',
  // Platform-wide events that may have a recipient (e.g. the new user themselves)
  // but still need superadmin visibility.
  'new_user',
  'account_reactivated',
  // Grupul a atins numărul maxim de membri: emailul merge la adminul grupului
  // (admin_email), dar superadminul vrea să știe de fiecare dată când un grup
  // s-a umplut. Deci CC mereu.
  'group_full',
  // Digestul de anunțuri pleacă membrilor grupului, iar superadminul nu e
  // membru în grupurile oamenilor — deci până acum NU AFLA NICIODATĂ că s-a
  // scris ceva pe un grup. Adăugat pe 13 august, după ce Alin (admin la „Rond
  // Coșbuc" și „Bosianu") a scris un anunț despre care noi n-am știut nimic.
  //
  // ⚠️ E un eveniment de tip broadcast (`recipient_user_ids`), deci copia
  // superadminului pleacă printr-o trimitere SEPARATĂ, o singură dată per grup,
  // nu o dată per membru — vezi ramura `hasBroadcastRequest && shouldCcSuperadmin`
  // de mai jos. Emailul e cel primit și de membri: numele grupului, câte mesaje
  // s-au scris, autorul ultimului și primele ~90 de caractere din el.
  'anunturi_digest',
])

// Events that CC the superadmin ONLY if the frontend did not specify a recipient.
// These are "broadcast" events where the frontend makes N calls (one per member)
// plus a separate no-recipient call intended for the superadmin. Without this
// split, the superadmin would get N+1 copies of the same event.
const SUPERADMIN_CC_IF_NO_RECIPIENT = new Set<string>([
  'member_left',
  'member_removed',
  'member_joined',
  'admin_transferred',
  'kick_vote_initiated',
  'kick_vote_result',
  'member_approved',
  'member_rejected',
  'group_created',
  'group_updated',
  // Linkul grupului de WhatsApp a fost salvat/schimbat de admin: frontendul
  // trimite un email per membru activ (cu admin_email) + un apel dedicat
  // superadminului (fără admin_email). Deci CC doar când lipsește recipientul.
  'whatsapp_link_shared',
  'account_suspended',
  'account_deleted',
  'partner_application',
  'consultation_request',
  'newsletter_signup',
  'terrain_proposed',
  // Comenzi de analiză (plată Oblio + Netopia) — fără primary recipient,
  // notificarea merge doar către superadmin pe Slack + email.
  'comanda_creata',
  'comanda_platita',
])

const PLATFORM_URL = 'https://apartamentual.ro'

// Evenimente care NU se anunță pe Slack.
//
// ⚠️ Regula generală a funcției e „Slack la fiecare apel", și e bună pentru
// evenimente rare. `terenuri_noi_zone` e altfel: e personalizat per persoană,
// deci digestul săptămânal face ~62 de apeluri într-o singură dimineață de
// luni. Fără excepția asta, `#app_events` primește 62 de mesaje identice ca
// formă și canalul devine inutilizabil exact în ziua în care ai vrea să te
// uiți la el. Rezumatul (câți au primit, câte terenuri, ce n-a putut fi legat
// de nicio zonă) îl trimite edge function-ul `digest-terenuri-zone`, o
// singură dată, la final.
//
// Digestul de anunțuri nu are nevoie de asta fiindcă trimite întregului grup
// dintr-un singur apel (`recipient_user_ids`), deci un singur mesaj pe Slack.
const SKIP_SLACK = new Set<string>([
  'terenuri_noi_zone',
])

// ═══════════════════════════════════════════════════════════════════════════
// Helper: rândul „teren" din emailul de comandă
// ═══════════════════════════════════════════════════════════════════════════
// Distinge un teren de pe PLATFORMĂ (link intern .../teren-details.html?id=UUID)
// de un anunț EXTERN (OLX, Storia etc.), ca să știi imediat, din email, dacă și
// despre ce teren de pe platformă e vorba — și să-l poți corela rapid după ID.
function buildTerenRow(linkTeren: string): { label: string; value: string } {
  if (!linkTeren) {
    return { label: 'Link teren', value: '—' }
  }
  // Caută UUID-ul terenului în linkul intern al platformei.
  const match = linkTeren.match(/teren-details\.html\?id=([0-9a-fA-F-]{36})/)
  if (match) {
    const terenId = match[1]
    return {
      label: '🟢 Teren pe platformă',
      value:
        `<a href="${linkTeren}" style="color: #c2604a;">Deschide terenul pe platformă</a>` +
        `<br><span style="color:#888;font-size:12px;">ID teren: ${terenId}</span>`,
    }
  }
  // Link extern (anunț sursă) — păstrăm comportamentul anterior, dar etichetat clar.
  return {
    label: 'Link anunț teren (extern)',
    value: `<a href="${linkTeren}" style="color: #c2604a;">${linkTeren}</a>`,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: text scris de utilizator, afișat într-un rând de email
// ═══════════════════════════════════════════════════════════════════════════
// Valorile din detailsList intră direct în HTML, deci rândurile scrise de om
// s-ar lipi într-un bloc. Aici scăpăm caracterele HTML (textul vine de la
// client, nu de la noi) și transformăm rândurile noi în <br>.
function formatMultilineText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>')
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML email template helper
// ═══════════════════════════════════════════════════════════════════════════

interface EmailTemplateOptions {
  headerEmoji?: string        // e.g. "🎉", "🔔"
  headerTitle: string          // main heading inside the body
  intro?: string               // short intro paragraph (HTML allowed)
  bodyParagraphs?: string[]    // additional paragraphs (HTML allowed)
  detailsList?: Array<{ label: string; value: string }>  // key-value rows
  ctaLink?: string             // optional CTA button URL
  ctaLabel?: string            // CTA button label
  footerNote?: string          // small print below CTA
}

function buildEmailHtml(opts: EmailTemplateOptions): string {
  const {
    headerEmoji = '🔔',
    headerTitle,
    intro = '',
    bodyParagraphs = [],
    detailsList = [],
    ctaLink,
    ctaLabel,
    footerNote,
  } = opts

  const paragraphsHtml = bodyParagraphs
    .map(p => `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">${p}</p>`)
    .join('')

  const detailsHtml = detailsList.length > 0
    ? `<table style="width: 100%; border-collapse: collapse; margin: 16px 0 24px; background: #f3f0e7; border-radius: 8px; overflow: hidden;">
         ${detailsList.map(d => `
           <tr>
             <td style="padding: 10px 14px; font-size: 13px; color: #8a8a8a; border-bottom: 1px solid #e8e3d8; font-weight: 500;">${d.label}</td>
             <td style="padding: 10px 14px; font-size: 13px; color: #1a1a1a; border-bottom: 1px solid #e8e3d8;">${d.value}</td>
           </tr>
         `).join('')}
       </table>`
    : ''

  // ⚠️ Butonul comun al TUTUROR emailurilor platformei (invitații, cereri de
  // alăturare, digestul de anunțuri, notificările de grup). Avea fundal aproape
  // negru și text alb, iar în programele de mail care randează pe fundal
  // întunecat dispărea: rămânea doar scrisul alb plutind, fără formă de buton.
  // Trecut pe contur cărămiziu, ca butoanele din emailul de terenuri (14 august).
  const ctaHtml = (ctaLink && ctaLabel)
    ? `<div style="text-align: center; margin: 28px 0;">
         <a href="${ctaLink}" style="display: inline-block; border: 2px solid #c2604a; color: #c2604a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
           ${ctaLabel}
         </a>
       </div>`
    : ''

  const footerHtml = footerNote
    ? `<p style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: #8a8a8a;">${footerNote}</p>`
    : ''

  return `
    <div style="font-family: 'Mona Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; background: #faf8f3; color: #555555;">
      <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #e8e3d8;">
        <h1 style="margin: 0; font-size: 22px; color: #1a1a1a; font-weight: 600;">
          apartamen<span style="color: #c2604a;">TU</span>al
        </h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: #8a8a8a;">by LTFB studio</p>
      </div>
      <div style="padding: 32px 8px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #1a1a1a; line-height: 1.3;">
          ${headerEmoji} ${headerTitle}
        </h2>
        ${intro ? `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">${intro}</p>` : ''}
        ${paragraphsHtml}
        ${detailsHtml}
        ${ctaHtml}
        ${footerHtml}
      </div>
      <div style="border-top: 1px solid #e8e3d8; padding: 20px 8px 0; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #8a8a8a;">
          — Echipa ApartamenTUal<br>
          <a href="${PLATFORM_URL}" style="color: #c2604a; text-decoration: none;">apartamentual.ro</a>
        </p>
      </div>
    </div>
  `
}

// ═══════════════════════════════════════════════════════════════════════════
// Emailul „terenuri noi în zonele tale" (digest săptămânal)
// ═══════════════════════════════════════════════════════════════════════════
// Textul aprobat stă în `email_templates/email-terenuri-noi-saptamanal.md`.
// Dacă schimbi ceva aici, schimbă și acolo — altfel documentul de discutat
// începe să descrie un email care nu mai există.

// Câte terenuri apar ca dreptunghiuri cu poză, înainte ca restul să treacă în
// linii scurte. ⚠️ E o decizie de TEXT, nu de date: funcția SQL întoarce tot
// materialul, iar șablonul alege cât arată. Se mută de aici, fără migrație.
// Media măsurată e 12 terenuri pe om — 12 dreptunghiuri ar fi un catalog.
const CATE_CU_POZA = 3

// ⚠️ Prețul analizei stă ÎNTR-UN SINGUR LOC, dinadins. E preț de lansare, deci
// se va schimba, iar emailul ăsta pleacă singur în fiecare luni.
//
// Scrierea e „99 RON", nu „99 lei" — exact cum apare pe site
// (`analize.html:494`, `comanda-analiza.html:386`). „TVA inclus" e verificat:
// `analize.html:495` scrie „TVA 21% inclus în preț".
//
// ⚠️ Prețul mai trăiește în DOUĂ locuri din frontend, care se schimbă de mână:
// `analize.html` (494-495) și `comanda-analiza.html` (385-389).
const PRET_ANALIZA = '99 RON'
// ⚠️ Fără liniuță de dialog („—") în textul văzut de om. E o regulă generală
// de voce, nu o preferință de moment: vezi „Semne de punctuație" în CLAUDE.md.
const PRET_MENTIUNE = 'TVA inclus, preț de lansare'

/** Scapă textul care vine din baza de date (titluri de teren, nume de zonă). */
function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 186000 -> „186.000" (separatorul românesc e punctul). */
function numarRo(n: unknown): string {
  const v = Number(n)
  if (!isFinite(v)) return ''
  return Math.round(v).toLocaleString('ro-RO')
}

/** Numeralul în românește: 1 teren nou / 3 terenuri noi / 21 DE terenuri noi. */
function textTerenuri(n: number): string {
  if (n === 1) return '1 teren nou'
  if (n < 20) return `${n} terenuri noi`
  return `${n} de terenuri noi`
}

interface TerenDinLot {
  id?: string
  titlu?: string
  zona?: string
  oras?: string
  suprafata?: number | null
  pret_total?: number | null
  pret_mp?: number | null
  imagine?: string | null
}

function linkTeren(t: TerenDinLot): string {
  return t.id
    ? `${PLATFORM_URL}/teren-details.html?id=${encodeURIComponent(String(t.id))}`
    : `${PLATFORM_URL}/terenuri.html`
}

/**
 * Rândul de cifre al unui teren: „620 mp · 186.000 € · 300 €/mp".
 * Sare peste ce lipsește, în loc să scrie „— €" sau „NaN".
 * ⚠️ Moneda e €, iar prețul pe mp vine calculat din SQL (`pret_total /
 * suprafata`), fiindcă exact așa îl calculează și pagina (`terenuri.js:335`).
 * Coloana `terenuri.pret_pe_mp` există în bază, dar frontendul n-o citește —
 * dacă am folosi-o, emailul ar putea arăta alt preț decât pagina.
 */
function cifreTeren(t: TerenDinLot): string[] {
  const out: string[] = []
  if (t.suprafata) out.push(`${numarRo(t.suprafata)} mp`)
  if (t.pret_total) out.push(`<strong style="color:#1a1a1a;">${numarRo(t.pret_total)} €</strong>`)
  if (t.pret_mp) out.push(`${numarRo(t.pret_mp)} €/mp`)
  return out
}

/** Dreptunghiul cu poză, pentru primele CATE_CU_POZA terenuri. */
function cardTeren(t: TerenDinLot): string {
  const href = linkTeren(t)
  const locatie = [t.zona, t.oras].filter(Boolean).map(escHtml).join(' · ')
  // Toate cele 46 de terenuri publice au poză (măsurat 13 august), dar un
  // teren fără poză nu trebuie să lase un dreptunghi gol în email.
  const poza = t.imagine
    ? `<tr><td style="padding:0;">
         <a href="${href}"><img src="${escHtml(t.imagine)}" alt="" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;border-radius:8px 8px 0 0;"></a>
       </td></tr>`
    : ''

  // ⚠️ REGULĂ PENTRU TOATE BUTOANELE DIN EMAILURI (14 august, telefonul lui Lucian):
  // un buton cu fundal aproape negru DISPARE în programele de mail care randează
  // pe fundal întunecat. Fundalul butonului rămâne negru, fundalul paginii devine
  // negru, și se vede doar scrisul alb plutind.
  // Soluția aleasă: toate butoanele sunt cu CONTUR cărămiziu și text cărămiziu,
  // fără fundal plin. Culoarea e aceeași în ambele moduri, deci butonul se vede
  // și pe hârtie, și pe negru. Ierarhia se face din mărime, nu din umplere.
  // ⚠️ Nu te baza pe `prefers-color-scheme` în email: multe programe îl ignoră și
  // inversează culorile după capul lor.
  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;background:#ffffff;border:1px solid #e8e3d8;border-radius:8px;overflow:hidden;">
      ${poza}
      <tr><td style="padding:16px;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a1a1a;line-height:1.3;">${escHtml(t.titlu || 'Teren')}</p>
        ${locatie ? `<p style="margin:0 0 12px;font-size:13px;color:#8a8a8a;">${locatie}</p>` : ''}
        <p style="margin:0 0 14px;font-size:14px;color:#555555;">${cifreTeren(t).join(' · ')}</p>
        <a href="${href}" style="display:inline-block;border:2px solid #c2604a;color:#c2604a;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;">Vezi terenul →</a>
      </td></tr>
    </table>`
}

// Paleta semnăturii — aceleași șase culori prin care se rotește „TU"-ul din
// `apartamenTUal` pe site (`index.html:2044` și `js/footer.js:279`).
// ⚠️ DACĂ SE SCHIMBĂ ACOLO, SE SCHIMBĂ ȘI AICI. Sunt trei locuri, iar emailul
// e singurul care nu se vede la o privire pe site.
//
// În email culorile stau pe loc: nu există JavaScript într-un email, deci
// rotația e imposibilă. În schimb, fiecare bulină ia altă culoare din paletă,
// în ordinea de acolo — semnătura oprită într-un cadru, în loc de animație.
const PALETA_TU = ['#c2604a', '#5e8a6c', '#5a7196', '#a76782', '#b8965c', '#7a9a90']

/**
 * Listă cu buline colorate.
 *
 * ⚠️ NU `<ul><li>`: Outlook pe Windows ignoră `margin` pe listă și pune
 * indentarea lui, deci lista ar ieși aliniată altfel decât restul emailului.
 * Un tabel cu două coloane arată la fel peste tot.
 *
 * ⚠️ Bulina e o CELULĂ cu fundal, nu caracterul „•": caracterul se randează
 * la mărimi diferite de la un program de email la altul, iar culoarea lui
 * depinde de font. O celulă de 7×7 cu `bgcolor` e desenată identic peste tot.
 * `border-radius` e ignorat de Outlook pe Windows, deci acolo bulina iese
 * pătrată — arată tot deliberat, fiindcă e colorată și aliniată.
 *
 * ⚠️ Culoarea e strict decorativă. Nicio liniuță nu depinde de ea ca să se
 * înțeleagă, deci nu se pierde nimic dacă cineva citește emailul în text simplu.
 */
function liniute(elemente: string[]): string {
  const randuri = elemente.map((t, i) => {
    const culoare = PALETA_TU[i % PALETA_TU.length]
    return `
    <tr>
      <td width="20" style="width:20px;padding:8px 0 0;vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td width="7" height="7" bgcolor="${culoare}" style="width:7px;height:7px;background:${culoare};border-radius:50%;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
      <td style="padding:0 0 14px;font-size:15px;line-height:1.6;color:#555555;">${t}</td>
    </tr>`
  }).join('')
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px;">${randuri}</table>`
}

/** Linia scurtă, pentru restul terenurilor. Un rând, cu link propriu. */
function linieTeren(t: TerenDinLot): string {
  const href = linkTeren(t)
  const detalii = [t.zona ? escHtml(t.zona) : null, ...cifreTeren(t)].filter(Boolean).join(' · ')
  return `
    <tr><td style="padding:11px 0;border-bottom:1px solid #e8e3d8;font-size:14px;line-height:1.5;">
      <a href="${href}" style="color:#1a1a1a;text-decoration:none;font-weight:600;">${escHtml(t.titlu || 'Teren')}</a>
      <br><span style="color:#8a8a8a;font-size:13px;">${detalii}</span>
    </td></tr>`
}

// ═══════════════════════════════════════════════════════════════════════════
// Event formatters
// ═══════════════════════════════════════════════════════════════════════════

function formatNotificationMessage(payload: NotificationPayload): FormattedMessage {
  const { event_type, data } = payload
  const groupLink = data.group_id ? `${PLATFORM_URL}/grup-details.html?id=${data.group_id}` : PLATFORM_URL
  const profileLink = data.user_id ? `${PLATFORM_URL}/profile-view-new.html?id=${data.user_id}` : PLATFORM_URL

  switch (event_type) {
    
    // ─── Invitations ───────────────────────────────────────────────────────
    
    case 'invitation_sent': {
      const groupName = data.group_name || 'un grup'
      const inviterName = data.invited_by || 'Un membru'
      const inviteLink = data.invite_link || PLATFORM_URL
      
      const title = `Ai fost invitat/ă în grupul „${groupName}" pe ApartamenTUal`
      const body = `${inviterName} te-a invitat să te alături grupului „${groupName}" pe ApartamenTUal. Deschide linkul pentru a vedea detaliile: ${inviteLink}`
      const html = buildEmailHtml({
        headerEmoji: '🎉',
        headerTitle: 'Ai primit o invitație!',
        intro: 'Salut!',
        bodyParagraphs: [
          `<strong>${inviterName}</strong> te-a invitat să te alături grupului <strong style="color: #c2604a;">„${groupName}"</strong> pe ApartamenTUal — platforma unde oameni construiesc împreună blocuri și apartamente, împărțind costurile.`,
          'Apasă butonul de mai jos ca să vezi detaliile grupului și să decizi dacă vrei să te alături:',
        ],
        ctaLink: inviteLink,
        ctaLabel: 'Vezi grupul și răspunde',
        footerNote: `Pe pagina grupului vei putea vedea descrierea, membrii, zonele de interes, și vei avea opțiunea să accepți sau să respingi invitația. Dacă nu ai cont încă pe ApartamenTUal, vei fi invitat/ă să-ți creezi unul înainte să poți răspunde invitației.<br><br>Dacă butonul nu funcționează, copiază acest link în browser:<br><a href="${inviteLink}" style="color: #c2604a; word-break: break-all;">${inviteLink}</a>`,
      })
      return { title, body, html }
    }

    case 'member_invited_someone': {
      const groupName = data.group_name || 'grupul tău'
      const inviterName = data.invited_by || 'Un membru'
      const invitedName = data.invited_name || 'cineva'
      const title = `${inviterName} a invitat pe cineva în „${groupName}"`
      const body = `${inviterName} a trimis o invitație către ${invitedName} pentru grupul „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '📨',
        headerTitle: 'O nouă invitație a fost trimisă în grupul tău',
        bodyParagraphs: [
          `<strong>${inviterName}</strong> (membru în grupul tău) a trimis o invitație către <strong>${invitedName}</strong> pentru grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
          'Invitația a fost creată și invitatul a primit un email cu link de acceptare. Când va accepta, cererea lui va apărea automat pe pagina grupului pentru aprobare din partea ta (pentru că invitația vine de la un membru obișnuit, nu direct de la admin).',
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'join_request_admin_email': {
      const groupName = data.group_name || 'grupul tău'
      const userName = data.user_name || data.user_email || 'Un utilizator'
      const userEmail = data.user_email || ''
      const title = `Cerere de alăturare în „${groupName}" — ${userName}`
      const body = `${userName} (${userEmail}) a acceptat o invitație și așteaptă aprobarea ta pentru a intra în grupul „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '👋',
        headerTitle: 'O nouă cerere de alăturare',
        bodyParagraphs: [
          `<strong>${userName}</strong> a acceptat o invitație și așteaptă aprobarea ta pentru a intra în grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
          'Pentru că invitația a fost trimisă de un membru obișnuit (nu direct de tine), cererea trebuie aprobată de tine ca admin înainte ca persoana să devină membru activ.',
        ],
        detailsList: [
          { label: 'Utilizator', value: userName },
          { label: 'Email', value: userEmail || 'N/A' },
          { label: 'Grup', value: groupName },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi cererea în grup',
        footerNote: 'Pe pagina grupului vei vedea cererea în banner-ul de sus, unde poți să o aprobi sau să o respingi cu un click.',
      })
      return { title, body, html }
    }

    // ─── Group lifecycle ───────────────────────────────────────────────────

    case 'group_created':
    case 'grup_created': {
      const groupName = data.nume || data.group_name || 'un grup nou'
      // Acceptăm și numele trimise de frontend (grup-nou.html): created_by pentru
      // creator și oras pentru zonă. Fără asta, ambele apăreau „N/A" în email.
      const ownerEmail = data.owner_email || data.creator_email || data.created_by || 'N/A'
      const zona = data.zona || data.oras || 'N/A'
      const maxMembers = data.max_members || data.max_membri || 'N/A'
      const title = `✨ Grup nou creat: „${groupName}"`
      const body = `Un nou grup a fost creat pe platformă: ${groupName} (zona ${zona}, max ${maxMembers} membri). Creator: ${ownerEmail}`
      const html = buildEmailHtml({
        headerEmoji: '✨',
        headerTitle: 'Grup nou pe platformă',
        bodyParagraphs: [
          `Un nou grup a fost creat: <strong style="color: #c2604a;">„${groupName}"</strong>`,
        ],
        detailsList: [
          { label: 'Nume grup', value: groupName },
          { label: 'Zona', value: zona },
          { label: 'Max membri', value: String(maxMembers) },
          { label: 'Creator', value: ownerEmail },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'group_updated':
    case 'grup_updated': {
      const groupName = data.nume || data.group_name || 'un grup'
      const ownerEmail = data.owner_email || 'N/A'
      const title = `📝 Grup actualizat: „${groupName}"`
      const body = `Grupul „${groupName}" a fost actualizat de ${ownerEmail}.`
      const html = buildEmailHtml({
        headerEmoji: '📝',
        headerTitle: 'Un grup a fost actualizat',
        bodyParagraphs: [
          `Grupul <strong style="color: #c2604a;">„${groupName}"</strong> a fost modificat (nume, descriere sau status).`,
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: 'Modificat de', value: ownerEmail },
          { label: 'Status curent', value: data.status || 'N/A' },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'join_request': {
      const groupName = data.group_name || data.grup_nume || 'un grup'
      const userName = data.user_name || data.user_email || 'un utilizator'
      const title = `👋 Cerere de alăturare în „${groupName}"`
      const body = `${userName} a cerut să se alăture grupului „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '👋',
        headerTitle: 'Cerere nouă de alăturare',
        bodyParagraphs: [
          `<strong>${userName}</strong> a cerut să se alăture grupului <strong style="color: #c2604a;">„${groupName}"</strong>.`,
        ],
        detailsList: [
          { label: 'Utilizator', value: userName },
          { label: 'Email', value: data.user_email || 'N/A' },
          { label: 'Grup', value: groupName },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi cererea în grup',
      })
      return { title, body, html }
    }

    case 'member_approved': {
      const groupName = data.group_name || data.grup_nume || 'un grup'
      const userName = data.user_name || data.user_email || 'un utilizator'
      const title = `✅ Membru aprobat în „${groupName}"`
      const body = `${userName} a fost aprobat ca membru în „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '✅',
        headerTitle: 'Membru aprobat în grup',
        bodyParagraphs: [
          `<strong>${userName}</strong> a fost aprobat ca membru în grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
        ],
        detailsList: [
          { label: 'Utilizator', value: userName },
          { label: 'Grup', value: groupName },
          { label: 'Aprobat de', value: data.approved_by_email || 'admin' },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'member_joined': {
      const groupName = data.group_name || 'un grup'
      const userName = data.user_name || data.user_email || 'Un nou membru'
      const title = `🎉 ${userName} s-a alăturat grupului „${groupName}"`
      const body = `${userName} a acceptat invitația și s-a alăturat grupului „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '🎉',
        headerTitle: 'Un nou membru s-a alăturat grupului',
        bodyParagraphs: [
          `<strong>${userName}</strong> a acceptat o invitație și s-a alăturat grupului <strong style="color: #c2604a;">„${groupName}"</strong>.`,
          'Îl/o poți saluta în grupul de WhatsApp sau pe pagina grupului.',
        ],
        detailsList: [
          { label: 'Nou membru', value: userName },
          { label: 'Email', value: data.user_email || 'N/A' },
          { label: 'Grup', value: groupName },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'group_full': {
      const groupName = data.group_name || data.grup_nume || 'un grup'
      const maxM = data.max_membri || data.max || 'maximul stabilit'
      const title = `👥 Grupul „${groupName}" a atins numărul maxim de membri`
      const body = `Grupul „${groupName}" a atins numărul maxim de membri (${maxM}). Noi cereri nu mai pot fi aprobate până nu mărești plafonul din editarea grupului.`
      const html = buildEmailHtml({
        headerEmoji: '👥',
        headerTitle: 'Grupul a atins numărul maxim de membri',
        bodyParagraphs: [
          `Grupul <strong style="color: #c2604a;">„${groupName}"</strong> a atins numărul maxim de membri (<strong>${maxM}</strong>).`,
          'Nu mai poți aproba cereri noi până nu mărești plafonul. Dacă vrei mai mulți membri, deschide grupul, apasă „Editează" și crește numărul maxim de membri.',
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: 'Număr maxim', value: String(maxM) },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    // ─── Link WhatsApp de grup ─────────────────────────────────────────────
    // Adminul a salvat (sau a schimbat) linkul conversației de WhatsApp a
    // grupului. Emailul merge la fiecare membru activ, ca să se poată alătura.
    case 'whatsapp_link_shared': {
      const groupName = data.group_name || 'grupul tău'
      const adminName = data.admin_name || 'Adminul grupului'
      const rawLink = (data.whatsapp_link || '').toString().trim()
      // Protecție minimă: punem în buton doar linkuri http(s), ca un
      // „javascript:..." scris din greșeală în câmpul din admin să nu ajungă
      // ca href în emailul membrilor.
      const safeLink = /^https?:\/\//i.test(rawLink) ? rawLink : ''
      const isUpdate = data.is_update === true
      // Când linkul a fost salvat din pagina de editare a grupului odată cu alte
      // modificări (nume, descriere, oraș, plafon, status), trimitem un SINGUR
      // email — acesta — și menționăm aici că s-au schimbat și alte detalii.
      const alsoUpdated = data.also_updated === true

      const title = isUpdate
        ? `💬 Link WhatsApp actualizat — grupul „${groupName}"`
        : `💬 Grupul „${groupName}" are acum o conversație pe WhatsApp`
      const body = isUpdate
        ? `${adminName} a actualizat linkul conversației de WhatsApp pentru grupul „${groupName}": ${rawLink}`
        : `${adminName} a adăugat o conversație de WhatsApp pentru grupul „${groupName}": ${rawLink}`
      const html = buildEmailHtml({
        headerEmoji: '💬',
        headerTitle: isUpdate
          ? 'Linkul de WhatsApp al grupului s-a schimbat'
          : 'Grupul tău are acum o conversație pe WhatsApp',
        bodyParagraphs: [
          isUpdate
            ? `<strong>${adminName}</strong> a actualizat linkul conversației de WhatsApp a grupului <strong style="color: #c2604a;">„${groupName}"</strong>. Linkul vechi s-ar putea să nu mai funcționeze — folosește-l pe cel de mai jos.`
            : `<strong>${adminName}</strong> a deschis o conversație pe WhatsApp pentru grupul <strong style="color: #c2604a;">„${groupName}"</strong>, ca discuțiile de zi cu zi să fie mai simple.`,
          'Apasă butonul de mai jos ca să intri în conversație:',
          ...(alsoUpdated
            ? ['<em>Notă: în aceeași salvare au fost actualizate și alte detalii ale grupului (nume, descriere, oraș, număr maxim de membri sau modul de alăturare). Le poți vedea pe pagina grupului.</em>']
            : []),
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: 'Adăugat de', value: adminName },
        ],
        ctaLink: safeLink || groupLink,
        ctaLabel: safeLink ? 'Intră în grupul de WhatsApp' : 'Vezi grupul pe platformă',
        footerNote: safeLink
          ? `Dacă butonul nu funcționează, copiază acest link în browser:<br><a href="${safeLink}" style="color: #c2604a; word-break: break-all;">${safeLink}</a><br><br>Linkul e pentru membrii grupului — te rugăm să nu îl distribui în afara lui. Îl găsești oricând și pe <a href="${groupLink}" style="color: #c2604a;">pagina grupului</a>.`
          : `Linkul îl găsești pe <a href="${groupLink}" style="color: #c2604a;">pagina grupului</a>.`,
      })
      return { title, body, html }
    }

    // Digestul zilnic de anunțuri, trimis seara la 19:00 de edge function-ul
    // `digest-anunturi-grup`. Un singur apel per grup, cu `recipient_user_ids`.
    //
    // Emailul spune CÂTE mesaje sunt și primele cuvinte din ultimul — atât.
    // Textul integral rămâne pe platformă, intenționat: emailul e un semnal
    // („merită să intri"), nu un înlocuitor al paginii de grup.
    case 'anunturi_digest': {
      const groupName = data.group_name || 'grupul tău'
      const numar = Math.max(1, Number(data.numar_anunturi) || 1)
      const autor = data.autor_ultim || 'Un membru'
      // Textul e scris de utilizatori și intră în HTML — trebuie scăpat.
      const preview = data.preview_ultim
        ? formatMultilineText(String(data.preview_ultim))
        : ''

      // Numeralul în românește: 1 mesaj / 3 mesaje / 21 DE mesaje.
      const cateMesaje = numar === 1
        ? 'un mesaj nou'
        : numar < 20
          ? `${numar} mesaje noi`
          : `${numar} de mesaje noi`

      const title = numar === 1
        ? `📣 Un mesaj nou în grupul „${groupName}"`
        : `📣 ${numar < 20 ? numar : `${numar} de`} mesaje noi în grupul „${groupName}"`
      const body = `Azi s-a scris în grupul „${groupName}": ${cateMesaje}. Ultimul, de la ${autor}: „${data.preview_ultim || ''}"`

      const html = buildEmailHtml({
        headerEmoji: '📣',
        headerTitle: numar === 1 ? 'Ai un mesaj nou pe grup' : 'Ai mesaje noi pe grup',
        bodyParagraphs: [
          `Azi s-${numar === 1 ? 'a' : 'au'} scris <strong>${cateMesaje}</strong> în grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
          ...(preview
            ? [`Ultimul, de la <strong>${autor}</strong>:<br><em style="color: #5a5a5a;">„${preview}"</em>`]
            : []),
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: numar === 1 ? 'Mesaj nou' : 'Mesaje noi', value: String(numar) },
          { label: 'Ultimul scris de', value: autor },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Citește pe pagina grupului',
        footerNote:
          'Primești acest email o dată pe zi, seara, și doar în zilele în care cineva a scris ceva pe grupul tău. ' +
          `Dacă nu vrei să-l mai primești, debifează-l în <a href="${PLATFORM_URL}/profile-edit-new.html" style="color: #c2604a;">profilul tău</a>, la „Notificări pe email".`,
      })
      return { title, body, html }
    }

    case 'terenuri_noi_zone': {
      // Un apel per persoană — zonele lui, terenurile lui, cifrele lui.
      // ⚠️ Spre deosebire de `anunturi_digest`, care trimite ACELAȘI text unui
      // grup întreg dintr-un singur apel, aici fiecare om primește alt email.
      // De aceea evenimentul e în SKIP_SLACK.
      const nume = String(data.nume || '').trim()
      const terenuri: TerenDinLot[] = Array.isArray(data.terenuri) ? data.terenuri : []
      const zone = [data.zona_1, data.zona_2, data.zona_3].filter(Boolean).map(String)
      const totalTerenuri = Number(data.total_terenuri) || terenuri.length
      const totalZone = Number(data.total_zone_cu_terenuri) || zone.length
      const textZona1 = String(data.terenuri_1_text || textTerenuri(totalTerenuri))

      // Subiectul: „3 terenuri noi în Tineretului". Se schimbă singur de la o
      // săptămână la alta (altă zonă, altă cifră), ceea ce contează la un email
      // recurent — un subiect fix ajunge să arate ca un abonament nedorit.
      const title = zone.length > 0
        ? `${textZona1} în ${zone[0]}`
        : 'Terenuri noi în zonele tale'

      // ⚠️ NICIO mențiune de perioadă („săptămâna asta", „ultimele 7 zile").
      // Fereastra e per persoană, de la ultima trimitere către el, cu plafon la
      // 14 zile. Dacă o luni pică trimiterea, omul ar primi „săptămâna asta"
      // pentru terenuri vechi de 12 zile.
      const listaZone = zone.length > 1
        ? `${zone.slice(0, -1).map(escHtml).join(', ')} și ${escHtml(zone[zone.length - 1])}`
        : escHtml(zone[0] || '')
      const zoneRamase = totalZone > zone.length ? totalZone - zone.length : 0

      const intro = totalZone <= 1
        ? `Au apărut <strong style="color:#1a1a1a;">${escHtml(textZona1)}</strong> în <strong style="color:#1a1a1a;">${listaZone}</strong>, una dintre zonele pe care le-ai bifat în profil.`
        : `Au apărut <strong style="color:#1a1a1a;">${textTerenuri(totalTerenuri)}</strong> în ${totalZone} dintre zonele pe care le-ai bifat în profil: ${listaZone}${zoneRamase > 0 ? `, plus încă ${zoneRamase}` : ''}.`

      // Cârligul: o frază, imediat sub „au apărut…", înainte de terenuri.
      // ⚠️ Blocul mare despre analiză stă la mijlocul emailului, iar cine se
      // oprește după primele trei terenuri nu ajunge la el. Fraza asta îi spune
      // devreme că se poate afla ce se construiește pe teren, și trimite în jos.
      // ⚠️ Prețul apare de două ori în email, decizia lui Lucian din 14 august.
      // Ca să nu sune insistent, doar aici e anunțat („Costă X"); mai jos e o
      // simplă linie de fapt, care adaugă TVA-ul și mențiunea de lansare.
      // În cod rămâne o singură constantă, deci noiembrie e tot o linie.
      const carlig = `Pe oricare dintre ele poți cere o analiză de arhitect, ca să afli câte apartamente se pot construi acolo și la ce cost estimativ pe mp. Costă ${PRET_ANALIZA}, TVA inclus.`

      const cuPoza = terenuri.slice(0, CATE_CU_POZA)
      const restul = terenuri.slice(CATE_CU_POZA)

      const cardsHtml = cuPoza.map(cardTeren).join('')
      // ⚠️ „Restul terenurilor", nu „Și restul": lista vine acum după blocurile
      // explicative, deci nu se mai lipește de cardurile de deasupra.
      const listaHtml = restul.length > 0
        ? `<p style="margin:24px 0 8px;font-size:15px;line-height:1.6;">Restul terenurilor noi, pe scurt:</p>
           <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px;">
             ${restul.map(linieTeren).join('')}
           </table>`
        : ''

      const p = (t: string) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${t}</p>`

      // ✅ „Fă un grup pe terenul acesta" a devenit adevărat pe 14 august
      // (Piesa 5, commit `2c560b1`): pagina terenului are butonul, iar
      // `grup-nou.html` citește `?teren=` și pune terenul la favoritele
      // grupului nou. Până atunci era singura promisiune neacoperită din email.
      //
      // ⚠️ Ce NU scrie textul, fiindcă nu există în cod (verificat 13 august):
      //   • „filtrează pagina după zonele tale" — filtrul acela nu există, iar
      //     `js/terenuri.js` nu citește parametri din URL. De asta emailul dă
      //     linkuri directe, nu instrucțiuni de căutare;
      //   • „terenul devine al grupului" — butonul din pagina terenului scrie
      //     în `terenuri_likes_grupuri`, adică în FAVORITELE grupului.
      const html = `
        <div style="font-family:'Mona Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#faf8f3;color:#555555;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Le-am adăugat pe platformă de la ultimul email încoace.</div>
          <div style="text-align:center;padding:24px 0;border-bottom:1px solid #e8e3d8;">
            <h1 style="margin:0;font-size:22px;color:#1a1a1a;font-weight:600;">
              apartamen<span style="color:#c2604a;">TU</span>al
            </h1>
            <p style="margin:4px 0 0;font-size:12px;color:#8a8a8a;">by LTFB studio</p>
          </div>
          <div style="padding:32px 8px;">
            ${p(nume ? `Bună, ${escHtml(nume)},` : 'Bună,')}
            ${p(intro)}
            ${p(carlig)}
            <div style="margin:0 0 24px;">
              <a href="${PLATFORM_URL}/analize.html" style="display:inline-block;border:2px solid #c2604a;color:#c2604a;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:14px;">Vezi ce conține analiza →</a>
            </div>
            ${cardsHtml}
            <p style="margin:28px 0 8px;font-size:16px;font-weight:600;color:#1a1a1a;">Ce nu scrie pe nicio pagină de teren</p>
            ${p(`Suprafața și prețul le vezi și la noi, și în anunțul original. Ce nu vezi nicăieri e <strong style="color:#1a1a1a;">câte apartamente se pot construi acolo și cât ar costa un apartament pe terenul acela</strong>: cost pe mp construit, cost pe mp util și cât te costă terenul pentru un apartament de o anumită suprafață. Asta face analiza de arhitect, în mai multe variante de împărțire în apartamente. <strong style="color:#1a1a1a;">${PRET_ANALIZA}</strong>, ${PRET_MENTIUNE}. Se comandă din pagina terenului.`)}
            <p style="margin:24px 0 8px;font-size:16px;font-weight:600;color:#1a1a1a;">Dacă vreunul îți place</p>
            ${p('Toate pornesc din pagina terenului:')}
            ${liniute([
              '<strong style="color:#1a1a1a;">Adaugă-l la profilul tău.</strong> Nu te obligă la nimic, dar ceilalți văd că cineva e interesat de el și te pot invita într-un grup.',
              '<strong style="color:#1a1a1a;">Vezi cine mai e interesat.</strong> Pagina îți arată câți sunt. Intri pe profilul oricăruia și de acolo poți face un grup și îl inviți.',
              '<strong style="color:#1a1a1a;">Vezi ce grupuri sunt interesate de el.</strong> Dacă vreunul ți se potrivește, poți cere alăturarea; odată intrat, puteți comenta chiar sub teren, pe pagina grupului.',
              '<strong style="color:#1a1a1a;">Dacă ești deja într-un grup</strong>, adaugă terenul la favoritele lui: îl vede toată lumea și comentați pe el acolo.',
              // ✅ Butonul există din 14 august (Piesa 5), pe pagina terenului.
              // Liniuța fusese scrisă pe 13 august, înaintea lui, ca decizie
              // asumată; de atunci a devenit adevărată.
              '<strong style="color:#1a1a1a;">Fă un grup pe terenul acesta.</strong> Majoritatea grupurilor pornesc exact așa, de la un teren pe care l-a găsit cineva primul.',
            ])}
            ${listaHtml}
            <div style="text-align:center;margin:28px 0;">
              <a href="${PLATFORM_URL}/terenuri.html" style="display:inline-block;border:2px solid #c2604a;color:#c2604a;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
                Vezi toate terenurile
              </a>
            </div>
            ${p('Dacă acum niciunul nu ți se potrivește, nu trebuie să faci nimic. Îți scriem din nou când mai apar terenuri în zonele tale.')}
            <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
              Lucian<br>ApartamenTUal / LTFB Studio
            </p>
          </div>
          <div style="border-top:1px solid #e8e3d8;padding:20px 8px 0;">
            <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#8a8a8a;">
              Primești acest email pentru că ai bifat în profil zonele în care ai vrea să locuiești, iar în ele au apărut terenuri noi. Îți scriem doar în săptămânile în care chiar apare ceva. Dacă nu vrei să-l mai primești, debifează „Terenuri noi în zonele mele" în <a href="${PLATFORM_URL}/profile-edit-new.html" style="color:#c2604a;">profilul tău</a>.
            </p>
            <p style="margin:0;font-size:13px;color:#8a8a8a;text-align:center;">
              <a href="${PLATFORM_URL}" style="color:#c2604a;text-decoration:none;">apartamentual.ro</a>
            </p>
          </div>
        </div>`

      // Rezumatul care ajunge în `notification_log`. Slack e sărit la
      // evenimentul ăsta, deci `body` e strict pentru jurnal și depanare.
      const body = `${nume || 'destinatar'}: ${totalTerenuri} terenuri noi în ${totalZone} zone (${zone.join(', ')}), ${terenuri.length} în email.`

      return { title, body, html }
    }

    case 'member_rejected': {
      const groupName = data.group_name || data.grup_nume || 'un grup'
      const userName = data.user_name || data.user_email || 'un utilizator'
      const title = `❌ Cerere respinsă în „${groupName}"`
      const body = `Cererea lui ${userName} pentru „${groupName}" a fost respinsă.`
      const html = buildEmailHtml({
        headerEmoji: '❌',
        headerTitle: 'Cerere de alăturare respinsă',
        bodyParagraphs: [
          `Cererea lui <strong>${userName}</strong> de a se alătura grupului <strong style="color: #c2604a;">„${groupName}"</strong> a fost respinsă de admin.`,
        ],
        detailsList: [
          { label: 'Utilizator', value: userName },
          { label: 'Grup', value: groupName },
        ],
      })
      return { title, body, html }
    }

    case 'member_left': {
      const groupName = data.group_name || 'un grup'
      const userName = data.user_name || data.user_email || 'Un membru'
      const title = `👋 ${userName} a părăsit grupul „${groupName}"`
      const body = `${userName} a părăsit voluntar grupul „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '👋',
        headerTitle: 'Un membru a părăsit grupul',
        bodyParagraphs: [
          `<strong>${userName}</strong> a părăsit voluntar grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
        ],
        detailsList: [
          { label: 'Membru', value: userName },
          { label: 'Email', value: data.user_email || 'N/A' },
          { label: 'Grup', value: groupName },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'member_removed': {
      const groupName = data.group_name || 'un grup'
      const userName = data.user_name || data.user_email || 'Un membru'
      const reason = data.reason || 'vot de excludere'
      const title = `🚫 ${userName} a fost eliminat din „${groupName}"`
      const body = `${userName} a fost eliminat din grupul „${groupName}" (${reason}).`
      const html = buildEmailHtml({
        headerEmoji: '🚫',
        headerTitle: 'Un membru a fost eliminat',
        bodyParagraphs: [
          `<strong>${userName}</strong> a fost eliminat din grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
        ],
        detailsList: [
          { label: 'Membru eliminat', value: userName },
          { label: 'Grup', value: groupName },
          { label: 'Motiv', value: reason },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'admin_transferred': {
      const groupName = data.group_name || 'un grup'
      const oldAdmin = data.old_admin_name || data.old_admin_email || 'adminul precedent'
      const newAdmin = data.new_admin_name || data.new_admin_email || 'noul admin'
      const title = `🔄 Admin schimbat în „${groupName}"`
      const body = `Rolul de admin al grupului „${groupName}" a fost transferat de la ${oldAdmin} la ${newAdmin}.`
      const html = buildEmailHtml({
        headerEmoji: '🔄',
        headerTitle: 'Admin transferat',
        bodyParagraphs: [
          `Rolul de administrator al grupului <strong style="color: #c2604a;">„${groupName}"</strong> a fost transferat.`,
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: 'Admin precedent', value: oldAdmin },
          { label: 'Admin nou', value: newAdmin },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    // ─── Kick votes ────────────────────────────────────────────────────────

    case 'kick_vote_initiated': {
      const groupName = data.group_name || 'un grup'
      const targetName = data.target_name || data.target_email || 'un membru'
      const initiatorName = data.initiator_name || 'un membru'
      const title = `⚖️ Vot de excludere inițiat în „${groupName}"`
      const body = `${initiatorName} a inițiat un vot pentru excluderea lui ${targetName} din „${groupName}".`
      const html = buildEmailHtml({
        headerEmoji: '⚖️',
        headerTitle: 'Vot de excludere inițiat',
        bodyParagraphs: [
          `<strong>${initiatorName}</strong> a inițiat un vot pentru excluderea lui <strong>${targetName}</strong> din grupul <strong style="color: #c2604a;">„${groupName}"</strong>.`,
          data.reason ? `<em>Motiv: ${data.reason}</em>` : 'Ceilalți membri ai grupului vor vota dacă excluderea se aprobă sau nu.',
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: 'Membru vizat', value: targetName },
          { label: 'Inițiator', value: initiatorName },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    case 'kick_vote_result': {
      const groupName = data.group_name || 'un grup'
      const targetName = data.target_name || data.target_email || 'un membru'
      const result = data.result || 'decis' // 'kicked' or 'survived'
      const resultText = result === 'kicked' ? 'a fost eliminat' : 'rămâne în grup'
      const emoji = result === 'kicked' ? '🚫' : '✅'
      const title = `${emoji} Rezultat vot de excludere în „${groupName}"`
      const body = `Votul de excludere pentru ${targetName} în „${groupName}" s-a încheiat: ${targetName} ${resultText}.`
      const html = buildEmailHtml({
        headerEmoji: emoji,
        headerTitle: 'Vot de excludere încheiat',
        bodyParagraphs: [
          `Votul de excludere pentru <strong>${targetName}</strong> în grupul <strong style="color: #c2604a;">„${groupName}"</strong> s-a încheiat.`,
          `<strong>${targetName} ${resultText}.</strong>`,
        ],
        detailsList: [
          { label: 'Grup', value: groupName },
          { label: 'Membru vizat', value: targetName },
          { label: 'Rezultat', value: result === 'kicked' ? 'Eliminat' : 'Rămâne în grup' },
          { label: 'Voturi pentru', value: String(data.votes_for || 'N/A') },
          { label: 'Voturi împotrivă', value: String(data.votes_against || 'N/A') },
        ],
        ctaLink: groupLink,
        ctaLabel: 'Vezi grupul',
      })
      return { title, body, html }
    }

    // ─── Account lifecycle ────────────────────────────────────────────────

    case 'new_user': {
      const isAgency = data.account_type === 'profesional'
      if (isAgency) {
        const title = '🏢 Cerere nouă de agenție - necesită aprobare'
        const body = `O nouă agenție imobiliară s-a înregistrat și așteaptă aprobare. Email: ${data.email}, Nume: ${data.agency_name}`
        const html = buildEmailHtml({
          headerEmoji: '🏢',
          headerTitle: 'Cerere nouă de agenție',
          intro: 'O nouă agenție imobiliară s-a înregistrat pe platformă și așteaptă aprobarea ta.',
          detailsList: [
            { label: 'Email', value: data.email || 'N/A' },
            { label: 'Nume agenție', value: data.agency_name || 'N/A' },
            { label: 'Website', value: data.agency_website || 'N/A' },
            { label: 'User ID', value: data.user_id || 'N/A' },
          ],
          ctaLink: `${PLATFORM_URL}/admin-utilizatori.html`,
          ctaLabel: 'Aprobă din admin panel',
          footerNote: 'Agenția nu va putea publica terenuri până când nu o aprobi din panoul de admin (filtrul „Pending aprobare").',
        })
        return { title, body, html }
      }
      const title = '🎉 Utilizator nou înregistrat'
      const body = `Un nou utilizator s-a înregistrat: ${data.email}`
      const html = buildEmailHtml({
        headerEmoji: '🎉',
        headerTitle: 'Utilizator nou înregistrat',
        intro: 'Un nou utilizator s-a înregistrat și și-a confirmat emailul.',
        detailsList: [
          { label: 'Email', value: data.email || 'N/A' },
          { label: 'User ID', value: data.user_id || 'N/A' },
          { label: 'Tip cont', value: 'Utilizator activ' },
        ],
        ctaLink: profileLink,
        ctaLabel: 'Vezi profilul',
      })
      return { title, body, html }
    }

    case 'account_suspended': {
      const userName = data.user_name || data.email || 'Un utilizator'
      const title = `⏸️ Cont suspendat: ${userName}`
      const body = `Contul ${userName} a fost suspendat.`
      const html = buildEmailHtml({
        headerEmoji: '⏸️',
        headerTitle: 'Cont suspendat',
        bodyParagraphs: [
          `Contul <strong>${userName}</strong> a fost suspendat.`,
        ],
        detailsList: [
          { label: 'Utilizator', value: userName },
          { label: 'Email', value: data.email || 'N/A' },
          { label: 'Suspendat până la', value: data.suspended_until || 'N/A' },
          { label: 'Motiv', value: data.reason || 'N/A' },
        ],
        ctaLink: `${PLATFORM_URL}/admin-utilizatori.html`,
        ctaLabel: 'Vezi utilizatorii',
      })
      return { title, body, html }
    }

    case 'account_reactivated': {
      const userName = data.user_name || data.email || 'Un utilizator'
      // This one is dual-purpose: if sent to the user themselves, it's a welcome message.
      // If sent to the superadmin as a cc, it's informational.
      const title = `✅ Contul tău a fost aprobat!`
      const body = `Salut${userName ? ' ' + userName : ''}! Contul tău pe ApartamenTUal a fost aprobat de un administrator.`
      const html = buildEmailHtml({
        headerEmoji: '✅',
        headerTitle: 'Contul tău a fost aprobat!',
        intro: `Salut${userName ? ' ' + userName : ''}!`,
        bodyParagraphs: [
          'Avem o veste bună: contul tău pe ApartamenTUal a fost aprobat de un administrator.',
          'Acum poți să publici terenuri și să folosești toate funcționalitățile platformei pentru agenții imobiliare.',
        ],
        ctaLink: PLATFORM_URL,
        ctaLabel: 'Intră în cont',
        footerNote: 'Mulțumim că ești parte din comunitatea noastră!',
      })
      return { title, body, html }
    }

    case 'account_deleted': {
      const userName = data.user_name || data.email || 'Un utilizator'
      const title = `🗑️ Cont șters: ${userName}`
      const body = `Contul ${userName} a fost șters.`
      const html = buildEmailHtml({
        headerEmoji: '🗑️',
        headerTitle: 'Cont șters de pe platformă',
        bodyParagraphs: [
          `Contul <strong>${userName}</strong> a fost șters.`,
        ],
        detailsList: [
          { label: 'Utilizator', value: userName },
          { label: 'Email', value: data.email || 'N/A' },
          { label: 'Șters de', value: data.deleted_by || 'self' },
        ],
      })
      return { title, body, html }
    }

    // ─── Content events ──────────────────────────────────────────────────

    case 'terrain_proposed':
    case 'teren_created': {
      const title = `🏞️ Teren nou propus: ${data.titlu || 'fără titlu'}`
      const body = `Un nou teren a fost propus: ${data.titlu}, zona ${data.zona}, suprafață ${data.suprafata} mp. Propus de ${data.creator_email || 'N/A'}`
      const html = buildEmailHtml({
        headerEmoji: '🏞️',
        headerTitle: 'Teren nou propus',
        intro: 'Un nou teren a fost adăugat pe platformă.',
        detailsList: [
          { label: 'Titlu', value: data.titlu || 'N/A' },
          { label: 'Zonă', value: data.zona || 'N/A' },
          { label: 'Suprafață', value: data.suprafata ? `${data.suprafata} m²` : 'N/A' },
          { label: 'Propus de', value: data.creator_email || 'N/A' },
        ],
        ctaLink: data.id ? `${PLATFORM_URL}/teren-details.html?id=${data.id}` : `${PLATFORM_URL}/terenuri.html`,
        ctaLabel: 'Vezi terenul',
      })
      return { title, body, html }
    }

    case 'partner_application': {
      // Etichete lizibile pentru categorie (trebuie să corespundă cu cele din
      // formularul devino-partener.html).
      const partnerCatLabels: Record<string, string> = {
        arhitectura: 'Arhitectură / Urbanism',
        design_interior: 'Design interior',
        constructii: 'Construcții',
        furnizori: 'Furnizori produse & finisaje',
        juridic: 'Avocatură / Consultanță juridică imobiliară',
        financiar: 'Consultanță financiară / Brokeri credite',
        agentii_imobiliare: 'Agenții imobiliare',
      }
      const companyName = data.company_name || data.name || 'N/A'
      const categoryRaw = data.category || data.domain || ''
      const categoryLabel = partnerCatLabels[categoryRaw] || categoryRaw || 'N/A'
      const description = data.description || data.message || 'N/A'

      const details = [
        { label: 'Nume/Companie', value: companyName },
        { label: 'Categorie', value: categoryLabel },
        { label: 'Email', value: data.email || 'N/A' },
        { label: 'Telefon', value: data.phone || 'N/A' },
        { label: 'Oraș', value: data.city || 'N/A' },
        { label: 'Website', value: data.website || 'N/A' },
        { label: 'Descriere', value: description },
      ]

      const title = `🤝 Cerere nouă de parteneriat`
      const body = `O nouă cerere de parteneriat: ${companyName} (${categoryLabel})`
      const html = buildEmailHtml({
        headerEmoji: '🤝',
        headerTitle: 'Cerere nouă de parteneriat',
        intro: 'Cineva a aplicat pentru a deveni partener al platformei. Cererea e salvată ca inactivă și așteaptă aprobarea ta din panoul de admin.',
        detailsList: details,
        ctaLink: `${PLATFORM_URL}/admin-parteneri.html`,
        ctaLabel: 'Vezi cererile din admin',
      })
      return { title, body, html }
    }

    case 'newsletter_signup': {
      const subEmail = data.email || 'N/A'
      const src = data.source || 'necunoscut'
      // Sunt două trasee de abonare, cu status DIFERIT în baza de date:
      //  • din footer / banda de pe homepage → 'pending', adresa nu e dovedită,
      //    abonatul primește email de confirmare (double opt-in) și intră în
      //    lista de trimitere abia după ce dă clic;
      //  • de la înregistrarea contului (sursă 'register') → 'confirmed' direct,
      //    fiindcă adresa e deja dovedită prin confirmarea contului, iar bifa de
      //    la înregistrare e consimțământul explicit. Contactul Resend se creează
      //    pe loc, deci abonatul e DEJA pe lista de trimitere.
      // Până acum notificarea spunea „pending" în ambele cazuri, ceea ce dădea
      // impresia falsă de abonări nefinalizate. `status` vine din
      // newsletter-subscribe; dacă lipsește, păstrăm comportamentul vechi.
      const isConfirmed = data.status === 'confirmed'
      const statusLabel = isConfirmed ? 'confirmat (activ pe listă)' : 'pending (neconfirmat)'
      const title = isConfirmed
        ? `📨 Newsletter: abonare nouă (confirmată)`
        : `📨 Newsletter: abonare nouă (pending)`
      const body = isConfirmed
        ? `O adresă nouă s-a abonat la newsletter, direct de la înregistrarea contului — adresa e deja confirmată și intră în lista de trimitere. Email: ${subEmail} · sursă: ${src}`
        : `O adresă nouă s-a abonat la newsletter și așteaptă confirmarea (double opt-in). Email: ${subEmail} · sursă: ${src}`
      const html = buildEmailHtml({
        headerEmoji: '📨',
        headerTitle: 'Abonare nouă la newsletter',
        intro: isConfirmed
          ? 'O adresă nouă s-a abonat la newsletter în timpul înregistrării contului. Adresa fiind deja confirmată prin linkul de activare a contului, abonarea e validă fără un al doilea email — abonatul e deja în lista de trimitere.'
          : 'O adresă nouă s-a abonat la newsletter și a primit emailul de confirmare (double opt-in). Va intra în lista de trimitere doar după ce confirmă.',
        detailsList: [
          { label: 'Email', value: subEmail },
          { label: 'Sursă', value: src },
          { label: 'Zonă interes', value: data.zone_interest || '—' },
          { label: 'Status', value: statusLabel },
        ],
        ctaLink: `${PLATFORM_URL}/admin-newsletter.html`,
        ctaLabel: 'Vezi abonații',
      })
      return { title, body, html }
    }

    case 'consultation_request': {
      const title = `💬 Cerere nouă de consultanță`
      const body = `O nouă cerere de consultanță de la ${data.name || data.email || 'un vizitator'}`
      const html = buildEmailHtml({
        headerEmoji: '💬',
        headerTitle: 'Cerere nouă de consultanță',
        intro: 'Un vizitator a solicitat consultanță prin formularul de pe platformă.',
        detailsList: [
          { label: 'Nume', value: data.name || 'N/A' },
          { label: 'Email', value: data.email || 'N/A' },
          { label: 'Telefon', value: data.phone || 'N/A' },
          { label: 'Subiect', value: data.subject || 'N/A' },
          { label: 'Mesaj', value: data.message || 'N/A' },
        ],
      })
      return { title, body, html }
    }

    // ─── Comenzi de analiză (plată via Oblio + Netopia) ───────────────────

    case 'comanda_creata': {
      const orderId = data.order_id || 'N/A'
      const numeClient = data.nume_client || 'N/A'
      const tipPersoana = data.tip_persoana === 'PJ' ? 'persoană juridică' : 'persoană fizică'
      const pret = data.pret ? `${data.pret} RON` : 'N/A'
      const proforma = data.proforma || 'N/A'
      const proformaUrl = data.proforma_url || ''
      const nrCadastral = (data.nr_cadastral || '').toString().trim()
      const adresaTeren = (data.adresa_teren || '').toString().trim()
      const linkTeren = (data.link_teren || '').toString().trim()
      // Descrierea e scrisă de client și e partea cea mai utilă din comandă.
      // O păstrăm aproape întreagă (plafon larg, doar ca protecție la emailuri
      // uriașe) și marcăm tăierea comparând cu lungimea reală, nu cu plafonul.
      const DESCRIERE_MAX = 2000
      const descriereRaw = (data.descriere_teren || '').toString().trim()
      const descriereTeren = descriereRaw.length > DESCRIERE_MAX
        ? descriereRaw.substring(0, DESCRIERE_MAX) + '…'
        : descriereRaw

      const title = `🛒 Comandă nouă — ${orderId} (așteaptă plată)`
      const body = `O comandă nouă a fost creată și așteaptă plata clientului. Comandă: ${orderId} | Client: ${numeClient} | Sumă: ${pret} | Nr. cadastral: ${nrCadastral || 'N/A'}`
      const html = buildEmailHtml({
        headerEmoji: '🛒',
        headerTitle: 'Comandă nouă — așteaptă plată',
        intro: 'O comandă pentru analiză preliminară a fost creată. Clientul a primit emailul cu proforma și butonul "Plătește cu cardul". Vei fi notificat din nou când plata e confirmată.',
        detailsList: [
          { label: 'Comandă', value: orderId },
          { label: 'Client', value: `${numeClient} (${tipPersoana})` },
          { label: 'Email client', value: data.email || 'N/A' },
          { label: 'Sumă (TVA inclus)', value: pret },
          { label: 'Proformă Oblio', value: proforma },
          { label: 'Nr. cadastral teren', value: nrCadastral || '—' },
          { label: 'Adresa teren', value: adresaTeren || '—' },
          buildTerenRow(linkTeren),
          { label: 'Descriere teren', value: descriereTeren ? formatMultilineText(descriereTeren) : 'N/A' },
        ],
        ctaLink: proformaUrl,
        ctaLabel: proformaUrl ? 'Vezi proforma' : undefined,
        footerNote: 'Status comandă: <strong>pending_payment</strong>. Vei primi un nou email când plata e confirmată automat de Oblio (după ce clientul plătește pe Netopia, factura fiscală este generată automat).',
      })
      return { title, body, html }
    }

    case 'comanda_platita': {
      const orderId = data.order_id || 'N/A'
      const numeClient = data.nume_client || 'N/A'
      const tipPersoana = data.tip_persoana === 'PJ' ? 'persoană juridică' : 'persoană fizică'
      const pret = data.pret ? `${data.pret} RON` : 'N/A'
      const factura = data.factura || 'În curs de generare'
      const nrCadastral = (data.nr_cadastral || '').toString().trim()
      const adresaTeren = (data.adresa_teren || '').toString().trim()
      const linkTeren = (data.link_teren || '').toString().trim()

      const title = `✅ Plată confirmată — ${orderId} | începe analiza`
      const body = `Plată confirmată pentru ${orderId}. Client: ${numeClient}. Sumă: ${pret}. Factură: ${factura}.`
      const html = buildEmailHtml({
        headerEmoji: '✅',
        headerTitle: 'Plată confirmată — începe analiza!',
        intro: 'O comandă a fost plătită cu succes pe Netopia. Oblio a generat automat factura fiscală și a trimis-o clientului. <strong>Acum e momentul să începi analiza preliminară.</strong>',
        detailsList: [
          { label: 'Comandă', value: orderId },
          { label: 'Client', value: `${numeClient} (${tipPersoana})` },
          { label: 'Email client', value: data.email || 'N/A' },
          { label: 'Sumă încasată', value: pret },
          { label: 'Factură fiscală', value: factura },
          { label: 'Nr. cadastral teren', value: nrCadastral || '—' },
          { label: 'Adresa teren', value: adresaTeren || '—' },
          buildTerenRow(linkTeren),
        ],
        bodyParagraphs: [
          '⏰ <strong>Termen livrare</strong>: 3-5 zile lucrătoare de la confirmarea plății.',
          'Verifică în Supabase tabelul <code>comenzi_analize</code> pentru detalii complete (descriere teren, link anunț, date facturare).',
        ],
        footerNote: 'Status comandă: <strong>paid</strong>. După ce livrezi PDF-ul cu analiza, marchezi manual <code>status = \'completed\'</code>.',
      })
      return { title, body, html }
    }

    // ─── Legacy/unchanged events preserved for backwards compat ───────────

    case 'user_signup':
      return {
        title: '🎉 New User Signup',
        body: `A new user has signed up!\n\nEmail: ${data.email || 'N/A'}\nUser ID: ${data.user_id || 'N/A'}\nCreated at: ${data.created_at || new Date().toISOString()}`
      }

    case 'teren_updated':
      return {
        title: '🔄 Teren Updated',
        body: `A teren (land) has been updated!\n\nTitle: ${data.titlu || 'N/A'}\nTeren ID: ${data.id || 'N/A'}\nUpdated by: ${data.updated_by || data.created_by_user_id || 'N/A'}\nStatus: ${data.status || 'N/A'}`
      }

    case 'membership_request':
      return {
        title: '👋 New Membership Request',
        body: `A user has requested to join a group!\n\nGroup: ${data.grup_nume || data.grup_id || 'N/A'}\nUser: ${data.user_email || data.user_id || 'N/A'}\nStatus: ${data.status || 'pending'}\nGroup ID: ${data.grup_id || 'N/A'}`
      }

    case 'membership_approved':
      return {
        title: '✅ Membership Approved',
        body: `A membership request has been approved!\n\nGroup: ${data.grup_nume || data.grup_id || 'N/A'}\nUser: ${data.user_email || data.user_id || 'N/A'}\nApproved by: ${data.approved_by_email || data.approved_by_user_id || 'N/A'}\nGroup ID: ${data.grup_id || 'N/A'}`
      }

    case 'profile_updated':
      return {
        title: '👤 Profile Updated',
        body: `A user profile has been updated!\n\nUser: ${data.email || data.user_id || 'N/A'}\nUser ID: ${data.user_id || 'N/A'}\nUpdated fields: ${data.updated_fields ? data.updated_fields.join(', ') : 'N/A'}`
      }

    default:
      return {
        title: `🔔 Site Event: ${event_type}`,
        body: `Event: ${event_type}\n\nData: ${JSON.stringify(data, null, 2)}`
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Logging în notification_log (pentru pagina de admin „Notificări")
// ═══════════════════════════════════════════════════════════════════════════
//
// Scrie un rând per canal (email / slack) după fiecare încercare de trimitere.
// Este BEST-EFFORT: orice eroare aici e prinsă și ignorată, ca logarea să NU
// blocheze vreodată trimiterea notificării reale. Folosește REST-ul PostgREST
// cu service_role (env-uri disponibile automat în edge functions), deci nu
// adaugă nicio dependință nouă. Coloanele id + created_at se completează
// automat de DB (default), deci nu le trimitem.

async function logNotification(row: {
  event_type: string
  channel: string
  recipient: string | null
  subject: string | null
  status: string
  payload: unknown
  // Textul erorii, când statusul e 'error'. Fără el, o notificare picată apărea
  // în admin doar ca „Eroare", fără niciun indiciu despre cauză — pe 26.07.2026
  // au picat 18 emailuri și motivul a trebuit dedus din tiparul orelor.
  error?: string | null
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return

    await fetch(`${supabaseUrl}/rest/v1/notification_log`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(row),
    })
  } catch (err) {
    // Non-fatal — nu blocăm notificarea dacă logarea eșuează
    console.error('notification_log insert failed (non-fatal):', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Rezolvarea adreselor pe server, pornind de la `user_id`
// ═══════════════════════════════════════════════════════════════════════════
//
// DE CE EXISTĂ. Până acum, paginile de grup își adunau în browser emailurile
// membrilor (`select('email').in('user_id', ...)`) și le pasau aici gata
// scrise. Asta cerea ca orice utilizator logat să aibă drept de citire pe
// coloana `email` din `profiles` — adică oricine își făcea cont putea
// descărca toate adresele platformei.
//
// De acum browserul trimite `user_id`-uri, iar adresele se rezolvă AICI, cu
// service role. Adresa nu mai trece niciodată prin browserul cuiva.
//
// ⚠ Nu e o breșă: funcția nu ÎNTOARCE adresele apelantului, doar trimite
// emailul la ele. Cine apelează nu află nimic.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()

  // Doar UUID-uri valide ajung în interogare — restul sunt ignorate, ca să nu
  // se poată strecura nimic în șirul `in.(...)`.
  const ids = [...new Set(userIds.filter((id) => typeof id === 'string' && UUID_RE.test(id)))]
  if (ids.length === 0) return found

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('resolveUserEmails: lipsesc SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return found
  }

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  }

  // Sursa principală: `profiles`, o singură cerere pentru toți.
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=user_id,email&user_id=in.(${ids.join(',')})`,
      { headers },
    )
    if (res.ok) {
      const rows = await res.json()
      for (const row of rows) {
        if (row?.user_id && row?.email) found.set(row.user_id, row.email)
      }
    } else {
      console.error('resolveUserEmails: profiles a răspuns', res.status, await res.text())
    }
  } catch (err) {
    console.error('resolveUserEmails: eroare la interogarea profiles:', err)
  }

  // Plasă de siguranță: cine n-are rând în `profiles` se caută în auth.
  // Există cel puțin un cont în situația asta (`fabian_224@yahoo.com`, găsit
  // pe 31 iulie), iar o notificare netrimisă în tăcere e exact tiparul de bug
  // care ne-a costat deja timp la Oblio.
  const lipsa = ids.filter((id) => !found.has(id))
  for (const id of lipsa) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { headers })
      if (res.ok) {
        const user = await res.json()
        if (user?.email) found.set(id, user.email)
      }
    } catch (err) {
      console.error(`resolveUserEmails: nu s-a putut rezolva ${id} din auth:`, err)
    }
  }

  const nerezolvate = ids.filter((id) => !found.has(id))
  if (nerezolvate.length > 0) {
    console.warn('resolveUserEmails: fără adresă pentru', nerezolvate.join(', '))
  }

  return found
}

// Completează câmpurile `*_email` din payload pornind de la `*_user_id`.
//
// Regula e mecanică, ca să nu fie nevoie de o listă de excepții:
//     user_id            → user_email
//     admin_user_id      → admin_email
//     target_user_id     → target_email
//     recipient_user_id  → recipient_email
//     old_admin_user_id  → old_admin_email        (și așa mai departe)
//
// Un câmp `*_email` trimis explicit de frontend NU se suprascrie — așa
// traseele vechi, nemodificate încă, merg mai departe exact ca înainte, iar
// migrarea paginilor se poate face pe rând, fără „big bang".
//
// În plus, `recipient_user_ids` (listă) devine `recipient_emails`, folosită
// pentru anunțurile către tot grupul: un singur apel din browser în loc de
// câte unul per membru.
async function hydrateEmailsFromUserIds(data: Record<string, any>): Promise<void> {
  const deRezolvat: string[] = []
  const perechi: Array<{ cheieEmail: string; userId: string }> = []

  for (const [cheie, valoare] of Object.entries(data)) {
    if (typeof valoare !== 'string' || !UUID_RE.test(valoare)) continue

    let cheieEmail: string | null = null
    if (cheie === 'user_id') cheieEmail = 'user_email'
    else if (cheie.endsWith('_user_id')) cheieEmail = `${cheie.slice(0, -'_user_id'.length)}_email`
    if (!cheieEmail) continue

    // Nu suprascriem ce a trimis deja frontendul.
    if (data[cheieEmail]) continue

    perechi.push({ cheieEmail, userId: valoare })
    deRezolvat.push(valoare)
  }

  const lista = Array.isArray(data.recipient_user_ids) ? data.recipient_user_ids : []
  deRezolvat.push(...lista)

  if (deRezolvat.length === 0) return

  const adrese = await resolveUserEmails(deRezolvat)

  for (const { cheieEmail, userId } of perechi) {
    const adresa = adrese.get(userId)
    if (adresa) data[cheieEmail] = adresa
  }

  if (lista.length > 0) {
    data.recipient_emails = lista.map((id: string) => adrese.get(id)).filter(Boolean)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trimiterea emailului, cu reîncercare când Resend ne refuză temporar
// ═══════════════════════════════════════════════════════════════════════════
//
// De ce e nevoie: broadcasturile (member_joined, group_updated,
// whatsapp_link_shared) pornesc din frontend câte un apel per membru, toate
// în aceeași milisecundă. Fiecare apel e o invocare separată a funcției, deci
// un POST separat la Resend. La un grup de 15 oameni înseamnă 15 cereri
// simultane, iar Resend respinge surplusul cu 429 („prea multe cereri").
// Pe 26.07.2026 s-au pierdut astfel 18 emailuri într-o singură minută, printre
// care și confirmarea de aprobare a unui membru.
//
// Soluția: reîncercăm de câteva ori, cu pauză crescătoare plus o componentă
// aleatoare. Aleatorul e esențial — fără el, toate invocările paralele ar
// reveni fix în același moment și s-ar lovi de aceeași limită.

const EMAIL_MAX_ATTEMPTS = 4
const EMAIL_BASE_DELAY_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Pauză crescătoare: ~0,4s, ~0,8s, ~1,6s, fiecare cu până la 300ms aleator.
function backoffDelay(attempt: number): number {
  return EMAIL_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300)
}

interface EmailSendResult {
  ok: boolean
  error?: string
  attempts: number
}

async function sendEmailWithRetry(apiKey: string, body: unknown): Promise<EmailSendResult> {
  let lastError = 'unknown error'
  let attempt = 0

  while (attempt < EMAIL_MAX_ATTEMPTS) {
    attempt++

    let response: Response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      // Rețeaua a căzut sub noi — merită reîncercat.
      lastError = `network error: ${err instanceof Error ? err.message : String(err)}`
      if (attempt >= EMAIL_MAX_ATTEMPTS) break
      await sleep(backoffDelay(attempt))
      continue
    }

    if (response.ok) {
      return { ok: true, attempts: attempt }
    }

    const errText = await response.text()
    lastError = `HTTP ${response.status}: ${errText}`

    // Reîncercăm DOAR ce are șanse să meargă a doua oară: 429 (limită de rată)
    // și erorile de server. O adresă invalidă sau o cheie greșită (restul de
    // 4xx) va eșua identic de fiecare dată — nu are rost să insistăm.
    const isRetriable = response.status === 429 || response.status >= 500
    if (!isRetriable || attempt >= EMAIL_MAX_ATTEMPTS) break

    // Dacă Resend ne spune explicit cât să așteptăm, îl ascultăm.
    const retryAfterHeader = Number(response.headers.get('retry-after'))
    const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : backoffDelay(attempt)

    console.log(`Resend ${response.status} — reîncerc peste ${waitMs}ms (încercarea ${attempt}/${EMAIL_MAX_ATTEMPTS})`)
    await sleep(waitMs)
  }

  return { ok: false, error: lastError, attempts: attempt }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawPayload = await req.json()
    
    // Check if this is an Auth webhook (different format)
    let payload: NotificationPayload
    
    if (rawPayload.type === 'user.created' || rawPayload.type === 'user') {
      const user = rawPayload.record || rawPayload.event?.data?.record || rawPayload
      payload = {
        event_type: 'user_signup',
        data: {
          user_id: user.id || user.user_id,
          email: user.email,
          created_at: user.created_at || new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }
    } else {
      payload = rawPayload as NotificationPayload
    }
    
    // Normalize flat payloads — wrap root-level data fields inside data object
    if (payload.event_type && !payload.data) {
      const { event_type, timestamp, ...rest } = payload as any
      payload = {
        event_type: event_type,
        data: rest,
        timestamp: timestamp
      }
    }

    if (!payload.event_type || !payload.data) {
      throw new Error('Missing required fields: event_type and data')
    }

    // Rezolvă pe server adresele pentru orice `*_user_id` primit, ÎNAINTE de
    // formatare — formatările citesc `data.user_email`, `data.target_email`
    // etc. și rămân neatinse. Traseele care încă trimit adresa direct merg
    // mai departe nemodificate (câmpurile deja completate nu se suprascriu).
    await hydrateEmailsFromUserIds(payload.data)

    const message = formatNotificationMessage(payload)
    
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
    const emailApiKey = Deno.env.get('RESEND_API_KEY')
    const adminEmail = Deno.env.get('ADMIN_EMAIL')
    
    const results: { slack?: boolean; email?: boolean; recipients?: string[]; error?: string } = {}
    
    // Send to Slack if configured — mai puțin la evenimentele din SKIP_SLACK,
    // care ar inunda canalul (vezi comentariul de la definiția listei).
    if (slackWebhookUrl && !SKIP_SLACK.has(payload.event_type)) {
      try {
        const slackMessage: SlackMessage = {
          text: message.title,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: message.title, emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: message.body } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: `Event: ${payload.event_type} | Time: ${new Date().toISOString()}` }] }
          ]
        }
        
        const slackResponse = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        })
        
        if (slackResponse.ok) {
          results.slack = true
        } else {
          results.error = `Slack error: ${await slackResponse.text()}`
        }
      } catch (error) {
        results.error = `Slack error: ${error.message}`
      }

      // Înregistrează încercarea Slack în notification_log (best-effort)
      await logNotification({
        event_type: payload.event_type,
        channel: 'slack',
        recipient: '#app_events',
        subject: message.title,
        status: results.slack ? 'sent' : 'error',
        payload: payload.data,
        error: results.slack ? null : (results.error || 'unknown error').substring(0, 1000),
      })
    }

    // Send email if configured
    if (emailApiKey) {
      try {
        // Determine whether the caller specified an explicit recipient.
        // The field `recipient_email` is the modern name; `admin_email` is the
        // legacy name used by many frontend call sites. Either one indicates
        // that the frontend intentionally targeted someone specific.
        //
        // Al treilea caz, nou: `recipient_user_ids` — un anunț către tot
        // grupul, într-un singur apel. Adresele au fost rezolvate pe server
        // în `hydrateEmailsFromUserIds` și au ajuns în `recipient_emails`.
        const broadcastEmails: string[] = Array.isArray(payload.data.recipient_emails)
          ? payload.data.recipient_emails.filter(Boolean)
          : []

        // Ne uităm la ce a CERUT frontendul, nu la ce s-a rezolvat. Dacă a
        // cerut un anunț către grup dar nicio adresă n-a putut fi rezolvată,
        // mesajul nu trebuie să cadă înapoi pe superadmin ca „destinatar
        // implicit" — ar ajunge la persoana greșită și, la evenimentele cu
        // copie automată, în dublu exemplar.
        const hasBroadcastRequest =
          Array.isArray(payload.data.recipient_user_ids) && payload.data.recipient_user_ids.length > 0

        const hasExplicitRecipient = !!(
          payload.data.recipient_email || payload.data.admin_email || hasBroadcastRequest
        )
        const primaryRecipient = payload.data.recipient_email || payload.data.admin_email || adminEmail

        // Build recipients list, deduplicated.
        const recipients: string[] = []
        if (!hasBroadcastRequest && primaryRecipient) recipients.push(primaryRecipient)

        // Superadmin CC logic:
        //   - SUPERADMIN_CC_ALWAYS events: always add the superadmin, even when
        //     there's an explicit recipient (e.g. invitation sent to an outsider).
        //   - SUPERADMIN_CC_IF_NO_RECIPIENT events: only add the superadmin if
        //     NO explicit recipient was specified. This is for "broadcast" events
        //     where the frontend makes N calls (one per member, each with
        //     admin_email set) plus a separate dedicated call for the superadmin
        //     (no admin_email). Without this split, the superadmin would receive
        //     N+1 copies of the same event.
        const shouldCcSuperadmin =
          SUPERADMIN_CC_ALWAYS.has(payload.event_type) ||
          (SUPERADMIN_CC_IF_NO_RECIPIENT.has(payload.event_type) && !hasExplicitRecipient)
        
        if (shouldCcSuperadmin && adminEmail && !recipients.includes(adminEmail)) {
          recipients.push(adminEmail)
        }
        
        // Lista de trimiteri. Fiecare intrare devine UN email separat.
        //
        // ⚠ La broadcast, fiecare destinatar primește mesajul lui, nu unul
        // comun. Dacă am pune toate adresele într-un singur `to:`, fiecare
        // membru al grupului ar vedea adresele celorlalți în antetul „Către" —
        // exact scurgerea pe care o închidem.
        const deliveries: string[][] = hasBroadcastRequest
          ? broadcastEmails.map((adresa) => [adresa])
          : (recipients.length > 0 ? [recipients] : [])

        // Copia pentru superadmin, la broadcast, pleacă separat — o singură
        // dată, nu o dată per membru.
        if (hasBroadcastRequest && shouldCcSuperadmin && adminEmail
            && !broadcastEmails.includes(adminEmail)) {
          deliveries.push([adminEmail])
        }

        if (deliveries.length === 0) {
          // No one to send to — log and skip
          console.log('No email recipients for event', payload.event_type)
        } else {
          // Use custom HTML from formatter if provided, else fall back to the
          // generic monospace dump (only used for legacy/unformatted events).
          const emailHtml = message.html || `
                <h2>${message.title}</h2>
                <div style="white-space: pre-wrap; font-family: monospace;">${message.body}</div>
                <hr>
                <p><small>Event Type: ${payload.event_type}</small></p>
                <p><small>Time: ${new Date().toISOString()}</small></p>
              `

          const trimise: string[] = []
          const esuate: string[] = []

          for (const to of deliveries) {
            const sendResult = await sendEmailWithRetry(emailApiKey, {
              from: 'apartamentual@ltfbstudio.ro',
              to,
              subject: message.title,
              html: emailHtml
            })

            if (sendResult.ok) {
              trimise.push(...to)
              if (sendResult.attempts > 1) {
                console.log(`Email trimis din a ${sendResult.attempts}-a încercare către ${to.join(', ')}`)
              }
            } else {
              esuate.push(...to)
              const errText = sendResult.error || 'unknown error'
              results.error = results.error ? `${results.error}; Email error: ${errText}` : `Email error: ${errText}`
            }

            // Înregistrează încercarea de email în notification_log (best-effort).
            // Un rând per trimitere, ca în admin să se vadă exact cine a primit
            // și cine nu — la broadcast, o singură linie ar ascunde eșecurile
            // individuale.
            await logNotification({
              event_type: payload.event_type,
              channel: 'email',
              recipient: to.join(', '),
              subject: message.title,
              status: sendResult.ok ? 'sent' : 'error',
              payload: payload.data,
              error: sendResult.ok
                ? null
                : `[${sendResult.attempts} încercări] ${sendResult.error || 'unknown error'}`.substring(0, 1000),
            })
          }

          if (trimise.length > 0) {
            results.email = true
            results.recipients = trimise
          }
          if (esuate.length > 0) {
            console.error('Emailuri netrimise către:', esuate.join(', '))
          }
        }
      } catch (error) {
        results.error = results.error ? `${results.error}; Email error: ${error.message}` : `Email error: ${error.message}`
      }
    }
    
    if (results.slack || results.email) {
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } else {
      console.log('No notification methods configured. Notification:', message)
      return new Response(
        JSON.stringify({ success: true, message: 'No notification methods configured', logged: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    
  } catch (error) {
    console.error('Error in notify-admins:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

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

  const ctaHtml = (ctaLink && ctaLabel)
    ? `<div style="text-align: center; margin: 28px 0;">
         <a href="${ctaLink}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
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
      const title = `📨 Newsletter: abonare nouă (pending)`
      const body = `O adresă nouă s-a abonat la newsletter și așteaptă confirmarea (double opt-in). Email: ${subEmail} · sursă: ${src}`
      const html = buildEmailHtml({
        headerEmoji: '📨',
        headerTitle: 'Abonare nouă la newsletter',
        intro: 'O adresă nouă s-a abonat la newsletter și a primit emailul de confirmare (double opt-in). Va intra în lista de trimitere doar după ce confirmă.',
        detailsList: [
          { label: 'Email', value: subEmail },
          { label: 'Sursă', value: src },
          { label: 'Zonă interes', value: data.zone_interest || '—' },
          { label: 'Status', value: 'pending (neconfirmat)' },
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
      const descriereTeren = (data.descriere_teren || '').toString().substring(0, 250)

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
          { label: 'Descriere teren', value: descriereTeren ? descriereTeren + (descriereTeren.length === 250 ? '…' : '') : 'N/A' },
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

    const message = formatNotificationMessage(payload)
    
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
    const emailApiKey = Deno.env.get('RESEND_API_KEY')
    const adminEmail = Deno.env.get('ADMIN_EMAIL')
    
    const results: { slack?: boolean; email?: boolean; recipients?: string[]; error?: string } = {}
    
    // Send to Slack if configured
    if (slackWebhookUrl) {
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
      })
    }

    // Send email if configured
    if (emailApiKey) {
      try {
        // Determine whether the caller specified an explicit recipient.
        // The field `recipient_email` is the modern name; `admin_email` is the
        // legacy name used by many frontend call sites. Either one indicates
        // that the frontend intentionally targeted someone specific.
        const hasExplicitRecipient = !!(payload.data.recipient_email || payload.data.admin_email)
        const primaryRecipient = payload.data.recipient_email || payload.data.admin_email || adminEmail
        
        // Build recipients list, deduplicated.
        const recipients: string[] = []
        if (primaryRecipient) recipients.push(primaryRecipient)
        
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
        
        if (recipients.length === 0) {
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
          
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${emailApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'apartamentual@ltfbstudio.ro',
              to: recipients,
              subject: message.title,
              html: emailHtml
            })
          })
          
          if (emailResponse.ok) {
            results.email = true
            results.recipients = recipients
          } else {
            const errText = await emailResponse.text()
            results.error = results.error ? `${results.error}; Email error: ${errText}` : `Email error: ${errText}`
          }

          // Înregistrează încercarea de email în notification_log (best-effort)
          await logNotification({
            event_type: payload.event_type,
            channel: 'email',
            recipient: recipients.join(', '),
            subject: message.title,
            status: results.email ? 'sent' : 'error',
            payload: payload.data,
          })
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

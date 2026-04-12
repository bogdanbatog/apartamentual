// Edge Function to notify admins of various site events
// Can send notifications via Slack, Email, or other services

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  event_type: 'user_signup' | 'new_user' | 'grup_created' | 'grup_updated' | 'teren_created' | 'teren_updated' | 'membership_request' | 'membership_approved' | 'profile_updated' | string
  data: Record<string, any>
  timestamp?: string
}

interface SlackMessage {
  text: string
  blocks?: any[]
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawPayload = await req.json()
    
    // Check if this is an Auth webhook (different format)
    let payload: NotificationPayload
    
    if (rawPayload.type === 'user.created' || rawPayload.type === 'user') {
      // This is an Auth webhook
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
      // This is a database trigger payload
      payload = rawPayload as NotificationPayload
    }
    
    // Normalize payload: if data fields are at root level (flat payload from nav.js),
    // wrap them inside data object
    if (payload.event_type && !payload.data) {
      const { event_type, timestamp, ...rest } = payload as any;
      payload = {
        event_type: event_type,
        data: rest,
        timestamp: timestamp
      };
    }
    
    // Validate payload
    if (!payload.event_type || !payload.data) {
      throw new Error('Missing required fields: event_type and data')
    }

    // Format notification message based on event type
    const message = formatNotificationMessage(payload)
    
    // Get admin notification preferences from environment
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
    const emailApiKey = Deno.env.get('RESEND_API_KEY')
    const adminEmail = Deno.env.get('ADMIN_EMAIL')
    
    const results: { slack?: boolean; email?: boolean; error?: string } = {}
    
    // Send to Slack if configured
    if (slackWebhookUrl) {
      try {
        const slackMessage: SlackMessage = {
          text: message.title,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: message.title,
                emoji: true
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message.body
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Event: ${payload.event_type} | Time: ${new Date().toISOString()}`
                }
              ]
            }
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
    }
    
    // Send email if configured
    if (emailApiKey && adminEmail) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${emailApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'apartamentual@ltfbstudio.ro',
            to: [payload.data.recipient_email || adminEmail],
            subject: message.title,
            html: `
              <h2>${message.title}</h2>
              <div style="white-space: pre-wrap; font-family: monospace;">${message.body}</div>
              <hr>
              <p><small>Event Type: ${payload.event_type}</small></p>
              <p><small>Time: ${new Date().toISOString()}</small></p>
            `
          })
        })
        
        if (emailResponse.ok) {
          results.email = true
        } else {
          results.error = results.error ? `${results.error}; Email error: ${await emailResponse.text()}` : `Email error: ${await emailResponse.text()}`
        }
      } catch (error) {
        results.error = results.error ? `${results.error}; Email error: ${error.message}` : `Email error: ${error.message}`
      }
    }
    
    // Return success if at least one notification method worked
    if (results.slack || results.email) {
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } else {
      // If no notification methods are configured, log and return success anyway
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

function formatNotificationMessage(payload: NotificationPayload): { title: string; body: string } {
  const { event_type, data } = payload
  
  switch (event_type) {
    case 'new_user': {
      const isAgency = data.account_type === 'profesional';
      if (isAgency) {
        return {
          title: '🏢 Cerere nouă de agenție - necesită aprobare',
          body: `O nouă agenție imobiliară s-a înregistrat și așteaptă aprobare!\n\n` +
                `📧 Email: ${data.email || 'N/A'}\n` +
                `🏢 Nume agenție: ${data.agency_name || 'N/A'}\n` +
                `🌐 Website: ${data.agency_website || 'N/A'}\n` +
                `🆔 User ID: ${data.user_id || 'N/A'}\n\n` +
                `⚠️ ACȚIUNE NECESARĂ: Intră în panoul de admin → Utilizatori → filtrul "Pending aprobare" pentru a aproba sau respinge această agenție.\n\n` +
                `Link rapid: https://apartamentual.onrender.com/admin-utilizatori.html`
        }
      }
      return {
        title: '🎉 Utilizator nou înregistrat',
        body: `Un nou utilizator s-a înregistrat și și-a confirmat emailul!\n\n` +
              `📧 Email: ${data.email || 'N/A'}\n` +
              `🆔 User ID: ${data.user_id || 'N/A'}\n` +
              `Tip cont: Utilizator activ\n\n` +
              `Vezi profilul: https://apartamentual.onrender.com/profile-view-new.html?id=${data.user_id || ''}`
      }
    }
    case 'account_reactivated':
      return {
        title: '✅ Contul tău a fost aprobat!',
        body: `Salut${data.user_name ? ' ' + data.user_name : ''}!\n\n` +
              `Avem o veste bună: contul tău de pe ApartamenTUal a fost aprobat de un administrator.\n\n` +
              `Acum poți să publici terenuri și să folosești toate funcționalitățile platformei pentru agenții imobiliare.\n\n` +
              `🔗 Intră în cont: https://apartamentual.onrender.com\n\n` +
              `Mulțumim că ești parte din comunitatea noastră!\n\n` +
              `— Echipa ApartamenTUal`
      }
    case 'user_signup':
      return {
        title: '🎉 New User Signup',
        body: `A new user has signed up!\n\nEmail: ${data.email || 'N/A'}\nUser ID: ${data.user_id || 'N/A'}\nCreated at: ${data.created_at || new Date().toISOString()}`
      }
    
    case 'grup_created':
      return {
        title: '✨ New Group Created',
        body: `A new group has been created!\n\nGroup Name: ${data.nume || 'N/A'}\nGroup ID: ${data.id || 'N/A'}\nOwner: ${data.owner_email || data.owner_user_id || 'N/A'}\nZona: ${data.zona || 'N/A'}\nMax Members: ${data.max_members || 'N/A'}`
      }
    
    case 'grup_updated':
      return {
        title: '📝 Group Updated',
        body: `A group has been updated!\n\nGroup Name: ${data.nume || 'N/A'}\nGroup ID: ${data.id || 'N/A'}\nOwner: ${data.owner_email || data.owner_user_id || 'N/A'}\nStatus: ${data.status || 'N/A'}`
      }
    
    case 'teren_created':
      return {
        title: '🏞️ New Teren Added',
        body: `A new teren (land) has been added!\n\nTitle: ${data.titlu || 'N/A'}\nTeren ID: ${data.id || 'N/A'}\nCreated by: ${data.creator_email || data.created_by_user_id || 'N/A'}\nZona: ${data.zona || 'N/A'}\nSuprafata: ${data.suprafata || 'N/A'} m²`
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
        title: '🔔 Site Event',
        body: `Event: ${event_type}\n\nData: ${JSON.stringify(data, null, 2)}`
      }
  }
}

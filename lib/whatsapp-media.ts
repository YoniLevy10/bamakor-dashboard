import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Download media from WhatsApp/Meta using the media ID
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
  mediaType: 'image' | 'audio' | 'video' | 'document'
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!accessToken) {
      console.error('❌ Missing WHATSAPP_ACCESS_TOKEN')
      return null
    }

    // Step 1: Get media URL from Meta
    console.log(`📥 Fetching media URL for ID: ${mediaId}`)
    const mediaUrlResponse = await fetch(
      `https://graph.facebook.com/v23.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!mediaUrlResponse.ok) {
      console.error(`❌ Failed to fetch media URL:`, mediaUrlResponse.statusText)
      return null
    }

    const mediaData = await mediaUrlResponse.json()
    const mediaUrl = mediaData.url

    if (!mediaUrl) {
      console.error('❌ No media URL in response')
      return null
    }

    // Step 2: Download the actual media file
    console.log(`📥 Downloading media from: ${mediaUrl}`)
    const fileResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!fileResponse.ok) {
      console.error(`❌ Failed to download media:`, fileResponse.statusText)
      return null
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer())
    const contentType = fileResponse.headers.get('content-type') || getMimeType(mediaType)
    const fileName = `whatsapp_${mediaType}_${Date.now()}.${getExtension(mediaType)}`

    console.log(`✅ Downloaded ${mediaType} (${buffer.length} bytes)`)

    return {
      buffer,
      mimeType: contentType,
      fileName,
    }
  } catch (err) {
    console.error('❌ Error downloading WhatsApp media:', err)
    return null
  }
}

/**
 * Upload WhatsApp media to Supabase Storage
 */
export async function uploadWhatsAppMediaToStorage(
  ticketId: string,
  mediaBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ filePath: string; fileSize: number } | null> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase credentials for storage upload')
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate organized file path: ticket-attachments/{ticketId}/{timestamp-filename}
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const extension = fileName.split('.').pop() || 'dat'
    const filePath = `${ticketId}/${timestamp}-${randomStr}.${extension}`

    console.log(`📤 Uploading to Supabase Storage bucket 'ticket-attachments': ${filePath}`)

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, mediaBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      const errorMsg = String(uploadError)
      const isBucketError = errorMsg.includes('not found') || errorMsg.includes('Bucket')
      
      if (isBucketError) {
        console.error('❌ CRITICAL: Storage bucket "ticket-attachments" not found in Supabase:', uploadError)
        console.error('⚠️ Action required: Create "ticket-attachments" bucket in Supabase Storage dashboard')
      } else {
        console.error('❌ Failed to upload to Supabase Storage:', uploadError)
      }
      return null
    }

    console.log(`✅ Media uploaded successfully: ${filePath}`)

    return {
      filePath,
      fileSize: mediaBuffer.length,
    }
  } catch (err) {
    console.error('❌ Error uploading file to Supabase Storage:', err)
    return null
  }
}

/**
 * Create attachment record in database
 */
export async function createAttachmentRecord(
  supabaseAdmin: any,
  ticketId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  mimeType: string
): Promise<boolean> {
  try {
    const { error: dbError } = await supabaseAdmin
      .from('ticket_attachments')
      .insert({
        ticket_id: ticketId,
        file_name: fileName,
        file_url: filePath,
        mime_type: mimeType,
      })

    if (dbError) {
      console.error('❌ Failed to create attachment record:', dbError)
      return false
    }

    console.log(`✅ Attachment record created for ticket: ${ticketId}`)
    return true
  } catch (err) {
    console.error('❌ Error creating attachment record:', err)
    return false
  }
}

/**
 * Helper: Get MIME type from media type
 */
function getMimeType(mediaType: 'image' | 'audio' | 'video' | 'document'): string {
  const mimeTypes: Record<string, string> = {
    image: 'image/jpeg',
    audio: 'audio/mpeg',
    video: 'video/mp4',
    document: 'application/octet-stream',
  }
  return mimeTypes[mediaType] || 'application/octet-stream'
}

/**
 * Helper: Get file extension from media type
 */
function getExtension(mediaType: 'image' | 'audio' | 'video' | 'document'): string {
  const extensions: Record<string, string> = {
    image: 'jpg',
    audio: 'mp3',
    video: 'mp4',
    document: 'bin',
  }
  return extensions[mediaType] || 'bin'
}

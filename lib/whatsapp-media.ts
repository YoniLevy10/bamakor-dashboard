import { createClient, SupabaseClient } from '@supabase/supabase-js'

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
      console.error('❌ DOWNLOAD_FAILURE: Missing WHATSAPP_ACCESS_TOKEN environment variable')
      return null
    }

    // Step 1: Get media URL from Meta Graph API
    console.log(`📥 STEP_1_START: Fetching media URL from Meta (mediaId: ${mediaId})`)
    let mediaUrlResponse
    try {
      mediaUrlResponse = await fetch(
        `https://graph.facebook.com/v23.0/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
    } catch (fetchErr) {
      console.error('❌ DOWNLOAD_FAILURE: Network error during Meta API media URL request', {
        mediaId,
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      })
      return null
    }

    if (!mediaUrlResponse.ok) {
      let responseBody = ''
      try {
        responseBody = await mediaUrlResponse.text()
      } catch (readErr) {
        responseBody = `[Could not read response: ${readErr}]`
      }
      console.error('❌ DOWNLOAD_FAILURE: Meta API returned non-200 status on media URL fetch', {
        mediaId,
        status: mediaUrlResponse.status,
        statusText: mediaUrlResponse.statusText,
        responseBody: responseBody.substring(0, 500), // Truncate for logging
      })
      return null
    }

    let mediaData
    try {
      mediaData = await mediaUrlResponse.json()
    } catch (parseErr) {
      console.error('❌ DOWNLOAD_FAILURE: Failed to parse Meta API response as JSON', {
        mediaId,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      })
      return null
    }

    const mediaUrl = mediaData?.url
    if (!mediaUrl) {
      console.error('❌ DOWNLOAD_FAILURE: Meta API response missing "url" field', {
        mediaId,
        receivedFields: Object.keys(mediaData || {}),
        fullResponse: JSON.stringify(mediaData).substring(0, 300),
      })
      return null
    }

    console.log(`✅ STEP_1_SUCCESS: Got media URL from Meta`)

    // Step 2: Download the actual media file
    console.log(`⏳ STEP_2_START: Downloading media from URL`)
    let fileResponse
    try {
      fileResponse = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    } catch (fetchErr) {
      console.error('❌ DOWNLOAD_FAILURE: Network error during media file download', {
        mediaId,
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      })
      return null
    }

    if (!fileResponse.ok) {
      let responseBody = ''
      try {
        responseBody = await fileResponse.text()
      } catch (readErr) {
        responseBody = `[Could not read response: ${readErr}]`
      }
      console.error('❌ DOWNLOAD_FAILURE: Media URL returned non-200 status', {
        mediaId,
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        responseBody: responseBody.substring(0, 500),
      })
      return null
    }

    let arrayBuffer
    try {
      arrayBuffer = await fileResponse.arrayBuffer()
    } catch (readErr) {
      console.error('❌ DOWNLOAD_FAILURE: Failed to read media file as buffer', {
        mediaId,
        error: readErr instanceof Error ? readErr.message : String(readErr),
      })
      return null
    }

    const buffer = Buffer.from(arrayBuffer)
    const contentType = fileResponse.headers.get('content-type') || getMimeType(mediaType)
    const fileName = `whatsapp_${mediaType}_${Date.now()}.${getExtension(mediaType)}`

    console.log(`✅ STEP_2_SUCCESS: Downloaded ${mediaType} (${buffer.length} bytes from Meta)`)

    return {
      buffer,
      mimeType: contentType,
      fileName,
    }
  } catch (err) {
    console.error('❌ DOWNLOAD_FAILURE: Unexpected error during WhatsApp media download', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
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
      console.error('❌ UPLOAD_FAILURE: Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate organized file path: ticket-attachments/{ticketId}/{timestamp-filename}
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const extension = fileName.split('.').pop() || 'dat'
    const filePath = `${ticketId}/${timestamp}-${randomStr}.${extension}`

    console.log(`⏳ STEP_1_START: Uploading to Supabase Storage bucket 'ticket-attachments'`, {
      ticketId,
      filePath,
      bufferSize: mediaBuffer.length,
      mimeType,
    })

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, mediaBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      const errorMessage = String(uploadError)
      const errorCode = (uploadError as unknown as Record<string, unknown>)?.['code'] || 'UNKNOWN'
      const errorDetails = (uploadError as unknown as Record<string, unknown>)?.['details'] || ''
      
      const isBucketError = errorMessage.includes('not found') || errorMessage.includes('Bucket')
      const isPermissionError = errorMessage.includes('permission') || errorMessage.includes('auth')
      const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('limit')
      
      console.error('❌ UPLOAD_FAILURE: Supabase Storage upload failed', {
        ticketId,
        filePath,
        bufferSize: mediaBuffer.length,
        errorMessage,
        errorCode,
        errorDetails: String(errorDetails).substring(0, 300),
        isBucketError,
        isPermissionError,
        isQuotaError,
        fullError: JSON.stringify(uploadError).substring(0, 500),
      })
      
      if (isBucketError) {
        console.error('⚠️ UPLOAD_DIAGNOSIS: Bucket "ticket-attachments" not found or inaccessible')
      }
      if (isPermissionError) {
        console.error('⚠️ UPLOAD_DIAGNOSIS: Permission denied - check service role key permissions')
      }
      if (isQuotaError) {
        console.error('⚠️ UPLOAD_DIAGNOSIS: Storage quota exceeded')
      }
      
      return null
    }

    console.log(`✅ STEP_1_SUCCESS: Successfully uploaded to Supabase Storage`, {
      ticketId,
      filePath,
      fileSize: mediaBuffer.length,
    })

    return {
      filePath,
      fileSize: mediaBuffer.length,
    }
  } catch (err) {
    console.error('❌ UPLOAD_FAILURE: Unexpected error during Supabase Storage upload', {
      ticketId,
      fileName,
      bufferSize: mediaBuffer.length,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return null
  }
}

/**
 * Create attachment record in database
 * 
 * Production schema columns for ticket_attachments:
 * - id (auto)
 * - ticket_id (required)
 * - attachment_type (required)
 * - file_url (required)
 * - mime_type (required)
 * - whatsapp_media_id (optional)
 * - created_at (auto)
 * - file_name (required)
 * 
 * NOTE: file_size does NOT exist in production schema
 */
export async function createAttachmentRecord(
  supabaseAdmin: SupabaseClient,
  ticketId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  mimeType: string,
  mediaId?: string,
  attachmentType: string = 'whatsapp_image'
): Promise<boolean> {
  try {
    // STABILITY: Validate required fields before database insert
    if (!ticketId) {
      console.error('❌ DB_INSERT_FAILURE: ticketId is missing or empty')
      return false
    }
    if (!filePath) {
      console.error('❌ DB_INSERT_FAILURE: file_url (filePath) is missing or empty')
      return false
    }
    if (!mimeType) {
      console.error('❌ DB_INSERT_FAILURE: mimeType is missing or empty')
      return false
    }

    console.log(`⏳ DB_INSERT_START: Creating attachment record in database`, {
      ticketId,
      fileName,
      mimeType,
      attachmentType,
      fileSize,
      mediaId: mediaId || null,
    })

    // Build payload matching exact production schema
    // Production columns: ticket_id, file_name, file_url, mime_type, attachment_type, whatsapp_media_id
    // NOTE: file_size is NOT in the production schema - removed
    const payload = {
      ticket_id: ticketId,
      file_name: fileName,
      file_url: filePath,
      mime_type: mimeType,
      attachment_type: attachmentType,
      whatsapp_media_id: mediaId || null,
    }

    console.log(`ℹ️ DB_INSERT_PAYLOAD: Columns to insert:`, {
      schema: Object.keys(payload),
      values: {
        ticket_id: ticketId,
        file_name: fileName,
        file_url: filePath,
        mime_type: mimeType,
        attachment_type: attachmentType,
        whatsapp_media_id: mediaId || 'null',
      },
    })

    const { error: dbError } = await supabaseAdmin
      .from('ticket_attachments')
      .insert(payload)

    if (dbError) {
      const errorMessage = String(dbError?.message || String(dbError))
      const errorCode = (dbError as unknown as Record<string, unknown>)?.['code'] || 'UNKNOWN'
      const errorDetails = (dbError as unknown as Record<string, unknown>)?.['details'] || ''
      const errorHint = (dbError as unknown as Record<string, unknown>)?.['hint'] || ''

      // Analyze error to determine root cause
      const isColumnMissing = errorMessage.includes('column') || errorMessage.includes('does not exist')
      const isUniqueViolation = errorCode === '23505' || errorMessage.includes('unique')
      const isConstraintViolation = errorMessage.includes('constraint') || errorCode === '23502'
      const isPermissionDenied = errorMessage.includes('permission') || errorMessage.includes('auth')

      console.error('❌ DB_INSERT_FAILURE: Database insert failed for ticket attachment', {
        ticketId,
        fileName,
        errorMessage,
        errorCode,
        errorDetails: String(errorDetails).substring(0, 300),
        errorHint: String(errorHint).substring(0, 300),
        attemptedColumns: Object.keys(payload),
        isColumnMissing,
        isUniqueViolation,
        isConstraintViolation,
        isPermissionDenied,
        fullError: JSON.stringify(dbError).substring(0, 500),
      })

      if (isColumnMissing) {
        console.error(`⚠️ DB_INSERT_DIAGNOSIS: Column missing or schema mismatch`, {
          attemptedColumns: Object.keys(payload),
          productionColumns: ['id', 'ticket_id', 'attachment_type', 'file_url', 'mime_type', 'whatsapp_media_id', 'created_at', 'file_name'],
        })
      }

      if (isConstraintViolation) {
        console.error(`⚠️ DB_INSERT_DIAGNOSIS: Constraint violation - check foreign keys and NOT NULL constraints`, {
          attemptedColumns: Object.keys(payload),
        })
      }

      return false
    }

    console.log(`✅ DB_INSERT_SUCCESS: Attachment record created in database`, {
      ticketId,
      fileName,
      fileSize,
      columns: Object.keys(payload),
    })
    return true
  } catch (err) {
    console.error('❌ DB_INSERT_FAILURE: Unexpected error creating attachment record', {
      ticketId,
      fileName,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
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

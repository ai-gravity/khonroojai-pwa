export const MAX_VIDEO_BYTES = 80 * 1024 * 1024
export const MIN_VIDEO_SECONDS = 30

export function validateVideoFile(file) {
  if (!file || typeof file.size !== 'number') return { valid: false, reason: 'file-type' }
  const extension = `.${String(file.name || '').split('.').pop()?.toLowerCase() || ''}`
  const supportedExtension = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg'].includes(extension)
  if (file.size > MAX_VIDEO_BYTES) return { valid: false, reason: 'file-too-large' }
  if ((file.type && !file.type.startsWith('video/')) || (!file.type && !supportedExtension)) return { valid: false, reason: 'file-type' }
  return { valid: true, extension }
}

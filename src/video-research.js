/**
 * Shared browser decoder frame extraction for the uploaded-video research
 * path. The app and the synthetic end-to-end harness use this same function.
 * It returns full-frame gate statistics plus a fixed central 80% ROI mean for
 * the versioned uploaded-video adapter contract.
 */

export const RESEARCH_ROI_DEFINITION_ID = 'fingertip_roi_mean_rgb_v1'
export const RESEARCH_ROI_DESCRIPTION = 'central_80_percent_of_48x36_downsampled_frame'

export function getVideoFrameStats(video, canvas, context) {
  if (!video?.videoWidth || !video?.videoHeight || !canvas || !context) return { valid: false, reason: 'waiting' }
  canvas.width = 48
  canvas.height = 36
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let red = 0; let green = 0; let blue = 0; let brightness = 0; let saturated = 0
  for (let index = 0; index < pixels.length; index += 4) {
    red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2]
    brightness += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3
    if (pixels[index] > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245) saturated += 1
  }
  const count = pixels.length / 4
  const meanR = red / count; const meanG = green / count; const meanB = blue / count
  const roiLeft = Math.floor(canvas.width * 0.1)
  const roiRight = Math.ceil(canvas.width * 0.9)
  const roiTop = Math.floor(canvas.height * 0.1)
  const roiBottom = Math.ceil(canvas.height * 0.9)
  let roiRed = 0; let roiGreen = 0; let roiBlue = 0; let roiCount = 0
  for (let y = roiTop; y < roiBottom; y += 1) {
    for (let x = roiLeft; x < roiRight; x += 1) {
      const index = (y * canvas.width + x) * 4
      roiRed += pixels[index]; roiGreen += pixels[index + 1]; roiBlue += pixels[index + 2]
      roiCount += 1
    }
  }
  const meanBrightness = brightness / count
  const redLift = meanR - ((meanG + meanB) / 2)
  const redDominant = meanR > meanG * 1.045 && meanR > meanB * 1.08 && redLift > 5
  const dark = meanBrightness < 29
  const clipped = saturated / count > 0.68
  return {
    red: meanR,
    green: meanG,
    blue: meanB,
    researchRgb: [roiRed / roiCount, roiGreen / roiCount, roiBlue / roiCount],
    brightness: meanBrightness,
    redLift,
    redDominant,
    dark,
    clipped,
    valid: redDominant && !dark && !clipped,
  }
}

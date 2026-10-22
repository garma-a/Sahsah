export async function prepareAudio(file: Blob): Promise<Blob> {
  if (file.size > 15 * 1024 * 1024) throw new Error('حجم الصوت بحد أقصى ١٥ ميجا')
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    if (buffer.duration < 0.2 || buffer.duration > 30)
      throw new Error('مدة الصوت من ٠٫٢ إلى ٣٠ ثانية')
    const channels = Math.min(2, buffer.numberOfChannels),
      length = buffer.length
    const view = new DataView(new ArrayBuffer(44 + length * channels * 2))
    const text = (at: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i))
    }
    text(0, 'RIFF')
    view.setUint32(4, view.byteLength - 8, true)
    text(8, 'WAVEfmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, buffer.sampleRate, true)
    view.setUint32(28, buffer.sampleRate * channels * 2, true)
    view.setUint16(32, channels * 2, true)
    view.setUint16(34, 16, true)
    text(36, 'data')
    view.setUint32(40, view.byteLength - 44, true)
    const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel))
    for (let i = 0; i < length; i++)
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, samples[channel][i]))
        view.setInt16(
          44 + (i * channels + channel) * 2,
          Math.round(sample * (sample < 0 ? 32768 : 32767)),
          true,
        )
      }
    return new Blob([view.buffer], { type: 'audio/wav' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('مدة')) throw error
    throw new Error('المتصفح مش قادر يفك الصوت. جرّب ملف WAV أو MP3 صالح.')
  } finally {
    await context.close()
  }
}

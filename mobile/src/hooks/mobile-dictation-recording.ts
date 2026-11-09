import type { DictationCaptureChunk } from '../platform/dictation-capture-contract'
import { MAX_HELD_AUDIO_BYTES, type MobileDictationHeldAudio } from './mobile-dictation-held-audio'

// Everything one dictation heard, from the tap, whichever engine hears it: replayed to the computer when the phone fails, and kept after a failure for Retry.
export class MobileDictationRecording {
  private chunks: DictationCaptureChunk[] = []
  private keptBytes = 0
  private overflowed = false

  keep(chunk: DictationCaptureChunk): void {
    if (this.overflowed) {
      return
    }
    // Past the cap a replay would lose speech, so keep nothing and say it is incomplete.
    if (this.keptBytes + chunk.data.byteLength > MAX_HELD_AUDIO_BYTES) {
      this.chunks = []
      this.keptBytes = 0
      this.overflowed = true
      return
    }
    this.chunks.push(chunk)
    this.keptBytes += chunk.data.byteLength
  }

  // False once speech was dropped past the cap; the recording no longer covers the whole dictation.
  get complete(): boolean {
    return !this.overflowed
  }

  get bytes(): number {
    return this.keptBytes
  }

  // Queue a copy for sending; the recording itself stays, so a failed replay can be retried.
  replayInto(held: MobileDictationHeldAudio): void {
    held.clear()
    for (const chunk of this.chunks) {
      held.hold(chunk)
    }
  }

  clear(): void {
    this.chunks = []
    this.keptBytes = 0
    this.overflowed = false
  }
}

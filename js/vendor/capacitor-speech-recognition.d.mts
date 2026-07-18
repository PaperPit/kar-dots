export interface NativeSpeechEvent {
  [key: string]: unknown
}

export interface NativeSpeechHandle {
  remove(): Promise<void>
}

export interface NativeSpeechRecognition {
  checkPermissions(): Promise<{ speechRecognition: string }>
  requestPermissions(): Promise<{ speechRecognition: string }>
  available(opts: { language: string }): Promise<{ available: boolean }>
  getLastPartialResult(): Promise<NativeSpeechEvent>
  stop(): Promise<void>
  forceStop(): Promise<void>
  start(opts: {
    language: string
    partialResults: boolean
    maxResults: number
    contextualStrings?: string[]
  }): Promise<void>
  addListener(
    event: string,
    cb: (event: NativeSpeechEvent) => void
  ): Promise<NativeSpeechHandle>
}

export const SpeechRecognition: NativeSpeechRecognition

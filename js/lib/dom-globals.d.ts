export {}

declare global {
  interface SpeechRecognitionAlternative {
    transcript: string
    confidence: number
  }

  interface SpeechRecognitionResult {
    isFinal: boolean
    length: number
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionEventLike {
    resultIndex: number
    results: ArrayLike<SpeechRecognitionResult>
  }

  interface SpeechRecognitionErrorLike {
    error: string
  }

  interface SpeechRecognitionLike {
    lang: string
    interimResults: boolean
    maxAlternatives: number
    continuous: boolean
    onresult: ((e: SpeechRecognitionEventLike) => void) | null
    onerror: ((e: SpeechRecognitionErrorLike) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
  }

  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean
      Plugins?: {
        StatusBar?: {
          setStyle(opts: { style: string }): void
        }
      }
    }
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

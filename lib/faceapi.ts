/**
 * Shared face-api.js loader — client-side only.
 * Dynamic import is used so the library never runs during SSR.
 * Models are loaded from /public/models (served as /models/).
 * The singleton ensures models are only loaded once per page session.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _fa: any = null
let _loaded = false
let _promise: Promise<void> | null = null

/**
 * Returns the face-api.js module with models loaded.
 * Safe to call multiple times — subsequent calls resolve immediately.
 */
export async function getFaceApi(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (_loaded) return _fa
  if (_promise) { await _promise; return _fa }

  _promise = (async () => {
    console.log('[FaceAPI] Loading face-api.js...')
    _fa = await import('face-api.js')
    console.log('[FaceAPI] Loading models from /models...')
    await Promise.all([
      _fa.nets.tinyFaceDetector.loadFromUri('/models'),
      _fa.nets.faceLandmark68Net.loadFromUri('/models'),
      _fa.nets.faceRecognitionNet.loadFromUri('/models'),
    ])
    _loaded = true
    console.log('[FaceAPI] All models ready.')
  })()

  await _promise
  return _fa
}

export function isFaceApiLoaded(): boolean { return _loaded }

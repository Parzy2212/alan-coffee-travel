/**
 * Shared face-api.js loader — client-side only.
 * Dynamic import is used so the library never runs during SSR.
 * Models are loaded from /public/models (served as /models/).
 * The singleton ensures models are only loaded once per page session.
 */

type FaceApi = typeof import('face-api.js')

let _loaded = false
let _promise: Promise<FaceApi> | null = null

/**
 * Returns the face-api.js module with models loaded.
 * Safe to call multiple times — subsequent calls resolve immediately.
 */
export function getFaceApi(): Promise<FaceApi> {
  if (_promise) return _promise
  _promise = (async () => {
    console.log('[FaceAPI] Loading face-api.js...')
    const fa = await import('face-api.js')
    console.log('[FaceAPI] Loading models from /models...')
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri('/models'),
      fa.nets.faceLandmark68Net.loadFromUri('/models'),
      fa.nets.faceRecognitionNet.loadFromUri('/models'),
    ])
    _loaded = true
    console.log('[FaceAPI] All models ready.')
    return fa
  })()
  return _promise
}

export function isFaceApiLoaded(): boolean { return _loaded }

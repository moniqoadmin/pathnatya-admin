export type ErrorCodeKind = 'tamper' | 'integrity' | 'other'

export interface ErrorCode {
  kind: ErrorCodeKind
  code: number
  message: string
  area: string
}

export const ERROR_CODES: ErrorCode[] = [
  {
    kind: 'tamper',
    code: 573,
    message: 'Video files tampered. Please contact admin.',
    area: 'Tamper',
  },
  {
    kind: 'tamper',
    code: 6924,
    message: 'Duplicate app instance / duplicate protected segment detected.',
    area: 'Tamper',
  },
  {
    kind: 'integrity',
    code: 7316,
    message: 'Something went wrong. Please contact admin.',
    area: 'Offline integrity (missing hashes)',
  },
  {
    kind: 'integrity',
    code: 294,
    message: 'Something went wrong. Please contact admin.',
    area: 'Offline integrity (segment missing)',
  },
  {
    kind: 'integrity',
    code: 8651,
    message: 'Offline video integrity check failed. Please contact admin.',
    area: 'Offline integrity (hash mismatch)',
  },
  {
    kind: 'integrity',
    code: 537,
    message: 'Something went wrong. Please contact admin.',
    area: 'Offline integrity (playback hash mismatch)',
  },
  {
    kind: 'integrity',
    code: 891,
    message: 'Offline package is missing the expected at-rest header.',
    area: 'Offline crypto',
  },
  {
    kind: 'integrity',
    code: 4386,
    message: 'Unsupported offline package version.',
    area: 'Offline crypto',
  },
  { kind: 'other', code: 219, message: 'Please enter your password.', area: 'Login' },
  {
    kind: 'other',
    code: 248,
    message: 'We could not prepare your video. Please try again.',
    area: 'Preparing video',
  },
  { kind: 'other', code: 268, message: 'Playlist IV must be 128 bits.', area: 'HLS' },
  {
    kind: 'other',
    code: 318,
    message: 'Please enter a valid 10-digit phone number.',
    area: 'Phone check',
  },
  {
    kind: 'other',
    code: 352,
    message: 'Password must be at least 6 characters.',
    area: 'Set password',
  },
  {
    kind: 'other',
    code: 361,
    message: 'Login tokens are required to save an offline session.',
    area: 'Offline session',
  },
  {
    kind: 'other',
    code: 391,
    message: 'This build of Chromium cannot play HLS streams.',
    area: 'Playback',
  },
  { kind: 'other', code: 406, message: 'Invalid phone number or password.', area: 'Login' },
  { kind: 'other', code: 469, message: 'Video key token is empty.', area: 'Video key' },
  {
    kind: 'other',
    code: 482,
    message: 'Offline integrity hashes are invalid.',
    area: 'Offline integrity',
  },
  {
    kind: 'other',
    code: 578,
    message: 'Invalid phone number for offline session.',
    area: 'Offline session',
  },
  { kind: 'other', code: 625, message: 'Download cancelled.', area: 'Download' },
  {
    kind: 'other',
    code: 629,
    message: 'Login response did not include a video key.',
    area: 'Login / video key',
  },
  { kind: 'other', code: 647, message: 'Video source URL is invalid.', area: 'HLS' },
  {
    kind: 'other',
    code: 674,
    message: 'Please enter a valid 10-digit phone number.',
    area: 'Login',
  },
  {
    kind: 'other',
    code: 681,
    message: 'Unable to decrypt segment. Key does not match this video.',
    area: 'HLS decrypt',
  },
  { kind: 'other', code: 684, message: 'Passwords do not match.', area: 'Set password' },
  {
    kind: 'other',
    code: 719,
    message: 'Playlist does not contain any media segments.',
    area: 'HLS',
  },
  {
    kind: 'other',
    code: 734,
    message: 'Unsupported platform (non-Windows/macOS).',
    area: 'Platform',
  },
  {
    kind: 'other',
    code: 742,
    message: 'Wrong phone number. Please check and try again.',
    area: 'Phone check',
  },
  {
    kind: 'other',
    code: 783,
    message: 'Device identifier error (propagated).',
    area: 'Set password',
  },
  {
    kind: 'other',
    code: 804,
    message: 'HLS video is not prepared / Unable to read playlist.',
    area: 'HLS',
  },
  { kind: 'other', code: 815, message: 'Request failed with status {status}.', area: 'HLS fetch' },
  {
    kind: 'other',
    code: 845,
    message: 'Virtual machine detected / playback blocked on VM.',
    area: 'Security',
  },
  { kind: 'other', code: 917, message: 'API / login pipeline error (wrapper).', area: 'Auth / API' },
  { kind: 'other', code: 938, message: 'A download is already in progress.', area: 'Download' },
  { kind: 'other', code: 952, message: 'Screen too small.', area: 'Platform' },
  {
    kind: 'other',
    code: 965,
    message: 'Unable to verify phone number. Please try again.',
    area: 'Phone check',
  },
  {
    kind: 'other',
    code: 1274,
    message: 'Full screen is required to play the video.',
    area: 'Playback gate',
  },
  { kind: 'other', code: 1472, message: 'Download cancelled.', area: 'Download' },
  {
    kind: 'other',
    code: 1748,
    message: 'Device identifier API is unavailable. Restart the app.',
    area: 'Device ID',
  },
  { kind: 'other', code: 2861, message: 'Unsupported device (phone/tablet).', area: 'Platform' },
  {
    kind: 'other',
    code: 3167,
    message: 'Video key is not available for this session. Please log in again.',
    area: 'Video key',
  },
  { kind: 'other', code: 3318, message: 'Low internet speed.', area: 'Network warning' },
  {
    kind: 'other',
    code: 3562,
    message: 'Video source did not return an HLS playlist.',
    area: 'HLS',
  },
  {
    kind: 'other',
    code: 3847,
    message: 'Expected encrypted payload response.',
    area: 'API client',
  },
  { kind: 'other', code: 3928, message: 'Video source host is not allowed.', area: 'HLS' },
  { kind: 'other', code: 4041, message: 'Not found (pathnatya protocol).', area: 'Protocol' },
  { kind: 'other', code: 4102, message: 'HTTP {status}.', area: 'API client' },
  { kind: 'other', code: 4276, message: 'Unable to prepare video.', area: 'HLS prepare' },
  {
    kind: 'other',
    code: 4518,
    message: 'Unable to prepare video / prepare pipeline wrapper.',
    area: 'Playback',
  },
  { kind: 'other', code: 4710, message: 'No internet connection.', area: 'Offline toast' },
  { kind: 'other', code: 5196, message: 'Unknown / invalid HLS segment.', area: 'HLS' },
  {
    kind: 'other',
    code: 5291,
    message: 'Unable to read this device identifier. Check your network connection.',
    area: 'Set password',
  },
  {
    kind: 'other',
    code: 5743,
    message: 'Unable to fetch (network retry wrapper).',
    area: 'HLS fetch',
  },
  {
    kind: 'other',
    code: 5831,
    message: 'No internet. Offline access only within 7 days of online login.',
    area: 'Phone check',
  },
  {
    kind: 'other',
    code: 6183,
    message: 'Screen recording or sharing detected.',
    area: 'Security',
  },
  {
    kind: 'other',
    code: 7524,
    message: 'Video key token does not decode to 16 bytes for AES-128.',
    area: 'Video key',
  },
  {
    kind: 'other',
    code: 7614,
    message: 'Unable to set password. Please try again.',
    area: 'Set password',
  },
  { kind: 'other', code: 7642, message: 'Video player is not ready.', area: 'Playback' },
  {
    kind: 'other',
    code: 8264,
    message: 'Unable to play the video stream (hls.js fatal).',
    area: 'Playback',
  },
  {
    kind: 'other',
    code: 8437,
    message: 'Invalid phone/password. Offline login only within 7 days.',
    area: 'Login',
  },
  {
    kind: 'other',
    code: 9247,
    message: 'Password is required to save an offline session.',
    area: 'Offline session',
  },
  {
    kind: 'other',
    code: 9372,
    message: 'Could not prepare video. Check internet and try again.',
    area: 'Preparing video',
  },
  {
    kind: 'other',
    code: 9431,
    message: 'Unsupported HLS encryption method.',
    area: 'HLS',
  },
]

const ERROR_CODE_BY_NUMBER = new Map(ERROR_CODES.map((item) => [item.code, item]))

export function getErrorCode(code: number): ErrorCode | undefined {
  return ERROR_CODE_BY_NUMBER.get(code)
}

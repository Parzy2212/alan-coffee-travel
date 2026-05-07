export interface ParsedUA {
  browser: string
  os: string
  deviceType: 'desktop' | 'mobile'
}

export function parseUserAgent(ua: string): ParsedUA {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)

  let os = 'Unknown OS'
  if (/Windows NT/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) os = 'macOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone/.test(ua)) os = 'iPhone'
  else if (/iPad/.test(ua)) os = 'iPad'
  else if (/Linux/.test(ua)) os = 'Linux'

  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera'
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari'
  else if (/Chromium\//.test(ua)) browser = 'Chromium'

  return { browser, os, deviceType: isMobile ? 'mobile' : 'desktop' }
}

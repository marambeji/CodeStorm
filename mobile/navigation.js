function classifyNavigation(address, appUrl, allowLocalHttp = false) {
  try {
    if (typeof address !== 'string' || !/^https?:\/\//i.test(address.trim())) return 'blocked'
    const url = new URL(address)
    if (url.username || url.password) return 'blocked'
    const sameOrigin = url.origin === new URL(appUrl).origin
    if (url.protocol === 'https:') return sameOrigin ? 'app' : 'external'
    const localHost = /^(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/
    return allowLocalHttp && sameOrigin && localHost.test(url.hostname) ? 'app' : 'blocked'
  } catch {
    return 'blocked'
  }
}

function configuredAppUrl(address, allowLocalHttp = false) {
  return classifyNavigation(address, address, allowLocalHttp) === 'app' ? new URL(address).href : null
}

module.exports = { classifyNavigation, configuredAppUrl }

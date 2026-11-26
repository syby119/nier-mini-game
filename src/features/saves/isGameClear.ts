export function isGameClear() {
  const cookie = document.cookie.match(/(?:^|;\s*)gameClear=([^;]*)/)
  return cookie ? parseInt(cookie[1], 10) > 0 : false
}

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { classifyNavigation, configuredAppUrl } = require('./navigation')

const site = 'https://econexus.example/'

test('conserve dans l’application les routes EcoNexus et les QR publics', () => {
  assert.equal(classifyNavigation(site + 'app/plantdoc', site), 'app')
  assert.equal(classifyNavigation(site + 'trace/lot-123', site), 'app')
})

test('ouvre les itinéraires externes sans les charger dans EcoNexus', () => {
  assert.equal(classifyNavigation('https://www.google.com/maps/dir/', site), 'external')
  assert.equal(classifyNavigation('https://econexus.example.autre.example/', site), 'external')
})

test('bloque les URL non HTTPS et celles avec des identifiants', () => {
  for (const address of [
    'javascript:alert(1)', 'file:///test', 'http://econexus.example',
    'https://user:password@econexus.example', 'invalide', undefined,
  ]) {
    assert.equal(classifyNavigation(address, site), 'blocked')
    assert.equal(configuredAppUrl(address), null)
  }
  assert.equal(configuredAppUrl(' https://econexus.example '), site)
})

test('autorise HTTP en développement uniquement pour le serveur local configuré', () => {
  const local = 'http://172.17.12.165:5173/'
  assert.equal(configuredAppUrl(local), null)
  assert.equal(configuredAppUrl(local, true), local)
  assert.equal(classifyNavigation(local + 'connexion', local, true), 'app')
  assert.equal(classifyNavigation('http://172.17.12.166:5173/', local, true), 'blocked')
  assert.equal(configuredAppUrl('http://econexus.example/', true), null)
})

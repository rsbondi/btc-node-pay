const bcoin = require('bcoin');
const {Payment} = require('../../payment')
const network = bcoin.Network.get('regtest');
const host = '127.0.0.1:18444'
const express = require('express')
const bodyParser = require('body-parser');
const path = require('path')
const fs = require('fs')
const https = require('https')
const privateKey  = fs.readFileSync(`${__dirname}/../key.pem`, 'utf8')
const certificate = fs.readFileSync(`${__dirname}/../cert.pem`, 'utf8')
const credentials = {key: privateKey, cert: certificate}

const xpub = "tpubDCPDDmriunw2e8s7aRg1Vfb8CXD6L2ntwnFqeaaw9fYWuksBSREVgzowxVzkfv7RbDk4FcjBh1vpDPEacEq8dRoPxeK4eZH3H6gvkB22fYY"
const paytrack = new Payment(xpub, host, network, {expiration: 2*60*60*1000})
let clients = {}

function receiveNew(ip) {
  const receiveAt = paytrack.getNewAddress(0, 'p2sh')
  clients[ip] = receiveAt
  return receiveAt
}

paytrack.on('payment_received', p => {
  console.log('payment event received', p)
  const client = Object.keys(clients).filter(k => clients[k] == p.address)
  if(client.length) delete clients[client[0]] // reset client for future donations
})

const web = express()
web.use(bodyParser.urlencoded({ extended: true}));
web.use(bodyParser.json());

web.get('/', function (req, res) {
  let receiveAt
  const addrForIp = clients[req.connection.remoteAddress]
  // prevent generating multiple addresses, save client address and reuse
  if (addrForIp) {
    const status = paytrack.getStatus(addrForIp)
    if(status && !status.error && status.remaining > 0)  receiveAt = addrForIp
    else receiveAt = receiveNew(req.connection.remoteAddress)
    // additionally you might want to consider how to handle your node being offline
  } else {
    receiveAt = receiveNew(req.connection.remoteAddress)
  }
  let index = fs.readFileSync(`${__dirname}/index.html`).toString('utf8').replace('{ADDRESS}', receiveAt)
  res.send(index)
})

web.get('/qrcode.min.js', function (req, res) {
  const file = path.join.apply(null, ['/'].concat(__dirname.split(path.sep).slice(0, -1).concat(['qrcode.min.js'])))
  res.sendFile(file)
})

const httpsServer = https.createServer(credentials, web)
httpsServer.listen(8443, () => console.log('Web server listening on port 8443!'))

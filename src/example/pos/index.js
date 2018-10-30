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
const paytrack = new Payment(xpub, host, network)
let paid = {}

paytrack.on('payment_received', p => {
  console.log('payment event received', p)
  paid[p.address] = p
})

const web = express()
web.use(bodyParser.urlencoded({ extended: true}));
web.use(bodyParser.json());

web.get('/', function (req, res) {
  res.sendFile(`${__dirname}/index.html`)
})

web.get('/qrcode.min.js', function (req, res) {
  const file = path.join.apply(null, ['/'].concat(__dirname.split(path.sep).slice(0, -1).concat(['qrcode.min.js'])))
  res.sendFile(file)
})

web.post('/check', (req, res) => {
  const address = req.param('address')
  const isPaid = !!~Object.keys(paid).indexOf(address)
  const status = paytrack.getStatus(address)
  let ret
  if(status) ret = status
  else if(isPaid) ret = {paid: isPaid}
  else ret = {paid: isPaid, remaining: 0}
  res.send(JSON.stringify(ret ))
})

web.post('/spend', (req, res) => {
  if(paytrack.connected) {
    const receiveAt = paytrack.getNewAddress(req.param('amount'), 'p2sh')
    res.send(JSON.stringify({address: receiveAt}))
  } else res.send(JSON.stringify({error: 'server node unavailable, please try again later'}))

})

const httpsServer = https.createServer(credentials, web)
httpsServer.listen(8443, () => console.log('Web server listening on port 8443!'))

const bcoin = require('bcoin');

const script = bcoin.Script.fromRaw("a9145988a26ce2123707d2df15cdd0f07447df0a6c6587", "hex")
const data = {
    firstAddressTx: {
        mine: {"value":100000,"script": bcoin.Script.fromRaw("a9145988a26ce2123707d2df15cdd0f07447df0a6c6587", "hex"),"address":"2N1QdotNaP1dEzakk6TsZH6b39eL5u2eGXC"},
        tx: bcoin.TX.fromRaw("0200000001d2d32248408e3df7616ce2afc04dfd7882cb090ef6775ca324cdc152ed25e43e01000000171600144ac93bb604016d7ba31a61abf8f4df339191f0bcfeffffff028facba010000000017a9142e78a983983ee8499c901807232c2fe48b7598b487a08601000000000017a9145988a26ce2123707d2df15cdd0f07447df0a6c658717010000", "hex")
    }
}

module.exports = data
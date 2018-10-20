const {HDPublicKey, Peer, net, Address} = require('bcoin') // TODO: decouple?
const events = require('events')
const converter = require('./addresses')
const EXPIRE_REUSE = 1*60*60*1000
const Promise = require('promise')

/**
 * Class for handling address generation and payment tracking
 */
class Payment {
    /**
     * 
     * @param {string} xpub the extended public key as hex string
     * @param {string} node the host bitcoind node host:port
     * @param {bcoin.Network} network the network to run on
     * @param {object}  cfg additional options for database path and expiration
     */
    constructor(xpub, node, network, cfg) {
        this._eventEmitter = new events.EventEmitter();
        this.on = (event, cb) => this._eventEmitter.on(event, cb)
        this.network = network
        const DB = require(`${cfg && cfg.db || './db/sqlite'}`)
        this.db = new DB(xpub)

        this.expiration = cfg && cfg.expiration || 5*60*1000 // make available for reuse after this amount of time

        // some inconsistencies in bcoin and core
        this.networkName = network.type == 'regtest' ? 'testnet' : network.type
        if(network.type == 'regtest') this.network.addressPrefix.bech32 = 'bcrt'
        
        this.watchlist = {} // store addresses here with additional information
        this.expired = {}   // store here for reuse
        this.gaps = []      // on startup, this is filled for use of addresses that were generated but never used
        this.waitingConfirmation = {} // payment received, update block height in db when block received and value here
        this.account = HDPublicKey.fromBase58(xpub, this.networkName).derive(0) // always receive, no change
        this.index = -1     // this increments to next derivation if no expired or gaps
        this.connected = false // status flag set on error from connection
        this.node = node
        this.nextN =[]
        this.usedIndexes = []
        if(node) this._setupPeer(node)

        this.db.on('db_ready', () => {
            this.db.getIndex().then(i => {
                this.index = i // set index for tracking
                this.db.getIndexState().then(s => {
                    this.gaps = s.gaps
                    this.usedIndexes = s.used
                    for(let n=this.index==-1?0:this.index; n < this.index + 20; n++) {
                        const addr = this.account.derive(n)
                        this.nextN.push({index: n, address: converter.segwitAddress(addr, this.network.type)})
                        this.nextN.push({index: n, address: converter.p2shAddress(addr, this.networkName)})
                    }
                    this._eventEmitter.emit('payment_ready') // let outside world know
                }).catch(console.log)
                this.db.getPayments().then(console.log)   
            })
        })
    }

    /**
     * connect to bitcoin node and monitor messages
     * @param {string} host bitcoind node host:port
     */
    _setupPeer(host) {
        let peer = Peer.fromOptions({
            network: this.network.type,
            agent: '/tx-listener:0.0.1/',
            hasWitness: () => {
              return false;
            }
          });
          
          const addr = net.NetAddress.fromHostname(host, this.network.type);          
          console.log(`Connecting to ${addr.hostname}`);          
          peer.connect(addr);
          peer.tryOpen();
          
          peer.on('error', e => {
              this.connected = false
              console.error(e)
              peer = null
              setTimeout(() => this._setupPeer(host), 5000)
          })
          
          peer.on('packet', (msg) => {
          
            if(msg.cmd === 'version') {
                console.log('version command, block height', msg.height)
                this.height = msg.height
                this.db.getBlock().then(b => {
                    if(b[0].hash) peer.sendGetBlocks([b[0].hash])
                }) 
        }
          
            if(msg.cmd === 'tx') {
                const mine = msg.tx.outputs.filter(o => ~Object.keys(this.watchlist).indexOf(this._outputAddress(o)))
                if(mine.length) { this._handleMine(mine[0], msg.tx) }
            }
          
            if (msg.cmd === 'block') {
              this._handleBlock(msg.block.toBlock())
            }
          
            if (msg.cmd === 'inv') { 
                peer.getData(msg.items) 
            }
          });
          
          peer.on('open', () => { 
              this.connected = true; 
              console.log('peer connection established, listening for transactions') 
            })
          
    }

    /**
     * handle block message and update height in database
     * @param {bcoin.Block} block the new block received
     */
    _handleBlock(block) {
        return new Promise((resolve, reject) => {
            this.height++
            this.db.trackBlock(block.hash().toString('hex'))
            let promises = []
            block.txs.forEach(tx => {
                const txid = Buffer.from(tx.hash()).reverse().toString('hex')
                const blockhash = Buffer.from(block.hash()).reverse().toString('hex')
                if (this.waitingConfirmation[txid]) {
                    promises.push(this.db.setBlock(txid, this.height, blockhash))
                } else {
                    const myTxOuts = tx.outputs.filter(o => {
                        return ~this.nextN.map(n => n.address).indexOf(this._outputAddress(o))
                    })
                    if(myTxOuts.length) { 
                        const txout = myTxOuts[0]
                        const payment = this._paymentFromTxOut(txout, tx)
                        payment.index = this.nextN.filter(n => n.address == payment.address)[0].index
                        this.usedIndexes.push(payment.index)
                        promises.push(this.db.savePayment(payment).then(() => promises.push(this.db.setBlock(txid, this.height, blockhash))))
                    }
                }

            })
            Promise.all(promises).then(resolve).catch(reject)
        })
    }

    _paymentFromTxOut(txout, tx) {
        const address = this._outputAddress(txout)
        return {
            address: address,
            amount: txout.value,
            tx: tx
        }
    }

    /**
     * handle transaction message for monitored address
     * @param {bcoin.Output} txout 
     * @param {bcoin.Transaction} tx 
     */
    _handleMine(txout, tx) {
        return new Promise((resolve, reject) => {
            const payment = this._paymentFromTxOut(txout, tx)
            const address =payment.address
            let item = this.watchlist[address]
            payment.index = item.index
            if(payment.amount < (item.amount - item.received)) {
                payment.error = "insufficient amount received"
                item.received += payment.amount
            }
            this._eventEmitter.emit('payment_received', payment)
            this.db.savePayment(payment)
            const txid = Buffer.from(tx.hash()).reverse().toString('hex')
            this.waitingConfirmation[txid] = Object.assign(this.watchlist[address], {address: address})
            if(!payment.error) {
                clearTimeout(this.watchlist[address].timer)
                delete this.watchlist[address]
            }
        })
    }

    /**
     * gets the index of the next dervation item checking expired and gaps or incrementing
     * @returns {number} the available index for derivation
     */
    _getNextIndex() { 
        const now = (new Date()).getTime()
        const matured = Object.keys(this.expired).filter(a => now - this.expired[a].expires > EXPIRE_REUSE)
        if(matured.length) {
            const index = this.expired[matured[0]].index
            delete this.expired[matured[0]]
            matured.shift()
            return index
        }
        if(this.gaps.length) 
            return this.gaps.shift()
        while(~this.usedIndexes.indexOf(++this.index)) {}
        return this.index 
    }

    /**
     * get status for address,
     * @param {string} address 
     * @returns {object|null} time remaining or null
     */
    getStatus(address) {
        const item = this.watchlist[address]
        if(this.node && !this.connected) return {error: "node is currently not connected"}
        if(item) return {paid: false, remaining: item.expires - (new Date()).getTime()}
        else return null
    }

    /**
     * get address and set up monitoring
     * @param {number} amt how much is considered paid for pos/invoice, can be zero for donations, any amount valid
     * @param {string} type the address type, bech32 or p2sh
     * @returns {string} monitored address
     */
    getNewAddress(amt, type) {
        const index = this._getNextIndex()
        const receiveAddress = this.account.derive(index)

        let address 
        if(type == 'bech32') address = converter.segwitAddress(receiveAddress, this.network.type)
        else if(type='p2sh') address = converter.p2shAddress(receiveAddress, this.networkName)

        this.watchlist[address] = {
            amount: amt, 
            received: 0,
            index: index,
            expires: (new Date()).getTime() + this.expiration
        }
        this.watchlist[address].timer = setTimeout(() => {
            if(this.watchlist[address]) {
                this.expired[address] = this.watchlist[address]
                delete this.watchlist[address]
            }
        }, this.expiration)
        return address
    }
    
    /**
     * gets address for output
     * @param {bcoin.Output} o the output to decode
     * @returns {string} the address for the output
     */
    _outputAddress(o) {
        const address = Address.fromScript(o.script) 
        if(!address) return ''
        if(address.type < 2)
            return address.toBase58(this.networkName)
        else return address.toBech32(this.network.type)
    }
}

module.exports = {Payment: Payment}

// TODO: if payment short, get new address to complete
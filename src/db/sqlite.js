const sqlite3 = require('sqlite3').verbose();
const events = require('events');
const Promise = require('promise');

/**
 * database class for sqlite
 */
class DB {
    /**
     * database class constructor
     * @param {string} key this is a unique identifier for the xpub instance
     */
    constructor(key) {
        this._eventEmitter = new events.EventEmitter();
        this.on = (event, cb) => this._eventEmitter.on(event, cb)
        this.db = new sqlite3.Database(key ? key.slice(-16) : ':memory:')
        this.db.serialize(() => {
            this.db.get("SELECT * FROM sqlite_master WHERE type='table'", (err, tbl) => {
                if (!tbl) this._nodb()
                else this._eventEmitter.emit('db_ready')
            })
        })    
    }

    /**
     * save a pyment to the database
     * @param {object} payment 
     * @property {string} payment.address the bitcoin address
     * @property {number} payment.amount number of satoshis for payment
     * @property {number} payment.index index of the derivation path last segment
     * @property {bcoin.Transaction} payment.tx the complete transaction object
     */
    savePayment(payment) {
        return new Promise((resolve) => {
            const {address, amount, index, tx} = payment
            const txid = Buffer.from(tx.hash()).reverse().toString('hex') //TODO: decouple bcoin here
            const pmt = this.db.prepare("INSERT INTO payments VALUES (?, ?, ?, ?, ?)")
            pmt.run(address, amount, index, (new Date()).toISOString(), txid)
            pmt.finalize()
            
            const txx = this.db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?)")
            txx.run(txid, '', -1, tx.toRaw())
            txx.finalize(resolve)
            
        })
    }

    /**
     * update a transaction to include block hash and height
     * @param {string} txid the transaction id
     * @param {number} height block height
     * @param {string} block block hash
     * @returns {Promise}
     */
    setBlock(txid, height, block) {
        return new Promise((resolve) => {
            const pmt = this.db.prepare(`UPDATE transactions SET block=?, height=? WHERE txid='${txid}'`)
            pmt.run(block, height)
            pmt.finalize(resolve)
        })
    }

    /**
     * fetch a transaction by txid
     * @param {string} hash the txid
     * @returns {Promise<array>} single transaction object
     */
    trackBlock(hash, height) {
        return new Promise((resolve) => {
            const pmt = this.db.prepare("UPDATE block SET hash=?, height=? WHERE idx=0")
            pmt.run(hash, height)
            pmt.finalize(resolve)
        })
    }

    /**
     * fetch single result of the latest known block
     * @returns {Promise<array>} single block result
     */
    getBlock() {
        return new Promise((resolve, reject) => this._query(resolve, reject, "SELECT * FROM block"))
    }

    /**
     * currently used for troubleshooting, not required
     * @returns {Promise<array>} list of payments received
     */
    getPayments() {
        return new Promise((resolve, reject) => this._query(resolve, reject, "SELECT * FROM payments p JOIN transactions t ON p.txid=t.txid"))    
    } 

    /**
     * currently used for troubleshooting, not required
     * @param {string} address 
     * @returns {Promise<array>} single record for payment to address or empty if not existing
     */
    getPayment(address) {
        return new Promise((resolve, reject) => this._query(resolve, reject, `SELECT * FROM payments  p JOIN transactions t ON p.txid=t.txid WHERE address='${address}'`))
    }

    /**
     * currently used for troubleshooting, not required
     * @param {string} hash 
     * @returns {Promise<array>} single record for transaction or empty if not existing
     */
    getTransaction(hash) {
        return new Promise((resolve, reject) => this._query(resolve, reject, `SELECT * FROM transactions WHERE txid='${hash}'`))
    }

    /**
     * gets the next index for derivation, excluding gaps
     * @returns {Promise<number>} the index
     */
    getIndex() {
        return new Promise((res, rej) => {
            (new Promise((resolve, reject) => this._query(resolve, reject, `SELECT MAX(idx) idx FROM payments`))).then(i => {
                let index
                if(i.length && i[0].idx !== null) index = i[0].idx; else index = -1
                res(index)
            }) 
        })
    }

    /**
     * gets all indexes that had been generated but no payment received for reuse, called on startup
     * @returns {Promise<number[]>} array of all indexes that had been generated but have not received payments
     */
    getIndexState() {
        const sql =`SELECT idx
        FROM payments ORDER BY idx ASC;`

        return new Promise((resolve, reject) => {
            this.db.all(sql, (err, results) => {
                if(err) reject(err)
                else {
                    let gaps = []
                    if(results.length) for(let g=0;g<results[0].idx; g++) gaps.push(g) // leading gaps
                    for(let i=0, j=1; j<results.length; i++,j++) {
                        const thisone = results[i].idx
                        const nextone = results[j].idx
                        for(let t=thisone+1; t<nextone; t++) gaps.push(t)
                    }
                    resolve({gaps:gaps, used:results})
                }
            })    
        })
    }

    _query(resolve, reject, sql) {
        this.db.all(sql, (err, results) => {
            if(err) reject(err)
            else resolve(results)
        })
    }

    _txCreated() { 
        this.db.run("CREATE TABLE block (idx INT , hash TEXT, height INT);", (err, result) => {
            this.db.run("INSERT INTO block VALUES(0, '', 0);", (e,r) => {
                this._eventEmitter.emit('db_ready') 
            })
        })
    }

    _paymentCreated() { 
        this.db.run("CREATE TABLE transactions (txid TEXT PRIMARY KEY , block TEXT, height INT, tx BLOB);", (err, result) => {
            this._txCreated()
        }) 
    }

    _nodb() { 
        this.db.run("CREATE TABLE payments (address TEXT PRIMARY KEY , amount INT, idx INT, time DATE, txid TEXT);", (err, result) => {
            this.db.run("CREATE UNIQUE INDEX idx_payments_index ON payments (idx);", (err, result) => this._paymentCreated())
        }) 
    }
}

module.exports = DB
var sqlite3 = require('sqlite3').verbose();
const events = require('events');
var Promise = require('promise');

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
        this.db = new sqlite3.Database(key.slice(-16))
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
        const {address, amount, index, tx} = payment
        const txid = Buffer.from(tx.hash()).reverse().toString('hex')
        const pmt = this.db.prepare("INSERT INTO payments VALUES (?, ?, ?, ?, ?)")
        pmt.run(address, amount, index, (new Date()).toISOString(), txid)
        pmt.finalize()
        
        const txx = this.db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?)")
        txx.run(txid, '', -1, tx.toRaw())
        txx.finalize()
        
    }

    /**
     * update a transaction to include block hash and height
     * @param {string} txid the transaction id
     * @param {number} height block height
     * @param {string} block block hash
     */
    setBlock(txid, height, block) {
        const pmt = this.db.prepare(`UPDATE transactions SET block=?, height=? WHERE txid='${txid}'`)
        pmt.run(block, height)
        pmt.finalize()
    }

    trackBlock(hash) {
        const pmt = this.db.prepare("UPDATE block SET hash=? WHERE idx=0")
        pmt.run(hash)
        pmt.finalize()
    }

    getBlock() {
        return new Promise((resolve, reject) => this._query(resolve, reject, "SELECT * FROM block"))
    }

    /**
     * currently used for troubleshooting, not required
     * @returns {array} list of payments received
     */
    getPayments() {
        return new Promise((resolve, reject) => this._query(resolve, reject, "SELECT * FROM payments p JOIN transactions t ON p.txid=t.txid"))    
    } 

    /**
     * currently used for troubleshooting, not required
     * @param {string} address 
     * @returns {array} single record for payment to address or empty if not existing
     */
    getPayment(address) {
        return new Promise((resolve, reject) => this._query(resolve, reject, `SELECT * FROM payments WHERE address='${address}'`))
    }

    /**
     * gets the next index for derivation, excluding gaps
     * @returns {number} the index
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
     * @returns {number[]} array of all indexes that had been generated but have not received payments
     */
    getGaps() {
        const sql =`SELECT p.idx + 1 AS idx
        FROM payments as p
          LEFT OUTER JOIN payments as r ON p.idx + 1 = r.idx
        WHERE r.idx IS NULL;`

        return new Promise((resolve, reject) => this._query(resolve, reject, sql))
    }

    _query(resolve, reject, sql) {
        this.db.all(sql, (err, results) => {
            if(err) reject(err)
            else resolve(results)
        })
    }

    _txCreated() { 
        this.db.run("CREATE TABLE block (idx INT , hash TEXT);", (err, result) => {
            this.db.run("INSERT INTO block VALUES(0, '');", (e,r) => {
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
var sqlite3 = require('sqlite3').verbose();
const events = require('events');
var Promise = require('promise');

class DB {
    constructor() {
        this._eventEmitter = new events.EventEmitter();
        this.on = (event, cb) => this._eventEmitter.on(event, cb)
        this.payments = []
        this.transactions = []
        this._eventEmitter.emit('db_ready') 
    }

    savePayment(payment) {
        const {address, amount, index, tx} = payment
        const txid = Buffer.from(tx.hash()).reverse().toString('hex')
        this.payments.push({address: address, amount: amount, idx: index, time: '', txid: txid})
        
        this.transactions.push({txid: txid, block: '', height: -1, tx: tx.toRaw()})
    }

    setBlock(txid, height, block) {
        let tx = this.transactions.filter(tx => tx.txid == txid)[0]
        tx.block = block
        tx.height = height
    }

    getPayments(offset, limit) {
        return new Promise((resolve, reject) => {
            this.transactions.slice().reduce((o,c,i) => {
                let p = o.filter(t => t.txid == c.txid)[0]
                p.block = c.block; p.height = c.height; p.tx = c.tx;
                return o
            }, this.payments.slice())
        })    
    } 

    getPayment(address) {
        return new Promise((resolve, reject) => resolve(this.payments.slice().filter(p => p.address == address)[0]))
    }

    getIndex() {
        return new Promise((res, rej) => {
            res(this.payments.slice().reduce((o, c) => {
                return Math.max(o, c.idx)
            }, -1))
        })
    }

    getGaps() {
        const gaps = this.payments.reduce((o, c, i) => {
            if(i) {
                if(i) {
                    const prev = this.payments[i-1].idx
                    let gap = c.idx - prev
                    for(let p = prev+1; p < c.idx; p++) o.push(p)
                }
            }
            return o

        },[])

        return new Promise((resolve, reject) => resolve(gaps))
    }

}

module.exports = DB
var sqlite3 = require('sqlite3').verbose();
const events = require('events');
var Promise = require('promise');

class DB {
    constructor() {
        this._eventEmitter = new events.EventEmitter();
        this.on = (event, cb) => this._eventEmitter.on(event, cb)
        this.payments = []
        this.transactions = []
        setTimeout(() => {
            this._eventEmitter.emit('db_ready') 
        }, 0)
    }

    savePayment(payment) {
        return new Promise((resolve) => {
            
            const {address, amount, index, tx} = payment
            const txid = Buffer.from(tx.hash()).reverse().toString('hex')
            this.payments.push({address: address, amount: amount, idx: index, time: '', txid: txid})
            this.transactions.push({txid: txid, block: '', height: -1, tx: tx.toRaw()})
            resolve()
        })
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
        return new Promise((resolve, reject) => {
            const payment = this.payments.slice().filter(p => p.address == address)
            resolve(payment)
        })
    }

    getIndex() {
        return new Promise((res, rej) => {
            res(this.payments.slice().reduce((o, c) => {
                return Math.max(o, c.idx)
            }, -1))
        })
    }

    getIndexState() {
        return new Promise((resolve, reject) => {
            let gaps = []
            let results = this.payments.map(p => p.idx)
            if(results.length) for(let g=0;g<results[0].idx; g++) gaps.push(g) // leading gaps
            for(let i=0, j=1; j<results.length; i++,j++) {
                const thisone = results[i].idx
                const nextone = results[j].idx
                for(let t=thisone+1; t<nextone; t++) gaps.push(t)
            }
            resolve({gaps:gaps, used:results})
        })
        
    }

    trackBlock(hash) {

    }

}

module.exports = DB
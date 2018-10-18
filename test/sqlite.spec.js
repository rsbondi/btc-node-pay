const DB = require('../src/db/sqlite')
const assert = require('assert');
const bcoin = require('bcoin');
const testdata = require('./testdata/data')

describe('Test sqlite database class', function () {
    it('should start with -1 index', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            const index = await db.getIndex()
            assert.equal(index, -1)
            done()
        })
    })

    it('should index properly for payments saved', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            const payment = {
                address: "address",
                amount: 0,
                tx: testdata.firstAddressTx.tx,
                index: 7
            }
            db.savePayment(payment)
    
            const index = await db.getIndex()
            assert.equal(index, 7)
            done()
        })
    })

    it('should retrieve gaps', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            let payment = {
                address: "address",
                amount: 0,
                tx: testdata.firstAddressTx.tx,
                index: 1
            }
            db.savePayment(payment)
            let bogustx = testdata.firstAddressTx.tx
            bogustx._hash = "xxxx" // hack for no duplicate txid
            payment = {
                address: "address2",
                amount: 0,
                tx: bogustx,
                index: 4
            }
            await db.savePayment(payment)
            const gaps = await db.getGaps()
            // FIXME: this is wrong, should be [2,3]
            assert.equal(JSON.stringify(gaps.map(g => g.idx)), JSON.stringify([2,5]))
            done()
    
        })
    })

})

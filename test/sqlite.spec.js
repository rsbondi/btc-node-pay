const DB = require('../src/db/sqlite')
const assert = require('assert');
const bcoin = require('bcoin');
const testdata = require('./testdata/data')

describe('Test sqlite database class', function () {
    it('should start with -1 index', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            const index = await db.getIndex()
            assert.strictEqual(index, -1)
            done()
        })
    })

    it('should update index properly for payments saved', function (done) {
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
            assert.strictEqual(index, 7)
            done()
        })
    })

    it('should retrieve gaps and used indexes', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            let payment = {
                address: "address",
                amount: 0,
                tx: testdata.firstAddressTx.tx,
                index: 1
            }
            await db.savePayment(payment)
            let bogustx = testdata.firstAddressTx.tx
            bogustx._hash = "xxxx" // hack for no duplicate txid
            payment = {
                address: "address2",
                amount: 0,
                tx: bogustx,
                index: 4
            }
            await db.savePayment(payment)
            const state = await db.getIndexState()
            assert.strictEqual(JSON.stringify(state.gaps), JSON.stringify([0,2,3]))
            assert.strictEqual(JSON.stringify(state.used), JSON.stringify([1,4]))
            done()
    
        })
    })

    it('should save and retrieve payments', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            let payment = {
                address: "address",
                amount: 0,
                tx: testdata.firstAddressTx.tx,
                index: 1
            }
            await db.savePayment(payment)
            const pay = await db.getPayment("address")
            assert.strictEqual(payment.index, pay[0].idx)
            assert.strictEqual(payment.amount, pay[0].amount)
            done()
        })
    })

    it('should track latest block hash', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            await db.trackBlock("abcd123")
            let block = await db.getBlock()
            assert.strictEqual(block[0].hash, "abcd123")
            await db.trackBlock("wxyz123")
            block = await db.getBlock()
            assert.strictEqual(block[0].hash, "wxyz123")
            done()
        })
    })

    it('should retrieve transaction', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            const bogustx = testdata.firstAddressTx.tx
            let payment = {
                address: "address",
                amount: 0,
                tx: bogustx,
                index: 2
            }
            await db.savePayment(payment)
            const txid = Buffer.from(bogustx.hash()).reverse().toString('hex')
            const tx = await db.getTransaction(txid)
            assert.strictEqual(txid, tx[0].txid)
            done()
        })
    })

    it('should set block confirmation', function (done) {
        const db = new DB()
        db.on('db_ready', async () => {
            let payment = {
                address: "address",
                amount: 0,
                tx: testdata.firstAddressTx.tx,
                index: 1
            }
            await db.savePayment(payment)
            const txid = Buffer.from(testdata.firstAddressTx.tx.hash()).reverse().toString('hex')

            await db.setBlock(txid, 100, "AAAABBBBCCCCDDDD")

            const p = await db.getPayment("address")

            assert.strictEqual(p[0].block, "AAAABBBBCCCCDDDD")
            done()
    
        })
    })


})

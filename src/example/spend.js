const {KeyRing, Script, Mnemonic, HDPrivateKey} = require('bcoin')

class Spend {
    static info(index, network) {
        const mnemonic = Mnemonic.fromPhrase('praise you muffin lion enable neck grocery crumble super myself license ghost')
        const key = HDPrivateKey.fromMnemonic(mnemonic, "");
        const account = key.derivePath(`m/49'/0'/1'`)
        const rec = account.derive(0).derive(index)
        const keyring = new KeyRing(rec.privateKey);
        let p2sh = new Script();
        p2sh.pushOp(Script.opcodes.OP_0); 
        p2sh.pushData(keyring.getKeyHash()); 
        p2sh.compile(); 
        const redeemScript = p2sh.raw.toString('hex')
        
        return {
          privateKey: keyring.toSecret(network),
          script: p2sh,
          redeemScript: p2sh.raw.toString('hex')
        }
             
    }
}

const network = require('bcoin').Network.get('testnet')
for(let i=0; i<10; i++) {
    const info = Spend.info(i, network)
    console.log(info.privateKey, info.redeemScript)
}

module.exports = Spend
const {KeyRing, Script} = require('bcoin')
class AddressConverter {
    static segwitAddress(receiveAddress, network) {
        const ring = KeyRing.fromPublic(receiveAddress.publicKey)
        let p2wpkhScript = new Script();
        p2wpkhScript.pushOp(Script.opcodes.OP_0); 
        p2wpkhScript.pushData(ring.getKeyHash()); 
        p2wpkhScript.compile(); 

        const witaddress = p2wpkhScript.getAddress();
        
        const address = witaddress.toBech32(network)
        return address
    }

    static p2shAddress(receiveAddress, network) {
        const ring = KeyRing.fromPublic(receiveAddress.publicKey)
        ring.witness = true
        const address = ring.getNestedAddress()
        return address.toBase58(network)
    }

}

module.exports = AddressConverter
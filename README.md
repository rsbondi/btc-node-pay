### Overview

WIP - this should be usable, but not tested, testers welcome

This is a simple class to receive bitcoin payments using xpub.  Addresses are tracked
and expired addresses are re-used.  Defaults to sqlite but can be used with any db by providing
proper db class.  You are the payment processor so you process directly in your apps without
appearing to go to a third party.  Example use case would be to embed a qr code for donations
on a web page but with no address re-use.  An event is raised when a payment is received.

This is receive only and is not meant to be a complete wallet back end, you use the wallet of 
your choice and generate an xpub, and use this library to automate generation of addresses for 
receiving funds in your app.

### Requirements

nodejs and a fully synced bitcoin core node

### Usage

```javascript
const Payment = require('btc-node-pay')
const network = 'testnet'
const xpub = "xpub..."
const host = '127.0.0.1:18333'
const paytrack = new Payment(xpub, host, network)

paytrack.on('payment_received', p => {
  // do something meaningful
})

// expect a pament of 2000 satoshis, use zero for donation of any value
const payme = paytrack.getNewAddress(2000, 'p2sh')
// generate qr code or something
```


see `example` directory in repository for more usage info

### Limitations

* At least one block needs to be mined before shutdown to track properly on startup
* Currently does not handle reorg so you may end up with addresses not used if logged beforehand

### Defining additional database types

The default database is sqlite.  You can create a simple database class for use with any database by creating the class and implementing the methods.  See the `sqlite.js` file for methods and types.  Methods beginning with underscore do not need to be implemented.
 
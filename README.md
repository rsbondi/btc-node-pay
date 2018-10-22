### Overview

WIP - not a production ready library

This is a simple class to receive bitcoin payments using xpub.  Addresses are tracked
and reuses expired addresses.  Defaults to sqlite but can be used with any db by providing
proper db class.  You are the payment processor so you process directly in your apps without
appearing to go to a third party.

### Usage

see `example` directory

### Limitations

* At least one block needs to be mined before tracking properly after shutdown
* Currently does not scan on startup for payments confirmation

### Defining additional database types

The default database is sqlite.  You can create a simple database class for use with any database by creating the class and implementing the methods.  See the `sqlite.js` file for methods and types.  Methods beginning with underscore do not need to be implemented.

### TODO:

* expand tests for lib and sqlite
* ✔ create sqlite tests
* ✔ fix gaps with consecutive nulls
* ✔ catch up on restart
    * ✔ get blocks, check for payments received
    * ✔ track block height, currently it is out of sync
* ✔ recovery window, check n addresses ahead to monitor, check on restart
* ✔ add get transaction to db
* document db definition for implementing db class for different db(postgre, mysql, etc.)

 
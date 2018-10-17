### Overview

WIP - not a production ready library

This is a simple class to receive bitcoin payments using xpub.  Addresses are tracked
and reuses expired addresses.  Defaults to sqlite but can be used with any db by providing
proper db class.  You are the payment processor so you process directly in your apps without
appearing to go to a third party.

### Usage

see `example` directory

### Limitations

* Currently does not check for payments received external to this class
* Currently does not scan on startup for payments confirmation

### Defining additional database types

The default database is sqlite.  You can create a simple database class for use with any database by creating the class and implementing the methods.  See the `sqlite.js` file for methods and types.  Methods beginning with underscore do not need to be implemented.

### TODO:

* expand tests for lib
* create sqlite tests
* catch up on restart
    * get blocks, check for payments received
    * tracke block height
* recovery window, check n addresses ahead to monitor, check on restart
* document db definition for implementing db class for        different db(postgre, mysql, etc.)

 
var procedure = require('./index');
var print = procedure('print');
print.method(String, function(s) { console.log( "fooooo" ); });
print("foo");

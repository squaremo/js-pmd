var procedure = require('./index');
var print = procedure('print');
print.method(String, function(s) { console.log( "any string" ); });
print("foo");
print.method('foo', function(s) { console.log( "foo!" ); });
print("foo");

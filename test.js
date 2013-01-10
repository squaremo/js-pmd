var procedure = require('./index');
var print = procedure('print');
print.method(String, function(s) { console.log( "any string" ); });
print("foo");
print.method('foo', function(s) { console.log( "foo!" ); });
print("foo");
print.method(Object, function(o) { console.log( "any object" ); });
print(3);

print(undefined);
print.method(undefined, function(_) { console.log("undefineded"); });
print(undefined);

# Multiple dispatch in JavaScript

This module implements the <def>Prototype Multiple Dispatch</def>
algorithm as described in <http://lee.fov120.com/ecoop.pdf>. I'm
writing it to see how programming in JavaScript with multiple dispatch
works out.

## Example

The general pattern is to create a procedure then add methods
specialising it. Methods may specialise in any argument to
constructors or values. When invoked, the procedure chooses the most
specific method given the arguments and applies it.

```javascript
var procedure = require('./index'), Any = procedure.Any;

// Create a generic function
var print = procedure('print');

// Specialise
print.method(Any, function (a) { return 'ANY:' + a.toString(); });
print.method(Number, function (n) { return 'NUM: ' + n; });
print.method(3, function (three) { return 'MAGIC NUM'; });

// print can be used like a regular function
print(3);
print(17);
print(true);
```

## Adaption to JavaScript

The model given in the paper is parameterised on two operators and one
function. One operator determines how to construct a rank for a method
and another determine how these are ordered. I follow Slate in
constructing vectors from the argument ranking and ordering them
lexically.

The function `delegates` in the model produces a list of the delegates
of an object, and this is where it must be adapted to JavaScript.

In JavaScript, delegation is through the object constructor's
`prototype` property. This conveniently gives us the ability to
specialise on types (the constructors) or values (the arguments
themselves and constructor prototypes).

JavaScript's built-in constructors don't have a common ancestor; for
this reason I introduced an `Any` constructor to act as a top type
(i.e., it accepts any value). This makes defining methods with unused
arguments easier and admits some optimisations described in the paper.

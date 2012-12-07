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
var procedure = require('./index');

// Create a generic function
var print = procedure('print');

// Specialise
print.method(Object, function (a) { return 'ANY: ' + a.toString(); });
print.method(Number, function (n) { return 'NUM: ' + n; });
print.method(3, function (three) { return 'MAGIC NUM'; });

// print can be used like a regular function
print(3);
// => 'MAGIC NUM'
print(17);
// => 'NUM: 17'
print(true);
// => 'ANY: true'
```

(By the way, the argument to `procedure` is really just to make nicer
symbols for debugging, but it may become important if the machinery is
more exposed in the future.)

## Adaption to JavaScript

The model given in the paper is parameterised, so that it can be
adapted to languages other than Slate for which it was designed.

One variable is the way in which the most applicable method is chosen
given a list of arguments. I mimic Slate in ordering methods by the
'closeness' (least distance in the delegation chain) of the first
argument, then in the case of a tie, the second argument, and so on.

Another variable is how the delegation chain is determined (this ties
into the notion of 'closeness' above). In JavaScript, delegation is
through an object's [[prototype]] (non-standardly available as the
property `__proto__`). THe [[rototype]] is supplied either as the
argument to `Object.create(proto)`, or implicitly as the constructor
function's `prototype` property.

This gives us the ability to specialise on values by using the
prototypes themselves, or on types by using the `prototype` property
of the constructor. In general, using `Object.create()` would lead to
the first kind of specialisation, and using the `new` operator would
lead to the second.

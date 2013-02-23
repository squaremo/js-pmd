# Multiple dispatch in JavaScript

This module implements generic functions, for JavaScript, using the
<def>Prototype Multiple Dispatch</def> algorithm as described in
<http://lee.fov120.com/ecoop.pdf>. I'm writing it to see how
programming in JavaScript with generic functions works out.

## What are generic functions?

A generic function is a family of procedures (I'm using "procedure" to
distinguish the family members from the family itself, but think of
them as regular functions), of which one is selected to be run for a
given invocation. The particular procedure that will run depends on
the types of the arguments; each of the procedures in the family is
called a "method".

This is like methods in JavaScript -- if I say `foo.frobnicate(bar)`,
it's the `frobnicate` belonging to `foo`, or somewhere on its
prototype chain, that is called. You could see all methods called
`frobnicate` as being in a family, with the particular method run
depending on what appears before the dot when `frobnicate` is
invoked. With generic functions, though, the method run can depend on
any or all of the arguments; each method belongs to all its arguments,
not just the first one. This is usually called "multiple dispatch", as
opposed to the "single dispatch" of JavaScript (also Java, Smalltalk,
and others).

One consequence of methods not belonging to a single value is that you
have to define them outside of values, and that leads to a more openly
extensible system. For example, say I have a widget type that renders
a value differently depending on what kind of value it is (please
excuse poor jqueryism here, and let's pretend the value is boxed):

    Widget.prototype.render = function(value) {
      if (val instanceof String) {
        this.append($('<input class="str"/>').val(value));
      }
      else if (value instanceof Boolean) {
        this.append($('<input type="checkbox"/>').selected(value));
      }
      // ...
    };

In some other file, I introduce my own kind of value that's specific
to my application, and which I want to render its own specific
way. Now I have a quandary. I could change my `widget.render`, adding
another `else if` for my new kind of value. This doesn't seem very
satisfactory, at best.

Alternatively, I could rewrite `widget.render` use what's called
double dispatch; that is, instead of checking the type of the value,
it calls a method on the value:

    Widget.prototype.render = function(value) {
      this.append(value.toInput());
    };

This way the code particular to my new kind of value can be given
along with it. However, now the code for `String`s and `Boolean`s also
has to go with them too; again, not very satisfactory. (This conundrum
is akin to the [Expression
Problem](http://en.wikipedia.org/wiki/Expression_problem). I say
"akin" because we're not trying to keep type safety here, just to not
fling code everywhere).

If `render` were a generic function, I could just add another method,
alongside my new type, without disturbing any other `render` methods,
or `String` and `Boolean`. Something like this:
 
    render.method(Widget, MyValue, function(widget, value) {
      var opts = $('<select class="myval"/>');
      // ...
      widget.append(opts);
    });


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
property `__proto__`). The [[prototype]] is supplied either as the
argument to `Object.create(proto)`, or implicitly via the constructor
function's `prototype` property.

This gives us the ability to specialise on values by using the
prototypes themselves, or on types by using the `prototype` property
of the constructor. In general, using `Object.create()` would lead to
the first kind of specialisation, and using the `new` operator would
lead to the second.

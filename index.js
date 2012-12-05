// Slate-like multimethod dispatch

// From the paper:

// The rule R-Lookup is a straight-forward transcription of the idea
// of multiple dispatch. It states that a method body should be
// dispatched if it is applicable - a member of the set of applicable
// methods - and it is the most speciﬁc of all such method bodies, or
// rather, is the least method body according to an operator that
// compares the applicable method bodies. The rank function and ≺
// operator together implement this comparison operator.

// We then deﬁne the applic set of methods as those methods for which
// every argument either contains a satisfactory role for the method,
// or delegates to an object with such a role. A role here is
// satisfactory if index of the method argument on which it is found
// matches that in the role, and the method selector matches that in
// the role as well. This deﬁnition relies on the delegates function,
// which returns an ordered list of all delegated-to objects
// transitively reachable by the delegation lists in objects, and
// including the original method argument itself.  In the case of a
// statically-ﬁxed delegation hierarchy, this rule exactly mirrors the
// applicability criteria in previous multi-method languages such as
// Cecil, Dylan and CLOS.


/*
dispatch(selector, args, n) {
    for each index below n {
        position := 0
        push args[index] on ordering stack
        while ordering stack is not empty {
            arg := pop ordering stack
            for each role on arg with selector and index {
                rank[role’s method][index] := position
                if rank[role’s method] is fully specified {
                    if no most specific method
                    or rank[role’s method] ≺ rank[most specific method] {
                        most specific method := role’s method
                    }
                }
            }
            for each delegation on arg {
                push delegation on ordering stack if not yet visited
            }
            position := position + 1
        }
    }
    return most specific method
}
*/


// Here role means position in arguments; since methods are
// internalised at objects, it makes sense to look at all the
// positions in which an object may appear while examining that
// object.

// JavaScript isn't used in the same way as say, Self; objects are
// created using constructor functions, and delegate using the
// (single) prototype slot *of the constructor*. We'll follow the
// delegation chain

//     object -> object.constructor -> object.constructor.prototype

// We keep a table of selector -> position -> methods at
// each object. While dispatching, we have to keep track of the rank
// vector of each method; to keep this as local state we gensym a
// string to be used in the hash table. This also avoids conflicts
// that might arise if, for instance, a function value was used as the
// body for more than one method.

'use strict';

var gensym_counter = 0;
function gensym(name) {
    return name + '_' + (gensym_counter++);
}

// JavaScript's delegation chains don't have the same root; we'll
// substitute our own, for the convenience of defining methods with
// discard (unused) arguments, and also so we can potentially do some
// of the optimisations described in the PMD paper (specifically
// sparse rank vectors and partial dispatch).
//
// This ends up being a special-case in the delegation chain code.
function ANY() {}
ANY.prototype = {};

function procedure(name) {
    var selector = gensym(name); // possibly gensym name, or fully qualify it, or ..
    var METHODS = {};

    var STRINGS = {};
    var NUMBERS = {};
    var TRUE_TABLE = {};
    var FALSE_TABLE = {};
    var NULL_TABLE = {};

    function get_table(value, create) {
        switch (typeof value) {
        case 'string':
            if (value in STRINGS) {
                return STRINGS[value];
            }
            else {
                return (create) ? STRINGS[value] = {} : false;
            }
        case 'number':
            if (value in NUMBERS) {
                return NUMBERS[value];
            }
            else {
                return (create) ? NUMBERS[value] = {} : false;
            }
        case 'boolean':
            return value && TRUE_TABLE || FALSE_TABLE;
        default: // Object, Array, RegExp, Function
            if (value === null) {
                return NULL_TABLE;
            }
            // %% defineProperty
            var hasRoles = value.hasOwnProperty('__roles__');
            if (create && !hasRoles) {
                Object.defineProperty(value, '__roles__',
                                      {value: {}, enumerable: false});
            }
            return value.__roles__;
        }
    }

    function method(/* object 1..n, bodyFn*/) {
        var methodname = gensym(name);
        var body = arguments[arguments.length-1];
        for (var i = 0, len = arguments.length-1; i < len; i++) {
            var arg = arguments[i];
            var rolename = selector + ':' + i;
            var table = get_table(arg, true);
            //console.log({TABLE: table});
            if (!table[rolename]) table[rolename] = [];
            table[rolename].push(methodname);
        }
        METHODS[methodname] = body;
    }

    function lookup(args) {
        var ranks = {};
        // %% since we only have one delegate at any point, this could
        // %% be a register.
        var stack = [];
        var mostspecificmethod;

        for (var i=0, len = args.length; i < len; i++) {
            var position = 0;
            var rolename = selector + ':' + i;
            var n = 0;
            stack.push({isValue: true, arg: args[i]});
            while (stack.length > 0 && n < 10) {
                n++;
                var _a = stack.pop();
                var arg = _a.arg, isValue = _a.isValue;
                //console.log({ARG: arg});
                var methods;
                var table = get_table(arg, false);
                if (table && (methods = table[rolename])) {
                    methods.forEach(function (methodname) {
                        var rank;
                        if (!(rank = ranks[methodname])) {
                            rank = ranks[methodname] = {
                                filled: 0,
                                vector: []
                            };
                        }
                        rank.vector[i] = position;
                        // store the fullness in the index after the last arg
                        rank.filled++;
                        if (rank.filled === len &&
                            (!mostspecificmethod ||
                             rank.vector < ranks[mostspecificmethod].vector)) {
                            mostspecificmethod = methodname;
                        }
                    });
                }

                // All the top level constructors are their own
                // prototype's constructor. %% bad shortcut?
                if (!isValue && arg === arg.prototype.constructor) {
                    //console.log({DELEGATE: 'ANY', isval: false});
                    stack.push({arg: ANY, isValue: false});
                }
                // To pretend that there's a root to the delegation
                // chain, we treat ANY as the constructor of the real
                // top-level constructors. If Any is used as a value,
                // it will go via the chain Any.constructor = Object.
                else if (arg !== ANY || isValue) {
                    var delegate = (isValue) ? arg.constructor : arg.prototype;
                    //console.log({DELEGATE: delegate, isval: !isValue});
                    stack.push({arg: delegate, isValue: !isValue});
                }
                //console.log({STACK: stack});
                position++;
            }
        }
        //console.log(ranks);
        return METHODS[mostspecificmethod];
    }
    
    var dispatch = function() {
        var method = lookup(arguments);
        if (method) { return method.apply(method, arguments); }
        else throw "No applicable method found";
    }
    dispatch.method = method;
    return dispatch;
}

module.exports = procedure;
module.exports.Any = ANY;

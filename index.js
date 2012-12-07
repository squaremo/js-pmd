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
// (single) prototype slot *of the constructor function*, *at the time
// of construction*. This is non-standardly supplied as the __proto__
// property of a value. To allow both values and constructors in
// specialisations, we follow the delegation chain:

//     value -> value.__proto__

// In general, we'll want to use constructor functions (e.g.,
// `HTMLElement`) to stand in for types; however, following
// `value.constructor` will not in general yield the expected
// delegation chain. For this reason, if a function is given in a
// method definition, we assume it is intended as a 'type' and
// implicitly use its prototype -- which _will_ in general work as
// expected.

// `Object.prototype` is the root of the prototype chain; its [[prototype]] is null.

// We keep a table of role -> methods at each object. While
// dispatching, we have to keep track of the rank vector of each
// method; to keep this as local state we gensym a string to be used
// in the hash table. This also avoids conflicts that might arise if,
// for instance, a function value was used as the body for more than
// one method.

'use strict';

(function() {
    var gensym_counter = 0;
    function gensym(name) {
        return name + '_' + (gensym_counter++);
    }

    // Object.getPrototypeOf will fail for a ground type, so we
    // promote everything to an object.
    //    val.__proto__ === Object(val).__proto__
    var delegate = (Object.getPrototypeOf) ?
        function (v) { return Object.getPrototypeOf(Object(v)); } : function(val) { return val.__proto__; };

    function procedure(name) { // name is just for easier debugging if
                               // we have to inspect roles tables
        
        var selector = gensym(name);

        // This will store our method bodies. We need to use strings
        // to identify them both for debugging, and so that we can use
        // those strings in hashes while ranking.
        var METHODS = {};

        // We can't just go and add properties to these kinds of
        // values, so we keep the role tables hashed against their
        // (unique) reprs in these.
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
            default: // Object, Array, RegExp, Function can all have
                     // arbitrary values
                if (value === null) {
                    return NULL_TABLE;
                }
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
                if (typeof arg === 'function') arg = arg.prototype;
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
            // %% since there's only have one delegate at any point,
            // %% this could be a register.
            var stack = [];
            var mostspecificmethod = false;

            for (var i=0, len = args.length; i < len; i++) {
                var position = 0;
                var rolename = selector + ':' + i;

                stack.push(args[i]);

                while (stack.length > 0) {
                    var arg = stack.pop();
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
                            rank.filled++;
                            if (rank.filled === len &&
                                // NB above also checks the method has
                                // the correct number of args
                                (!mostspecificmethod ||
                                 rank.vector < ranks[mostspecificmethod].vector)) {
                                mostspecificmethod = methodname;
                            }
                        });
                    }

                    var proto = delegate(arg);
                    if (proto !== null) stack.push(proto);
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

    (typeof window !== 'undefined') ? window.procedure = procedure : module.exports = procedure;

})();

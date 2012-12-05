// Slate-like multimethod dispatch

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

function procedure(name) {
    var selector = gensym(name); // possibly gensym name, or fully qualify it, or ..
    var METHODS = {};

    function method(/* object 1..n, bodyFn*/) {
        var methodname = gensym(name);
        var body = arguments[arguments.length-1];
        for (var i = 0, len = arguments.length-1; i < len; i++) {
            var arg = arguments[i];
            var rolename = selector + ':' + i;
            if (!arg.__roles__) arg.__roles__ = {};
            var table = arg.__roles__;
            if (!table[rolename]) table[rolename] = [];
            table[rolename].push(methodname);
        }
        METHODS[methodname] = body;
    }

    function lookup(args) {
        var ranks = {};
        var stack = [];
        var mostspecificmethod;

        for (var i=0, len = args.length; i < len; i++) {
            var position = 0;
            var rolename = selector + ':' + i;
            stack.push(args[i]);
            console.log({ARG: args[i]});
            while (stack.length > 0) {
                var arg = stack.pop();
                var methods;
                if (arg.__roles && (methods = arg.__roles[rolename])) {
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
                        if (!mostspecificmethod ||
                            (rank.filled === len &&
                             rank.vector > ranks[mostspecificmethod].vector)) {
                            mostspecificmethod = methodname;
                        }
                    });
                }
                var delegate = arg, isCons = false;
                while (delegate !== Object &&
                       delegate !== Array &&
                       delegate !== Number &&
                       delegate !== String &&
                       delegate !== Boolean &&
                       delegate !== RegExp) {
                    console.log({DELEGATE: delegate});
                    delegate = (isCons) ? delegate.prototype : delegate.constructor;
                    stack.push(delegate);
                    isCons = !isCons;
                }
                position++;
            }
        }
        console.log({ranks: ranks});
        return METHODS[mostspecificmethod];
    }
    
    var dispatch = function() {
        var method = lookup(arguments);
        if (method) { return method.call(method, arguments); }
        else throw "No applicable method found";
    }
    dispatch.method = method;
    return dispatch;
}

module.exports = procedure;

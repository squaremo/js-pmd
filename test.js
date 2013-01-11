var procedure = require('./index');
var assert = require('assert');

suite("Base types and values", function() {

    cases = [
        ['Object', Object, {}],
        ['String', String, new String('foo')],
        ['Unboxed string', String, 'foo'],
        ['Number', Number, new Number(56)],
        ['Unboxed number', Number, 45.8],
        ['Boolean', Boolean, new Boolean(true)],
        ['Unboxed boolean', Boolean, false],
        ['Null', null, null],
        ['Undefined', undefined, undefined],
        ['Array', Array, [1,2,'foo']],
        ['Function', Function, function() { return 3; }],
        ['String -> Object', Object, 'foo'],
        ['Number -> Object', Object, 9136],
        ['Boolean -> Object', Object, true],
        ['null -> Object', Object, null],
        ['Array -> Object', Object, [89, 'foo', true]],
        ['Function -> Object', Object, function() { return 'foo'; }],
        ['String value', 'foo', 'foo'],
        ['Number value', 0xffffffff, 0xffffffff],
        ['Boolean value', false, false],
    ];
    
    negatives = [
        ['undefined -/-> Object', Object, undefined],
        ['true -/-> false', false, true],
        ['String -/-> Number', Number, 'foo'],
        ['Different string value', 'bar', 'foo'],
        ['Different number value', 56, 21],
    ];

    cases.forEach(function(c) {
        test(c[0], function(done) {
            var p = procedure(c[0] + '-test-proc');
            p.method(c[1], function(val) {
                done();
            });
            p(c[2]);
        });
    });

    negatives.forEach(function(c) {
        test(c[0], function(done) {
            var p = procedure(c[0] + '-test-proc');
            p.method(c[1], function(val) {
                assert.fail("Should not have been dispatched here");
            });
            assert.throws(function() { p(c[2]); }, TypeError);
            done();
        });
    });

});

suite("User-defined types", function() {

    test("Assigned prototype", function(done) {
        // Typical user-defined inheritance
        function Sub() {}
        function Super() {}
        Sub.prototype = new Super();
        
        var p = procedure('assigned-prototype-test-proc');
        p.method(Super, function(_) { done(); });
        p(new Sub());
    });

    test('Anonymous constructor', function(done) {
        // Embellished user-defined inheritance using an intermediate,
        // anonymous constructor to hold the prototype. This can be
        // used if you don't want Super to be called, for example.
        function Sub() {}
        function Super() {}
        Sub.prototype = (function() {
            function cons() {}
            cons.prototype = Super.prototype;
            return new cons();
        })();

        var p = procedure('anonymous-cons-test-proc');
        p.method(Super, function(_) { done(); });
        p(new Sub());
    });

});

suite("Ranking", function() {

    var Sub, Super;
    setup(function() {
        Super = function() {};
        Sub = function() {};
        Sub.prototype = new Super();
    });

    test("Closest wins", function(done) {
        var p = procedure('closest-test-proc');
        p.method(Super, function(_) {
            assert.fail('Super procedure called instead of sub procedure');
        });
        p.method(Sub, function(_) { done(); });
        p(new Sub());
    });
    test("Does not match subtype", function(done) {
        var p = procedure('not-subtype-test-proc');
        p.method(Sub, function(_) {
            assert.fail("Matched subtype given supertype");
        });
        p.method(Super, function(_) { done(); });
        p(new Super());
    });

    // i.e., lefterly arguments count for more
    test("Lexical order", function(done) {
        var p = procedure('lexical-test-proc');
        p.method(Super, Sub, function(_) {
            assert.fail('Not ranked in lexical order');
        });
        p.method(Sub, Super, function(_) { done(); });
        p(new Sub(), new Sub());
    });

    // i.e., if the first args are the same, the second arg decides.
    test("Tiebreaker second arg", function(done) {
        var p = procedure('tiebreak-test-proc');
        p.method(Super, Sub, function(_) { done(); });
        p.method(Super, Super, function(_) {
            assert.fail("Less specific method chosen");
        });
        p(new Sub(), new Sub());
    });

    // This came up because I was returning value.__roles__ when
    // looking up the method table for a value, and this picked up
    // __roles__ from the value's prototype if the procedure had been
    // specialised on a supertype. In some cases this meant the method
    // was counted twice in a particular role, and looked saturated,
    // but may not have actually been applicable for another argument.
    //
    // This is a problem because I only check that the *number* of
    // arguments applicable is the number of arguments passed, on the
    // assumption that a method appears only once in each role. It
    // might be better to use a bitset, and even to check that each
    // bit is not already set.
    test("Method appears once each role", function(done) {
        var r = procedure('once-per-role-test-proc');
        r.method(Sub, Function, function (sub, fn) {
            assert.fail("Method with wrong type selected");
        });
        r.method(Object, Function, function (val, fn) {
            assert.fail("Less specialised method chosen");
        });
        r.method(String, Function, function (str, fn) {
            done();
        });
        r("foo", function fn() {});
    });

});

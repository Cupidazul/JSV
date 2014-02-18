var env;

//calls ok(true) if no error is thrown
function okNoError(func, msg) {
	try {
		func();
		ok(true, msg);
	} catch (e) {
		ok(false, msg + ': ' + e);
	}
}


function setupEnv () {
    env = env || require('../lib/jsv').JSV.createEnvironment("json-schema-draft-03");

    // AddressBook example from http://relaxng.org/compact-tutorial-20030326.html
    env.createSchema({
                         "type": "object",
                         "id": "http://example.com/addressbook.json",
                         "description": "AddressBook example from http://relaxng.org/compact-tutorial-20030326.html",
                         "properties": {
                             "cards": {
                                 "type": "array",
                                 "items": {
                                     "type": "array",
                                     "items": {
                                         "type": "string"
                                     },
                                     "minItems": 2,
                                     "maxItems": 2,
                                     "$schema":"http://json-schema.org/draft-03/schema#"
                                 },
                                 "required": true
                             }
                         },
                         "$schema":"http://json-schema.org/draft-03/schema#"
                     },
                     undefined,
                     "http://example.com/addressbook.json");

    // The referral target schema, with a canonical id.
    env.createSchema({
                         "type": "array",
                         "id": "http://example.com/subdir/card.json",
                         "description": "Referral target",
                         "items": {
                             "type": "string"
                         },
                         "minItems": 2,
                         "maxItems": 2,
                         "$schema":"http://json-schema.org/draft-03/schema#"
                     },
                     undefined,
                     "http://example.com/subdir/card.json");

    // Similar example, using $ref to factor part of the schema.
    env.createSchema({
                         "type": "object",
                         "id": "http://example.com/addressbook_ref.json",
                         "description": "Similar example, using $ref to factor part of the schema.",
                         "properties": {
                             "cards": {
                                 "type": "array",
                                 "items": {
                                     "$ref": "./subdir/card.json"
                                 },
                                 "required": true
                             }
                         },
                         "$schema":"http://json-schema.org/draft-03/schema#"
                     },
                     undefined,
                     "http://example.com/addressbook_ref.json");


    // Similar example, using extends to factor part of the schema.
    env.createSchema({
                         "type": "object",
                         "id": "http://example.com/addressbook_extends.json",
                         "description": "Similar example, using extends to factor part of the schema.",
                         "properties": {
                             "cards": {
                                 "type": "array",
                                 "items": {
                                     "extends": {
                                         "$ref": "./subdir/card.json"
                                     }
                                 },
                                 "required": true
                             }
                         },
                         "$schema":"http://json-schema.org/draft-03/schema#"
                     },
                     undefined,
                     "http://example.com/addressbook_extends.json");
}


//
//
// Tests
//
//

module("Reference Tests");

test("Self Identifying Schemas", function () {

         setupEnv();

         // While createSchema takes a URI argument, for V3 schemas the validator should be able
         // to use the canonical id field to find it, if it has been registered.
         // http://tools.ietf.org/html/draft-zyp-json-schema-03#section-5.27

          env.createSchema({ "id": "http://example.com/foo.json",
                             "$schema":"http://json-schema.org/draft-03/schema#"
                           });

         ok(env.findSchema("http://example.com/foo.json"), "found schema by id");
     });

test("Forward Referral", function () {

         setupEnv();
         // A schema with a reference in it should be accepted, even if the destination schema
         // hasn't been registered yet.

         okNoError(function () {
                       env.createSchema({
                                            "type": "object",
                                            "id": "http://example.com/addressbook.json",
                                            "properties": {
                                                "cards": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "http://example.com/subdir/card.json"
                                                    },
                                                    "required": true
                                                }
                                            },
                                            "$schema":"http://json-schema.org/draft-03/schema#"
                                        });
                   }, "Can make schema with forward reference");

     });

test("Validate Schema", function () {

         setupEnv();

         var jsonschema = env.findSchema(env.getOption("latestJSONSchemaSchemaURI"));
         var explicit_schema = env.findSchema("http://example.com/addressbook.json");
         var referring_schema = env.findSchema("http://example.com/addressbook_ref.json");
         var card_schema = env.findSchema("http://example.com/subdir/card.json");

         ok(explicit_schema, "explicit addressbook schema");
         ok(referring_schema, "referring addressbook schema");
         ok(card_schema, "card schema");

         equal(jsonschema.validate(explicit_schema).errors.length, 0, 'valid explicit schema');
         equal(jsonschema.validate(referring_schema).errors.length, 0, 'valid referring schema');
         equal(jsonschema.validate(card_schema).errors.length, 0, 'valid referral target schema');

     });

test("Simple Referral", function () {

         setupEnv();

         var schema = { "$ref": "http://example.com/subdir/card.json" };
         notEqual(env.validate({}, schema).errors.length, 0, "card must be array");
         notEqual(env.validate([], schema).errors.length, 0, "card must have fields");
         notEqual(env.validate(["foo"], schema).errors.length, 0, "card must have two fields");
         notEqual(env.validate(["foo", {}], schema).errors.length, 0, "both fields must be string");
         notEqual(env.validate(["foo", "bar", "baz"], schema).errors.length, 0, "card maxItems 2");
         equal(env.validate(["foo", "bar"], schema).errors.length, 0, "card maxItems 2");
     });

function validateAddressbook (test_name, schema_uri) {
    var schema = { "$ref": schema_uri };

    test(test_name, function () {

             setupEnv();

             notEqual(env.validate('', schema).errors.length, 0, "addressbook is object");
             notEqual(env.validate({}, schema).errors.length, 0, "cards required");
             notEqual(env.validate({ "cards": {}}, schema).errors.length, 0, "cards must be array");
             equal(env.validate({ "cards": []}, schema).errors.length, 0, "empty array ok");

             notEqual(env.validate({ "cards": [ {} ] }, schema).errors.length, 0,
                      "cards schema is enforced on items");

             notEqual(env.validate({ "cards": [['foo']]}, schema).errors.length, 0,
                      "each card must have length 2");

             notEqual(env.validate({ "cards": [ ['foo', 'bar' ], ["foo" ] ] }, schema).errors.length, 0,
                      "second card is bad");

             equal(env.validate({ "cards": [ ["foo", "bar" ] ] }, schema).errors.length, 0,
                   "good addressbook with one card");

             equal(env.validate({ "cards": [ ["foo", "bar" ], ["bar", "foo" ] ] }, schema).errors.length, 0,
                   "good addressbook with two cards");
         });
}

validateAddressbook("Explicit Schema", "http://example.com/addressbook.json");
validateAddressbook("Referring Schema", "http://example.com/addressbook_ref.json");
validateAddressbook("Extends Schema", "http://example.com/addressbook_extends.json");

test("ObjectId Test", function () {
    equal(env.validate("5303258583109200002afd9e", {
        "type": ["ObjectId", "string"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^[0-9a-fA-F]{24}$"
    }).errors.length, 0, "string may be objectId");

    var id = {
        _bsontype: "ObjectID",

        toHexString: function(){
            return "5303258583109200002afd9e";
        }
    };
    equal(env.validate(id, {
        "type": ["ObjectId", "string"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^[0-9a-fA-F]{24}$"
    }).errors.length, 0, "string may be objectId");

    notEqual(env.validate("fewfewfe", {
        "type": ["ObjectId", "string"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^[0-9a-fA-F]{24}$"
    }).errors.length, 0, "string may be objectId");

    notEqual(env.validate({value: "fdewew"}, {
        "type": ["ObjectId", "string"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^[0-9a-fA-F]{24}$"
    }).errors.length, 0, "string may be objectId");
    notEqual(env.validate([{value: "fdewew"}], {
        "type": ["ObjectId", "string"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^[0-9a-fA-F]{24}$"
    }).errors.length, 0, "string may be objectId");
});





test("DateTime", function () {
    equal(env.validate("2014-02-18T09:45:22.262Z", {
        "type": ["string", "Date"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^([\\+-]?\\d{4}(?!\\d{2}\\b))((-?)((0[1-9]|1[0-2])(\\3([12]\\d|0[1-9]|3[01]))?|W([0-4]\\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\\d|[12]\\d{2}|3([0-5]\\d|6[1-6])))([T\\s]((([01]\\d|2[0-3])((:?)[0-5]\\d)?|24\\:?00)([\\.,]\\d+(?!:))?)?(\\17[0-5]\\d([\\.,]\\d+)?)?([zZ]|([\\+-])([01]\\d|2[0-3]):?([0-5]\\d)?)?)?)?$"
    }).errors.length, 0, "string may be date");

    equal(env.validate(new Date(), {
        "type": ["string", "Date"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^([\\+-]?\\d{4}(?!\\d{2}\\b))((-?)((0[1-9]|1[0-2])(\\3([12]\\d|0[1-9]|3[01]))?|W([0-4]\\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\\d|[12]\\d{2}|3([0-5]\\d|6[1-6])))([T\\s]((([01]\\d|2[0-3])((:?)[0-5]\\d)?|24\\:?00)([\\.,]\\d+(?!:))?)?(\\17[0-5]\\d([\\.,]\\d+)?)?([zZ]|([\\+-])([01]\\d|2[0-3]):?([0-5]\\d)?)?)?)?$"
    }).errors.length, 0, "string may be date");

    notEqual(env.validate(new Date("fewgerge"), {
        "type": ["string", "Date"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^([\\+-]?\\d{4}(?!\\d{2}\\b))((-?)((0[1-9]|1[0-2])(\\3([12]\\d|0[1-9]|3[01]))?|W([0-4]\\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\\d|[12]\\d{2}|3([0-5]\\d|6[1-6])))([T\\s]((([01]\\d|2[0-3])((:?)[0-5]\\d)?|24\\:?00)([\\.,]\\d+(?!:))?)?(\\17[0-5]\\d([\\.,]\\d+)?)?([zZ]|([\\+-])([01]\\d|2[0-3]):?([0-5]\\d)?)?)?)?$"
    }).errors.length, 0, "string may be date");

    notEqual(env.validate("gregrege", {
        "type": ["string", "Date"],
        "id": "http://example.com/objectid.json",
        "$schema":"http://json-schema.org/draft-03/schema#",
        "pattern": "^([\\+-]?\\d{4}(?!\\d{2}\\b))((-?)((0[1-9]|1[0-2])(\\3([12]\\d|0[1-9]|3[01]))?|W([0-4]\\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\\d|[12]\\d{2}|3([0-5]\\d|6[1-6])))([T\\s]((([01]\\d|2[0-3])((:?)[0-5]\\d)?|24\\:?00)([\\.,]\\d+(?!:))?)?(\\17[0-5]\\d([\\.,]\\d+)?)?([zZ]|([\\+-])([01]\\d|2[0-3]):?([0-5]\\d)?)?)?)?$"
    }).errors.length, 0, "string may be date");
});

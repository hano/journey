var journey = require('../lib/journey'),
       vows = require('../../vows/lib/vows');

var sys = require('sys'),
   http = require('http'),
 assert = require('assert'),
    url = require('url');

var mock = {
    mockRequest: function (method, path, headers) {
        var uri = url.parse(path || '/', true);

        return {
            listeners: [],
            method: method,
            headers: headers || { accept: "application/json", "Content-Type":'application/json' },
            url: uri,
            setBodyEncoding: function (e) { this.bodyEncoding = e },
            addListener: function (event, callback) {
                this.listeners.push({ event: event, callback: callback });
                if (event == 'body') {
                    var body = this.body;
                    this.body = '';
                    callback(body);
                } else { callback() }
            }
        };
    },
    mockResponse: function () {
        return {
            body: null,
            finished: false,
            status: 200,
            headers: [],
            sendHeader: function (status, headers) {
                this.status = status;
                this.headers = headers;
            },
            sendBody: function (body) { this.body = body },
            finish: function () { this.finished = true }
        };
    },

    request: function (method, path, headers, body) {
        return journey.server.handler(this.mockRequest(method, path, headers),
                                      this.mockResponse(), JSON.stringify(body));
    }
}

// Convenience functions to send mock requests
var get  = function (p, h)    { return mock.request('GET',    p, h) }
var del  = function (p, h)    { return mock.request('DELETE', p, h) }
var post = function (p, h, b) { return mock.request('POST',   p, h, b) }
var put  = function (p, h, b) { return mock.request('PUT',    p, h, b) }


var routes = function (map) {
    map.route('GET', 'picnic/fail').to(map.resources["picnic"].fail);
    map.get('home/room').to(map.resources["home"].room);

    map.route('GET', /^(\w+)$/).
        to(function (res, r) { return map.resources[r].index(res) });
    map.route('GET', /^(\w+)\/([0-9]+)$/).
        to(function (res, r, k) { return map.resources[r].get(res, k) });
    map.route('PUT', /^(\w+)\/([0-9]+)$/, { payload: true }).
        to(function (res, r, k) { return map.resources[r].update(res, k) });
    map.route('POST', /^(\w+)$/, { payload: true }).
        to(function (res, r, doc) { return map.resources[r].create(res, doc) });
    map.route('DELETE', /^(\w+)\/([0-9]+)$/).
        to(function (res, r, k) { return map.resources[r].destroy(res, k) });
    map.route('GET', '/').to(function (res) { return map.resources["home"].index(res) });
};

journey.resources = {
    "home": {
        index: function (res) {
            res.send([200, {"Content-Type":"text/html"}, "honey I'm home!"]);
        },
    },
    "picnic": {
        fail: function () {
            throw "fail!";
        }
    },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        "kitchen": {},
    "recipies": {}
};

journey.ENV = 'test';

vows.tell('Journey', function (ctx) {
    //
    // SUCCESSFUL (2xx)
    //

    get('/', { accept: "application/json" }).addVow(function (res) {
        assert.equal(res.status, 200);
        assert.equal(res.body, "honey I'm home!");
        assert.match(res.body, /honey/);
        assert.ok(res.finished);
    }, "A valid HTTP request returns a 200");

    // URI parameters get parsed into a javascript object, and are passed to the
    // function handler like so:
    journey.resources["home"].room = function (res, params) {
        res.send([200, {"Content-Type":"text/html"}, JSON.stringify(params)]);
    };
    get('/home/room?slippers=on&candles=lit').addVow(function (res) {
        var home = JSON.parse(res.body);

        assert.equal(home.slippers, 'on');
        assert.equal(home.candles, 'lit');
        assert.equal(res.status, 200);
    }, "A request with uri parameters gets parsed into an object");

    // Here, we're sending a POST request; the input is parsed into an object, and passed
    // to the function handler as a parameter.
    // We expect Journey to respond with a 201 'Created', if the request was successful.
    journey.resources["kitchen"].create = function (res, input) {
        res.send(201, "cooking-time: " + (input['chicken'].length + input['fries'].length) + 'min');
    };
    post('/kitchen', null, {"chicken":"roasted", "fries":"golden"}).addVow(function (res) {
        assert.equal(res.body, 'cooking-time: 13min');
        assert.equal(res.status, 201);
    }, "A POST request");

    //
    // Representational State Transfer (REST)
    //
    journey.resources["recipies"].index = function (params) {
        
    };
    get('/recipies').addCallback(function (res) {
        //var doc = JSON.parse(res.body);

        //assert.ok(doc.includes("recipies"));
        //assert.ok(doc.recipies.is(Array));
    });

    //
    // CLIENT ERRORS (4xx)
    //

    // Journey being a JSON only server, asking for text/html returns 'Bad Request'
    get('/', { accept: "text/html" }).addVow(function (res) {
        assert.equal(res.status, 400);
    }, "A request for text/html returns a 400");

    // This request won't match any pattern, because of the '@', 
    // it's therefore considered invalid
    get('/hello/@').addVow(function (res) {
        assert.equal(res.status, 400);
    }, "A request for an invalid pattern returns a 400");

    // Trying to access an unknown resource will result in a 404 'Not Found',
    // as long as the uri format is valid
    get('/unknown').addVow(function (res) {
        assert.equal(res.status, 404);
    }, "A request for an unknown resource returns a 404");

    // Here, we're trying to use the DELETE method on /
    // Of course, we haven't allowed this, so Journey responds with a
    // 405 'Method not Allowed', and returns the allowed methods
    del('/').addVow(function (res) {
        assert.equal(res.status, 405);
        assert.equal(res.headers.allow, 'GET');
    }, "A request with an unsupported method returns a 405");

    //
    // SERVER ERRORS (5xx)
    //

    // The code in `picnic.fail` throws an exception, so we return a
    // 500 'Internal Server Error'
    get('/picnic/fail').addVow(function (res) {
        assert.equal(res.status, 500);
    }, "A request to a controller with an error in it returns a 500");

});

journey.router.draw(routes);


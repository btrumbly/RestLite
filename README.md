# RestLite

A light weight NodeJS restful API module.

### Install

```
npm install rest-lite
```

## Example

```
const { RestLite } = require("restLite");

const server = new RestLite();

server.setHeader("Access-Control-Allow-Origin", "*");
server.setHeader(
  "Access-Control-Allow-Methods",
  "GET, POST, OPTIONS, PUT, PATCH, DELETE"
);
server.setHeader(
  "Access-Control-Allow-Headers",
  "Authorization, Content-Type, responseType, Accept, User-Agent"
);
server.setHeader(
  "Content-Type",
  "application/javascript, application/octet-stream"
);

const config = {
      responseType: "json",
      serviceName: "Test Server"
      port: 2000
}

// server(config)
server.serve(config);

const fn = function(req, res, query) {
  console.log("get");
  res.OK("hello");
};

const fn1 = async function(req, res, query) {
  res.OK(req.body);
};

const fn2 = function(req, res, query) {
  console.log("put");
  res.OK();
};

const fn3 = function(req, res, query) {
  console.log(req.accountID);
  res.OK();
};

// routes
server
  .at("/path")
  .get(fn)
  .post(fn1)
  .put(fn2);

server
  .at("/path/:accountID")
  .get(fn3)

```

## Guards
Guards are functions used to safeguard call and controllers. A guard is a function that takes in a http request and returns a boolean. If ``true`` the guard allows the request to go through. Guards should be async functions. you can have multiple guards. 
```
const server = new RestLite();

const authenticated = (req) => {
  if (!req.headers.userID) {
    return false
  } else {
    return true
  }
}

server.setGuard(authenticated);
// server.setGuard(guardNumber2)
```

## Whitelist
White list are routes that bypass the any guards set.
```
const server = new RestLite();

// Set whitelisted URL paths
server.setWhitelists([
  "/v1/auth", 
  "/v1/auth/check", 
  "/v1/settings/new/account", 
]);

```

## Separate Router File
### index.js
```
require("dotenv").config();

const { RestLite } = require("../lib/RestLite");
const { authenticated } = require("../lib/authority");

server = new RestLite();

const serverConfig = {
  port: process.env.PORT || 80,
  host: process.env.HOST,
  responseType: "json", 
}

// Set response headers
server.setHeader("Access-Control-Allow-Origin", "*");
server.setHeader(
  "Access-Control-Allow-Methods",
  "GET, POST, OPTIONS, PUT, PATCH, DELETE"
);
server.setHeader(
  "Access-Control-Allow-Headers",
  "Authorization, Content-Type, responseType, Accept, User-Agent, uid"
);
server.setHeader(
  "Content-Type",
  "application/javascript, application/octet-stream"
);

// Set whitelisted URL paths
server.setWhitelists([
  "/v1/auth", 
  "/v1/auth/check", 
  "/v1/settings/new/account", 
]);

server.setGuard(authenticated);

// HTTP Server
server.serve(serverConfig);

module.exports = { server };

require("./v1/routes");
```
### routes.js
```
const { server } = require("../index");
const { attemptLogin, logout } = require("../../controllers/auth");

// Auth
server
  .at("/v1/auth")
  .get(logout)
  .post(attemptLogin)

```

## Responses

| Status Code | Method         |
| ----------- | -------------- |
| 100         | Continue()     |
| 200         | OK()           |
| 201         | Created()      |
| 204         | NoContent()    |
| 301         | Moved()        |
| 302         | Found()        |
| 400         | Bad()          |
| 401         | Unauthorized() |
| 404         | Forbidden()    |
| 500         | Error()        |

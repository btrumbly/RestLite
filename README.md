# RestLite

A light weight, powerful NodeJS restful API and Gateway module.
### Install

```
npm install rest-lite
```

## Example

```
const RestLite = require("rest-lite");

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
  console.log(req.accountid);
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
## Server Config
| Option      | Value         | Example | |
| ----------- |:--------------:|:----:|---|
| responseType | String |"json"  |``Format of requests and responses. This is default for all responses but Render, RenderFile.`|
| host         | String |"localhost", "127.0.0.1"  |``Address the server should bind to``|
| port         | Number |3000 |``Port the server should listen on``    |
| serviceName  | String |"RestLight Server" |``The name of the API or service``  |
| logging      | Boolean/String |true, "debug" |``"debug" - Outputs all request, "error" - Outputs only errors, true - Outputs proxy request only``
| keepWildcardCase | Boolean | | ``true, Keeps the wildcard and url case as it was typed. false (Default), lowercase the wildcard``

## Logging
To output the logs of Rest-Lite to a function, use `setLogOutput()`. Your logging method should take in `(message: STRING, Request: HTTPRequestObject)`. This should be used in conjunction with the logging setting in your config. See above for more information.
```
const logToDB = async (message, request) => {
  await database('INSERT INTO ProductLogs (Message, Request) VALUES (?,?), [message, request])
}

server.setLogOutput(logToDB);
```
## Route Guards
Guards are functions used to safeguard call and controllers. A guard is a function that takes in a http request and returns a boolean. If ``true`` the guard allows the request to go through. Guards should be async functions. you can have multiple guards. 
```
const RestLite = require("rest-lite");
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

### Route Guard Path & Settings
Settings Object:
```
{
  redirect: String
  html: String
}
```
Passing Path and Settings:
- Below is an example of if a request fails a guard it will then be redirected, using 302, to google.com.
```
server.setGuard(authenticated, '*', {redirect: 'https://google.com'});
```
- Below is an example of if a request fails a guard it will then be served alternative content based on directory path.
```
server.setGuard(authenticated, '*', {html: './expired.html'});
```
- You can pass `*` to apply a guard to all paths or use a wildcard variable. ex: `api/*` .
- Note: You can only use redirect or html in the settings. Redirect hold presidents over serving alternative html content.


## Method Guards
Method guards run before sending a request to a method. Great for permission checks or user roles.
```
const checkUserRole = async (req) => {
  if (someLogic === req.headers.userID) {
    return true;
  }
  return false;
}

// routes
server.at("/path").get(fn, checkUserRole)

```
If the method guard receives ```true```, the request will be pass to the method. If the method guard receives ```false```, the requester will receive a ```401``` and ```{ error: 401, message: "Permission Denied" }```
## Route Whitelist
White list are routes that bypass the any guards set. They can be by HTTP Method or path only. Whitelist do support wildcards. `/api/*`
```
const RestLite = require("rest-lite");
const server = new RestLite();

// Set whitelisted URL paths
server.setWhitelists([
  "/v1/auth", 
  "/v1/auth/check", 
  "/v1/settings/new/account", 
]);

// Set whitelisted URL paths by method
server.setWhitelists([
  "/v1/auth", 
  "/v1/auth/check", 
  "/v1/settings/new/account", 
], 'POST');

// Set single whitelisted URL path
server.setWhitelist("/v1/auth", 'POST');

// Set single whitelisted URL path by method
server.setWhitelist("/v1/auth", 'POST');

```
## Responses

| Status Code | Method         |
|:-----------:| -------------- |
| 100         | Continue()     |
| 200         | OK()           |
| 201         | Created()      |
| 204         | NoContent()    |
| 301         | Moved()        |
| 302         | Found()        |
| 400         | Bad()          |
| 401         | Unauthorized() |
| 404         | Forbidden()    |
| 429         | MaxLimit()     |
| 500         | Error()        |
| *           | SendResponse(data, statusCode) |
| *           | Render(statusCode, Content) |
| *           | RenderFile(statusCode, FilePath) |
---
## Separate Router File
### index.js
```
require("dotenv").config();

const RestLite = require("rest-lite");
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

## Gateway 
RestLite also functions as a gateway. Forwarding request onto another host or service. Gateway routes take priority of API controller routes. 
Auth guards work just like with API routes.
```
// Set route guards
server.setGuard(authorized);
server.setGuard(checkProductLicense, '*', {html: './html/expired.html'});

// Gateway routes
server.forward("api/v1/form/*").to("http://localhost:7211");
server.forward("api/v2/form/*").to("http://localhost:7204");
```
### Gateway Path Swapping
With ``.swap`` you can replcae the path with an alternative path. For the example below, the path would change from ``api/v2/form/`` to ``api/v1/legacyform/`` once it is passed on.
```
server.forward("api/v2/form/*").to("http://localhost:7204").swap("api/v1/legacyform/");
```

## Fallback Actions
Setting a fall back action is based on the HTTP response code that is returned. This works for web application like VUE JS when the router is contained in the source code and the server should serve the default HTML file. 
In the example below on the server returning a ```404```, you can set the return action to render a 404 page of in the case to return the default ```index.html``` file. You can also set the alternative retunr HTTP Code you would like to return with the response. So on ```404``` render file ```"./dist/index.html"``` with HTTP Code ```200```.
```
// Return a file
server.on(404).renderFile("./dist/index.html").with(200)

// Return text
server.on(404).render("<p>The page you have request can not be found.</p>").with(404)

```

## Vue JS Example
```
const { RestLite } = require("rest-lite");
const server = new RestLite();
const publicPath = `/webapp;

server.setHeader("Access-Control-Allow-Origin", "*");
server.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

const config = {
  responseType: "json",
  serviceName: "Vue Web Application",
  port: process.env.PORT || 80,
  logging: 'debug'
};

server.serve(config);

server.on(404).renderFile("./dist/index.html").with(200)

server.at(publicPath).get((req, res) => {
  res.RenderFile(200, "./dist/index.html");
});

server.at(`${publicPath}/:uri`).get((req, res) => {
  if (req.uri.includes(".")) {
    res.RenderFile(200, `./dist/${req.uri}`);
  } else {
    res.RenderFile(200, "./dist/index.html");
  }
});

server.at(`${publicPath}/js/:uri`).get((req, res) => {
  res.RenderFile(200, `./dist/js/${req.uri}`);
});

server.at(`${publicPath}/css/:uri`).get((req, res) => {
  res.RenderFile(200, `./dist/css/${req.uri}`);
});

server.at(`${publicPath}/fonts/:uri`).get((req, res) => {
  res.RenderFile(200, `./dist/fonts/${req.uri}`);
});

server.at(`${publicPath}/img/:uri`).get((req, res) => {
  res.RenderFile(200, `./dist/img/${req.uri}`);
});
```

## API Documentation
Documentation will generate a ```.md``` (Markdown File) of all your routes and the corresponding methods. In order for a method to be seen by the generator, the method must be noted like example below. Documentation works with [dotenv](https://www.npmjs.com/package/dotenv). You can also provide a array of folder/files to not look at. Do this by adding the an array of strings to the ignore property as seen below. By default ```.git, .vscode, .gitignore, node_modules``` are ignored.
```
const server = new RestLite();

server.writeDocs({output: 'README.md', ignore: ['.git','.vscode','.gitignore','node_modules']});
```
### Registering a method
The generator will look for the ```@name``` and ```@description``` fields. Make sure the ```@name``` matches the method name passed in your route.
```
/**
 * @name getAnalytics
 * @method GET
 * @description Get all analytics for the provided pageID.
 * @async
 * @param {HTTP Request} req 
 * @param {HTTP Response} res 
 * @param {Object Query Params} params 
 * @returns {Array[Object]}
 */
const getAnalytics = async (req, res, params) => {
   // method logic here
};
```
### Example:
```
server.at("/api/v1/analytics/:pageID").get(getAnalytics);

/**
 * @name getAnalytics
 * @method GET
 * @description Get all analytics for the provided pageID.
 * @async
 * @param {HTTP Request} req 
 * @param {HTTP Response} res 
 * @param {Object Query Params} params 
 * @returns {Array[Object]}
 */
const getAnalytics = async (req, res, params) => {
   // method logic here
};
```
## Documentation Example:
# Analytics-Service-API
**Version:** 1.0.0

**Author:** Brian Trumbly

**Description:**

API service that handle all interactions with website analytics.

## Dependencies
```
{
  dotenv: "^8.2.0"
  mariadb: "^2.5.1"
  rest-lite: "^1.0.6"
}
```
## Environment
```
 DB_HOST=*************
 DB_USER=*************
 DB_PASSWORD=*************
 PORT=*************
 NODE_ENV=*************
```
# Routes
### Path: `/api/v1/analytics/:pageID`

### Get: [getAnalytics]()

>**Repo Link:** [getAnalytics]()

>**Description:**  Get all analytics for the provided pageID.

>**File Path:** controllers/analytics.js
```
/**
 * @name getAnalytics
 * @method GET
 * @description Get all analytics for the provided pageID.
 * @async
 * @param {HTTP Request} req 
 * @param {HTTP Response} res 
 * @param {Object Query Params} params 
 * @returns {Array[Object]}
 */
```
---
Document generated by [Rest-Lite](https://www.npmjs.com/package/rest-lite).
/**
 * Title: RestLite
 * About: A light weight http Restful API Server / Gateway.
 * Author: Brian Trumbly
 */

 const http = require("http");
 const url = require("url");
 const contentType = require("content-type");
 const rawBodyMap = new WeakMap();
 const getRawBody = require("raw-body");
 const fetch = require("node-fetch");
 const { createDocs } = require("rest-lite/src/docs/createDocs");
 const Formidable = require("formidable");
 var FormData = require("form-data");
 var fs = require("fs");

 
 class RestLite {
   constructor() {
     this._server = null;
     this._routes = {};
     (this._forwardRoutes = {}), (this._guards = []);
     this._methodGuard = [];
     this._whiteList = [];
     this._headers = [];
     this._config = {
       responseType: "json",
       host: null,
       port: 3000,
       serviceName: "RestLight Server",
     };
   }
 
   /**
    * Starts the HTTP Server and listens for request.
    * @param {Number} port
    * @param {String} host
    * @param {Object} config
    */
   async serve(config) {
     const _this = this;
     this._config = config || this._config;
 
     let server = http
       .createServer()
       .listen(this._config.port || 3000, this._config.host);
 
     console.info(
       `${this._config.serviceName || "RestLight Server"} running \n Host: ${
         this._config.host || "localhost"
       } \n Port: ${this._config.port || 3000}`
     );
 
     server.on("request", async (req, res) => {
       try {
         _this._headers.forEach((h) => {
           res.setHeader(h[0], h[1]);
         });
 
         // Check for OPTIONS call and respond.
         if (req.method === "OPTIONS") {
           res.statusCode = 200;
           res.end();
           return;
         }
 
         const u = url.parse(req.url);
         const query = url.parse(req.url, true).query;
         let path = u.pathname.toLowerCase();
         let whiteListed = false;
 


         // Add custom response methods to http.ServerResponse
         res.__proto__.SendResponse = function (data, code) {
           if (!data) {
             this.statusCode = code;
             this.end();
             return;
           }
 
           if (_this._config.responseType.toLocaleLowerCase() === "json") {
             this.statusCode = code;
             this.end(JSON.stringify(data));
           } else {
             this.statusCode = code;
             this.end(data);
           }
         };

         res.__proto__.Continue = function (data) {
           this.statusCode = 100;
           this.SendResponse(data, 100);
         };
 
         res.__proto__.OK = function (data) {
           this.SendResponse(data, 200);
         };
 
         res.__proto__.Created = function (data) {
           this.SendResponse(data, 201);
         };
 
         res.__proto__.NoContent = function (data) {
           this.SendResponse(data, 204);
         };
 
         res.__proto__.Moved = function (data) {
           this.SendResponse(data, 301);
         };
 
         res.__proto__.Found = function (data) {
           this.SendResponse(data, 302);
         };
 
         res.__proto__.Bad = function (data) {
           this.SendResponse(data, 400);
         };
 
         res.__proto__.Unauthorized = function (data) {
           this.SendResponse(data, 401);
         };
 
         res.__proto__.Forbidden = function (data) {
           this.SendResponse(data, 403);
         };
 
         res.__proto__.NotFound = function (data) {
           this.SendResponse(data, 404);
         };
 
         res.__proto__.MaxLimit = function (data) {
           this.SendResponse(data, 429);
         };
 
         res.__proto__.Error = function (data) {
           this.SendResponse(data, 500);
         };
 
         res.__proto__.Render = function (code, content) {
           this.statusCode = code;
           this.writeHead(this.statusCode, { "Content-Type": "text/html" });
           this.write(content);
           this.end();
         };

         res.__proto__.RenderFile = async function (code, path) {
          this.statusCode = code;
           try {
              if (!path) {
                this.end();
                return;
              }
              
              let file = await await fs.readFileSync(path)
              this.writeHead(this.statusCode, { "Content-Type": "text/html" });
              this.write(file);
              this.end();  
           } catch (error) {
             console.error(error);
             this.end(); 
           }
        };
 
         let fwd;
 
         // Check for gateway routes first. These take priority of API Routes.
         if (Object.keys(_this._forwardRoutes).length) {
           for (const key in _this._forwardRoutes) {
             if (
               path.toLowerCase().includes(key.replace("*", "").toLowerCase())
             ) {
               path = key;
               fwd = true;
               break;
             }
           }
         }
 
         if (!fwd) {
           // Check if Path and Method exists.
           if (
             !_this._routes[path] ||
             !_this._routes[path][`_${req.method.toLowerCase()}`]
           ) {
             let sp = path.toLocaleLowerCase().split("/");
             sp.shift();
             let nPath = "";
 
             // Check for wildcard values
             for (const key in _this._routes) {
               if (_this._routes[key].wildcards) {
                 let parts = _this._routes[key].parts;
 
                 if (parts.length === sp.length) {
                   for (let i = 0; i < parts.length; i++) {
                     if (parts[i].part === sp[i]) {
                       nPath += "/" + sp[i];
                     } else if (parts[i].part === "*" && parts[i].id) {
                       nPath += "/*";
                     } else {
                       break
                     }
                   }
                   if (_this._routes[nPath]) {
                     if (nPath.includes("*")) {
                       for (let j = 0; j < parts.length; j++) {
                         if (parts[j].part === "*" && parts[j].id) {
                           req[parts[j].id] = sp[j];
                         }
                       }
                     }
                     break;
                   } else {
                     nPath = "";
                   }
                 }
               }
             }
 
             if (
               !_this._routes[nPath] ||
               !_this._routes[nPath][`_${req.method.toLowerCase()}`]
             ) {
               res.NotFound({ error: 404, message: "Path not found." });
               return;
             } else {
               path = nPath;
             }
           }
         }
 
         // Check for whitelist URL
         for (let i = 0; i < _this._whiteList.length; i++) {
           if (path === _this._whiteList[i].toLocaleLowerCase()) {
             whiteListed = true;
           }
         }
 
         // Run any API Guards
         if (!whiteListed) {
           if (_this._guards.length) {
             for (let i = 0; i < _this._guards.length; i++) {
               let pass;
               if (_this._guards[i].path && _this._guards[i].path !== '*') {
                 if (path.includes(_this._guards[i].path.toLowerCase())) {
                   pass = await _this._guards[i].fn(req);
                 } else {
                   pass = true;
                 }
               } else {
                 pass = await _this._guards[i].fn(req);
               }
 
               if (!pass) {
                 // check if there settings for the guard.
                 if (_this._guards[i].settings) {
                  // check for redirect
                  if (_this._guards[i].settings.redirect) {
                    res.writeHead(302, {
                      location: _this._guards[i].settings.redirect,
                    });
                    res.end();
                    return
                  }
                  // check for alt content return
                  if (_this._guards[i].settings.html) {
                    let found = await fs.existsSync(_this._guards[i].settings.html)
                    if (await fs.existsSync(_this._guards[i].settings.html)) {
                      let page = await fs.readFileSync(_this._guards[i].settings.html);
                      res.writeHead(401, { "Content-Type": "text/html" });
                      res.write(page.toString());
                      res.end();
                      return
                    }
                  }
                  // else just return 401
                  res.statusCode = 401;
                  res.end(
                    JSON.stringify({ error: 401, message: "Not Authenticated" })
                  );
                  return;
                 } 

                 res.statusCode = 401;
                  res.end(
                    JSON.stringify({ error: 401, message: "Not Authenticated" })
                  );
                  return;
               } 
             }
           }
         }
 
         // If content type is JSON resolve body and attach to http.ClientRequest
         if (req.headers["content-type"] && req.method.toLowerCase() !== 'get') {
          if (req.headers["content-type"].includes("application/json")) {
            req.body = await json(req);
          }
        }

        // Set URL Query
         req.query = query

         // Run any Method Guards
         if (!fwd && _this._routes[path][`_${req.method.toLowerCase()}`].prm) {
           if (_this._methodGuard.length) {
             for (let i = 0; i < _this._methodGuard.length; i++) {
               let pass = await _this._methodGuard[i](req);
               if (!pass) {
                 res.statusCode = 401;
                 res.end(
                   JSON.stringify({ error: 401, message: "Permission Denied" })
                 );
                 return;
               }
             }
           }
           if (
             typeof _this._routes[path][`_${req.method.toLowerCase()}`].prm ===
             "function"
           ) {
             let pass = await _this._routes[path][
               `_${req.method.toLowerCase()}`
             ].prm(req);
             if (!pass) {
               res.statusCode = 401;
               res.end(
                 JSON.stringify({ error: 401, message: "Permission Denied" })
               );
               return;
             }
           }
         }
 
         // Execute gateway logic first
         if (Object.keys(_this._forwardRoutes).length) {
           if (_this._forwardRoutes[path]) {
              // If forward has swap, replace with swap path.
              if (_this._forwardRoutes[path]._swap) {
                let tempPath = path.includes('*') ? path.replace('*', '') : path;
                req.originalURL = req.url;
                req.url = req.url.toLocaleLowerCase().replace(tempPath.toLocaleLowerCase(), _this._forwardRoutes[path]._swap.toLocaleLowerCase());
              }
              // forward request on.
             _this.forwardRequest(req, _this._forwardRoutes[path]._to.h, res);
             return;
           }
         }
 
         // Pass ClientRequest to corresponding controller
         _this._routes[path][`_${req.method.toLowerCase()}`].fn(req, res, query);
       } catch (error) {
         console.error(error);
       }
     });
   }
 
   /**
    * Adds a single response header
    * @param {*} key
    * @param {*} value
    */
   setHeader(key, value) {
     this._headers.push([key, value]);
   }
 
   /**
    * Sets all response headers.
    * @param {Array[{key, value}]} headers
    */
   setHeaders(headers) {
     this._headers = headers;
   }
 
   /**
    * Adds a single whitelist path that will bypass a API Guard
    * @param {String} headers
    */
   setWhitelist(path) {
     try {
       let sp = path.toLocaleLowerCase().split("/");
 
       let nPath = "";
       sp.forEach((p) => {
         if (p.includes(":")) {
           p = p.substring(1);
           nPath = nPath + "/*";
           wc = true;
         } else {
           if (p !== "") {
             nPath = nPath + "/" + p;
           }
         }
       });
 
       this._whiteList.push(nPath);
     } catch (error) {
       console.error(error);
     }
   }
 
   /**
    * Adds a single whitelist path that will bypass a API Guard
    * @param {Array[{String}]} headers
    */
   setWhitelists(list) {
     try {
       let wlist = [];
       list.forEach((path) => {
         let sp = path.toLocaleLowerCase().split("/");
         sp.shift();
         let nPath = "";
         sp.forEach((p) => {
           if (p.includes(":")) {
             p = p.substring(1);
             nPath = nPath + "/*";
           } else {
             if (p !== "") {
               nPath = nPath + "/" + p;
             }
           }
         });
         wlist.push(nPath);
       });
 
       if (this._whiteList.length) {
         this._whiteList.concat(wlist);
       } else {
         this._whiteList = wlist;
       }
     } catch (error) {
       console.error(error);
       if (res) {
         res.Error({status: 500, message: "Error processing request."});
       }
     }
   }
 
   /**
    * Adds a API Guard that every request must pass. Unless it is whitelisted.
    * Optionally pass a 'path' to only apply auth guard to request that include that path.
    * Optionally pass 'settings' have the request redirected or deliver alternative content.
    * @param {Function} fn
    * @param {String} path
    * @param {Object} ex. {redirect: String, html: String}
    * @returns {Boolean}
    */
   setGuard(fn, path, settings) {
     this._guards.push({ fn, path, settings });
   }
 
   setMethodGuard(fn) {
     this._methodGuard.push(fn);
   }
 
   /**
    * Sets a new API Controller
    * @param {String} path
    */
   at(path) {
     try {
       let sp = path.toLocaleLowerCase().split("/");
       let parts = [];
       let wc = false;
       let nPath = "";
       sp.forEach((p) => {
         if (p.includes(":")) {
           p = p.substring(1);
           parts.push({ part: "*", id: p });
           nPath = nPath + "/*";
           wc = true;
         } else {
           if (p !== "") {
             parts.push({ part: p, id: null });
             nPath = nPath + "/" + p;
           }
         }
       });
 
       let controller = new APIController(nPath);
       controller.parts = parts;
       controller.wildcards = wc;
 
       if (this._routes[nPath]) {
         throw Error(`Controller Path ${nPath}, already in use.`);
       }
 
       this._routes[nPath] = controller;
       return this._routes[nPath];
     } catch (error) {
       console.error(error);
     }
   }
 
   /**
    * Sets a new Gateway route.
    * @param {String} path
    */
   forward(path) {
     try {
       let gwr = new GatewayPath(path);
 
       if (this._forwardRoutes[path]) {
         throw Error(`Gateway Path ${path}, already in use.`);
       }
 
       this._forwardRoutes[path] = gwr;
       return this._forwardRoutes[path];
     } catch (error) {
       console.error(error);
     }
   }
 
   /**
    * Forward request via http to another host.
    * @param {HTTP Request} request
    * @param {String} to "Host ex. http://localhost:2000"
    * @param {HTTP Response} res
    */
   async forwardRequest(request, to, res) {
     if (this._config.logging) {
       console.info(`PROXY From: ${request.headers.host}${request.originalURL ? request.originalURL : request.url} to: ${to}${request.url} - IP: ${request.headers["x-forwarded-for"] || request.connection.remoteAddress}`)
     }
     try {
       let props = { method: request.method, headers: request.headers };
       if (request.headers["content-type"] && request.method !== "GET") {
         if (
           request.headers["content-type"].includes("application/json") &&
           request.body
         ) {
           props.body = JSON.stringify(request.body);
         }
       }
 
       let response;
       if (
         request.headers["content-type"] &&
         request.method !== "GET" &&
         request.headers["content-type"].includes("multipart/form-data")
       ) {
         const form = new Formidable.IncomingForm();
         form.keepExtensions = true;
         form.parse(request, async (err, fields, files) => {
           let key = Object.keys(files);
           if (key.length) {
             let form = new FormData();
             form.append(key[0], fs.createReadStream(files[key[0]].filepath));
             delete request.headers["content-type"];
             delete request.headers["content-length"];
             let host = to.split(":");
             form.submit(
               {
                 host: host[1].replace("//", ""),
                 protocol: host[0] + ":",
                 port: host[2] || null,
                 path: request.url,
                 headers: request.headers,
               },
               async (err, resp) => {
                 if (err) {
                   res.writeHeader(500);
                   res.end();
                   if (this._config.logging) {
                    console.info(`ERROR: PROXY from: ${to}${request.url} to: ${request.headers.host}${request.originalURL ? request.originalURL : request.url} - IP: ${request.headers["x-forwarded-for"] || request.connection.remoteAddress}, ${err}`)
                  }
                   return
                 }
                 fs.unlinkSync(files[key[0]].filepath);
 
                 let buffer = "";
                 resp.on("data", (chunk) => {
                   buffer += chunk;
                 });
                 resp.on("end", () => {
                   res.writeHeader(resp.statusCode || 500, {
                     "Content-Type": resp.headers["content-type"],
                   });
                   res.write(buffer);
                   res.end();
                   if (this._config.logging) {
                     console.info(`PROXY from: ${to}${request.url} to: ${request.headers.host}${request.originalURL ? request.originalURL : request.url} - IP: ${request.headers["x-forwarded-for"] || request.connection.remoteAddress}`)
                   }
                 });
 
                 return;
               }
             );
           }
         });
       } else {
         response = await fetch(`${to}${request.url}`, props);
         let keys = response.headers.raw();
         let headers = {};
         for (const key in keys) {
           headers[key] = response.headers.get(key);
         }
         let ct = response.headers.get("content-type");
         if (ct) {
           if (ct.includes("application/json")) {
             const data = await response.json();
             res.SendResponse(data, response.status);
             return;
           }
         }
 
         const buffer = await response.buffer();
         res.writeHeader(response.status, headers);
         res.write(buffer);
         res.end();
         if (this._config.logging) {
           console.info(`PROXY from: ${to}${request.url} to: ${request.headers.host}${request.originalURL ? request.originalURL : request.url} - IP: ${request.headers["x-forwarded-for"] || request.connection.remoteAddress}`)
         }
         return;
       }
     } catch (error) {
       console.error(error);
     }
   }
 
   /**
    * Documents API to a markdown file
    * @param {output: string} settings
    */
   writeDocs(settings) {
     try {
       if (settings && settings.output) {
         createDocs(settings.output);
       }
     } catch (error) {
       console.error(error);
     }
   }
 }
 
 /**
  * Returns a body buffer
  * @param {http.ClientRequest} req
  * @param {Object?} param1
  * @returns {Buffer}
  */
 const buffer = (req, { limit = "2mb", encoding } = {}) =>
   Promise.resolve().then(() => {
     const type = req.headers["content-type"] || "text/plain";
     const length = req.headers["content-length"];
 
     if (encoding === undefined) {
       encoding = contentType.parse(type).parameters.charset;
     }
 
     const body = rawBodyMap.get(req);
 
     if (body) {
       return body;
     }
 
     return getRawBody(req, { limit, length, encoding })
       .then((buf) => {
         rawBodyMap.set(req, buf);
         return buf;
       })
       .catch((err) => {
         if (err.type === "entity.too.large") {
           console.error(413, `Body exceeded ${limit} limit`, err);
         } else {
           console.error(400, "Invalid body", err);
         }
       });
   });
 
 /**
  * Returns body text
  * @param {http.ClientRequest} req
  * @param {Object?} param1
  * @returns {String}
  */
 const text = (req, { limit, encoding } = {}) =>
   buffer(req, { limit, encoding }).then((body) => body.toString(encoding));
 
 /**
  * Returns body JSON
  * @param {http.ClientRequest} req
  * @param {Object?} param1
  * @returns {JSON}
  */
 const json = (req, opts) =>
   text(req, opts).then((body) => {
     try {
       return JSON.parse(body === "" ? "{}" : body);
     } catch (err) {
       console.error(400, "Invalid JSON", err);
     }
   });
 
 class GatewayPath {
   constructor(path) {
     this._path = path.toLowerCase();
     this._swap = null;
     this._to = null;
   }
   swap(swap) {
    this._swap = swap.toLowerCase()
    return this;
   }
   to(host) {
     this._to = { h: host.toLowerCase() };
     return this;
   }
   
 }

class APIController {
   constructor(path) {
     this._path = path.toLowerCase();
     this._get = null;
     this._post = null;
     this._patch = null;
     this._put = null;
     this._delete = null;
   }
 
   get(fn, prm) {
     this._get = { fn: fn, prm: prm };
     return this;
   }
   patch(fn, prm) {
     this._patch = { fn: fn, prm: prm };
     return this;
   }
   post(fn, prm) {
     this._post = { fn: fn, prm: prm };
     return this;
   }
   put(fn, prm) {
     this._put = { fn: fn, prm: prm };
     return this;
   }
   delete(fn, prm) {
     this._delete = { fn: fn, prm: prm };
     return this;
   }
 }
 
 module.exports = { RestLite };
 
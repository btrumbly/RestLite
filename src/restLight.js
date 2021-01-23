/**
 * Title: RestLite
 * About: A light weight http Restful API Server.
 * Author: Brian Trumbly
 */

const http = require("http");
const url = require("url");
const contentType = require("content-type");
const rawBodyMap = new WeakMap();
const getRawBody = require("raw-body");
const { createDocs } = require("rest-lite/src/docs/createDocs");

class RestLite {
  constructor() {
    this._server = null;
    this._routes = {};
    this._guards = [];
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

        res.__proto__.Error = function (data) {
          this.SendResponse(data, 500);
        };

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
                  } else {
                    if (parts[i].part === "*" && parts[i].id) {
                      nPath += "/*"
                    }
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
                  break
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
              let pass = await _this._guards[i](req);
              if (!pass) {
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
        if (req.headers["content-type"]) {
          if (req.headers["content-type"].includes("application/json")) {
            req.body = await json(req);
          }
        }

        // Run any Method Guards
        if (_this._routes[path][`_${req.method.toLowerCase()}`].prm) {
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
        res.Error();
      }
    }
  }

  /**
   * Adds a API Guard that every request must pass. Unless it is whitelisted.
   * @param {Function} fn
   */
  setGuard(fn) {
    this._guards.push(fn);
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

class APIController {
  constructor(path) {
    this._path = path;
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

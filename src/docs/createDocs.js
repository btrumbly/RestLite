const fs = require("fs");
const path = require("path");
const { writeDocs } = require("./writeDocs");
const dir = "./";
const pathRegex = /"(.*)"/;
const getRegex = /.get\((.*?)\).?/;
const postRegex = /.post\((.*?)\).?/;
const putRegex = /.put\((.*?)\).?/;
const deleteRegex = /.delete\((.*?)\).?/;
const methodRegex = /\/\*\*([\s\S]*?)\*\//g;

let docs = "";
let api = {
  about: {},
  routes: [],
  methods: {},
  envs: "",
};

const exclude = [".git", ".vscode", ".gitignore", "node_modules"];

const createDocs = async (output) => {
  if (output.ignore) {
    exclude = ignore;
  }

  const files = fs.readdirSync(dir);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (fs.lstatSync(dir + file).isDirectory() && !exclude.includes(file)) {
      await sortDirectory(dir, file);
    } else if (!exclude.includes(file)) {
      await parseFile(dir + file);
    }
  }
  writeDocs(api, output);
};

const parseFile = (filename) => {
  return new Promise(async (res, rej) => {
    let content = await fs.readFileSync(filename);
    if (content.includes(".at(")) {
      await parseAPIRoutes(content.toString());
      api.routeFile = path.normalize(filename);
    }
    if (filename === "./package.json") {
      await parseAboutService(content);
    }
    if (filename.includes(".js")) {
      await parseJSFile(content.toString(), path.normalize(filename));
    }
    if (filename === "./.env") {
      await parseENVFile(content.toString());
    }
    res();
  });
};

const parseJSFile = (file, location) => {
  return new Promise(async (res, rej) => {
    const methods = [...file.matchAll(methodRegex)];
    if (methods) {
      for (let i = 0; i < methods.length; i++) {
        const disc = methods[i];

        let newMethod = {
          about: methods[0][0].trim(),
          path: location,
        };

        let name = /\@name(.*)/g.exec(disc);
        let description = /\@description(.*)/g.exec(disc);
        if (description) {
          newMethod.description = description[1];
        }
        if (name) {
          api.methods[name[1].trim()] = newMethod;
        }
      }
    }
    res();
  });
};

const parseENVFile = (file) => {
  return new Promise(async (res, rej) => {
    let env = file.split("\n");
    let envstr = "";
    for (let i = 0; i < env.length; i++) {
      let v = env[i].split("=");
      envstr += v[0] + "=*************" + "\n ";
    }
    api.envs = envstr;
    res();
  });
};

const sortDirectory = (dir, dirName) => {
  return new Promise(async (res, rej) => {
    const files = fs.readdirSync(dir + dirName);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (
        fs.lstatSync(dir + dirName + "/" + file).isDirectory() &&
        !exclude.includes(file)
      ) {
        await sortDirectory(dir + dirName + "/", file);
      } else {
        await parseFile(dir + dirName + "/" + file);
      }
    }
    res();
  });
};

const parseAboutService = (json) => {
  return new Promise(async (res, rej) => {
    let about = JSON.parse(json);
    api.about = about;
    if (api.about.homepage.includes("bitbucket")) {
      api.about.link =
        api.about.homepage.replace("#readme", "/") + "src/master/";
    } else if (api.about.homepage.includes("github")) {
      api.about.link =
        api.about.homepage.replace("#readme", "/") + "tree/master/";
    } else {
      api.about.link = api.about.homepage.replace("#readme", "/");
    }
    res();
  });
};

const parseAPIRoutes = (routesFile) => {
  return new Promise(async (res, rej) => {
    let rawRoutes = routesFile.split(".at(");

    rawRoutes.splice(0, 1);
    for (let i = 0; i < rawRoutes.length; i++) {
      const route = rawRoutes[i];
      let path = pathRegex.exec(route);
      if (path) {
        let newPath = {
          path: path[1],
        };
        let get = getRegex.exec(route);
        newPath.get = {};
        newPath.get.method = get ? get[1] : null;
        let post = postRegex.exec(route);
        newPath.post = {};
        newPath.post.method = post ? post[1] : null;
        let put = putRegex.exec(route);
        newPath.put = {};
        newPath.put.method = put ? put[1] : null;
        let del = deleteRegex.exec(route);
        newPath.del = {};
        newPath.del.method = del ? del[1] : null;
        api.routes.push(newPath);
      }
    }
    res();
  });
};

module.exports = { createDocs };

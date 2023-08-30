const fs = require("fs");
var path = require("path");
const dir = "./";

const writeDocs = async (api, output) => {
  return new Promise(async (res, rej) => {
    try {
      let d = "";
      d += `# ${api.about.name}\n`;
      d += `**Version:** ${api.about.version}\n\n`;
      d += `**Author:** ${api.about.author}\n\n`;
      d += `**Description:**\n\n`;
      d += `${api.about.description}\n\n`;
      d += `## Dependencies\n`;
      d += await list(api.about.dependencies);
      d += `## Environment\n`;
      d += "```\n" + api.envs.trim() + "\n```";
      d += "\n";
      if (api.gwRoutes.length) {
        d += `# Gateway\n`;
        d += await buildGateWay(api);
      }
      d += "\n";
      if (api.routes.length) {
        d += `# Routes\n`;
        d += await buildPath(api);
      }
      d += "---\n";
      d +=
        "Document generated by [Rest-Lite](https://www.npmjs.com/package/rest-lite).";
      fs.writeFileSync(dir + output, d);
      res();
    } catch (error) {
      console.error(error);
      rej(error);
    }
  });
};

const list = (values) => {
  return new Promise((res, rej) => {
    try {
      let dep = "```\n{\n";
      for (const key in values) {
        dep += `  ${key}: "${values[key]}"\n`;
      }
      dep += "}\n```\n";
      res(dep);
    } catch (error) {
      console.error(error);
      rej(error);
    }
  });
};

const buildPath = (api) => {
  return new Promise((res, rej) => {
    try {
      let p = "";
      for (let i = 0; i < api.routes.length; i++) {
        const r = api.routes[i];
        let m;
        p += "### Path: `" + r.path + "`\n\n";
        if (r.get.method) {
          if (api.methods[r.get.method.trim()]) {
            m = api.methods[r.get.method];
            p += `### Get: [${r.get.method}](${m.path})\n\n`;
            p += `>**Repo Link:** [${r.get.method}](${api.about.link}${m.path})\n\n`;
            p += `>**Description:** ${m.description}\n\n`;
            p += `>**File Path:** ${m.path}\n`;
            p += "```\n" + m.about + "\n```\n";
          } else {
            p += `**Get:** ${r.get.method}\n\n`;
          }
        }
        if (r.post.method) {
          if (r.post.method in api.methods) {
            m = api.methods[r.post.method.trim()];
            p += `### Post: [${r.post.method}](${m.path})\n\n`;
            p += `>**Repo Link:** [${r.post.method}](${api.about.link}${m.path})\n\n`;
            p += `>**Description:** ${m.description}\n\n`;
            p += `>**File Path:** ${m.path}\n`;
            p += "```\n" + m.about + "\n```\n";
          } else {
            p += `**Post:** ${r.post.method}\n\n`;
          }
        }
        if (r.put.method) {
          if (r.put.method in api.methods) {
            m = api.methods[r.put.method.trim()];
            p += `### Put: [${r.put.method}](${m.path})\n\n`;
            p += `>**Repo Link:** [${r.put.method}](${api.about.link}${m.path})\n\n`;
            p += `>**Description:** ${m.description}\n\n`;
            p += `>**File Path:** ${m.path}\n`;
            p += "```\n" + m.about + "\n```\n";
          } else {
            p += `**Put:** ${r.put.method}\n\n`;
          }
        }
        if (r.del.method) {
          if (r.del.method in api.methods) {
            m = api.methods[r.del.method.trim()];
            p += `### Delete: [${r.del.method}](${m.path})\n\n`;
            p += `>**Repo Link:** [${r.del.method}](${api.about.link}${m.path})\n\n`;
            p += `>**Description:** ${m.description}\n\n`;
            p += `>**File Path:** ${m.path}\n`;
            p += "```\n" + m.about + "\n```\n";
          } else {
            p += `**Delete:** ${r.del.method}\n\n`;
          }
        }
        p += "---\n";
      }

      res(p);
    } catch (error) {
      console.error(error);
    }
  });
};

const buildGateWay = (api) => {
  return new Promise((res, rej) => {
    try {
      let p = "| Path | | Forward To | \n |-----------|:---:|---------------| \n";
      for (let i = 0; i < api.gwRoutes.length; i++) {
        const r = api.gwRoutes[i];
        let m;
        p += `| ${r.path} | &rarr; |`;
        if (r.to) {
          p += `${r.to} |`;
        } else {
          '  | \n'
        }
        p += "\n";
      }

      res(p);
    } catch (error) {
      console.error(error);
    }
  });
};

module.exports = { writeDocs };

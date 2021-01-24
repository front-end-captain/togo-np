# togo-np
A "npm publish" cli

## 开始
### 环境要求
+ node.js >= 10+
+ npm >= 6.8+
+ Git >= 2.11+

### 安装
```shell
npm install togo-np
```

### 使用
#### 在命令行中使用

```shell
$ togo-np -h

  Usage: togo-np [options] [version]

  Options:
    -V, --version            output the version number
    --tag <tag>              specify dist-tag, default 'latest'
    --allow-any-branch       any branch can publish, default 'false'
    --branch <branch>        specify branch that allow publish
    --run-scripts <scripts>  run specify script, for example, --run-scripts 'test build'
    --clean                  remove 'node_modules' and reinstall, default 'false'
    -h, --help               display help for command


  # Usage
    Check version: togo-np version
    Help: togo help

  # GitHub
    https://github.com/front-end-captain/todo-np#readme
```

#### 在代码中使用

``` javascript
const run = require("togo-np");

(async () => {
  try {
    await run("1.2.3", { branch: "main" });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
```

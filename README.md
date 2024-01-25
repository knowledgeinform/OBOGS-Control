control-system
==============
testing ci2
Instrumentation and Control System for a lab

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/control-system.svg)](https://npmjs.org/package/control-system)
[![Downloads/week](https://img.shields.io/npm/dw/control-system.svg)](https://npmjs.org/package/control-system)
[![License](https://img.shields.io/npm/l/control-system.svg)](https://github.com/jonesjp1/N/A/blob/master/package.json)

<!-- toc -->
# Usage
<!-- usage -->

Installation

```shell
yarn install
```

```shell
npm install
```

Running
From src
```shell
node ../bin/run server -t
```

Testing

```shell
mocha
```

Development mode

```shell
cd src
../bin/run server -t
```

Production mode

```shell
cd src
sudo ../bin/run server 80
```

# Commands
<!-- commands -->

To easily make pinMap.js from Pinouts.csv:
excel formula for inter-lacing adjacent columns (copying every-other):
=IF(MOD(ROW(),2)=0,INDIRECT(CONCATENATE("K",ROW()-(ROW()/2 - 1))),INDIRECT(CONCATENATE("N",ROW()-((ROW()-1)/2))))

One-liner for inserting APL header into files
```shell
for f in *.js; do cat ~/dev/header.js $f > temp && mv temp $f; done
```

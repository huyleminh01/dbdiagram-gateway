const { parse } = require('url');

module.exports = class StaticProxy {
  constructor(proxyOptions, endpoints) {
    this.proxyOptions = proxyOptions;
    this.endpoints = endpoints;
    this.target = parse(this.endpoints[0]);
  }

  nextTarget() {
    return Object.assign({}, this.proxyOptions.target, this.target);
  }
};

const policy = require('./policies/request-logger');

module.exports = {
  version: '0.0.1',
  schema: {
    $id: 'https://express-gateway.io/schemas/plugins/logger.json',
  },
  init: function (pluginContext) {
    pluginContext.registerPolicy(policy);
  },
  policies: ['request-logger'],
};

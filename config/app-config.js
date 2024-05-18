const dotenv = require('dotenv');
dotenv.config();

const APP_CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'debug',
  logDriver: process.env.LOG_DRIVER || 'console',
};

module.exports = { APP_CONFIG };

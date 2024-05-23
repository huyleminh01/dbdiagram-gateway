const dotenv = require('dotenv');

dotenv.config();

const APP_CONFIG = {
  logLevel: process.env.LOG_LEVEL || 'debug',
  logDriver: process.env.LOG_DRIVER || 'console',

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? +process.env.REDIS_PORT : 6379,
  }
};

module.exports = { APP_CONFIG };

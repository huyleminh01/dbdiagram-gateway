const { createClient } = require('redis');
const { APP_CONFIG } = require('../config/app-config');
const { Logger } = require('../common/utils/logger');

const client = createClient({
  url: `redis://${APP_CONFIG.redis.user}:${APP_CONFIG.redis.password}@${APP_CONFIG.redis.host}:${APP_CONFIG.redis.port}`,
});

async function initRedisConnectionAsync() {
  client.on('ready', () => Logger.info('Redis connected'));

  client.on('end', () => Logger.info('Redis connection closed'));

  client.on('reconnecting', () => {
    Logger.info('Redis is reconnecting');
  });

  client.on('error', (error) => {
    Logger.info('Redis error', error);
  });

  await client.connect();
}

const RedisClient = {
  initRedisConnectionAsync,
  client,
};

module.exports = RedisClient;

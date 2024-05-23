const path = require('path');
const gateway = require('express-gateway');
const dotenv = require('dotenv');
const RedisClient = require('./connections/redis');

dotenv.config();

gateway().load(path.join(__dirname, 'config')).run();

// init redis connection'
RedisClient.initRedisConnectionAsync();

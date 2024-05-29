const { Logger } = require('../../../common/utils/logger');

/**
 * @description Define custom request logging middleware: can log more information and send message to file system or console
 */
module.exports = {
  name: 'request-logger',
  schema: {
    $id: 'http://express-gateway.io/schemas/policies/request-logger.json',
  },
  policy: (actionParams) => {
    return (req, res, next) => {
      const startTime = process.hrtime();

      Logger.info(`\n\n-----------------------------`);
      Logger.info(`Request started`);
      Logger.info(`-----------------------------`);

      res.on('finish', () => {
        // caltulate total time that server spent to complete the request
        const totalTime = process.hrtime(startTime);
        const totalTimeInMs = totalTime[0] * 1000 + totalTime[1] / 1000000;

        const { ip, method, originalUrl, httpVersion } = req;
        const userAgent = req.get('user-agent') || '';

        const { statusCode } = res;
        const contentLength = res.get('Content-Length');

        const message = [
          ip,
          method,
          originalUrl,
          `HTTP ${httpVersion}`,
          statusCode,
          contentLength,
          userAgent,
          `${totalTimeInMs}ms`,
        ].join(' - ');

        Logger.info(message);
        Logger.info(`-----------------------------`);
        Logger.info(`Request ended`);
        Logger.info(`-----------------------------`);
      });
      next();
    };
  },
};

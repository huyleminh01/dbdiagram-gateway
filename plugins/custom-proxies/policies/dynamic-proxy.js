const fs = require('fs');
const clone = require('clone');
const httpProxy = require('http-proxy');
const ProxyAgent = require('proxy-agent');
const strategies = require('./strategies');
const http = require('http');
const https = require('https');
const RedisClient = require('../../../connections/redis');
const { Logger } = require('../../../common/utils/logger');
const { parse } = require('url');

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const createStrategy = (strategy, proxyOptions, endpointUrls) => {
  const Strategy = strategies[strategy];
  return new Strategy(proxyOptions, endpointUrls);
};

module.exports = {
  name: 'dynamic-proxy',
  policy: (params, config) => {
    const serviceEndpointKey = params.serviceEndpoint;

    if (!serviceEndpointKey) {
      Logger.warn('Service Endpoint not provided — this proxy policy will permanently return 502');
      return (req, res) => res.sendStatus(502);
    }

    const endpoint = config.gatewayConfig.serviceEndpoints[serviceEndpointKey];

    if (!endpoint) {
      // Note: one day this can be ensured by JSON Schema, when $data keyword will be avaiable.
      throw new Error(
        `service endpoint ${serviceEndpointKey} (referenced in proxy policy configuration) does not exist`
      );
    }

    const proxyOptions = Object.assign({}, clone(params));

    if (endpoint.proxyOptions) {
      Object.assign(proxyOptions, clone(endpoint.proxyOptions));
    }
    if (params.proxyOptions) {
      Logger.warn(`The proxyOption object is deprecated and will be likely removed in the next major version. Consider
    putting these properties directly on the action parameters instead.`);
      Object.assign(proxyOptions, clone(params.proxyOptions));
    }

    if (proxyOptions.target) {
      const certLocations = {
        keyFile: proxyOptions.target.keyFile,
        certFile: proxyOptions.target.certFile,
        caFile: proxyOptions.target.caFile,
      };

      delete proxyOptions.target.keyFile;
      delete proxyOptions.target.certFile;
      delete proxyOptions.target.caFile;

      const certificatesBuffer = readCertificateDataFromFile(certLocations);
      Object.assign(proxyOptions.target, certificatesBuffer);
    }

    const intermediateProxyUrl = process.env.http_proxy || process.env.HTTP_PROXY || params.proxyUrl;

    if (intermediateProxyUrl) {
      Logger.verbose(`using intermediate proxy ${intermediateProxyUrl}`);
      proxyOptions.agent = new ProxyAgent(intermediateProxyUrl);
    }

    const proxy = httpProxy.createProxyServer(Object.assign(params, proxyOptions));

    proxy.on('error', (err, req, res) => {
      Logger.warn(err);

      if (!res.headersSent) {
        res.status(502).send('Bad gateway.');
      } else {
        res.end();
      }
    });

    let strategy;
    let urls;

    if (endpoint.url) {
      strategy = 'static';
      urls = [endpoint.url];
    } else {
      strategy = params.strategy || 'round-robin';
      urls = endpoint.urls;
    }

    const balancer = createStrategy(strategy, proxyOptions, urls);

    const stripPathFn = params.stripPath
      ? (req) => {
          const wildcardPos = req.route.path.search(/[:*]/);
          if (wildcardPos === -1) {
            // no wildcard, strip the full path. i.e. change URL to / + query string
            req.url = `/${req._parsedUrl.search || ''}`;
          } else if (wildcardPos === 0) {
            // full path is a wildcard match so there's nothing to strip
          } else {
            // else strip everything up to the first wildcard, ensuring path still begins with /
            req.url = `/${req.originalUrl.substring(wildcardPos)}`;
          }
        }
      : () => {};

    return async function proxyHandler(req, res) {
      let target = balancer.nextTarget();
      const headers = Object.assign({ 'eg-request-id': req.egContext.requestID }, proxyOptions.headers);

      stripPathFn(req);

      // These paths will trigger a hook to update the socket session
      // TODO: Find others solution to config or move these path to another fileß
      const pathToMatchSessionList = [
        { path: /^\/diagram_permission\/(?<diagramId>[\d\w_-]+)$/, method: 'put' },
        { path: /^\/diagram_permission\/(?<diagramId>[\d\w_-]+)$/, method: 'delete' },
        { path: /^\/query\/(?<diagramId>[\d\w_-]+)$/, method: 'delete' },
        { path: /^\/query\/(?<diagramId>[\d\w_-]+)\/rename$/, method: 'put' },
        { path: /^\/query_access\/$/, method: 'post' },
      ];

      const pathToMatch = pathToMatchSessionList.find((item) => {
        return item.method === req.method.toLowerCase() && item.path.test(req.path);
      });

      if (pathToMatch) {
        try {
          const matchResult = req.path.match(pathToMatch.path);
          let sessionId = matchResult.groups?.diagramId;
          Logger.debug('Session from params', sessionId);

          if (!sessionId) {
            // try to get diagram ID from the query params
            Logger.debug('Session from query', req.query.queryId)
            sessionId = req.query.queryId;
          }


          const address = await RedisClient.client.get(sessionId);

          Logger.debug('HTTP', sessionId, address);
          if (address) {
            target = parse(`http://${address}:5000`);
          }
        } catch (error) {
          Logger.error(error);
        }
      }

      Logger.debug(`proxying to ${target.href}, ${req.method} ${req.url}`);
      proxy.web(req, res, {
        target,
        headers,
        buffer: req.egContext.requestStream,
        agent: !intermediateProxyUrl ? (target.protocol === 'https:' ? httpsAgent : httpAgent) : proxyOptions.agent,
      });
    };

    // multiple urls will load balance, defaulting to round-robin
  },
};

// Parse endpoint URL if single URL is provided.
// Extend proxy options by allowing and parsing keyFile, certFile and caFile.
function readCertificateDataFromFile({ keyFile, certFile, caFile }) {
  let key, cert, ca;

  if (keyFile) {
    key = fs.readFileSync(keyFile);
  }

  if (certFile) {
    cert = fs.readFileSync(certFile);
  }

  if (caFile) {
    ca = fs.readFileSync(caFile);
  }

  return { key, cert, ca };
}

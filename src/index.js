/*!
 * Copyright 2018 Benjamin Clot. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const path = require('path');
const config = require(path.join(__dirname, '..', 'config', 'config.json'));
const bigQuery = require('@google-cloud/bigquery')({
  projectId: config.bigQuery.projectId,
  keyFilename: path.join(__dirname, '..', 'config', 'auth.json'),
});
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const http = require('http');
require('console-stamp')(console, {
  colors: {stamp: 'yellow', label: 'white', metadata: 'green'},
  metadata: function() {
    return `[${process.pid}]`;
  },
  pattern: 'dd/mm/yyyy HH:MM:ss.l',
});

var insertData = data => {
  return new Promise(function(resolve, reject) {
    if (!isValidReq(data)) {
      reject(new Error('Invalid or empty request'));

      return;
    }

    bigQuery
      .dataset(config.bigQuery.datasetId)
      .table(config.bigQuery.tableId)
      .insert(data, {ignoreUnknownValues: true})
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
};

var isValidReq = data => {
  return !!(
    typeof data === 'object' &&
    (data.length > 0 || Object.keys(data).length > 0)
  );
};

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', worker => {
    console.log(`Worker ${worker.process.pid} died`);

    cluster.fork();
  });
} else {
  http
    .createServer((req, res) => {
      let body = [];

      req
        .on('data', chunk => body.push(chunk))
        .on('end', () => {
          const requestOrigin = req.headers.origin || '*';

          res.setHeader('Access-Control-Allow-Origin', requestOrigin);
          res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
          res.setHeader(
            'Access-Control-Allow-Headers',	
            'Accept, Cache-Control, Content-Type, Origin, X-Requested-With'	
          );
          res.setHeader('Timing-Allow-Origin', requestOrigin);

          switch (req.method) {
            case 'OPTIONS':
              res.statusCode = 200;
              res.end();
    
              break;
            case 'POST':
              res.setHeader('Cache-control', 'no-store, no-cache, private');
              res.setHeader('Pragma', 'no-cache');

              body = Buffer.concat(body).toString();

              try {
                body = JSON.parse(body);

                insertData(body)
                  .then(() => {
                    res.statusCode = 200;
                    res.end();
                  })
                  .catch(err => {
                    console.error('BigQuery', JSON.stringify(err));

                    res.statusCode = 400;
                    res.end(err.message || '');
                  });
              } catch(e) {
                console.error('Error while parsing JSON', JSON.stringify(e));

                res.statusCode = 400;
                res.end('Error while parsing JSON');
              }

              break;
            default:
              console.error('Method not allowed', req.method);

              res.statusCode = 405;
              res.end();

              break;
          }
        })
        .on('error', err => {
          console.error('HTTP.error', JSON.stringify(err));
        });
    })
    // .on('connection', socket => socket.on('error', err => { console.error('Socket', JSON.stringify(err)); }))
    .on('clientError', (err, socket) => {
      // console.error('Request.clientError', JSON.stringify(err));

      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    })
    .listen(config.server.port);

  console.log(`Worker ${process.pid} started`);
}

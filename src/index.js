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
const http = require('http');

var insertData = data => {
  return new Promise(function(resolve, reject) {
    if (!isValidReq) {
      reject('Invalid or empty request');

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
  return !!data;
};

http
  .createServer((req, res) => {
    let body = [];

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Accept, Cache-Control, Content-Type, Origin, X-Requested-With'
    );

    switch (req.method) {
      case 'OPTIONS':
        res.statusCode = 200;
        res.end();

        break;
      case 'POST':
        req.on('data', chunk => body.push(chunk)).on('end', () => {
          body = Buffer.concat(body).toString();

          insertData(JSON.parse(body))
            .then(() => {
              res.statusCode = 200;
              res.end();
            })
            .catch(err => {
              if (err instanceof Error) {
                // eslint-disable-next-line no-console
                console.error(err);
              } else {
                // eslint-disable-next-line no-console
                console.error(new Error(err));
              }

              res.statusCode = 400;
              res.end();
            });
        });

        break;
      default:
        res.statusCode = 405;
        res.end();

        break;
    }
  })
  .on('clientError', (err, socket) => {
    if (err instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(err);
    } else {
      // eslint-disable-next-line no-console
      console.error(new Error(err));
    }

    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  })
  .listen(config.server.port);

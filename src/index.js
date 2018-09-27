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
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const app = express();
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
  app.use(
    cors({
      allowedHeaders:
        'Accept,Cache-Control,Content-Type,Origin,X-Requested-With',
      credentials: true,
      optionsSuccessStatus: 200,
      origin: true,
      methods: 'OPTIONS,POST',
      preflightContinue: false,
    })
  );

  app.use(
    bodyParser.json({
      inflate: true,
      limit: '100kb',
      type: 'text/plain',
    })
  );

  app.use(bodyParser.urlencoded({extended: true}));

  app.post('/', (req, res, next) => {
    const allowOrigin = res.get('Access-Control-Allow-Origin');

    if (allowOrigin) {
      res.set('Timing-Allow-Origin', allowOrigin);
    }

    res.set('Cache-control', 'no-store, no-cache, private');
    res.set('Pragma', 'no-cache');

    insertData(req.body)
      .then(() => {
        res.status(200).end();
      })
      .catch(err => {
        next(err);
      });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(JSON.stringify(err));

    res.status(err.status || err.statusCode || 400).end(err.message || '');
  });

  app.listen(config.server.port);

  console.log(`Worker ${process.pid} started`);
}

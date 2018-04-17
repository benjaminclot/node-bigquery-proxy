# [NodeJS BigQuery Proxy](https://github.com/benjaminclot/node-bigquery-proxy)

> Node.js proxy server for [Google BigQuery](https://cloud.google.com/bigquery/docs).

This proxy allows you to passthru rows from a POST request directly into BigQuery.
It's raw, meaning there's no queuing, buffering, logging, etc.

### Installing

    npm install --save

### Configuring

Replace/rename the two JSON sample files in the `config` folder.

| File        | How To                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| auth.json   | Auth file from Google Cloud Console                                            |
| config.json | Configuration parameters for BigQuery and the port the server should listen to |

### Running

    npm start

### License

Apache Version 2.0

See [LICENSE](https://github.com/benjaminclot/node-bigquery-proxy/blob/master/LICENSE)
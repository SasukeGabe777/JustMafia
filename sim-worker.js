'use strict';
// Runs a simulation batch off the main thread so live games don't stutter.
const { parentPort, workerData } = require('worker_threads');
const { runBatch } = require('./sim');

parentPort.postMessage(runBatch(workerData));

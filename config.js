'use strict';

var nconf = require('nconf');

nconf
  .file('local', {file: 'config.local.json'})   // read local overwrite
  .argv()                                             // Allow overwrites from command-line
  .env()                                              // Allow overwrites from env
  .file('default', {file: 'config.json'});      // read defaults

nconf.set('app', require('./package.json').name);
nconf.set('version', require('./package.json').version);

module.exports = nconf;

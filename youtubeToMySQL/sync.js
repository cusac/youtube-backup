process.env.API_TOKEN = '#';
process.env.playlistId = '#';

process.env.DB_HOSTNAME = '#'
process.env.DB_USERNAME = '#'
process.env.DB_PASSWORD = '#'
process.env.DB_NAME = '#'

const index = require('./index');

index.handler().then(()=>{});

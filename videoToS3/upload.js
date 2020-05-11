process.env.DB_HOSTNAME = '#'
process.env.DB_USERNAME = '#'
process.env.DB_PASSWORD = '#'
process.env.DB_NAME = '#'

process.env.AWS_ACCESS_KEY = '#';
process.env.AWS_SECRET_ACCESS_KEY = '#';

process.env.bucketName = 'videos-youtube-2'

process.env.limit = 1000;

const index = require('./index');

index.getHighestVersions().then(()=>{});
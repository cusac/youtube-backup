process.env.DB_HOSTNAME = 'mbt.czt7i8bu37g9.us-east-2.rds.amazonaws.com'
process.env.DB_USERNAME = 'admin'
process.env.DB_PASSWORD = 'tR5_XtBjvdR3XWvy'
process.env.DB_NAME = 'mbt'

process.env.AWS_ACCESS_KEY = '###';
process.env.AWS_SECRET_ACCESS_KEY = '###';

process.env.bucketName = 'videos-youtube-2'

process.env.limit = 1000;

const index = require('./index');

index.getHighestVersions().then(()=>{});
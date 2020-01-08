process.env.API_TOKEN = 'AIzaSyDPKlpdOuQWvUf4bf-z2WIpLD7v5WuFYdw';
process.env.playlistId = 'UUYwlraEwuFB4ZqASowjoM0g';

process.env.DB_HOSTNAME = 'mbt.czt7i8bu37g9.us-east-2.rds.amazonaws.com'
process.env.DB_USERNAME = 'admin'
process.env.DB_PASSWORD = 'tR5_XtBjvdR3XWvy'
process.env.DB_NAME = 'mbt'

const index = require('./index');

index.handler().then(()=>{});

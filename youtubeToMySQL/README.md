# YouTube to MySQL
This script will check Tom's YouTube channel through the YouTube API. It will add any videos that are found on the channel and not yet in MySQL to the MySQL videos table.

# How to use (Might take about an hour if you need to set things up, otherwise will only take a few minutes)
- Get yourself connected to the MySQL database to be used. Manually check the videos table. You should see most of the videos are already in there and marked as "in_s3". This script will only add the most recent videos published since the last time the script was ran. If you are having trouble connecting to the database, remember you will probably have to white list your IP in the security group and network ACL the database is connected to.
- "npm install" (tested with node 12.9.0)
- Update sync.js with any changes to the environment variables that may be required.
- "node sync.js". If this is successful you will see "### videos found" then "inserting videos" in the command line then shortly after the videos will be updated. Manually check the videos table to see that now the number of rows should match the ### given in the console. If you sort by publishedat you will see that the latest videos are not yet in s3, but earlier ones are.
- Move on to the videoToS3 script.
# youtube-backup
Scripts to sync Youtube video info to MySQL and to save high quality video and audio in S3. It is recommended that on a regular basis (like once a month). The youtubeToMySQL script then the videoToS3 script are ran in that order. Instructions are in the individual READMEs.

It is also recommended that as part of this process the bucket is synced to the Synology device. This should theoretically be automatic, but it can be checked as part of this process.

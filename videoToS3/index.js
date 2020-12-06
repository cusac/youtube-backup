const mysql = require('mysql');
const pool = mysql.createPool({
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

var fs = require('fs');
var youtubedl = require('youtube-dl');

const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3Stream = require('s3-upload-stream')(s3);

var ffmpeg = require('fluent-ffmpeg');

async function getHighestVersions(){
    let videos = await getVideos();

    let throttle = 10
    let count = 0

    let interval = setInterval(async ()=>{
        if(count < throttle){
            let nextVideo = videos.shift();
            if(nextVideo == undefined && count == 0){
                clearInterval(interval);
                console.log('done')
            } else if (nextVideo != undefined){
                console.log(nextVideo.title)
                count++
                await addHighestVersionToS3(nextVideo)
                count--
            }
        }
    },1000);
}

//Get highest version but only put it in s3 if it isn't already there (in the same size)
async function addHighestVersionToS3(video){
    //download best video and best audio
    let videoCheck = await download(video, 'bestvideo');
    let audioCheck = await download(video, 'bestaudio');

    //Debug
    //video.videoFilename = 'Tom Campbell: Intuition, Conscious Computers, and Individuality-dgMRS0bA_2A.mp4'

    //combine or fall back to single file
    if(videoCheck !== false && audioCheck != false){
        await combineVideoAndAudio(video);
        //delete invididual video and audio
        fs.unlinkSync(video.videoid + 'bestvideo')
        fs.unlinkSync(video.videoid + 'bestaudio')
    } else {
        console.log('fallback');
        await download(video, 'best')
        await renameFile(video.videoid + '.' + video.videoFilename.split('.').pop(), video.videoFilename)
    }

    //console.log(video);

    let fileSizeInBytes = getFilesizeInBytes(video.videoFilename);
    console.log(fileSizeInBytes);

    if(fileSizeInBytes >= (5*1000*1000*1000)){
        await uploadInParts(video);
    } else {
        await uploadVideo(video);
    }

    await deleteVideoLocally(video);
    await markDone(video);
}

async function combineVideoAndAudio(video){
    return new Promise(
        (resolve)=>{
            ffmpeg(video.videoid + 'bestvideo')
                .videoCodec('copy')
                .addInput(video.videoid + 'bestaudio')
                .save(video.videoFilename)
                .on('end', function() {
                    console.log('Combine finished!');
                    resolve()
                })
        }
    )
}

async function renameFile(from, to){
    return new Promise(
        (resolve)=>{
            fs.rename(from, to, function(err) {
                resolve();
            });
        }
    );
}

async function markDone(video){
    return new Promise(
        (resolve)=>{
            pool.getConnection(function (err, connection) {
                if (err) {
                    throw new Error("Unable to get connection to database:" + err);
                } else {
                    connection.query(
                        `UPDATE ${process.env.tableName}
                        SET in_s3 = 1
                        WHERE videoid = ?
                        `,
                        [video.videoid],
                        async function (error, result) {
                            connection.release()
                            if (error) {
                                throw new Error("Error getting count" + error);
                            } else {
                                resolve(result);
                            }
                        }
                    )
                }
            })
        }
    );
}

async function deleteVideoLocally(video){
    fs.unlinkSync(video.videoFilename);
}

async function uploadVideo(video){
    return new Promise(
        (resolve)=>{
            //fs.readFile(video.filename, function (err, data) {
                //if (err) throw err
          
                // Create a new buffer
                //var buffer = Buffer.from(data);
                
                console.log('start upload: '+video.videoFilename);
                // Add the pdf to S3 
                s3.putObject({
                    'Bucket': process.env.bucketName,
                    'Key': video.videoFilename,
                    'Body': fs.createReadStream(video.videoFilename)
                }, function (err, data) {
                    if (err) throw err
          
                    console.log('done uploading file: '+video.videoFilename);
                    resolve();
                })
          
            //})
        }
    );
}

async function uploadInParts(video){
    return new Promise(
        (resolve)=>{
            // Create the streams
            var read = fs.createReadStream(video.videoFilename);
            var upload = s3Stream.upload({
                'Bucket': process.env.bucketName,
                'Key': video.videoFilename,
            });
            
            // Optional configuration
            upload.maxPartSize(5 * 1000 * 1000 ); // 5 MB (slightly under)
            upload.concurrentParts(1000);

            // Handle errors.
            upload.on('error', function (error) {
                console.log(error);
            });
            
            /* Handle progress. Example details object:
            { ETag: '"f9ef956c83756a80ad62f54ae5e7d34b"',
                PartNumber: 5,
                receivedSize: 29671068,
                uploadedSize: 29671068 }
            */
            upload.on('part', function (details) {
                //console.log(details);
            });
            
            /* Handle upload completion. Example details object:
            { Location: 'https://bucketName.s3.amazonaws.com/filename.ext',
                Bucket: 'bucketName',
                Key: 'filename.ext',
                ETag: '"bf2acbedf84207d696c8da7dbb205b9f-5"' }
            */
            upload.on('uploaded', function (details) {
                console.log(details);
                console.log('done uploading file: '+video.videoFilename);
                resolve();
            });
            
            // Pipe the incoming filestream through compression, and up to S3. (removed compression)
            read.pipe(upload);
        }
    )
}

async function download(video, format){
    return new Promise(
        (resolve)=>{
            let failed = false;
            const videoDownload = youtubedl(`http://www.youtube.com/watch?v=${video.videoid}`,
                // Optional arguments passed to youtube-dl.
                //['--format=18'],
                [`-f ${format}`]
                // Additional options can be given for calling `child_process.execFile()`.
                //{ cwd: __dirname }
            )

            // Will be called when the download starts.
            videoDownload.on('info', function(info) {
                if(info.size == undefined){
                    failed = true;
                }
                console.log('Download started')
                console.log('filename: ' + info._filename)
                console.log('size: ' + info.size + ' ' + (info.size/1000000) + ' MB')
                if(format == 'bestvideo' || format == 'best'){
                    video.videoFilename = info._filename;
                } else {
                    video.audioFilename = info._filename;
                }
            })

            videoDownload.on('end', function () {
                if(format == 'bestvideo' || format == 'best'){
                    console.log('end download: '+video.videoFilename);
                } else {
                    console.log('end download: '+video.audioFilename);
                }

                if(failed){
                    fs.unlinkSync(video.videoid+format);
                    resolve(false)
                } else {
                    if(format=='best'){
                        fs.rename(video.videoid+format, video.videoid + '.' +  video.videoFilename.split('.').pop(), function(err) {
                                resolve();
                        });
                    } else {
                        resolve();
                    }


                    // fs.rename(video.videoid+format, video.videoid + '.' + ((format=='bestvideo'  || format == 'best' ) ? video.videoFilename.split('.').pop() : video.audioFilename.split('.').pop()), function(err) {
                    //     resolve();
                    // });
                }


            });

            videoDownload.pipe(fs.createWriteStream(video.videoid+format))
        }
    );
}

//Get the videos from MySQL that haven't been marked as in s3 yet
async function getVideos(){
    return new Promise(
        (resolve)=>{
            pool.getConnection(function (err, connection) {
                if (err) {
                    throw new Error("Unable to get connection to database:" + err);
                } else {
                    connection.query(
                        `SELECT *
                        FROM ${process.env.tableName}
                        WHERE in_s3 = 0
                        ORDER BY publishedat ASC
                        LIMIT ${process.env.limit}
                        `,
                        [],
                        async function (error, result) {
                            connection.release()
                            if (error) {
                                throw new Error("Error getting count" + error);
                            } else {
                                resolve(result);
                            }
                        }
                    )
                }
            })
        }
    );
}

function getFilesizeInBytes(filename) {
    var stats = fs.statSync(filename)
    var fileSizeInBytes = stats["size"]
    return fileSizeInBytes
}

module.exports.getHighestVersions = getHighestVersions;

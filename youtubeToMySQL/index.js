const https = require('https');
const mysql = require('mysql');
const moment = require('moment');
const pool = mysql.createPool({
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function handler (){
    await findAndAddVideos();
    return;
};

async function findAndAddVideos(){
    let videos = [];

    //Get ALL of the videos
    videos = await findVideos(videos, null);
    // console.log(videos.length + ' videos found');
    // console.log(videos);
    // return;

    //Insert all of the videos using INSERT IGNORE so only new ones are put in
    await insertVideos(videos);
}

//Recursively page through all the videos until we have the whole list
async function findVideos(videos, nextPageToken){

    if(videos.length <= 10000){ //Will eventually break when the channel reaches 10,000 videos
        let videoData = await requestVideos(nextPageToken);
        videos = videos.concat(videoData.items);
        if(videoData.nextPageToken){
            return await findVideos(videos, videoData.nextPageToken);
        }
    }

    return videos;
}

//Request a single page of videos from the YouTube API
function requestVideos(pageToken){
    let url = '';
    if(pageToken !== null){
        url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=25&pageToken=${pageToken}&playlistId=${process.env.playlistId}&key=${process.env.API_TOKEN}`;
    } else {
        url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=25&playlistId=${process.env.playlistId}&key=${process.env.API_TOKEN}`;
    }

    return new Promise(
        (resolve)=>{
            https.get(url, (res) => {
                str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                
                res.on('end', async function () {
                    let data = JSON.parse(str);
                    await requestStatistics(data.items);
                    await requestContentDetails(data.items);
                    resolve(data);
                });
            });
        }
    );
}

//Request the statistics of some videos
function requestStatistics(videos){
    let ids = videos.map((x)=>{return x.snippet.resourceId.videoId});
    url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${process.env.API_TOKEN}`;

    return new Promise(
        (resolve)=>{
            https.get(url, (res) => {
                str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                
                res.on('end', function () {
                    let data = JSON.parse(str);
                    joinDataTo(videos, data.items, 'statistics');
                    resolve();
                });
            });
        }
    );
}

//Request the contentDetails of some videos
function requestContentDetails(videos){
    let ids = videos.map((x)=>{return x.snippet.resourceId.videoId});
    url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(",")}&key=${process.env.API_TOKEN}`;

    return new Promise(
        (resolve)=>{
            https.get(url, (res) => {
                str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                
                res.on('end', function () {
                    let data = JSON.parse(str);
                    joinDataTo(videos, data.items, 'contentDetails');
                    resolve();
                });
            });
        }
    );
}

//Update videos with the statistics or contentDetails
function joinDataTo(videos, info, type){
    videos.forEach((video)=>{
        info.forEach((item)=>{
            if(video.snippet.resourceId.videoId == item.id){
                video[type] = item[type];
            }
        });
    });
}

//insert videos into database
function insertVideos(videos){

    console.log('inserting videos');

    let values = [];
    videos.forEach((video)=>{
        values.push([
            video.snippet.resourceId.videoId,
            video.snippet.title,
            video.snippet.description,
            video.snippet.publishedAt,
            video.statistics.viewCount,
            video.statistics.likeCount,
            video.statistics.dislikeCount,
            video.statistics.favoriteCount,
            video.statistics.commentCount,
            moment.duration(video.contentDetails.duration).asSeconds()
        ]);
    });

    //console.log(values);

    return new Promise(
        (resolve)=>{
            pool.getConnection(function (err, connection) {
                if (err) {
                    throw new Error("Unable to get connection to database:" + err);
                } else {
                    connection.query(
                        `INSERT INTO videos (
                            videoid,
                            title,
                            description,
                            publishedat,
                            viewcount,
                            likecount,
                            dislikecount,
                            favoritecount,
                            commentcount,
                            duration
                        )
                        VALUES ?
                        ON DUPLICATE KEY UPDATE
                            title = VALUES(title),
                            description = VALUES(description),
                            publishedat = VALUES(publishedat),
                            viewcount = VALUES(viewcount),
                            likecount = VALUES(likecount),
                            dislikecount = VALUES(dislikecount),
                            favoritecount = VALUES(favoritecount),
                            commentcount = VALUES(commentcount),
                            duration = VALUES(duration)
                        `,
                        [ values ],
                        async function (error, result) {
                            if (error) {
                                throw new Error("Error inserting" + error);
                            } else {
                                resolve(true);
                            }
                        }
                    )
                }
            })
        }
    );
}

module.exports.handler = handler;

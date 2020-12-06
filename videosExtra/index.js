const https = require('https');
const mysql = require('mysql');
const pool = mysql.createPool({
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});
const moment = require('moment');

async function handler (){
    await updateVideos();
    return;
};

async function updateVideos(){
    let extraVideoIds = await findExtraVideosIds();
    extraVideoIds = chunk(extraVideoIds, 25);
    let extraVideos = await getExtraVideos([], extraVideoIds, 0);
    console.log('extraVideos');
    console.log(extraVideos);
    insertExtraVideos(extraVideos)
}

async function getExtraVideos(extraVideos, extraVideoIds, index){
    if(index < extraVideoIds.length){
        let videoData = await requestVideoData(extraVideoIds[index]);
        console.log('videoData is')
        console.log(videoData)
        extraVideos = extraVideos.concat(videoData);
        return await getExtraVideos(extraVideos, extraVideoIds, index + 1);
    }
    return extraVideos
}

async function requestVideoData(videoids){
    console.log('requesting snippet');
    url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet&id=${videoids.join(",")}&key=${process.env.API_TOKEN}`;
    console.log(url);

    return new Promise(
        (resolve)=>{
            https.get(url, (res) => {
                str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                
                res.on('end', async function () {
                    // console.log(str);
                    let data = JSON.parse(str);
                    console.log(data);
                    await requestStatistics(data.items);
                    await requestContentDetails(data.items);
                    console.log('requestVideoData return is')
                    console.log(data.items)
                    resolve(data.items);
                });
            });
        }
    );
}

//Request the statistics of some videos
function requestStatistics(videos){
    let ids = videos.map((x)=>{return x.id});
    console.log('requesting statistics')
    url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${process.env.API_TOKEN}`;
    console.log(url)

    return new Promise(
        (resolve)=>{
            https.get(url, (res) => {
                str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                
                res.on('end', function () {
                    let data = JSON.parse(str);
                    console.log(data)
                    joinDataTo(videos, data.items, 'statistics');
                    resolve();
                });
            });
        }
    );
}

//Request the contentDetails of some videos
function requestContentDetails(videos){
    let ids = videos.map((x)=>{return x.id});
    console.log('requesting content')
    url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(",")}&key=${process.env.API_TOKEN}`;
    console.log(url)

    return new Promise(
        (resolve)=>{
            https.get(url, (res) => {
                str = '';
                res.on('data', function (chunk) {
                    str += chunk;
                });
                
                res.on('end', function () {
                    let data = JSON.parse(str);
                    console.log(data)
                    joinDataTo(videos, data.items, 'contentDetails');
                    resolve();
                });
            });
        }
    );
}

function chunk(array, size) {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}

// Read all of the extra videos Ids
function findExtraVideosIds(){
    return new Promise(
        (resolve)=>{
            pool.getConnection(function (err, connection) {
                if (err) {
                    throw new Error("Unable to get connection to database:" + err);
                } else {
                    connection.query(
                        `SELECT videoid From videos_extra
                        `,
                        [],
                        async function (error, result) {
                            if (error) {
                                throw new Error("Error inserting" + error);
                            } else {
                                resolve(result.map(x => x.videoid));
                            }
                        }
                    )
                }
            })
        }
    );
}

//Update videos with the statistics or contentDetails
function joinDataTo(videos, info, type){
    videos.forEach((video)=>{
        info.forEach((item)=>{
            if(video.id == item.id){
                video[type] = item[type];
            }
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}   

//insert videos into database
function insertExtraVideos(videos){

    console.log('inserting videos');

    let values = [];
    videos.forEach((video)=>{
        values.push([
            video.id,
            video.snippet.title,
            video.snippet.description,
            video.snippet.publishedAt,
            video.statistics.viewCount,
            video.statistics.likeCount,
            video.statistics.dislikeCount,
            video.statistics.favoriteCount,
            video.statistics.commentCount,
            moment.duration(video.contentDetails.duration).asSeconds(),
            video.snippet.channelId,
            video.snippet.channelTitle
        ]);
    });

    console.log(values);

    return new Promise(
        (resolve)=>{
            pool.getConnection(function (err, connection) {
                if (err) {
                    throw new Error("Unable to get connection to database:" + err);
                } else {
                    connection.query(
                        `INSERT INTO videos_extra (
                            videoid,
                            title,
                            description,
                            publishedat,
                            viewcount,
                            likecount,
                            dislikecount,
                            favoritecount,
                            commentcount,
                            duration,
                            channelid,
                            channeltitle
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
                            duration = VALUES(duration),
                            channelid = VALUES(channelid),
                            channeltitle = VALUES(channeltitle)
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

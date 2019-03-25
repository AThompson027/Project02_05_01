var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017';
var dbName = 'twitter_notes';
var database;

module.exports = {
    //this connects the information to the database storage
    connect: function () {
        MongoClient.connect(url, function(err, client) {
            if (err) {
                return console.log("Error: " + err);
            }
            database = client.db(dbName);
            console.log("Connected to database: " + dbName);
        });
    },
    connected: function () {
        //typeof is telling us what data type a variable is
        return typeof database != 'undefined';
    },
    // This will insert the followers in the storage
    insertfollowers: function(followers) {
        //targets which collection you want to deal with
        database.collection('followers').insert(followers, function(err) {
                if (err) {
                    console.log("Cannot insert followers into database!");
                }
        });
    },

    //get followers that belong to this user ID
    getFollowers: function(userId, callback) {
        var cursor = database.collection('followers').find(
        {
            for_user: userId
        });
        cursor.toArray(callback);
    },
    //deletes the collection of followers
    deletefollowers: function() {
        database.collection('followers').remove(( {} ), function(err) {
            if (err) {
                console.log("We cannot remove followers from database!");
            }
        } );
        
    },
    getNotes: function(ownerid, followerid, callback) {
        var cursor = database.collection('notes').find({
            owner_id: ownerid,
            follower_id: followerid
            }); 
            cursor.toArray(function(err, notes) {
                if (err) {
                    return callback(err);
                }
                //Put a note into the note area and map out there that is
                callback(null, notes.map(function(note) {
                    return {
                    _id: note._id,
                    content: note.content
                    }
                }));    
            });
    },
    insertNote: function(ownerid, followerid, content, callback){
        database.collection('notes').insert({
            owner_id: ownerid,
            follower_id: followerid,
            content: content
        },
        function (err, result) {
            if(err) {
                return callback(err, result);
            }
            callback(null, {
                _id: result.ops[0]._id,
                content: result.ops[0].content
            });
        });
    },
    updateNote: function(noteId, ownerId, content, callback){
        database.collection('notes').updateOne({
            _id: new ObjectID(noteId),
            owner_id: ownerId
        },
        {
            //set means that you want to set a new value
            $set: { content: content}
        },
        function(err, result) {
            if (err){
                return callback(err);
            }
            database.collection('notes').findOne({
                _id: new ObjectID(noteId)
                // content: note.content
            }, callback);
        });
    },
    deleteNote: function(noteId, ownerId, callback) {
        database.collection('notes').deleteOne({
            _id: new ObjectID(noteId),
            owner_id: ownerId
        }, callback);
    }
}
    

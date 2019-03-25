//THIS IS THE INDEX TO DISPLAY FRIENDS
//THIS IS THE HOME PAGE (RUN THIS PAGE)

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
//gets the authenticator from the js file
var authenticator = require('./authenticator.js');
var config = require('./config.json');
//gives help with urls and gives us stuff to use
var url = require('url');
var querystring = require('querystring');
var async = require('async');
var storage = require("./storage.js");
storage.connect();

//returns the name of the function
//Immediately invoked function expression (iffe)
//function runs by itself when defined that has a protection and invoking part
app.use(require('cookie-parser')());

// dirname is a node express global
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());

app.set('view engine', 'ejs');

setInterval(function(){
    if (storage.connected()) {
        console.log("Clearing MongoDB cache.");
        storage.deleteFriends();
    }
}, 1000 * 60 * 5);

//This endpoint will lead to the authenticator
app.get('/auth/twitter', authenticator.redirectToTwitterLoginPage);

app.get('/tweet', function(req, res){
    var credentials = authenticator.getCredentials();
    if (!credentials.access_token || !credentials.access_token_secret){
        return res.sendStatus(418);
    }
    var url = "https://api.twitter.com/1.1/statuses/update.json";
    authenticator.post(url, credentials.access_token, credentials.access_token_secret,
    {
        status: "Hi I am just a Tweeting maniac"
    },

    function(error, data) {
        if (error) {
            return res.status(400).send(error);
        }
        res.send("Tweet successful!");
    });
}); 
// searches and grabs info from the account of BMW from Twitter

// This will show all the friends data
app.get('/friends', function(req, res){
        var credentials = authenticator.getCredentials();
        if (!credentials.access_token || !credentials.access_token_secret) {
            return res.sendStatus(418);
        }
        var url = "https://api.twitter.com/1.1/friends/list.json";
        if (req.query.cursor) {
            url += '?' + querystring.stringify({ cursor: req.query.cursor})
        }
        authenticator.get(url, credentials.access_token, credentials.access_token_secret, function(error, data) {
            if (error) {
                return res.status(400).send(error);
            }
            res.send(data);
        });
});


// using the async package to create an asyncronous waterfall

app.get('/AllFriends', function (req,res) {
    renderMainPageFromTwitter(req, res);
});

app.get('/', function(req, res){
    var credentials = authenticator.getCredentials();
    if (!credentials.access_token || !credentials.access_token_secret) {
        return res.redirect('login');
    }

 if (!storage.connected()){
    console.log("Loading friends from Twitter.");
    return renderMainPageFromTwitter(req,res);
 }
    console.log("Loading friends from MongoDB.");
    storage.getFriends(credentials.twitter_id, function(err, friends) {
        if (err) {
          return res.status(500);
        }
        if (friends.length > 0) {
            console.log("Friends successfully loaded from MongoDB!");
            friends.sort(function(a, b) {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            res.render('index', { friends: friends});
        }
        else {
            console.log("Loading friends from Twitter.");
            renderMainPageFromTwitter(req, res);
        }
    });
});


app.get('/search', function (req,res) {
    var credentials = authenticator.getCredentials();
     if (!credentials.access_token || !credentials.access_token_secret) {
         return res.sendStatus(418);
     } 
         var url = "https://api.twitter.com/1.1/search/tweets.json";
         var query = querystring.stringify({ q: "BMW"});
         url += '?' + query;
         authenticator.get(url, credentials.access_token, credentials.access_token_secret, 
             function (error, data) {
             if (error) {
                 return res.status(400).send(error);
             }
             res.send(data);
         })
 });


app.get(url.parse(config.oauth_callback).path, function(req, res) {
    authenticator.authenticate(req, res, function(error){
        if (error) {
            res.redirect("/login");
            //makes the status a 401 when there is an unauthorized error
        }
        else {
            res.redirect("/");
        }
    });
});

//----------------------------------------
// This the start of the renderMainPageFromTwitter function that is tied to render the friends from twitter

function renderMainPageFromTwitter(req, res) {
    var credentials = authenticator.getCredentials();
    async.waterfall([
        //get id from friends
        function(callback){
            var cursor = -1;
            var ids = [];
            // console.log("ids.length: " + ids.length)
            async.whilst(function(){
                return cursor != 0;
            },
            function (callback) {
                var url = "https://api.twitter.com/1.1/friends/ids.json";
                url += "?" + querystring.stringify({
                    user_id: credentials.twitter_id, cursor: cursor
                });
                authenticator.get(url,
                     credentials.access_token,
                     credentials.access_token_secret, 
                    function (error, data) {
                    if (error) {
                        return res.status(400).send(error);
                    }
                    data = JSON.parse(data);
                    cursor = data.next_cursor_str;
                    ids = ids.concat(data.ids);
                    // console.log("ids.length: " + ids.length);
                    callback();
                });
            },
            function (error) {
                // console.log('last callback');
                if (error) {
                    return res.status(500).send(error);
                }
                callback(null, ids)
            });
            // console.log("ids.length: " + ids.length);
        },

        //look up friends data
        function (ids, callback) {
            var getHundredIds = function(i){
                return ids.slice(100*i, Math.min(ids.length,
                100*(i+1)));
            };
            var requestsNeeded = Math.ceil(ids.length/100);
            async.times(requestsNeeded, function (n, next) {
                var url = "https://api.twitter.com/1.1/users/lookup.json";

                url += "?" + querystring.stringify({ user_id: getHundredIds(n).join(',') });

                authenticator.get(url, credentials.access_token, credentials.access_token_secret, 
                    function(error, data){
                        if (error) {
                            return res.Status(500).send(error);
                        }
                        var friends = JSON.parse(data);
                        // console.log("n: ", n, friends);
                        next(null, friends);
                    });
                },
                    function(error, friends) {
                        friends = friends.reduce(function (previousValue, currentValue, currentIndex, array){
                        return previousValue.concat(currentValue);
                    }, []);
                    friends.sort(function(a, b){
                        return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
                    });
                    friends = friends.map(function(friend) {
                        return {
                            twitter_id: friend.id_str,
                            for_user: credentials.twitter_id,
                            name: friend.name,
                            screen_name: friend.screen_name,
                            location: friend.location,
                            profile_image_url: friend.profile_image_url
                        }
                    });
                    res.render('index', {friends: friends });
                    if (storage.connected()) {
                        storage.insertFriends(friends);
                    }
                    // console.log("friends.length: ", friends.length);
                });
        }
    ]);
}
//***end of function */
//-------------------------------------

//renders the login page
app.get('/login', function(req, res) {
    res.render('login');
    if (storage.connected) {
        console.log("We are deleting friends collection on login!");
        storage.deleteFriends();
    }
});
    //clears out and redirects to login
app.get('/logout', function(req, res) {
    authenticator.clearCredentials();
    //this clears the cookie of twitter_id when you logout
    res.clearCookie('twitter_id');
    if (storage.connected) {
        console.log("We are deleting friends collection on logout!");
        storage.deleteFriends();
    }
    res.redirect('/login');
});

function ensureLoggedIn(req,res,next) {
    var credentials = authenticator.getCredentials();
    if (!credentials.access_token || !credentials.access_token_secret || !credentials.twitter_id) {
        return res.sendStatus(401);
    }
    //this sets a cookie
    res.cookie('twitter_id', credentials.twitter_id, { httponly: true });
    // next goes to the response side
    next();
}

//ROUTING IS IMPORTANT
//make sure that you are logged in = ensureLoggedIn
//if the cookie is created and the callback is set then we can get our hands on these cookies
app.get('/friends/:uid/notes', ensureLoggedIn, function(req, res, next) {
    var credentials = authenticator.getCredentials();
    //using credentials instead of cookies to get the twitter_id
    storage.getNotes(credentials.twitter_id, req.params.uid, 
        function(err, notes) {
        if (err) {
            return res.status(500).send(err);
        }
        res.send(notes);
    });
});

app.post('/friends/:uid/notes', ensureLoggedIn, function(req, res, next) {
    storage.insertNote(req.cookies.twitter_id, req.params.uid, req.body.content, function(err, note) {
        if (err) {
            return res.sendStatus(500).send(err);
        }
        res.send(note);
    });
});

//************************************************** */
app.put('/friends/:uid/notes/:noteid', ensureLoggedIn, function (req, res){
    // var noteId = req.params.noteid;
    storage.updateNote(req.params.noteid, req.cookies.twitter_id, req.body.content, function(err, note) {
        if (err) {
            return res.sendStatus(500).send(err);
        }
        res.send({
            _id: note._id,
            content: note.content
        });
    });
});

app.delete('/friends/:uid/notes/:noteid', ensureLoggedIn, function (req, res){
    // var noteId = req.params.noteid;
    storage.deleteNote(req.params.noteid, req.cookies.twitter_id, function(err, note) {
        if (err) {
            return res.sendStatus(500).send(err);
        }
        res.sendStatus(200);
    });
});

//-----------------------------------------------------------------------------------------------------------------------------------
//THIS IS THE CODE THAT WHEN YOU CLICK THE "Click to see all followers!" LINK THAT IT WILL GO BACK TO DISPLAYING THE FOLLOWERS!

app.get('/followers', function(req, res){
    var credentials = authenticator.getCredentials();
    if (!credentials.access_token || !credentials.access_token_secret) {
        return res.sendStatus(418);
    }
    var url = "https://api.twitter.com/1.1/followers/list.json";
    if (req.query.cursor) {
        url += '?' + querystring.stringify({ cursor: req.query.cursor})
    }
    authenticator.get(url, credentials.access_token, credentials.access_token_secret, function(error, data) {
        if (error) {
            return res.status(400).send(error);
        }
        data = JSON.parse(data).users;
        data = data.map(function(follower) {
            return {
                twitter_id: follower.id_str,
                for_user: credentials.twitter_id,
                name: follower.name,
                screen_name: follower.screen_name,
                location: follower.location,
                profile_image_url: follower.profile_image_url
            }
        });
        res.render('followers', {followers: data });
        if (storage.connected()) {
            storage.insertFollowers(data);
        }
    });
});

//----------------------------------------
// This the start of the renderMainPageFromTwitter1 function that is tied to render the followers from twitter
function renderMainPageFromTwitter1(req, res) {
    var credentials = authenticator.getCredentials();
    async.waterfall([
        //get id from friends
        function(callback){
            var cursor = -1;
            var ids = [];
            // console.log("ids.length: " + ids.length)
            async.whilst(function(){
                return cursor != 0;
            },
            function (callback) {
                var url = "https://api.twitter.com/1.1/followers/ids.json";
                url += "?" + querystring.stringify({
                    user_id: credentials.twitter_id, cursor: cursor
                });
                authenticator.get(url,
                     credentials.access_token,
                     credentials.access_token_secret, 
                    function (error, data) {
                    if (error) {
                        return res.status(400).send(error);
                    }
                    data = JSON.parse(data);
                    cursor = data.next_cursor_str;
                    ids = ids.concat(data.ids);
                    // console.log("ids.length: " + ids.length);
                    callback();
                });
            },
            function (error) {
                // console.log('last callback');
                if (error) {
                    return res.status(500).send(error);
                }
                callback(null, ids)
            });
            // console.log("ids.length: " + ids.length);
        },

        //look up friends data
        function (ids, callback) {
            var getHundredIds = function(i){
                return ids.slice(100*i, Math.min(ids.length,
                100*(i+1)));
            };
            var requestsNeeded = Math.ceil(ids.length/100);
            async.times(requestsNeeded, function (n, next) {
                var url = "https://api.twitter.com/1.1/users/lookup.json";

                url += "?" + querystring.stringify({ user_id: getHundredIds(n).join(',') });

                authenticator.get(url, credentials.access_token, credentials.access_token_secret, 
                    function(error, data){
                        if (error) {
                            return res.Status(500).send(error);
                        }
                        var followers = JSON.parse(data);
                        // console.log("n: ", n, friends);
                        next(null, followers);
                    });
                },
                    function(error, followers) {
                        followers = followers.reduce(function (previousValue, currentValue, currentIndex, array){
                        return previousValue.concat(currentValue);
                    }, []);
                    followers.sort(function(a, b){
                        return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
                    });
                    followers = followers.map(function(follower) {
                        return {
                            twitter_id: follower.id_str,
                            for_user: credentials.twitter_id,
                            name: follower.name,
                            screen_name: follower.screen_name,
                            location: follower.location,
                            profile_image_url: follower.profile_image_url
                        }
                    });
                    res.render('index', {followers: followers });
                    if (storage.connected()) {
                        storage.insertFriends(followers);
                    }
                    // console.log("friends.length: ", friends.length);
                });
        }
    ]);
}

//------------------------------------------

app.get('/AllFollowers', function (req,res) {
    renderMainPageFromTwitter1(req, res);
});

app.get('/', function(req, res){
    var credentials = authenticator.getCredentials();
    if (!credentials.access_token || !credentials.access_token_secret) {
        return res.redirect('login');
    }

 if (!storage.connected()){
    console.log("Loading followers from Twitter.");
    return renderMainPageFromTwitter1(req,res);
 }
    console.log("Loading followers from MongoDB.");
    storage.getfollowers(credentials.twitter_id, function(err, followers) {
        if (err) {
          return res.status(500);
        }
        if (followers.length > 0) {
            console.log("Friends successfully loaded from MongoDB!");
            followers.sort(function(a, b) {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            res.render('index', { followers: followers});
        }
        else {
            console.log("Loading followers from Twitter.");
            renderMainPageFromTwitter1(req, res);
        }
    });
});

app.get('/followers/:uid/notes', ensureLoggedIn, function(req, res, next) {
    var credentials = authenticator.getCredentials();
    //using credentials instead of cookies to get the twitter_id
    storage.getNotes(credentials.twitter_id, req.params.uid, 
        function(err, notes) {
        if (err) {
            return res.status(500).send(err);
        }
        res.send(notes);
    });
});

app.post('/followers/:uid/notes', ensureLoggedIn, function(req, res, next) {
    storage.insertNote(req.cookies.twitter_id, req.params.uid, req.body.content, function(err, note) {
        if (err) {
            return res.sendStatus(500).send(err);
        }
        res.send(note);
    });
});


app.put('/followers/:uid/notes/:noteid', ensureLoggedIn, function (req, res){
    // var noteId = req.params.noteid;
    storage.updateNote(req.params.noteid, req.cookies.twitter_id, req.body.content, function(err, note) {
        if (err) {
            return res.sendStatus(500).send(err);
        }
        res.send({
            _id: note._id,
            content: note.content
        });
    });
});

app.delete('/followers/:uid/notes/:noteid', ensureLoggedIn, function (req, res){
    // var noteId = req.params.noteid;
    storage.deleteNote(req.params.noteid, req.cookies.twitter_id, function(err, note) {
        if (err) {
            return res.sendStatus(500).send(err);
        }
        res.sendStatus(200);
    });
});


app.listen(config.port, function() {
    console.log("Server is listening on localhost:%s", config.port);
    console.log('OAuth callback: ' + url.parse(config.oauth_callback).hostname + url.parse(config.oauth_callback).path);
});

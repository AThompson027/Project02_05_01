//********THIS IS THE AUTHENTICATOR FOR THE FOLLOWERS INFO */

// oauth object
var OAuth = require('oauth').OAuth;
var config = require('./config.json');
//OAuth object in variable that is calling json objects from the json file
//These are the parameters needed to construct the object
var oauth = new OAuth (
    config.request_token_url,
    config.access_token_url,
    config.consumer_key,
    config.consumer_secret,
    config.oauth_version,
    config.oauth_callback,
    config.oauth_signature
);
//this is the storage for our request's responses from Twitter
var twitterCredentials = {
    oauth_token: "",
    oauth_token_secret: "",
    access_token: "",
    access_token_secret: "",
    twitter_id: ""
}
module.exports = {
    getCredentials: function () {
        return twitterCredentials;
    },

    // this clears out the information to null
    clearCredentials: function () {
        twitterCredentials.oauth_token = "";
        twitterCredentials.oauth_token_secret = "";
        twitterCredentials.access_token = "";
        twitterCredentials.access_token_secret = "";
        twitterCredentials.twitter_id = "";
    },

    //the url gives the targeted api that we are requesting
    get: function(url, access_token, access_token_secret, callback){
        oauth.get.call(oauth, url, access_token, access_token_secret, callback);
    },
    post: function(url, access_token, access_token_secret, body, callback){
        oauth.post.call(oauth, url, access_token, access_token_secret, body, callback);
    },
    redirectToTwitterLoginPage: function(req, res){
        oauth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
            if (error) {
                console.log(error);
                res.send('authentication failed!');
            }
            else{
                twitterCredentials.oauth_token = oauth_token;
                twitterCredentials.oauth_token_secret = oauth_token_secret;
                res.redirect(config.authorize_url + '?oauth_token=' + oauth_token);
            }
        });
    },

    //This function is where we literally authenticate to get the authority to access the Twitter information such as thr access tokens

    authenticate: function (req,res, callback) {
        if(!(twitterCredentials.oauth_token && twitterCredentials.oauth_token_secret && req.query.oauth_verifier)){
            return callback("Request does not have all required keys!");
        }
        oauth.getOAuthAccessToken(twitterCredentials.oauth_token,
             twitterCredentials.oauth_token_secret,
              req.query.oauth_verifier,
               function(error, oauth_access_token, oauth_access_token_secret, results){
            if (error) {
                return callback(error);
            }
            oauth.get('https://api.twitter.com/1.1/account/verify_credentials.json',
            oauth_access_token,
            oauth_access_token_secret,
            function (error, data) {
                if (error) {
                    console.log(error);
                    return callback(error);
                }
                data = JSON.parse(data);
                twitterCredentials.access_token = oauth_access_token;
                twitterCredentials.access_token_secret = oauth_access_token_secret;
                twitterCredentials.twitter_id = data.id_str;
                return callback();
            });
        });
    }
}
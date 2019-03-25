//******THIS IS THE MAIN.JS FILE FOR THE FRIENDS PAGE FOR FUNCTIONALITY */

(function() {
    // the selected user id is going to equal nothing at the start and reflect which friend the user has collected
    var selectedUserId;
    var cache = {};

    function startup() {
        //this gets the twitter ids of friends by classname
        var friends = document.getElementsByClassName('friend');
        for (var i = 0; i < friends.length; i++) {
            //When you click on the friend that you would like to add a note for, 
            //it will display as the selected friend by displaying it as a blue color
            friends[i].addEventListener('click', function() {
                for (var j = 0; j < friends.length; j++) {
                    friends[j].className = 'friend';
                }
                this.className += ' active';
                selectedUserId = this.getAttribute('uid');
                console.log("Twitter ID: ", selectedUserId);
                var notes = getNotes(selectedUserId, function(notes) {
                    //creates a single note in memory
                    //th anchor
                        var docFragment = document.createDocumentFragment();
                        // li notes elements
                        var notesElements = createNoteElements(notes);
                        notesElements.forEach(function(element) {
                            docFragment.appendChild(element);
                        });
                        //this will get the UL from the HTML and append the list items (li) to the list
                    var newNoteButton = createAddNoteButton();
                    docFragment.appendChild(newNoteButton);
                    document.getElementById('notes').innerHTML = "";
                    document.getElementById('notes').appendChild(docFragment);
                });         
            });
        }
    }
    function getNotes(userId, callback) {
        //if the userId is cached then we return and have a callback of the cache of notes from our friends
        if (cache[userId]) {
            return callback(cache[userId]);
        }
        //every time the http state changes to 4 and if the status is ok then the information in the JSON will parse
        //if false then it will produce an empty array
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (xhttp.readyState == 4 && xhttp.status == 200) {
                var notes = JSON.parse(xhttp.responseText || []);
                cache[userId] = notes;
                callback(notes);
            }
        };
        //this will write a request in the URL bar
        xhttp.open('GET', '/friends/' + encodeURIComponent(userId) + '/notes');
        //this will send and expect a response
        xhttp.send();
    }

    //this will post the new notes
    function postNewNote(userid, note, callback) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (xhttp.readyState == 4 && xhttp.status == 200){
                var serverNote = JSON.parse(xhttp.responseText || {});
                cache[userid].push(serverNote);
                callback(serverNote);
            }
        }

        xhttp.open('POST', '/friends/' + encodeURIComponent(userid) + '/notes' );
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhttp.send(JSON.stringify(note));
    }

        function putNote(userid, note, callback) {
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState == 4 && xhttp.status == 200){
                    var serverNote = JSON.parse(xhttp.responseText || {});
                    cache[userid].push(serverNote);
                    callback(serverNote);
                }
            }

        xhttp.open('PUT', '/friends/' + encodeURIComponent(userid) + '/notes/' + encodeURIComponent(note._id), true );
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhttp.send(JSON.stringify(note));
    }

      //This function deletes the note when you press tab

    function deleteNote(userid, note, callback) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (xhttp.readyState == 4 && xhttp.status == 200){
                //filters elements out of the array and constructs it
                cache[userid] = cache[userid].filter(function(localNote){
                    return localNote._id != note._id;
                });
                callback();
            }
        }

    xhttp.open('DELETE', '/friends/' + encodeURIComponent(userid) + '/notes/' + encodeURIComponent(note._id), true );
    xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhttp.send(JSON.stringify(note));
}

    //This will map an array of JSON to elements
    function createNoteElements(notes) {
        return notes.map(function(note) {
            //this will hold the note
            var element = document.createElement('li');
            element.className = 'note';
            element.setAttribute('contenteditable', true);
            element.textContent = note.content;
            element.addEventListener('blur', function() {
                note.content = this.textContent;
                if (note.content == ""){
                    if (note._id){
                        deleteNote(selectedUserId, note, function(){
                            document.getElementById('notes').removeChild(element);
                        });
                    }
                    else {
                        document.getElementById('notes').removeChild(element);
                    }
                }
                else if (!note._id){
                    postNewNote(selectedUserId, {
                        content: this.textContent
                    }, function(newNote) {
                        note._id = newNote._id;
                    });
                }
                else {
                    putNote(selectedUserId, note, function(){

                    });
                }
            });
            element.addEventListener('keydown', function(e) {
                //code of the key that got fired
                if (e.keyCode == 13) {
                    e.preventDefault();
                    //if the next sibling is the add note button
                    //this makes it that when you are done typing and press enter it will go to the next note
                    if (element.nextSibling.className == 'add-note') {
                        element.nextSibling.click();
                    }
                    else {
                        element.nextSibling.focus();
                    }
                }
            });
            return element;
        });
        return notes;
    }
    //This creates more notes when you click the "ADD A NEW NOTE" button
    function createAddNoteButton(){
        var element = document.createElement('li');
        element.className = 'add-note';
        element.textContent = "Add a new note...";
        // when the button is clicked then it will get the ul and insert before the note element
        element.addEventListener('click', function() {
            var notesElements = createNoteElements([{}])[0];
            document.getElementById('notes').insertBefore(notesElements, this);
            notesElements.focus();
        });
        return element;
    }
// once the file is loaded then the function "startup" will load
    document.addEventListener('DOMContentLoaded', startup, false);
    //The second set of parenthesis is the call
})();

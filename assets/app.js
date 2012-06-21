var FRAMERATE = 4; // per second

var FIREBASE_URL = 'http://demo.firebase.com/guest324921312';

// Prompt the user for a name to use.
var USER_NAME = prompt("Your name?", "Guest"+Math.floor(Math.random()*9999+1));

// Get a reference to the presence data in firebase.
var ListRef = new Firebase(FIREBASE_URL);
var userListRef = ListRef.child('users');

//Our initial online status.
var currentStatus = '★  online';

//Get a reference to my own presence status
var myAccount = userListRef.child(USER_NAME);
myAccount.removeOnDisconnect();
var myStatus = myAccount.child('status');
var myScreen = myAccount.child('screen');
var screens = {};

// send notice any time screen is resized
$(window).resize(function() {
   myScreen.set(_screenSize())
});
myScreen.set(_screenSize());

//A helper function to let us set our own state.
function setUserStatus(status) {
   currentStatus = status;
   myStatus.set(status);
}

//We need to catch anytime we are marked as offline and then set the correct status. We
//could be marked as offline 1) on page load or 2) when we lose our internet connection
//temporarily.
myStatus.set(currentStatus);
myStatus.on("value", function(snapshot) {
   if( snapshot.val() === null ) {
      setUserStatus(currentStatus);
      myScreen.set(_screenSize());
   }
});

// Render someone's online status
function addUser(snapshot) {
   var $button = $('<button>monitor</button>').click(toggleMonitor);
   $('#presenceDiv').append($('<div/>').attr('id', snapshot.name()).append('<span />').append($button));
   setLocalStatus(snapshot.name(), snapshot.child('status'));
   setLocalScreens(snapshot.name(), snapshot.child('screen'));
}
//Remove the status of a user who left
function removeUser(snapshot) {
   $("#" + snapshot.name()).remove();
}
// update the user account on screen resize or status change
function updateUser(snapshot) {
   setLocalStatus(snapshot.name(), snapshot.child('status'));
   setLocalScreens(snapshot.name(), snapshot.child('screen'));
}

//Change a user's status
function setLocalStatus(name, snapshot) {
//        var name = snapshot.parent().name();
   $('#' + name).find('span').text(name + ' is currently ' + snapshot.val());
}

//Change a user's status
function setLocalScreens(name, snapshot) {
//        var name = snapshot.parent().name();
   screens[name] = snapshot.val();
}

//Anytime an online status is added, removed, or changed, we want to update the GUI
userListRef.on('child_added', addUser);
userListRef.on('child_removed', removeUser);
userListRef.on('child_changed', updateUser);

// Use idle/away/back events created by idle.js to update our status information;
document.onIdle = function () {
   setUserStatus('☆ idle');
};
document.onAway = function () {
   setUserStatus('☄ away');
};
document.onBack = function (isIdle, isAway) {
   setUserStatus('★ online');
};

setIdleTimeout(5000);
setAwayTimeout(10000);


/** Screen Monitoring
 **********************************************************************************/

//Get a reference to my own presence status
var pointerList = ListRef.child('pointers');
var myPointer = { ref: pointerList.child(USER_NAME), curr: {top: 0, left: 0, type: ''}, last: {} };
var pointers = {};

jQuery(function($) {
   $(document)
      // send mousemove commands; buffer them for performance
         .on('mousemove', bufferNotify)
      // send all click notices (do not buffer them)
         .on('click', function(e) {
            myPointer.ref.set({top: e.clientY, left: e.clientX, type: 'click', user: name});
         })
});

setInterval(function() {
   // check for buffered mousemoves and send them off
   if( _moved(myPointer.curr, myPointer.last) ) {
      myPointer.last = myPointer.curr;
      myPointer.ref.set(myPointer.curr);
   }
}, Math.ceil(1000/FRAMERATE));

function bufferNotify(e) {
   myPointer.curr = {top: e.clientY, left: e.clientX, type: e.type};
}

function toggleMonitor() {
   var id = $(this).parent().attr('id'), pointer = pointers[id] || {id: id};
   (pointer.active && disablePointer(pointer)) || enablePointer(pointer);
}

function enablePointer(pointer) {
   var id = pointer.id;
   pointer = pointers[ id ] = {active: true, id: id, ref: pointerList.child(id), loc: {left: 0, top: 0, type: ''}};
   $('#mousey').clone().appendTo('body').attr('id', 'mousey-'+id).offset(pointer.loc);
   // activate the current button
   $('#'+id+' button').addClass('active');
   // create a callback to track changes to the mouse position
   // store a ref to the callback so we can remove it later
   pointer.callback = function(snapshot) {
      moveEvent(pointer, snapshot.val());
   };
   // activate the callback to monitor mouse position and update
   pointer.ref.on('value', pointer.callback);
   return true;
}

function disablePointer(pointer) {
   var id = pointer.id;
//        // stop repositioning the arrow
//        clearInterval(pointer.interval);
   // remove the Firebase event listener
   pointer.ref.off('value', pointer.callback);
   // reset the button class
   $('#'+id+' button').removeClass('active');
   // prevent memory leaks since the callback references dom objects
   // but since this is all async and calls may still be coming in right now
   // keep it as a valid function for the moment
   pointer.callback = function() {};
   // remove the pointer arrow from the screen
   $('#mousey-'+id).remove();
   // mark the pointer disabled
   pointer.active = false;
   return true;
}

function checkPosition(pointer) {
   var $mousey = $('#mousey-'+pointer.id), pos = _pos(pointer);
   if( pointer.active && _moved(pos, $mousey.offset()) ) {
      $mousey.offset(pos);
   }
}

function _pos(pointer) {
   var loc = pointer.loc, out = {top: loc.top, left: loc.left };
   if( pointer.id === USER_NAME ) {
      // don't let fake mouse interfere with real mouse
      out.top += 2;
      out.left += 2;
   }
   return out;
}

function _moved(pointer, loc) {
   return pointer.top != loc.top || pointer.left != loc.left;
}

function _screenSize() {
   $win = $(window);
   return {width: $win.width(), height: $win.height()};
}

function moveEvent(pointer, loc) {
   pointer.loc = loc;
   checkPosition(pointer);
   if( loc.type === 'click' ) { xIt(loc); }
}

function xIt(loc) {
   var pos = $.extend({}, loc);
   var $e = $('<div class="anX">X</div>').offset({top: -250, left: -250}).appendTo('body');
   pos.top -= $e.height()/2;
   pos.left -= $e.width()/2;
   $e.offset(pos).fadeOut(5000, function() { $(this).remove(); });
}

/** Screen Recordings
 **************************************************************/
var recordingList = ListRef.child('recordings');
var recordingIdRef = ListRef.child('recordingCounter');

// a map of user ids to recording data that will be stored
var recordingsInProgress = {};

function startRecording(userId) {
   recordingsInProgress[userId] = [];
   var ref = pointerList.child(userId);
   ref.on('value', record);
}

function stopRecording(userId) {
   pointerList.child(userId).off('value', record);
   _newRecId().then(function(recId) {
      recordingList.child(recId, recordingsInProgress[userId]);
      delete recordingsInProgress[userId];
   });
}

function record(snapshot) {
   var e = snapshot.val();
   recordingsInProgress[e.user].push(e);
}

function updateRecordingList(snapshot) {
   //todo
   //todo
   //todo
   //todo
   //todo
}
recordingList.on('value', updateRecordingList);

function replay(recordingId) {
   //todo
   //todo
   //todo
}

function _newRecId() {
   var def = $.Deferred();
   recordingIdRef.once('value', function(data) {
      def.resolve(++data);
      //todo this should probably use a transaction
      recordingIdRef.set(data);
   });
   return def.promise();
}

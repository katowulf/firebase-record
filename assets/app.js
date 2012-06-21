(function($) { // localize scope

   /** CONFIGURATION
    **************************************************************************/

   var FRAMERATE = 10; // per second
   var FIREBASE_URL = 'http://gamma.firebase.com/wordspot/';

   // Prompt the user for a name to use.
   var USER_NAME = _getUserName();

   // The html appearing in a user's status row
   var USER_PRESENCE_TEMPLATE = '<span></span>' +
      '<a class="btn btn-mini monitor" href="#"><i class="icon-eye-open"></i>track</a>' +
      '<a class="btn btn-mini record" href="#"><i class="icon-play"></i>record</a>';

   // the html appearing in a replay link
   var REPLAY_TEMPLATE = '<div id="{replayId}">{name} (created {created}) ' +
      '<a href="#" class="btn btn-micro play"><i class="icon-play"></i>{duration}</a>' +
      '<a href="#" class="btn btn-micro del"><i class="icon-remove"></i></a>';

   // Get a reference to the presence data in firebase.
   var FirebaseRoot = new Firebase(FIREBASE_URL);

   setIdleTimeout(5000);
   setAwayTimeout(10000);

   /** LOCAL VIEW RENDERING (RUNS ON DOCUMENT READY)
    ************************************************************************************/

   jQuery(function($) {  // run on document ready

      var myAccount, userView, userController, screenTrackerView, replayView;

      // the view gets callbacks from UserControl whenever an account is updated
      // and is responsible for rendering the data
      userView = {
         created: function(user) {
            var id = user.id;
            if( !$('#'+id).length ) {
               var $e = $('<div/>')
                  .addClass('user user-'+user.color)
                  .attr('id', user.id)
                  .append(USER_PRESENCE_TEMPLATE);
               if( myAccount && myAccount.id === user.id ) {
                  $e.addClass('myAccount');
               }
               $('#presence').append($e);
            }
            setLocalStatus(user);
         },
         updated: function(user) {
            setLocalStatus(user);
         },
         destroyed: function(user) {
            $("#" + user.id).remove();
         }
      };

      function setLocalStatus(user) {
         $('#' + user.id+' span').html(user.name + user.status);
      }

      /** MONITOR USER PRESENCE
       *********************************************************************/

      // this actually monitors for remote accounts being added/updated/deleted
      // and informs the renderer whenever a change occurs
      userController = new UserController(FirebaseRoot, userView);

      /** Update local user so remote viewers can see us */
      var myAccountLoader = userController.create({name: USER_NAME}).then(function(user) {
         myAccount = user;

         // it's a new account so add it to Firebase and notify people it exists
         user.sync();

         // make sure this user is deleted from database on a disconnect event
         user.ref.removeOnDisconnect();

         // Use idle/away/back events created by idle.js to update our status information;
         document.onIdle = function() {
            user.status = UserController.STATUS_IDLE;
            user.sync();
         };
         document.onAway = function() {
            user.status = UserController.STATUS_AWAY;
            user.sync();
         };
         document.onBack = function() {
            user.status = UserController.STATUS_ONLINE;
            user.sync();
         };
      });

      /** TRACK SCREEN EVENTS
       *********************************************************************/

      screenTrackerView = {
         lastPos: {top: 0, left: 0},
         created: function(screenMonitor) {
            var id = screenMonitor.userId;
            //todo use colors once mousey images are available
            $('<img id="mousey-'+id+'" class=".mousey" src="assets/img/pointer-arrow-yellow.png" />')
               .appendTo('body').offset(ScreenTrackerController.pos(screenMonitor.event, myAccount.id));
            _toggleOnMonitor(screenMonitor);
            return true;
         },
         updated: function(event) {
            var pos = ScreenTrackerController.pos(event, myAccount.id);
            if( _moved(pos, this.lastPos) ) {
               $('#mousey-'+event.userId).offset(pos);
               if( event.type == 'click' ) {
                  xIt(pos, userColor(event.userId, userController));
               }
            }
            return true;
         },
         destroyed: function(screenMonitor) {
            $('#mousey-'+screenMonitor.userId).remove();
            _toggleOffMonitor(screenMonitor);
            return true;
         },
         recordingOn: function(screenMonitor) {
            var $button = $('#'+screenMonitor.userId+' a.record');
            $button.addClass('btn-danger').find('i').removeClass('icon-play').addClass('icon-stop');
            return true;
         },
         recordingOff: function(screenMonitor) {
            var $button = $('#'+screenMonitor.userId+' a.record');
            $button.removeClass('btn-danger').find('i').removeClass('icon-stop').addClass('icon-play');
            return true;
         }
      };

      replayView = {
         created: function(replayId, replay) {
            $('#replays').append(_replayTemplate(replayId, replay));
         },
         destroyed: function(replayId, replay) {
            console.log('replay destroyed', replayId, replay);
         },
         started: function(replayId, replay) {
            console.log('replay started', replayId, replay);
         },
         finished: function(replayId, replay) {
            console.log('replay finished', replayId, replay);
         }
         //todo paused? aborted?
      };

      var screenTracker = new ScreenTrackerController(FirebaseRoot, screenTrackerView, replayView, FRAMERATE);

      myAccountLoader.then(function(user) {
         // record local screen events for others to track
         screenTracker.syncLocal(user.id);
      });

      $('#presence').on('click', '.user a.monitor', toggleMonitor).on('click', '.user a.record', toggleRecording);

      function toggleMonitor(e) {
         var $parent = $(this).parent(), id = $parent.attr('id'), activate = !$parent.hasClass('active');
         screenTracker.toggle(userController.fetch(id), activate);
      }

      function toggleRecording(e) {
         var $parent = $(this).parent(), id = $parent.attr('id'), activate = !$(this).hasClass('btn-danger');
         screenTracker.toggleRecording(userController.fetch(id), activate);
      }


   }); // end jQuery(...) run on document ready

   /** UTILITY FUNCTIONS
    **************************************************************************************************/

   function _getUserName() {
      var name = $.cookie('USER_NAME');
      if( name ) { return name; }

      name = prompt("Your name?", "Guest") || 'Guest';
      _setUserName(name);
      return name;
   }

   function _setUserName(name) {
      console.log('setting name to '+name);
      $.cookie('USER_NAME', name);
   }

   function _toggleOnMonitor(screenMonitor) {
      var $parent = $('#'+screenMonitor.userId);
      $parent.addClass('active');
      $parent.find('a.monitor').addClass('btn-primary').find('i').removeClass('icon-eye-open').addClass('icon-stop');
   }

   function _toggleOffMonitor(screenMonitor) {
      var $parent = $('#'+screenMonitor.userId);
      $parent.removeClass('active');
      $parent.find('a.monitor').removeClass('btn-primary').find('i').removeClass('icon-stop').addClass('icon-eye-open');
   }

   function userColor(userId, userController) {
      return userController.fetch(userId).color;
   }

   function xIt(loc, color) {
      var pos = $.extend({}, loc);
      var $e = $('<div class="anX user-'+color+'">X</div>').offset({top: -250, left: -250}).appendTo('body');
      pos.top -= $e.height()/2;
      pos.left -= $e.width()/2;
      $e.offset(pos).fadeOut(3000, function() { $(this).remove(); });
   }

   function _moved(currPos, lastPos) {
      return currPos.top != lastPos.top || currPos.left != lastPos.left;
   }

   function _replayTemplate(replayId, replay) {
      var duration = moment.duration(replay.stopTime - replay.startTime);
      return REPLAY_TEMPLATE
         .replace(/\{replayId\}/, replayId)
         .replace(/\{userId\}/, replay.userId)
         .replace(/\{name\}/,   replay.name)
         .replace(/\{duration\}/, duration.asHours()+':'+duration.seconds())
         .replace(/\{created\}/, moment(replay.startTime).fromNow())
      ;
   }

})(jQuery);

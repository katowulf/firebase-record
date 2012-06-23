(function($) { // localize scope

   /** CONFIGURATION
    **************************************************************************/

   var FRAMERATE = 10; // per second
   var FIREBASE_URL = 'http://gamma.firebase.com/wordspot/';

   // Prompt the user for a name to use.
   var USER_NAME = getUserName();

   // The html appearing in a user's status row
   var USER_PRESENCE_TEMPLATE = '<li><span></span>' +
      '<a class="btn btn-mini monitor" href="#"><i class="icon-eye-open"></i>track</a>' +
      '<a class="btn btn-mini record" href="#"><i class="icon-play"></i>record</a></li>';

   // the html appearing in a replay link
   var REPLAY_TEMPLATE = '<li id="replay{replayId}">{name} ({created} old) ' +
      '<a href="#" class="btn btn-mini play"><i class="icon-play"></i>{duration}</a>' +
      '<a href="#" class="btn btn-mini del"><i class="icon-remove"></i></a></li>';

   // Get a reference to the presence data in firebase.
   var FirebaseRoot = new Firebase(FIREBASE_URL);

   setIdleTimeout(5000);
   setAwayTimeout(10000);

   /** LOCAL VIEW RENDERING (RUNS ON DOCUMENT READY)
    ************************************************************************************/

   jQuery(function($) {  // run on document ready

      var myAccount, userView, userController, screenTrackerView, replayView, screenTracker;

      // the view gets callbacks from UserControl whenever an account is updated
      // and is responsible for rendering the data
      userView = {
         created: function(user) {
            var id = user.id;
            if( !$('#'+id).length ) {
               var $e = $(USER_PRESENCE_TEMPLATE)
                  .addClass('user user-'+user.color)
                  .attr('id', user.id);
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
            var id = screenMonitor.user.id;
            //todo use colors once mousey images are available
            $('<img id="mousey-'+id+'" class=".mousey" src="assets/img/pointer-arrow-yellow.png" />')
               .appendTo('body').offset(ScreenTrackerController.pos(screenMonitor.event, myAccount.id));
            toggleOnMonitor(screenMonitor);
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
            $('#mousey-'+screenMonitor.user.id).remove();
            toggleOffMonitor(screenMonitor);
            return true;
         },
         recordingOn: function(screenMonitor) {
            var $button = $('#'+screenMonitor.user.id+' a.record');
            $button.addClass('btn-danger').find('i').removeClass('icon-play').addClass('icon-stop');
            return true;
         },
         recordingOff: function(screenMonitor) {
            var $button = $('#'+screenMonitor.user.id+' a.record');
            $button.removeClass('btn-danger').find('i').removeClass('icon-stop').addClass('icon-play');
            return true;
         }
      };

      replayView = {
         created: function(replay) {
            var $replay = $(replayTemplate(replay.id, replay));
            $replay.find('.del').click(_deleteClicked);
            $replay.find('.play').click(_playClicked);
            $('#replays').append($replay);
         },
         destroyed: function(replay) {
            $('#replay'+replay.id).remove();
         },
         started: function(replay) {
            var $button = $('#replay'+replay.id).find('.play');
            // reset content, enable the user buttons
            resetScreenComponents(true, $button);
            // reset the replay button
            //todo
            console.log('replay started', replay.id, replay);
         },
         finished: function(replay) {
            var $button = $('#replay'+replay.id).find('.play');
            // reset screen content, disable user buttons
            resetScreenComponents(false, $button);
            // change the replay button to a stop icon
            //todo

            //todo call abort on replay sequence as needed

            console.log('replay ended', replay.id, replay);
         },
         next: function(replay, event) {
            console.log(event);
            //todo
            //todo
            //todo
         }
      };

      screenTracker = new ScreenTrackerController(FirebaseRoot, screenTrackerView, replayView, FRAMERATE);

      myAccountLoader.then(function(user) {
         // record local screen events for others to track
         screenTracker.syncLocal(user.id);
      });

      $('#presence').on('click', '.user a.monitor', _trackerClicked).on('click', '.user a.record', _recordClicked);

      function _trackerClicked(e) {
         var $parent = $(this).parent(), id = $parent.attr('id'), activate = !$parent.hasClass('active');
         screenTracker.toggle(userController.fetch(id), activate);
      }

      function _recordClicked(e) {
         var $parent = $(this).parent(), id = $parent.attr('id'), activate = !$(this).hasClass('btn-danger');
         screenTracker.toggleRecording(userController.fetch(id), activate);
      }

      function _playClicked(e) {
         var $button = $(this), replay = findReplay($button, screenTracker);
         (replay.running() && replay.stop()) || replay.start().then(_replaySequence);
      }

      function _deleteClicked(e) {
         var $button = $(this), replay = findReplay($button, screenTracker);
         replay.destroy();
         $button.removeData('replay');
      }

      var _currentReplay = null;
      function _replaySequence(replay, events) {
         //todo
         //todo
         //todo
         //todo
      }

   }); // end jQuery(...) run on document ready

   /** UTILITY FUNCTIONS
    **************************************************************************************************/

   function getUserName() {
      var name = $.cookie('USER_NAME');
      if( name ) { return name; }

      name = prompt("Your name?", "Guest") || 'Guest';
      setUserName(name);
      return name;
   }

   function setUserName(name) {
      console.log('setting name to '+name);
      $.cookie('USER_NAME', name);
   }

   function toggleOnMonitor(screenMonitor) {
      var $parent = $('#'+screenMonitor.user.id);
      $parent.addClass('active');
      $parent.find('a.monitor').addClass('btn-primary').find('i').removeClass('icon-eye-open').addClass('icon-stop');
   }

   function toggleOffMonitor(screenMonitor) {
      var $parent = $('#'+screenMonitor.user.id);
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

   function replayTemplate(replayId, replay) {
      var duration = moment.duration(replay.stopTime - replay.startTime);
      return REPLAY_TEMPLATE
         .replace(/\{replayId\}/, replayId)
         .replace(/\{userId\}/, replay.userId)
         .replace(/\{name\}/,   replay.name)
         .replace(/\{duration\}/, _doubleOt(duration.asHours())+':'+_doubleOt(duration.seconds()))
         .replace(/\{created\}/, moment(replay.startTime).fromNow(true))
      ;
   }

   function _doubleOt(num) {
      return pad(Math.floor(~~num), 2);
   }

   function pad(n, len) {
      var s = n.toString();
      if (s.length < len) {
         s = ('0000000000' + s).slice(-len);
      }
      return s;
   }

   function resetScreenComponents(buttonsActive, $thisButton) {
      //todo
      //todo
      //todo
   }

   function findReplay($button, screenTracker) {
      var id, data = $button.data('replay');
      if( data ) {
         return data;
      }
      else {
         return screenTracker.getReplay($button.attr('id'));
      }
   }

})(jQuery);

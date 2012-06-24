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
   var REPLAY_TEMPLATE = '<li id="replay{replayId}"><span title="{created_date}">{name} ({created})</span> ' +
      '<a href="#" class="btn btn-mini play"><i class="icon-play"></i>{duration}</a>' +
      '<a href="#" class="btn btn-mini del"><i class="icon-remove"></i></a></li>';

   // Get a reference to the presence data in firebase.
   var FirebaseRoot = new Firebase(FIREBASE_URL);

   var BOX1_ORIG_OFFSET = {top: 0, left: 0};
   var BOX2_ORIG_OFFSET = {top: 0, left: 0};

   setIdleTimeout(5000);
   setAwayTimeout(10000);

   /** LOCAL VIEW RENDERING (RUNS ON DOCUMENT READY)
    ************************************************************************************/

   jQuery(function($) {  // run on document ready

      var myAccount, userView, userController, screenTrackerView, replayView, screenTracker;
      BOX1_ORIG_OFFSET = $.extend({}, $('#box1').position());
      BOX2_ORIG_OFFSET = $.extend({}, $('#box2').position());

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
         created: function(screenMonitor) {
            var id = screenMonitor.user.id;
            mouseImage(id, screenMonitor.user.color);
            toggleOnMonitor(screenMonitor);
            return true;
         },
         updated: function(event, screenMonitor) {
            switch(event.type) {
               case 'mousemove': //fall through
               case 'click':
                  moveMouse(event, myAccount.id, userController);
                  break;
               case 'drag':
                  tempBox(event, screenMonitor.user.id, screenMonitor.user.color);
                  break;
               case 'drop':
                  clearTempBox(screenMonitor.user.id);
                  moveBox(event);
                  break;
               default:
                  console.warn('I don\'t know what to do with a '+event.type+' event');
            }
            return true;
         },
         destroyed: function(screenMonitor) {
            $('#mousey-'+screenMonitor.user.id).remove();
            $('#draggable-'+screenMonitor.user.id).remove();
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

      var SEQUENCE_CALLS = {
         'mousemove': function(replay, e) {
            replay.$mouse && replay.$mouse.offset({top:e.top, left:e.left});
         },
         'click': function(replay, e) {
            var pos = {top:e.top, left:e.left};
            replay.$mouse && replay.$mouse.offset(pos);
            xIt(pos, replay.color);
         },
         'drag': function(replay, e) {
            replay.color = replay.color || replayColor(userController, replay);
            tempBox(e, replay.userId, replay.color);
         },
         'drop': function(replay, e) {
            clearTempBox(replay.userId);
            moveBox(e);
         }
      };

      replayView = {
         created: function(replay) {
            var $replay = $(replayTemplate(replay));
            $replay.find('.del').click(_deleteClicked);
            $replay.find('.play').click(_playClicked);
            // they seem to arrive backwards
            $('#replays').prepend($replay);
         },
         destroyed: function(replay) {
            $('#replay'+replay.id).remove();
         },
         started: function(replay) {
            var $button = $('#replay'+replay.id).find('.play');
            // change the replay button to a stop icon
            $button.addClass('btn-primary').find('i').removeClass('icon-play').addClass('icon-stop');
            // reset content, disable the user buttons
            resetScreenComponents(false, $button);
            // create the arrow for this replay session
            replay.color = replay.color || replayColor(userController, replay);
            replay.$mouse = mouseImage(replay.id, replay.color);
            console.info('replay started', replay.id, replay);
         },
         finished: function(replay) {
            var $button = $('#replay'+replay.id).find('.play');
            // remove the mouse object
            replay.$mouse && replay.$mouse.remove();
            replay.$mouse = null;
            // reset screen content, enable user buttons
            resetScreenComponents(true, $button);
            // reset replay button to a play icon
            $button.removeClass('btn-primary').find('i').addClass('icon-play').removeClass('icon-stop');
            console.info('replay ended', replay.id, replay);
         }
      };

      screenTracker = new ScreenTrackerController(FirebaseRoot, screenTrackerView, replayView, FRAMERATE);

      myAccountLoader.then(function(user) {
         // record local screen events for others to track
         screenTracker.syncLocal(user.id, new DragDropContainer($('#contentbox')));
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
         var $button = $(this);
         findReplay($button, screenTracker).then(function(replay) {
            if( replay.running() ) {
               _currentSequence && _currentSequence.abort();
               _currentSequence = null;
               replay.stop();
            }
            else {
               replay.start().then(function(events) {
                  setTimeout(function() {
                     _replaySequence(replay, events);
                  }, 10);
               });
            }
         });
      }

      function _deleteClicked(e) {
         var $button = $(this);
         $button.removeData('replay');
         findReplay($button, screenTracker).then(function(replay) {
            replay.destroy();
         });
      }

      var _currentSequence = null;
      function _replaySequence(replay, events) {
         var seq = _currentSequence = $.Sequence.start(SEQUENCE_CALLS), len = events.length, i = -1, e;
         while(++i < len) {
            e = events[i];
            seq.wait(e.elapsed).run(e.type, replay, e);
         }
         seq.end()
               .fail(function(e) {
                  console.error(e);
               })
               .always(function() {
                  replay.stop();
               });
      }


      /** TRACK KEYPRESS EVENTS
       *********************************************************************/

      var keypressView = {
         received: function(event) {
            var $msg = $('<div class="message" />')
                  .hide()
                  .prependTo('#messages')
                  .append($('<h3>')
                     .text(event.name)
                     .append('<span class="pull-right">'+moment(event.created).fromNow()+'</span>')
                  )
                  .append($('<p></p>').text(event.message))
                  .addClass('new')
                  .fadeIn(500);
            setTimeout(function() {
               $msg.removeClass('new');
            }, 3000);
         },
         send: function(message) {
            $('#myMessage').stop().text('Sent!').addClass('sent').fadeOut(3000, function() { $(this).text(''); });
         },
         cancel: function() {
            $('#myMessage').stop().fadeOut('1000', function() { $(this).text(''); });
         },
         myMessage: function(message) {
            var $myMessage = $('#myMessage').text(message);
            if( !$myMessage.is(':visible') ) {
               $myMessage.fadeIn(500);
            }
         }
      };

      myAccountLoader.then(function(user) {
         new KeypressTracker(FirebaseRoot, keypressView).syncLocal(user);
      });

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
      var user = userController.fetch(userId);
      return user? user.color : null;
   }

   function replayColor(userController, replay) {
      return userColor(replay.userId, userController) || ColorPicker.nextColor();
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

   function replayTemplate(replay) {
      var duration = moment.duration(replay.stopTime - replay.startTime);
      var fromNow  = moment.duration(moment().valueOf() - replay.startTime);
      return REPLAY_TEMPLATE
         .replace(/\{replayId\}/, replay.id)
         .replace(/\{userId\}/, replay.userId)
         .replace(/\{name\}/,   replay.name)
         .replace(/\{duration\}/, _doubleOt(duration.asMinutes())+':'+_doubleOt(duration.seconds()))
         .replace(/\{created\}/, (fromNow.asMinutes() < 1? 'new' : moment(replay.startTime).fromNow()))
         .replace(/\{created_date\}/, moment(replay.startTime).format('YYYY-MM-DD HH:mm:ss'))
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
      var id = $thisButton.parent().attr('id'), $buttons = $('#statusbox .btn').not('#replay-'+id+' .play');
      //$('#contentbox textarea').val('');
      $('.dragPlaceholder').remove();
      if( buttonsActive ) {
         $buttons.off('click.replay').removeClass('disabled');
      }
      else {
         // find any users being tracked and turn them off (we can't accurately replay if other people are munging up the data)
         $('#presence .monitor.btn-primary').click();
         // find any replays currently running and abort them
         $('#replays .play.btn-primary').not($thisButton).click();
         // reset the box locations
         $('#box1').css(BOX1_ORIG_OFFSET);
         $('#box2').css(BOX2_ORIG_OFFSET);
         $buttons.on('click.replay', false).addClass('disabled');
      }
   }

   function findReplay($button, screenTracker) {
      var id, replay = $button.data('replay');
      if( replay ) {
         return $.Deferred().resolve(replay).promise();
      }
      else {
         return screenTracker.getReplay($button.parent().attr('id').substr(6)).then(function(replay) {
            $button.data('replay', replay);
         });
      }
   }

   function mouseImage(id, color, pos) {
      return $('<img id="mousey-'+id+'" class="mousey" src="assets/img/pointer-arrow-'+color+'.png" />')
            .appendTo('body').offset(pos || {top:0,left:0});
   }

   function moveMouse(event, myAccountId, userController) {
      var pos = ScreenTrackerController.pos(event, myAccountId);
      $('#mousey-'+event.userId).offset(pos);
      if( event.type == 'click' ) {
         xIt(pos, userColor(event.userId, userController));
      }
      return pos;
   }

   function tempBox(event, userId, userColor) {
      var $box = $('#'+event.target), $tmpBox = $('#draggable-'+userId);
      if( !$tmpBox.length ) { $tmpBox = $('<div class="dragPlaceholder user-'+userColor+'" id="draggable-'+userId+'"></a>'); }
      $tmpBox
            .height($box.height())
            .width($box.width())
            .appendTo('body')
            .offset({top: event.top, left: event.left});
//      var $box = $('#'+event.target);
//      $('<div class="dragPlaceholder user-'+user.color+'" id="draggable-'+user.id+'"></a>')
//            .height($box.height())
//            .width($box.width())
//            .appendTo('body')
//            .offset({top: event.top, left: event.left})
//            .fadeOut(500, function() { $(this).remove(); });
   }

   function clearTempBox(userId) {
      $('#draggable-'+userId).remove();
   }

   function moveBox(event) {
      var $target = $('#'+event.target), parentOff = $target.parent().offset(),
          pos = {top: event.top-parentOff.top, left: event.left-parentOff.left};
      $target.animate(pos, {speed: 250});
   }

})(jQuery);


var ScreenTrackerController = (function() { // localize scoping but keep the controller public

   /*****************************************************
    * ScreenMonitorController
    *
    * @param firebaseRoot
    * @constructor
    ***************************************************/
   function ScreenTrackerController(firebaseRoot, trackerView, replayView, framerate) {
      var self = this;

      // stop monitoring any user that is removed
      this.monitoredScreens = {};
      this.view = trackerView;
      this.syncInterval = Math.ceil(1000/framerate);

      // sync firebase pointers (screen trackings) with local
      this.ref = firebaseRoot.child('pointers');
      this.ref.on('child_removed', function(snapshot) {
         var pointer = snapshot.val(), id = pointer.userId;
         if( id ) { self.stop(id); }
      });

      // sync firebase recordings with local
      this.replayRef = firebaseRoot.child('replays');
      this.replayView = replayView;
      this.replayRef.on('child_removed', function(snapshot) {
         self.replayView.destroyed(snapshot.name(), snapshot.val());
      });

      this.replayRef.limit(10).on('child_added', function(snapshot) {
         var replay = snapshot.val();
         replay.id = snapshot.name();
         self.replayView.created(replay);
      });
   }

   /**
    * @param userOrId
    * @return {Boolean}
    */
   ScreenTrackerController.prototype.tracking = function(userOrId) {
      return _idFor(userOrId) in this.monitoredScreens;
   };

   /**
    * @param user
    * @param {boolean} activate
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.toggle = function(user, activate) {
      if( typeof(activate) !== 'boolean' ) { activate = this.tracking(user); }
      (activate && this.track(user)) || this.stop(user);
      return this;
   };

   /**
    * @param {string} user
    * @param {boolean} activate
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.toggleRecording = function(user, activate) {
      (activate && this.record(user)) || this.stopRecording(user.id);
      return this;
   };

   /**
    * @param {string} userId
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.stopRecording = function(userId) {
      if( this.tracking(userId) ) {
         this.monitoredScreens[userId].stopRecording(this.replayRef);
      }
      return this;
   };

   /**
    * @param {string} user
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.record = function(user) {
      if( !this.tracking(user) ) { this.track(user); }
      this.monitoredScreens[user.id].record();
      return this;
   };

   /**
    * @param user
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.track = function(user) {
      this.monitoredScreens[user.id] = new ScreenTracker(user, this.ref, this.view);
      return this;
   };

   /**
    * @param userOrId
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.stop = function(userOrId) {
      var userId = _idFor(userOrId);
      if(this.tracking(userId)) {
         this.stopRecording(userId);
         this.monitoredScreens[userId].destroy();
         delete this.monitoredScreens[userId];
      }
      return this;
   };

   ScreenTrackerController.prototype.getReplay = function(recordingId) {
      var replayView = this.replayView, ref = this.replayRef.child(recordingId);
      return Defer.now(function(def) {
         ref.once('value', function(snapshot) {
            def.resolve(new Replay(recordingId, snapshot.val(), replayView, ref));
         });
      });
   };

   /**
    * @param {string} userId
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.syncLocal = function(userId, dragDropController) {
      var ref = this.ref.child(userId);
      var currPos = {top: 0, left: 0, type: '', userId: userId, target: ''};
      var lastPos = currPos, currBoxPos = currPos, lastBoxPos = currPos;

      ref.removeOnDisconnect();

      dragDropController.monitor(function(element, e) {
         var evt = _boxEvent(e, userId);
         switch(e.type) {
            case 'drag':
               currBoxPos = evt;     // buffer drag events
               break;
            case 'dragstop':
               evt.type = 'drop';
               ref.set(evt); // report final position immediately
               break;
            default:
               console.warn('I don\'t monitor '+ e.type+' events');
         }
      });

      // track mouse movement
      $(document).on('mousemove', function(e) {
         currPos = _event(e, userId);
      });

      // report clicks immediately
      $(document).on('click', function(e) {
         lastPos = currPos = _event(e, userId);
         ref.set(currPos);
      });

      // buffer updates by only checking the events occasionally
      setInterval(function() {
         if( _moved(currBoxPos, lastBoxPos) ) {
            // box drag event
            lastBoxPos = currBoxPos;
            ref.set(currBoxPos);
         }
         if( _moved(currPos, lastPos) ) {
            // mouse move event
            lastPos = currPos;
            ref.set(currPos);
         }
      }, this.syncInterval);

      return this;
   };

   ScreenTrackerController.pos = function(trackerEvent, localUserId) {
      var out = {top: trackerEvent.top, left: trackerEvent.left};
      if( trackerEvent.userId === localUserId ) {
         // if tracking own mouse, offset it just enough so that clicks work
         out.top += 5;
         out.left += 5;
      }
      return out;
   };

   function _event(e, userId) {
      return {top: e.pageY, left: e.pageX, type: e.type, userId: userId, target: $(e.target).attr('id')||null};
   }

   function _boxEvent(e, userId) {
      var res = _event(e, userId), pos = $(e.target).offset();
      res.top = pos.top;
      res.left = pos.left;
      return res;
   }

   function _moved(currPos, lastPos) {
      return currPos.top != lastPos.top || currPos.left != lastPos.left;
   }

   /*****************************************************
    * ScreenMonitor
    *
    * @param user
    * @constructor
    ***************************************************/
   function ScreenTracker(user, pointersRefList, view) {
      var self = this, userId = user.id;
      this.user   = user;
      this.view   = view;
      this.event  = {top: 0, left: 0, type: '', userId: userId, target: ''};
      this.ref    = pointersRefList.child(userId);
      this.replay = null;

      var trackFxn = function(snapshot) {
         var e = snapshot.val();
         if( e ) {
            self.event = e;
            self.view.updated(e, self);
            self.replay && self.replay.events.push(_replayEvent(self.replay, e));
         }
      };

      this.ref.on('value', trackFxn);

      this.destroy = function() {
         this.stopRecording();
         self.ref.off('value', trackFxn);
         view.destroyed(self);
      };

      view.created(this);
   }

   function _replayEvent(replay, e) {
      var ms = new Date().valueOf();
      return{created: ms, elapsed: _elapsed(ms, replay), type: e.type, top: e.top, left: e.left, target: e.target||null};
   }

   function _elapsed(ms, replay) {
      var len = replay && replay.events? replay.events.length : 0;
      return len? ms - replay.events[len-1].created : 0;
   }

   ScreenTracker.prototype.record = function() {
      this.replay = {userId: this.user.id, name: this.user.name, startTime: new Date().valueOf(), events: []};
      this.view.recordingOn(this);
   };

   ScreenTracker.prototype.stopRecording = function(replayRef) {
      var replay = this.replay;
      if( replay ) {
         this.replay = null;
         replay.stopTime = new Date().valueOf();
         replayRef.push(replay);
         this.view.recordingOff(this);
      }
   };

   /*****************************************************
    * Replay
    *
    * @param {object} props
    * @param {object} view
    * @constructor
    ***************************************************/
   function Replay(id, props, view, ref) {
      var self = this;
      console.log('building replay', props);
      this.name      = props.name;
      this.startTime = props.startTime;
      this.endTime   = props.endTime;
      this.userId    = props.userId;
      this.view = view;
      this.id = id;
      this.isRunning = false;

      this.destroy = Defer.fx(function(def) {
         self.view.destroyed(self);
         ref.remove(function() { def.resolve(id); });
      });

      this.getEvents = Defer.fx(function(def) {
         ref.child('events').once('value', function(snapshot) {
            def.resolve(snapshot.val());
         });
      });
   }
   Replay.prototype.running = function() { return this.isRunning; };
   Replay.prototype.start = function() {
      if( !this.isRunning ) {
         var self = this;
         this.isRunning = true;
         this.view.started(self);
         return this.getEvents();
      }
      else {
         return $.Deferred().reject('not running').promise();
      }
   };
   Replay.prototype.stop = function() {
      if( this.isRunning ) {
         this.isRunning = false;
         this.view.finished(this);
      }
      return this;
   };

   return ScreenTrackerController; // assign the controller function to the public var


   /** UTILITIES */

   function _idFor(userOrId) {
      return typeof(userOrId) === 'object'? userOrId.id : userOrId;
   }

})();

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
         self.replayView.created(snapshot.name(), snapshot.val());
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
      var replayView = this.replayView, replayRecord = this.replayRef.child(recordingId);
      return new Replay(replayRecord, replayView);
   };

   /**
    * @param {string} userId
    * @return {ScreenTrackerController}
    */
   ScreenTrackerController.prototype.syncLocal = function(userId) {
      var ref = this.ref.child(userId);
      var currPos = {top: 0, left: 0, type: '', userId: userId};
      var lastPos = {top: 0, left: 0, type: '', userId: userId};

      ref.removeOnDisconnect();

      // track mouse movement
      $(document).on('mousemove', function(e) {
         currPos = _event(e, userId);
      });

      // report clicks immediately
      $(document).on('click', function(e) {
         lastPos = currPos = _event(e, userId);
         ref.set(currPos);
      });

      // buffer updates by only checking the mouse position occasionally
      setInterval(function() {
         if( _moved(currPos, lastPos) ) {
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
      return {top: e.clientY, left: e.clientX, type: e.type, userId: userId};
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
      this.event  = {top: 0, left: 0, type: '', userId: userId};
      this.ref    = pointersRefList.child(userId);
      this.replay = null;

      var trackFxn = function(snapshot) {
         var e = snapshot.val();
         if( e ) {
            self.event = e;
            self.view.updated(e);
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
      return{created: ms, elapsed: _elapsed(ms, replay), type: e.type, top: e.top, left: e.left};
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
    * @param {object} record
    * @param {object} view
    * @constructor
    ***************************************************/
   function Replay(record, view) {
      var rec = record.val(), self = this;
      this.name      = rec.name;
      this.startTime = rec.startTime;
      this.endTime   = rec.endTime;
      this.userId    = rec.userId;
      this.view = view;
      this.id = record.name();
      this.isRunning = false;
      this.destroy = function() {
         var def = $.Deferred();
         record.remove(function() { def.resolve(); });
         return def.promise();
      };
      this.getEvents = function() {
         var def = $.Deferred();
         record.child('events').once('value', function(snapshot) {
            def.resolve(self, snapshot.val());
         });
         return def.promise();
      }
   }
   Replay.prototype.running = function() { return this.isRunning; };
   Replay.prototype.start = function() {
      var self = this;
      this.isRunning = true;
      return this.getEvents().then(function() {
         this.view.started(self);
      });
   };
   Replay.prototype.stop = function() {
      this.isRunning = false;
      this.view.finished(this);
   };

   return ScreenTrackerController; // assign the controller function to the public var


   /** UTILITIES */

   function _idFor(userOrId) {
      return typeof(userOrId) === 'object'? userOrId.id : userOrId;
   }

})();
/**
 * @param {Firebase} firebaseRoot
 * @param {object}   userView
 * @constructor
 */
var UserController = (function($) { // localized scoping but keep UserController public

   /*****************************************************
    * UserControl
    *
    * @param {Firebase} firebaseRoot
    * @param {object}   view
    * @constructor
    ***************************************************/
   function UserController(firebaseRoot, view) {
      this.userRefList   = firebaseRoot.child('user');
      this.idCounter     = new IncrementalIdGenerator(firebaseRoot, 'userIdCounter');
      this.view          = view;
      this.users         = [];
      this.defaultStatus = UserController.STATUS_ONLINE;

      var self = this;
      this.userRefList.on('child_added', function(snapshot) {
         var user = snapshot.val();
         if( user ) {
            if( user.id && self.fetch(user.id) ) {
               self.fetch(user.id).updated(snapshot);
            }
            else {
               self.create(user);
            }
         }
      });

      this.userRefList.on('child_removed', function(snapshot) {
         self.remove(snapshot.val().id);
      });
   }

   UserController.STATUS_ONLINE = '<span class="label label-success">★  online</label>';
   UserController.STATUS_IDLE   = '<span class="label label-warning">☆ idle</label>';
   UserController.STATUS_AWAY   = '<span class="label">☄ away</label>';

   UserController.prototype.fetch = function(userId) { return this.users[userId]; };
   UserController.prototype.create = function(props) {
      var self = this, user = new User(this, props);
      return user.ready().then(function() {
         self.users[user.id] = user;
      });
   };
//   UserController.prototype.load = function(userId) {
//      if( userId in this.users ) { return $.Deferred().resolve(this.users[userId]).promise(); }
//      else {
//         var def = $.Deferred(), self = this;
//         this.userRefList.child(userId).once('value', function(snapshot) {
//            var user = snapshot.val(), exists = user !== null;
//            if( exists ) { self.users[userId] = user; }
//            def.resolve(user);
//         });
//         return def.promise();
//      }
//   };
   UserController.prototype.remove = function(userId) {
      var user = this.fetch(userId);
      user && delete this.users[userId];
      user && user.removed();
      return this;
   };
   UserController.prototype.newId = function() {
      return this.idCounter.create();
   };

   /*****************************************************
    * User
    *
    * @param controller
    * @param props
    * @constructor
    ***************************************************/
   function User(controller, props) {
      if( typeof(props) === 'string' ) { props = {name: props}; }
      var self = this;
      // create a new unique id if necessary
      this.name   = props.name;
      this.status = props.status || controller.defaultStatus;
      this.view   = controller.view;
      this.color  = ColorPicker.nextColor(); // assign each user a color
      this.def    = $.Deferred();
      console.log(this.name+'\'s color is '+this.color);

      // determining the Id may require a callback, so we use a deferred/promise pattern
      _loadUserId(controller, props).then(function(id) {
         // store the id
         self.id = id;

         // load or create the new record in Firebase
         self.ref = controller.userRefList.child(id);

         if( self.name == 'Guest' ) {
            self.name = 'Guest_'+id;
         }

         // fulfill the promise (the user is ready)
         self.def.resolve(self);

         // add user to the view
         self.view.created(self);

         // listen for changes
         self.ref.on('value', function(snapshot) { self.updated.call(self, snapshot); });
      });
   }

   User.prototype.ready   = function() { return this.def.promise(); };
   User.prototype.sync = function() {
      this.ref.set({
         id: this.id,
         name: this.name,
         status: this.status
      });
   };
   User.prototype.updated = function(snapshot) {
      var vals = snapshot.val();
      if( vals !== null ) {
         this.name   = vals.name;
         this.status = vals.status;
         this.view.updated(this);
      }
   };
   User.prototype.removed = function() {
      this.ref.off('value', this.updated);
      this.view.destroyed(this);
   };

   /**
    * @param {UserController} controller
    * @param {object} props
    * @return {jQuery.Deferred} promise
    * @private
    */
   function _loadUserId(controller, props) {
      if( 'id' in props ) {
         return $.Deferred().resolve(props.id).promise();
      }
      else {
         return controller.newId();
      }
   }

   return UserController;

})(jQuery);
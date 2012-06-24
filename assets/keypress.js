
var KeypressTracker = (function($) {

   function KeypressTracker(firebaseRoot, viewController) {
      this.message = '';
      this.ref     = firebaseRoot.child('messages');
      this.view    = viewController;

      // collect messages and display them
      var self = this;
      this.ref.limit(5).on('child_added', function(snapshot) {
         self.view.received(snapshot.val());
      });
   }

   KeypressTracker.prototype.syncLocal = function(user) {
      $(document).on('keypress', function(e) {
         var message, undef;
         switch(e.keyCode){
            case $.ui.keyCode.ENTER:
               e.preventDefault();
               if( self.message.length ) {
                  self.ref.push({userId: user.id, name: user.name, created: moment().valueOf(), message: self.message});
                  self.view.send();
               }
               self.message = '';
               break;
            case $.ui.keyCode.ESCAPE:
               message = '';
               break;
            case $.ui.keyCode.BACKSPACE:
               message = self.message.substr(0, self.message.length-1);
               if( !message.length ) { self.view.cancel(); }
               break;
            default:
               if(e.which !== 0) {
                  message = self.message + String.fromCharCode(e.which);
               }
         }
         if( message !== undef ) {
            e.preventDefault();
            self.message = message;
            if( message ) { self.view.myMessage(message); }
            else { self.view.cancel(); }
         }
      });
      var self = this;
   };

   return KeypressTracker;

})(jQuery);
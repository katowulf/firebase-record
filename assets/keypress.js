
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
      var self = this;
      // keypress doesn't work for control keys in Chrome, so we need two functions
      // keypress to handle ascii chars and keydown to handle control keys
      $(document).on('keydown', function(e) {
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
               e.preventDefault();
               self.message = '';
               self.view.cancel();
               break;
            case $.ui.keyCode.BACKSPACE:
               e.preventDefault();
               self.message = self.message.substr(0, self.message.length-1);
               self.view.myMessage(self.message);
               if( !self.message.length ) { self.view.cancel(); }
               break;
            default:
               // nothing to do
         }
      });
      $(document).on('keypress', function(e) {
         var message;
         if(e.which !== 0) {
            e.preventDefault();
            // it's an ascii character (something we can display)
            // so update the message
            message = self.message = self.message + String.fromCharCode(e.which);
            self.view.myMessage(message);
         }
      });
   };

   return KeypressTracker;

})(jQuery);
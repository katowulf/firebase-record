
/*****************************************************
 * IncrementalIdGenerator
 *
 * @param firebaseRoot
 * @param idCounterKey
 * @constructor
 ****************************************************/
function IncrementalIdGenerator(firebaseRoot, idCounterKey) {
   var self = this;
   self.ref = firebaseRoot.child(idCounterKey);

   /**
    * Create a new ID (the next one in sequence)
    * @return {jQuery.Deferred} promise
    */
   this.create = function() {
      var def = $.Deferred();
      self.ref.once('value', function(snapshot) {
         var idCounter = ~~snapshot.val();
         def.resolve(++idCounter);
         self.ref.set(idCounter);
      });
      return def.promise();
   };
}

/*****************************************************
 * ColorPicker
 *
 * @constructor
 ***************************************************/
var ColorPicker = (function() {
   var availColors = ['green', 'blue', 'purple', 'orange', 'red', 'gray', 'black', 'yellow', 'white'];
   var currColor = 0;
   var max = availColors.length-1;
   return {
      /**
       * @return {string}
       */
      nextColor: function() {
         if( currColor > max ) { currColor = 0; }
         return availColors[currColor++];
      }
   };
})();
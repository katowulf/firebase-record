
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
 * DeferThis
 *
 * @static
 ***************************************************/
var Defer = {
   /**
    * @param {Function} fx
    * @return {Function}
    */
   fx: function(fx) {
      return function() { return Defer.now(fx); }
   },

   /**
    * @param {Function} fx
    * @return {jQuery.Deferred} promise
    */
   now: function(fx) {
      var def = $.Deferred();
      fx(def);
      return def.promise();
   }
};



/*****************************************************
 * ColorPicker
 *
 * @constructor
 ***************************************************/
var ColorPicker = (function() {
   var availColors = ['green', 'orange', 'blue', 'red', 'purple', 'gray', 'black', 'yellow', 'white'];
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
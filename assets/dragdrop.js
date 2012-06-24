
var DragDropContainer = (function($) {

   function DragDropContainer($container) {
      this.$draggables = $('.drag', $container).draggable({ containment: $container });
   }

   DragDropContainer.prototype.monitor = function(callback) {
      this.$draggables.bind( "drag", function(event, ui) {
         callback(this, event);
      });
      this.$draggables.bind( "dragstop", function(event, ui) {
         callback(this, event);
      });
   };

   return DragDropContainer;

})(jQuery);

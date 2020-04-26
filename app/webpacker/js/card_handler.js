(function() {
  $(document).on("card_handler_start", function(e, raw_game){
    new CardHandler(raw_game);
  })

  var CardHandler = function(raw_game){
    var game = $(raw_game);
    var correctCards = 0;
    var player_action_path;
    var hand;

    var init = function(){
      player_action_path = game.data("playerPath");
      hand = game.find("#hand"); 

      hand.on("click", ".playing_card", card_in_hand_clicked)
     
      game.find(".playing_card.played").each(function(i, card){
        card = $(card);
        if(card.data('suit')){
          //card.trigger("draw_card");
          window.draw_card(card);
        }
      });
    
      setup_drag_and_drop();
    }
    
    var setup_drag_and_drop = function(){
      return;
      game.find('.table-card-0').droppable({
        accept: '#hand div',
        hoverClass: 'hovered',
        drop: testDrop
      });
    
      // Create the card slots
      var words = [ 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten' ];
      // TODO: drag and drop not working
      for ( var i=1; i<=10; i++ ) {
        $('<div>' + words[i-1] + '</div>').data( 'number', i ).appendTo( '#cardSlots' ).droppable( {
          accept: '#hand .playing_card',
          hoverClass: 'hovered',
          drop: handleCardDrop
        });
      }
    }

    var card_in_hand_clicked = function(e){
      if(hand.find(".playing").length > 0){ return; } // already played a card
      var card = $(e.target);
  
      if(card.hasClass("selected")){
        card.addClass("playing");
        playCard(e);
      } else {
        hand.find(".selected").removeClass("selected");
        card.addClass("selected");
      }
    };
    
    function playCard(event) {
      var card = $(event.target);
      // only accept playable cards
      // Note: use server for validation with more precise messaging
      // instead of js flag here
      /*
      var playable  = card.data("playable");
        if(false && !playable) {
          hand.find(".playing").removeClass("playing")
          // TODO: add reason
          window.show_game_message(
            "You can't play this card right now!" // Not your turn/You have to bid/follow suit."
          );
          return;
        }
        */
        
        var suit = card.data('suit');
        var value = card.data('actualvalue'); // TODO: remove actual value - just extra complexity

        var to_card = game.find(".table-card-0")
        to_card.data("suit", card.data('suit'));
        to_card.data("value", card.data('value'));
        to_card.trigger("draw_card");

        $.ajax({
          url: player_action_path + ".json", 
          type: "POST", 
          data: {suit: suit, value: value},
          success: card_played,
          error: failed
        });

    }

    var failed = function(){
      show_failure("Failed to make action. Please refresh page")
    }

    var card_played = function(data){
      if(data['html']){
        window.new_board = data;
        window.load_new_board();
      } else {// expect message
        show_failure(data['message'] || "Unknown error, please refresh page")
      }
    };

    var show_failure = function(message){
      hand.find(".playing").removeClass("playing")
      $(document).trigger("card_handler_clear_bottom")
      window.show_game_message(message)
    }
    
    function testDrop(event, ui) {
      ui.draggable.addClass( 'correct' );
      ui.draggable.draggable( 'disable' );
      $(this).droppable( 'disable' );
      ui.draggable.position( { of: $(this), my: 'left top', at: 'left top' } );
      ui.draggable.draggable( 'option', 'revert', false );
      var cardSuit = ui.draggable.context.children[0].dataset.suit;
      var cardValue = ui.draggable.context.children[0].dataset.actualvalue;
      $.ajax({
        url: player_action_path + ".json", 
        type: "POST", 
        data: {suit: cardSuit, value: cardValue},
        success: card_played,
        error: failed
      });
    }
    
    function handleCardDrop( event, ui ) {
      var slotNumber = $(this).data( 'number' );
      var cardNumber = ui.draggable.data( 'number' );
     
      // If the card was dropped to the correct slot,
      // change the card colour, position it directly
      // on top of the slot, and prevent it being dragged
      // again
     
      if ( slotNumber == cardNumber ) {
        ui.draggable.addClass( 'correct' );
        ui.draggable.draggable( 'disable' );
        $(this).droppable( 'disable' );
        ui.draggable.position( { of: $(this), my: 'left top', at: 'left top' } );
        ui.draggable.draggable( 'option', 'revert', false );
        correctCards++;
      } 
       
    }

    init();
  }
}).call(this);

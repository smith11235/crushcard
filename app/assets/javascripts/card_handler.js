CardHandler = function(){
    var correctCards = 0;

    var d = $("#game_path")
    var game_id = d.data("id");
    var played_cards = d.data("table"); 
    var dealt_cards = d.data("dealt");
console.log("hands");
console.log(dealt_cards);
    var player_action_path = d.data("playerPath")

    var init = function(){
      $('#successMessage').css( {
        left: '580px',
        top: '250px',
        width: 0,
        height: 0
      } );
     
      // Reset the game
      correctCards = 0;
      //$('#cardPile').html( '' );
      $('#cardSlots').html( '' );
     
      // Create the pile of shuffled cards
      var numbers = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
      numbers.sort( function() { return Math.random() - .5 } );

      $.each(dealt_cards, function(i, card){
        console.log("Drawing Hand Card: " + i);
console.log(card);

        $("#card"+i).click(function(event) {
          if($(this).hasClass("selected")) {
            playCard(event);
          }
          $(this).addClass("selected");
          $(this).siblings().removeClass("selected");
          $(this).css({"background":"blue"});
          $(this).siblings().css({"background":"white"});
        });
        var currentCanvas = document.getElementById("canv"+i);
console.log("Canvas? canv"+i);
console.log(currentCanvas);

        DrawCard.draw_card(currentCanvas.dataset.suit, currentCanvas.dataset.value, "canv"+i);
      });
    
      $('#bottom').droppable( {
        accept: '#cardPile div',
        hoverClass: 'hovered',
        drop: testDrop
      } );
    
     
      // Create the card slots
      var words = [ 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten' ];
      for ( var i=1; i<=10; i++ ) {
        $('<div>' + words[i-1] + '</div>').data( 'number', i ).appendTo( '#cardSlots' ).droppable( {
          accept: '#cardPile div',
          hoverClass: 'hovered',
          drop: handleCardDrop
        } );
      }

      $.each(played_cards, function(i, card){
        DrawCard.draw_card(card[0], card[1], card[2]);
      });
    }
    
    function playCard(event) {
        // only accept playable cards
        var cardIsPlayable = event.target.getAttribute('data-playable');
        if(!(/true/i).test(cardIsPlayable)) {
          alert("You can't play this card right now!");
          return;
        }
    
        var cardSuit = event.target.getAttribute('data-suit');
        var cardValue = event.target.getAttribute('data-actualvalue');
        $.ajax({url: player_action_path, type: "POST", data: {id: game_id, suit: cardSuit, value: cardValue}});

    }
    
    function testDrop(event, ui) {
        // only accept playable cards
        var cardIsPlayable = ui.draggable.context.children[0].dataset.playable;
        if(!(/true/i).test(cardIsPlayable)) {
          alert("You can't play this card right now!");
          return;
        }
    
        ui.draggable.addClass( 'correct' );
        ui.draggable.draggable( 'disable' );
        $(this).droppable( 'disable' );
        ui.draggable.position( { of: $(this), my: 'left top', at: 'left top' } );
        ui.draggable.draggable( 'option', 'revert', false );
        var cardSuit = ui.draggable.context.children[0].dataset.suit;
        var cardValue = ui.draggable.context.children[0].dataset.actualvalue;
        $.ajax({url: player_action_path, type: "POST", data: {id: game_id, suit: cardSuit, value: cardValue}});
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
       
      // If all the cards have been placed correctly then display a message
      // and reset the cards for another go
     
      if ( correctCards == 10 ) {
        $('#successMessage').removeClass("hidden");
        $('#successMessage').animate({
          left: '380px',
          top: '200px',
          width: '400px',
          height: '100px',
          opacity: 1
        });
      }
     
    }

  init();
}

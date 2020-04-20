(function() {
  window.new_board = null;
	window.game = null;

  window.load_new_board = function() {
	  if(window['game']){
      window.game.stop();
   	}
    var board = $(window.new_board['html']);
    $(document).trigger("card_handler_start", board)
		if(window['game']){
      $('#game-wrapper').html(board);
		}
    window.game = new Game(board); // and remove this

    /*
    if (window.new_board['video'] && window.new_board.video.length > 0) {
      return $(document).trigger("vidchat_message", {
        streams: window.new_board.video
      });
    }
    */
  };
  window.show_game_message = function(message){
    var msg = $('#game-wrapper .message');
    msg.find(".text").html(message);
    msg.removeClass("hidden");
    msg.find("a").focus();
    msg.one("click", "a", function(e) {
      e.preventDefault();
      $('#game-wrapper .message').addClass("hidden");
      return false;
    });
  }

  var Game = function(game){
    var stopped = null;
    var config = null;

    var init = function(){
      stopped = false;
      config = game.data();

      if (config.poll === true) {
        wait_and_poll();
      }
      game.find(".start_game").on('click', start_game_clicked);
      game.find(".start_game").focus();
      game.find(".bid_form a").on('click', bid_clicked);
      game.find(".bid_form input").focus();
      game.find("a.clear_hand").on('click', deal_clicked);
      game.find("a.clear_hand").focus();
      $(document).find(".join_game button").on('click', add_player_clicked);
      game.find(".morph").on('click', morph_clicked);
      if (!config.poll) {
        $(document).on("poll_for_update", get_updated_board);
      }
      if (game.data("chime")) {
        chime();
      }
    }
    var stop = function(){
      stopped = true;
    };
    this.stop = stop;

    var chime = function(){
      var audio, sound;
      sound = $(document).find(".youre_up_bell").data("src");
      audio = new Audio(sound);
      audio.volume = 0.05;
      audio.play();
    };
    var morph_clicked = function(e){
      e.preventDefault();
      var index = $(document).find(".morph_form #index").val();
      $.ajax($(e.target).data('url'), {
        data: {
          index: index
        },
        method: "POST",
        success: success,
        error: failed
      });
      return false;
    };
    var deal_clicked = function(e) {
      var path;
      e.preventDefault();
      path = $(e.target).data('url');
      $.ajax(path, {
        method: "POST",
        success: success,
        error: failed
      });
      return false;
    };
    var bid_clicked = function(e) {
      var bid;
      e.preventDefault();
      bid = game.find(".bid_form #bid").val();
      $.ajax(config.playerPath, {
        data: {
          bid: bid
        },
        method: "POST",
        success: success,
        error: failed
      });
      return false;
    };
    var start_game_clicked = function(e) {
      var path;
      e.preventDefault();
      path = $(e.target).data('url');
      $.ajax(path, {
        method: "POST",
        success: success,
        error: failed
      });
      return false;
    };
    var add_player_clicked = function(e) {
      var jg, path, username;
      jg = $(document).find(".join_game");
      username = jg.find("#username").val();
      if (username && username.length >= 0) {
        jg.addClass("hidden");
        path = jg.data("url");
        $.ajax(path, {
          data: {
            username: username
          },
          method: "POST",
          success: success,
          error: failed
        });
      } else {
        window.show_game_message("Must set a name for yourself");
      }
    };
    var get_updated_board = function(){
      if (stopped) {
        return;
      }
      $.ajax({
        url: config.url + "&updated=" + config.updated,
        method: "GET",
        success: success,
        error: failed
      });
    };
    var wait_and_poll = function() {
      setTimeout(get_updated_board, 2000);
    };
    var success = function(data){
      if (data && data['html']) {
        window.new_board = data;
        window.load_new_board();
      } else if (data && data['message']) {
        window.show_game_message(data['message']);
      } else {
        wait_and_poll();
      }
    };
    var failed = function() {
      window.show_game_message("Failed to update game, please refresh page.");
    }
    init();
  };

}).call(this);

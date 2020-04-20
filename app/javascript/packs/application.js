/* eslint no-console:0 */
// This file is automatically compiled by Webpack, along with any other files
// present in this directory. You're encouraged to place your actual application logic in
// a relevant structure within app/javascript and only use these pack files to reference
// that code so it'll be compiled.
//
// To reference this file, add <%= javascript_pack_tag 'application' %> to the appropriate
// layout file, like app/views/layouts/application.html.erb


// Uncomment to copy all static images under ../images to the output folder and reference
// them with the image_pack_tag helper in views (e.g <%= image_pack_tag 'rails.png' %>)
// or the `imagePath` JavaScript helper below.
//
// const images = require.context('../images', true)
// const imagePath = (name) => images(name, true)

require("@rails/ujs").start()
require("channels")
require("jquery-ui-dist/jquery-ui")
//require('bootstrap')
require('../src/grayscale.js') // homepage ui helper
require('../src/draw_card.js')
require('../src/card_handler.js')
require('../src/game.js') //.coffee for source
//import '../src/vidchat.js' // TODO
// activestorage
// channels

$(function() {
  var game = $("#game");
  if(game.length > 0){
	  window.new_board = { html: game[0] };
    window.load_new_board();
    //new Vidchat();
  }
});

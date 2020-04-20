const { environment } = require('@rails/webpacker')

const webpack = require('webpack');

environment.plugins.append('Provide', new webpack.ProvidePlugin({
  $: 'jquery',
  jQuery: 'jquery'
}));

//import jquery_ujs
//import jquery-ui
//import twitter/bootstrap
module.exports = environment;

$(function() {
  $(window).scroll(function() {
    var navbar = $(".navbar");
    if(navbar.offset().top > 50){
      navbar.addClass("fixed");
    } else {
      navbar.removeClass("fixed");
    }
  });

  // TODO: only on homepage
  $('a.page-scroll').bind('click', function(event) {
    event.preventDefault();
    var $anchor = $(this);
    $('html, body').stop().animate({
        scrollTop: $($anchor.attr('href')).offset().top
    }, 1500, 'easeInOutExpo');
    return false;
  });
});

(function() {
  $(document).find("#score_history").on("click", function(e){
    e.preventDefault();
    var target = $(e.target);
    if(target.attr("id") !== "score_history"){
      target = target.parents("#score_history");
    }
    var url = target.data("url");
    console.log("Scores!: ", target, url);
      
    $.ajax(url, {
      method: "POST",
      success: function(data){
        console.log("Scores response", data);
        var modal = $(data['html']);
        $(document).find("#scores_wrapper").html(modal);
        modal.modal("show");
      }
    });

    return false;
  });
}).call(this);

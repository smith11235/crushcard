Rails.application.routes.draw do
  # For details on the DSL available within this file, see https://guides.rubyonrails.org/routing.html
  #get '/robots', formats: [:txt], to: "games#robots"
  get '/sitemap', formats: [:xml], to: "games#sitemap"

  resources :games, only: [:index, :show, :new, :create], path: "/" do
    member do
      post 'add_player', format: [:json]
      post 'start', formats: [:json]
      post 'deal', formats: [:json]
      post 'player_action', formats: [:json]
      post 'scores', formats: [:json]
      get 'toggle_hints'

      post 'morph', formats: [:json] # debug helper
      get 'morph' # user switching from chrome to safari for vidchat
    end
  end

  # TODO: convert these to member calls
  post 'games/add_cpu_player'

  # The priority is based upon order of creation: first created -> highest priority.
  # See how all your routes lay out with "rake routes".

  # You can have the root of your site routed with "root"
  root 'games#index'

end

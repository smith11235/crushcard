require_relative 'boot'

require 'rails/all'

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Crushcard
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 5.0

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration can go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded after loading
    # the framework and any gems in your application.

    #config.hosts << nil # allow any domain - development and prod
    config.hosts.clear


    #config.action_cable.mount_path = '/websocket'
    if Rails.env.production?
      config.action_cable.allowed_request_origins = ['http(s)?:\/\/tishnow.com']
    else
      puts "Allow action cable from all hosts".red
      config.action_cable.disable_request_forgery_protection = true
    end
  end
end

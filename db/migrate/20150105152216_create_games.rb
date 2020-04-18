class CreateGames < ActiveRecord::Migration[4.2]
  def change
    create_table :games do |t|
      t.timestamps
    end
    add_column :games, :name, :string
    add_column :games, :state, :text # TODO: json
  end
end

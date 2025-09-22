Just for testing model's communication

        class App.AllRobots extends Backbone.Collection
            model:App.RobotURDF

        class App.AllCSVs extends Backbone.Collection

RobotURDF is a true Backbone Model, communicating with App Engine Server
        class App.RobotURDF extends Backbone.Model

        App.usersrobots=new App.AllRobots()
        App.usersrobots.url="/robots"
        App.currentrobot= new App.RobotURDF()
        App.currentrobot

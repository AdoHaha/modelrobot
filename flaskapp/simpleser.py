#!/usr/bin/env python
from flask import Flask
import flask
app = Flask(__name__)

#flask.url_for('static', filename='style.css')
@app.route("/")
def hello():
    return flask.render_template('templates/index.html', )
    #return "Hello World!"

@app.route("/<folder>/<nazwapliku>")
def staticrender(folder,nazwapliku):
    ciag=folder+"/"+nazwapliku
    #return flask.render_template(ciag)
    return flask.send_from_directory(app.static_folder, ciag)
if __name__ == "__main__":
    app.run(debug=True)
